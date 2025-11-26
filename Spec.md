# MDC Syntax Specification (v1)

**Status:** Draft
**Purpose:** Define the Markdown Component (MDC) syntax — a Markdown extension that allows embedding Vue-style components and attribute bindings inside Markdown documents.

---

## 1. Overview

MDC extends **CommonMark** with **GFM (GitHub Flavored Markdown)** features and introduces new syntaxes for:

- Embedding **Vue-style components** inside Markdown.
- Adding **attributes and bindings** to Markdown elements.
- Using **document frontmatter** as a data scope for interpolation and binding.
- Defining **multiple slots** inside components.

This specification defines the syntax and semantics of MDC.  
Compilation and rendering behavior are **out of scope**, though an informative section describes the intended model.

---

## 2. Baseline and Compatibility

- **Base:** CommonMark  
- **Extensions:** GFM (tables, strikethrough, task lists, etc.)  
- **Inline HTML:** Fully supported inside MDC documents.  
- MDC components coexist with Markdown and inline HTML.

---

## 3. Frontmatter

MDC supports YAML frontmatter by default:

```md
---
title: Example
type: Article
---
```

Frontmatter defines document-level metadata and acts as the **data scope** for interpolation and bound attributes.

---

## 4. Component Syntax

### 4.1 Block Components

Block components use directive-style delimiters.

```md
::component-name{attr="value" .class #id}
Inner Markdown (default slot)
::
```

#### Rules

- **Name:** Supports `kebab-case` or `camelCase`.  
  Prefer `kebab-case` for HTML-like consistency.
- **Delimiters:** `::` opens and closes a block.  
  Parser **may** accept `:::` for readability if both sides match, but `::` is the canonical form.
- **Attributes (`{...}`):**
  - Props: `key="value"`, `key=value`, `key` (boolean true), `key=false`, `key=null`
  - Class shorthand: `.class` (repeatable)
  - ID shorthand: `#id` (one only)
  - Bound attributes: `{:prop="value"}`
- **Content:** Parsed as Markdown and passed as the component’s **default slot**.

#### YAML Attributes

A YAML-style attribute block may appear immediately after the opener:

```md
::MyComponent
---
attr: "value"
attr2: 21
---
Body content
::
```

**Precedence rule:** YAML attributes **override inline `{...}` attributes**.  
No merging is performed (includes `class` and `id`).

#### Multiple Slots

```md
::my-component
Default slot

#title
Title slot

#description
Description slot
::
```

- `#slotName` starts a new named slot.
- Everything before the first `#slot` is the default slot.
- Unknown slot names are **ignored** during rendering.
- Duplicate slot names are **concatenated in order**.
- Leading/trailing blank lines in each slot are **trimmed**.

#### Nesting

```md
::parent
  ::child
  text
  ::
::
```

Components can nest freely.

If an opener is not closed, **the rest of the file** becomes the child content of that component.

---

### 4.2 Inline Components

Inline components use a single colon `:`.

#### Forms

| Form | Example | Description |
|------|--------|-------------|
| Bare | `This is a :inline-component.` | Inline component without attributes or content. |
| With attributes | `hello :world{.text-red-500}` | Adds attributes to inline component. |
| With content and attributes | `This is the :em[Best]{color="green"}` | Content goes in `[...]` (default slot). |

#### Grammar

```mdc
:name[content]{attributes}
```

- Both `[content]` and `{attributes}` are optional.
- Only the **default slot** is supported inline.
- Component names may be `kebab-case` or `camelCase` (prefer `kebab-case`).

---

## 5. Attributes on Markdown Elements

Attributes may be attached to **inline** Markdown elements:

```md
**bold**{.emph data-x=1}
`code`{#token .pill title="Copy me"}
[label](https://x.y){target="_blank" rel="noreferrer"}
__hi__{#id}
![image](https://){#id}
```

### Attributes Rules

- Only **inline elements** support attributes.
- **Block elements** (headings, lists, tables, fenced code blocks, paragraph containers, etc.) **do not**.
- Attributes follow the same grammar as component attributes.
- Shorthands: `.class`, `#id`
- Unknown keys pass through as HTML attributes (including `data-*`/`aria-*`).

### Inline Span Shortcut

Create a styled `<span>` inline without a link:

```md
This is a [span]{.text-green-500}.
```

Renders as:

```html
<span class="text-green-500">span</span>
```

---

## 6. Bindings and Interpolation

### 6.1 Bound Attributes

A bound attribute evaluates its expression in the document scope (frontmatter + renderer-provided data):

```md
{:prop="identifier"}
{:data='{"json":true}'}
```

- Evaluated by the renderer at render time.
- **Events** (e.g., `@click`) are **not supported** for security reasons.
- Scope includes document frontmatter and optional renderer-provided data.
- No access to globals or external APIs.

### 6.2 Non-Bound Attributes

- Non-bound attributes (no leading `:`) are **strings**.
- Special boolean shorthand: `{flag}` ≡ `{:flag="true"}`.

### 6.3 Interpolation

#### Supported Forms

| Form | Description |
|------|-------------|
| `{{ identifier }}` | Resolves variable from scope. Supports dotted paths (`user.name`). Renders empty if missing/undefined/null or empty string. |
| `{{ identifier \|\| "literal" }}` | Uses `"literal"` as fallback if variable is missing/undefined/null or empty string. |

#### Evaluation Context

- Scope = document frontmatter + renderer data.
- No global objects or expressions beyond identifiers and the `|| "literal"` fallback.
- Interpolation is **disabled** inside:
  - Code spans / code fences
  - Link URLs
  - Image URLs
  - Attribute values

### 6.4 Escaping

- The backslash `\` escapes MDC syntax characters.
  - Inline component content: `:x[span \] here]` renders the `]`.
  - Attribute lists: `key="a\}b"` allows a literal `}` inside `{...}`.
  - `\}}` renders literal `}}` in text.

---

## 7. Slots and Error Handling

| Situation | Behavior |
|----------|----------|
| **Unknown slot** | Ignored silently (not passed, not rendered). |
| **Duplicate slots** | Concatenated in appearance order. |
| **Whitespace** | Leading/trailing blank lines trimmed per slot; internal whitespace preserved. |
| **Unclosed component** | Remaining file treated as that component’s children (default slot). |
| **Mismatched delimiters (`::` vs `:::`)** | Treated as an unclosed component (same fallback as above). |
| **Malformed attributes** | Invalid pairs dropped silently. |
| **Interpolation errors** | Output left as raw text. |

---

## 8. Compilation Model (Informative)

MDC compiles to a minimal, framework-agnostic AST named **Minimark**.

---

### 8.1 Minimark Types

~~~ts
export type MinimarkText = string

export type MinimarkElement = [string, Record<string, unknown>, ...MinimarkNode[]]

export type MinimarkNode = MinimarkElement | MinimarkText

export type MinimarkTree = {
  type: 'minimark'
  value: MinimarkNode[]
}
~~~

Frontmatter is returned separately:

~~~ts
{ tree: MinimarkTree, frontmatter: Record<string, unknown> }
~~~

---

### 8.2 Tag Names

- Markdown → HTML-like tags (`"p"`, `"strong"`, `"em"`, `"a"`, `"img"`, `"ul"`, `"li"`, etc.)
- Components → declared name (`"alert-box"`, `"myComponent"`)
- Interpolation → `"binding"`
- Slots → `"template"` with `"v-slot:<slotName>"`

---

### 8.3 Attributes & Bound Attributes in `attrs`

**Non-bound attributes**
- Stored as strings  
  Example: `title="Hi"` → `{ "title": "Hi" }`

**Boolean shorthand**
- `{flag}` → `{ ":flag": "true" }`

**Bound attributes**
- `{:prop="identifier"}` → `{ ":prop": "identifier" }`
- JSON string values preserved:

~~~json
{ ":data": "{\"x\":1}" }
~~~

**Class / ID**
- `.btn.primary` → `{ "class": "btn primary" }`
- `#hero` → `{ "id": "hero" }`

**YAML precedence**
- YAML overrides inline `{…}` (including class/id), no merging

---

### 8.4 Slots (`v-slot:SLOT_NAME`)

Named slots compile to `"template"` elements with a slot attribute.

Example MDC:

~~~md
::card
Default

#title
Hello

#footer
World
::
~~~

Minimark:

~~~json
[
  "card",
  {},
  "Default",
  ["template", { "v-slot:title": "" }, "Hello"],
  ["template", { "v-slot:footer": "" }, "World"]
]
~~~

Rules:
- Default slot → direct children
- Named slots → `"template"` with `"v-slot:name": ""`
- Unknown slots → compiled anyway
- Duplicate slots → concatenated
- One leading & trailing blank line trimmed

---

### 8.5 Interpolation as `"binding"` Element

Interpolation compiles into:

~~~json
["binding", { "value": string, "defaultValue"?: string }]
~~~

Example 1:

~~~md
{{ name }}
~~~

~~~json
["binding", { "value": "name" }]
~~~

Example 2:

~~~md
{{ user.name || "friend" }}
~~~

~~~json
["binding", { "value": "user.name", "defaultValue": "friend" }]
~~~

Renderer rules:
- Lookup performed in frontmatter + renderer scope
- If missing/empty → use fallback if present

---

### 8.6 Inline Elements with Attributes

~~~md
**bold**{.emph data-x=1}
~~~

~~~json
[
  "p",
  {},
  ["strong", { "class": "emph", "data-x": "1" }, "bold"]
]
~~~

Span shortcut:

~~~md
[span]{.green}
~~~

~~~json
[
  "p",
  {},
  ["span", { "class": "green" }, "span"]
]
~~~

Links & images:

~~~md
[label](https://ex){rel=nofollow}
![alt](src){#hero}
~~~

~~~json
[
  "p",
  {},
  ["a", { "href": "https://ex", "rel": "nofollow" }, "label"],
  ["img", { "src": "src", "alt": "alt", "id": "hero" }]
]
~~~

---

### 8.7 Block & Inline Components

Block with YAML override:

~~~md
::alert-box{type="info" .rounded}
---
type: "warning"
id: "w1"
---
**Heads up!**
::
~~~

~~~json
[
  "alert-box",
  { "type": "warning", "id": "w1", "class": "rounded" },
  ["strong", {}, "Heads up!"]
]
~~~

Inline component:

~~~md
This is :badge[New]{.pill}
~~~

~~~json
[
  "p",
  {},
  "This is ",
  ["badge", { "class": "pill" }, "New"]
]
~~~

Bare inline component:

~~~md
Hello :icon-user
~~~

~~~json
[
  "p",
  {},
  "Hello ",
  ["icon-user", {}, ""]
]
~~~

---

### 8.8 Error Tolerance

- Unclosed component → rest of file becomes children
- Mismatched `::` / `:::` → treated as unclosed
- Bad attributes → dropped
- Bad interpolation → literal text
- Slot whitespace → trimmed at edges

---

### 8.9 Full Example

Source:

~~~md
---
name: Ahad
---

::card{.shadow}
#title
:avatar{name}[Ahad]{.lg}

Default body with **bold** and a [link](https://ex){rel=nofollow}.

#footer
Thanks, {{ name || "guest" }}!
::
~~~

Minimark:

~~~json
{
  "type": "minimark",
  "value": [
    [
      "card",
      { "class": "shadow" },
      ["template", { "v-slot:title": "" },
        ["avatar", { ":name": "name", "class": "lg" }, "Ahad"]
      ],
      "Default body with ",
      ["strong", {}, "bold"],
      " and a ",
      ["a", { "href": "https://ex", "rel": "nofollow" }, "link"],
      ".",
      ["template", { "v-slot:footer": "" },
        "Thanks, ",
        ["binding", { "value": "name", "defaultValue": "guest" }],
        "!"
      ]
    ]
  ]
}
~~~

## 9. Summary

| Feature | Supported | Notes |
|--------|-----------|-------|
| CommonMark & GFM | ✅ | Base syntax |
| Inline HTML | ✅ | Fully supported |
| Block Components | ✅ | `::comp{...} ... ::` |
| Inline Components | ✅ | `:comp[...]{...}` |
| YAML Frontmatter | ✅ | Defines document scope |
| Bindings | ✅ | `{:prop="identifier"}` and JSON string variant |
| Interpolation | ✅ | `{{ var }}` and `{{ var \|\| "literal" }}` |
| Event Attributes | 🚫 | Security restriction |
| Attributes on inline Markdown | ✅ | `{...}` after inline elements |
| Attributes on block Markdown | 🚫 | Not supported |
| Slots | ✅ | `#slotName`, default slot |
| Unknown slots | Ignored |  |
| Duplicate slots | Concatenated |  |
| Unclosed components | Treated as open |  |

---

## 10. References

- CommonMark Specification — <https://spec.commonmark.org/>
- GitHub Flavored Markdown Spec — <https://github.github.com/gfm/>
- Vue Components & Slots (conceptual reference) — <https://vuejs.org/guide/components/slots.html>
