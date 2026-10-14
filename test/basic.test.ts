import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils'

describe('ssr', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
    server: true,
  })

  it('render vue component from component-map', async () => {
    const html = await $fetch('/component-map/vue-component')

    expect(html).toContain('[Custom Paragraph]')
    expect(html).toContain('Sample paragraph')
  })

  it('render component (by it\'s name) from component-map', async () => {
    const html = await $fetch('/component-map/component-name')

    expect(html).toContain('[Global Paragraph]')
    expect(html).toContain('Sample paragraph')
  })

  it('respects mdc.components.customElements at MDC runtime', async () => {
    const res = await $fetch('/api/is-custom-element', { query: { tag: 'x-foo' } }) as any
    expect(res).toEqual({ tag: 'x-foo', isCustomElement: true })

    const res2 = await $fetch('/api/is-custom-element', { query: { tag: 'div' } }) as any
    expect(res2).toEqual({ tag: 'div', isCustomElement: false })
  })

  describe('root component from frontmatter', () => {
    const render = async (frontmatter: string) => {
      const html = await $fetch<string>('/xss/root-component', { query: { md: `---\n${frontmatter}\n---\n\nroot content` } })
      // only the rendered markup; the payload legitimately appears (escaped) in the serialized `__NUXT_DATA__`
      return html.slice(html.indexOf('id="root-component"'), html.indexOf('<div id="teleports"'))
    }

    it('replaces dangerous root tags with div and strips unsafe props', async () => {
      const html = await render('component:\n  name: iframe\n  props:\n    srcdoc: "<script>alert(1)</script>"')
      expect(html).not.toContain('<iframe')
      expect(html).not.toContain('srcdoc')
      expect(html).toContain('root content')
    })

    it('blocks script root tag', async () => {
      const html = await render('component:\n  name: script\n  props:\n    src: "https://evil.example/x.js"')
      expect(html).not.toContain('<script src')
      expect(html).toContain('root content')
    })

    it('strips innerHTML from root props', async () => {
      const html = await render('component:\n  name: div\n  props:\n    innerHTML: "<img src=x onerror=alert(1)>"\n    .innerHTML: "<img src=x onerror=alert(2)>"')
      expect(html).not.toContain('onerror')
      expect(html).toContain('root content')
    })

    it('rejects malformed root tag names', async () => {
      const html = await render('component:\n  name: "div><img src=x onerror=alert(1)"')
      expect(html).not.toContain('onerror')
      expect(html).toContain('root content')
    })

    it('keeps safe root tags and props', async () => {
      const html = await render('component:\n  name: section\n  props:\n    id: safe-root')
      expect(html).toMatch(/<section[^>]*id="safe-root"/)
    })
  })

  describe('prop interpolation', () => {
    const render = async (markdown: string, frontmatter = '') => {
      const md = frontmatter ? `---\n${frontmatter}\n---\n\n${markdown}` : markdown
      const html = await $fetch<string>('/props-interpolation', { query: { md } })
      // only the rendered markup; the payload also appears in the serialized `__NUXT_DATA__`
      return html.slice(html.indexOf('id="props-interpolation"'), html.indexOf('<div id="teleports"'))
    }
    const openingTag = (html: string, tag: string) => html.match(new RegExp(`<${tag}\\b[^>]*>`))?.[0] ?? ''
    const docSlug = 'doc:\n  slug: getting-started'

    it('interpolates a placeholder in :href', async () => {
      const html = await render(':a[Read more]{:href="/docs/{{ doc.slug }}/overview"}', docSlug)
      expect(openingTag(html, 'a')).toContain('href="/docs/getting-started/overview"')
    })

    it('interpolates an expression with a fallback', async () => {
      const markdown = ':span{:title="Version {{ v.n || \'1.0\' }}"}'
      const fallback = await render(markdown)
      expect(openingTag(fallback, 'span')).toContain('title="Version 1.0"')

      const html = await render(markdown, 'v:\n  n: "2.1"')
      expect(openingTag(html, 'span')).toContain('title="Version 2.1"')
    })

    it('interpolates two placeholders in one value', async () => {
      const html = await render(':span{:title="{{ a }}-{{ b }}"}', 'a: x\nb: y')
      expect(openingTag(html, 'span')).toContain('title="x-y"')
    })

    it('keeps braces in a non-: prop (regression guard)', async () => {
      const html = await render(':span{title="{{ doc.slug }}"}', docSlug)
      expect(openingTag(html, 'span')).toContain('{{ doc.slug }}')
    })

    it('still resolves a plain :prop expression (regression guard)', async () => {
      const html = await render(':span{:title="doc.slug"}', docSlug)
      expect(openingTag(html, 'span')).toContain('title="getting-started"')
    })

    it('drops an unsafe href from interpolated data', async () => {
      const html = await render(':a[x]{:href="{{ link }}"}', 'link: "javascript:alert(1)"')
      const tag = openingTag(html, 'a')
      expect(tag).toMatch(/^<a\b/)
      expect(tag).not.toContain('href')
      expect(html).toMatch(/<a\b[^>]*>(<!--\[-->)?x(<!--\]-->)?<\/a>/)
      expect(html).not.toContain('javascript:alert')
    })

    it('drops href and does not fail on malformed encoding', async () => {
      const html = await render(':a[x]{:href="{{ link }}"}', 'link: "%"')
      const tag = openingTag(html, 'a')
      expect(tag).toMatch(/^<a\b/)
      expect(tag).not.toContain('href')
      expect(html).toMatch(/<a\b[^>]*>(<!--\[-->)?x(<!--\]-->)?<\/a>/)
    })

    it('does not expose internal data such as $route', async () => {
      const html = await render(':span{:title="a{{ $route.path }}b"}')
      expect(openingTag(html, 'span')).toContain('title="ab"')
    })

    it('does not evaluate placeholders inside interpolated values', async () => {
      const html = await render(':span{:title="t-{{ a }}"}', 'a: "{{ b }}"\nb: secret')
      const tag = openingTag(html, 'span')
      expect(tag).toContain('title="t-{{ b }}"')
      expect(html).not.toContain('secret')
    })

    it('supports the v-bind: prefix', async () => {
      const html = await render(':span{v-bind:title="/p/{{ doc.slug }}"}', docSlug)
      expect(openingTag(html, 'span')).toContain('title="/p/getting-started"')
    })

    describe('YAML block props', () => {
      const snippet = 'snippet:\n  api:\n    id: abc123'
      const block = (prop: string) => `::div\n---\n${prop}\n---\nbody\n::`
      // MDC wraps the output in its own `<div class="">`, so read the block element inside it.
      const blockTag = (html: string) => openingTag(html.slice(html.indexOf('<div class="">') + 1), 'div')

      it('interpolates a template inside a longer value', async () => {
        const html = await render(block(':title: https://apiconsole.example.com/repository/{{ snippet.api.id }}'), snippet)
        expect(blockTag(html).match(/title="[^"]*"/)?.[0]).toBe('title="https://apiconsole.example.com/repository/abc123"')
      })

      it('keeps braces in a non-: YAML prop (negative twin)', async () => {
        const html = await render(block('title: https://apiconsole.example.com/repository/{{ snippet.api.id }}'), snippet)
        const tag = blockTag(html)
        expect(tag).toContain('{{ snippet.api.id }}')
        expect(tag).not.toContain('abc123')
      })

      it('resolves a quoted value that starts with a placeholder', async () => {
        const html = await render(block(':title: "{{ snippet.api.id }}"'), snippet)
        expect(blockTag(html)).toContain('title="abc123"')
      })

      it('uses the fallback when the path is missing', async () => {
        const markdown = block(':title: Version {{ snippet.api.version || \'1.0\' }}')
        const html = await render(markdown, snippet)
        expect(blockTag(html)).toContain('title="Version 1.0"')

        const set = await render(markdown, 'snippet:\n  api:\n    version: "2.1"')
        expect(blockTag(set)).toContain('title="Version 2.1"')
      })
    })

    it('resolves the $doc. prefix', async () => {
      const html = await render(':span{:title="{{ $doc.doc.slug }}"}', docSlug)
      expect(openingTag(html, 'span')).toContain('title="getting-started"')
    })

    it('resolves the $document. prefix', async () => {
      const html = await render(':span{:title="{{ $document.doc.slug }}"}', docSlug)
      expect(openingTag(html, 'span')).toContain('title="getting-started"')
    })

    it('does not expose $doc.tags or $doc.runtimeData', async () => {
      const html = await render(':span{:title="a{{ $doc.tags.p }}b{{ $doc.runtimeData.doc.slug }}c"}', docSlug)
      expect(openingTag(html, 'span')).toContain('title="abc"')
    })

    describe('ancestor scope', () => {
      const nested = '::div{title="T"}\n:span{:title="{{ title }}"}\n::'

      it('reads a prop of an ancestor element', async () => {
        const html = await render(nested)
        expect(openingTag(html, 'span')).toContain('title="T"')
      })

      it('lets an ancestor prop shadow a document key', async () => {
        const html = await render(nested, 'title: DOC')
        expect(openingTag(html, 'span')).toContain('title="T"')
        expect(html).not.toContain('title="DOC"')
      })

      it('still reads the document key through $doc when shadowed', async () => {
        const html = await render('::div{title="T"}\n:span{:title="{{ $doc.title }}"}\n::', 'title: DOC')
        expect(openingTag(html, 'span')).toContain('title="DOC"')
      })

      it('reads the document key when no ancestor sets the prop (negative twin)', async () => {
        const html = await render(':span{:title="{{ title }}"}', 'title: DOC')
        expect(openingTag(html, 'span')).toContain('title="DOC"')
      })
    })

    it.each([
      ':span{v-bind:title="{{ bad }}" title="static"}',
      ':span{title="static" v-bind:title="{{ bad }}"}',
    ])('keeps a dropped prop absent even with a static twin: %s', async (markdown) => {
      const html = await render(markdown, 'bad: "javascript:alert(1)"')
      const tag = openingTag(html, 'span')
      expect(tag).toMatch(/^<span\b/)
      expect(tag).not.toContain('title')
      expect(html).not.toContain('javascript:')
    })

    it('drops the prop but keeps a static twin of another name', async () => {
      const html = await render(':span{:title="{{ bad }}" id="kept"}', 'bad: "javascript:alert(1)"')
      const tag = openingTag(html, 'span')
      expect(tag).toContain('id="kept"')
      expect(tag).not.toContain('title')
      expect(html).not.toContain('javascript:')
    })

    it.each(['onclick', 'srcdoc'])('does not render an unsafe attribute name: %s', async (name) => {
      const html = await render(`:span{:${name}="{{ x }}" id="kept"}`, 'x: "alert(1)"')
      const tag = openingTag(html, 'span')
      expect(tag).toContain('id="kept"')
      expect(tag).not.toContain(name)
      expect(html).not.toContain('alert(1)')
    })

    it('still interpolates a well-formed placeholder in a plain string (regression guard)', async () => {
      const html = await render(':span{:title="Hi {{ name }}"}', 'name: Bob')
      expect(openingTag(html, 'span')).toContain('title="Hi Bob"')
    })

    it.each([
      'Use {{ name | upper }}',
      'Use {{ a + b }}',
    ])('keeps a malformed template as a literal string: %s', async (value) => {
      const html = await render(`:span{:title="${value}"}`, 'name: Bob\na: x\nb: y')
      const tag = openingTag(html, 'span')
      expect(tag).toContain(`title="${value}"`)
      expect(tag).not.toContain('Bob')
      expect(tag).not.toContain('xy')
    })

    // `PropProbe` renders the type and the JSON of its props. SSR drops array and object attributes on a plain element.
    describe('structured YAML props', () => {
      const probe = (prop: string) => `::prop-probe\n---\n${prop}\n---\n::`
      const probeText = (html: string) => html.match(/<p id="probe">([\s\S]*?)<\/p>/)?.[1]?.replace(/&quot;/g, '"') ?? ''

      it('keeps a JSON array prop as an array', async () => {
        const text = probeText(await render(probe('items:\n  - "{{ name }}"'), 'name: Bob'))
        expect(text).toContain('items:array')
        expect(text).toContain('{"items":["{{ name }}"]}')
        expect(text).not.toContain('Bob')
      })

      it('keeps a JSON object prop as an object', async () => {
        const text = probeText(await render(probe('data:\n  template: "Hello {{ name }}"'), 'name: Bob'))
        expect(text).toContain('data:object')
        expect(text).toContain('{"data":{"template":"Hello {{ name }}"}}')
        expect(text).not.toContain('Bob')
      })
    })

    it('does not interpolate the reserved :style prop', async () => {
      const html = await render(':span{:style="color:{{ c }}" id="kept"}', 'c: red')
      const tag = openingTag(html, 'span')
      expect(tag).toContain('id="kept"')
      expect(tag).toContain('style="color:{{ c }}"')
      expect(tag).not.toContain('red')
    })

    it('does not interpolate the reserved :is prop', async () => {
      const html = await render(':span{:is="{{ c }}" id="kept"}', 'c: strong')
      const tag = openingTag(html, 'span')
      expect(tag).toContain('id="kept"')
      expect(tag).toContain('is="{{ c }}"')
      expect(html).not.toMatch(/<strong\b/)
    })
  })
})
