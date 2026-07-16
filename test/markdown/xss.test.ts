import { expect, it } from 'vitest'
import { parseMarkdown } from '../utils/parser'
import type { MDCElement } from '../../src/types'
import { validateProp } from '../../src/runtime/parser/utils/props'

const md = `\
<!-- anchol link -->
[a](javascript://www.google.com%0Aprompt(1))
[a](JaVaScRiPt:alert(1))
[XSS](vbscript:alert(document.domain))
<javascript:prompt(document.cookie)>
[x](y '<style>')
<a href="jav&#x09;ascript:alert('XSS');">Click Me</a>

<!-- image -->

![](x){onerror=alert(1) onload="alert('XSS')" }
![a]("onerror="alert(1))
![](contenteditable/autofocus/onfocus=confirm('qwq')//)">
![XSS](data:text/html;base64,PHNjcmlwdD5hbGVydCgnWFNTJyk8L3NjcmlwdD4K)
<img src=x onerror=alert(1) onload="alert('XSS')" />
<img src=x onerror=alert(1)>">yep</a>
![XSS]("onerror="alert('XSS'))
![XSS](https://www.example.com/image.png"onload="alert('XSS'))
![onload](https://www.example.com/image.png"onload="alert('ImageOnLoad'))
![onerror]("onerror="alert('ImageOnError'))

<!-- iframe -->

:iframe{src=x onerror=alert(1) onload="alert('XSS')" }
<iframe src=x onerror=alert(1) onload="alert('XSS')" />

`.trim()

it('XSS generic payloads', async () => {
  const { data, body } = await parseMarkdown(md)

  expect(Object.keys(data)).toHaveLength(2)

  for (const node of (body.children[0] as MDCElement).children) {
    const props = (node as MDCElement).props || {}
    expect(Object.entries(props as Record<string, any>).every(([k, v]) => validateProp(k, v))).toBeTruthy()
  }
})

it('should strip plain javascript: href from anchor elements', async () => {
  const { body } = await parseMarkdown(`\
<a href="javascript:alert(1)">this gets sanitized, yay!</a>
`.trim())

  const p = body.children[0] as MDCElement
  const a = p.children?.[0] as MDCElement

  expect(a.tag).toBe('a')
  expect(a.props?.href).toBeUndefined()
})

it('XSS payloads with HTML entities should be caught', async () => {
  const md = `\
## XSS payloads with HTML entities
<a href="jav&#x09;ascript:alert('XSS');">Click Me 1</a>
<a href="jav&#x0A;ascript:alert('XSS');">Click Me 2</a>  
<a href="jav&#10;ascript:alert('XSS');">Click Me 3</a>
<a href="&#x09;javascript:alert('XSS');">Click Me 4</a>

`.trim()

  // set the number of assertions to expect
  expect.assertions(5)

  const { data, body } = await parseMarkdown(md)

  expect(Object.keys(data)).toHaveLength(2)

  for (const node of (body.children[1] as MDCElement).children) {
    const props = (node as MDCElement).props || {}

    if ((node as MDCElement).tag === 'a') {
      expect(Object.keys(props)).toHaveLength(0)
    }
  }
})

it('should block xlink:href on SVG anchor elements', async () => {
  const { body } = await parseMarkdown(`\
<svg viewBox="0 0 10 10">
  <a xlink:href="javascript:alert(1)">click</a>
</svg>
`.trim())

  const svg = body.children[0] as MDCElement
  const a = svg.children?.find((c): c is MDCElement => (c as MDCElement).tag === 'a')

  expect(a).toBeDefined()
  expect((a as MDCElement).props?.xLinkHref).toBeUndefined()
})

it('should block data:text/html on iframe src', async () => {
  const { body } = await parseMarkdown(`\
<iframe src="data:text/html,<script>alert(1)</script>"></iframe>
`.trim())

  const iframe = body.children[0] as MDCElement
  expect(iframe.props?.src).toBeUndefined()
})

it('should block data:text/html on anchor href', async () => {
  const { body } = await parseMarkdown(`\
<a href="data:text/html,<script>alert(1)</script>">click</a>
`.trim())

  const p = body.children[0] as MDCElement
  const a = p.children?.[0] as MDCElement
  expect(a.props?.href).toBeUndefined()
})

it('should allow safe xlink:href values', async () => {
  expect(validateProp('xlinkhref', 'https://example.com')).toBe(true)
  expect(validateProp('xLinkHref', 'https://example.com')).toBe(true)
  expect(validateProp('xlink:href', 'https://example.com')).toBe(true)
  expect(validateProp('xlinkhref', '/relative/path')).toBe(true)
})

it('should block Vue directive-form event handlers and unsafe URLs', () => {
  const payloads: Array<[string, string]> = [
    [':onerror', 'alert(1)'],
    [':onload', 'alert(1)'],
    ['v-bind:onerror', 'alert(1)'],
    ['@click', 'alert(1)'],
    ['v-on:click', 'alert(1)'],
    [':href', 'javascript:alert(1)'],
    ['v-bind:href', 'javascript:alert(1)'],
    [':src', 'javascript:alert(1)'],
    ['v-bind:src', 'data:text/html,<script>alert(1)</script>'],
  ]

  for (const [attribute, value] of payloads) {
    expect(validateProp(attribute, value), `${attribute}="${value}"`).toBe(false)
  }
})

it('should allow safe Vue directive-form href and src values', () => {
  expect(validateProp(':href', 'https://example.com')).toBe(true)
  expect(validateProp('v-bind:href', '/relative/path')).toBe(true)
  expect(validateProp(':src', 'https://example.com/image.png')).toBe(true)
})

it('should strip Vue directive-form unsafe attributes from parsed HTML', async () => {
  const { body } = await parseMarkdown(`\
<p>
  <img :src="x" :onerror="alert(1)">
  <a :href="javascript:alert(1)">click</a>
  <svg :onload="alert(1)"></svg>
</p>
`.trim())

  const p = body.children[0] as MDCElement
  const img = p.children?.find((c): c is MDCElement => (c as MDCElement).tag === 'img')
  const a = p.children?.find((c): c is MDCElement => (c as MDCElement).tag === 'a')
  const svg = p.children?.find((c): c is MDCElement => (c as MDCElement).tag === 'svg')

  expect(img?.props?.onerror ?? img?.props?.[':onerror']).toBeUndefined()
  expect(a?.props?.href ?? a?.props?.[':href']).toBeUndefined()
  expect(svg?.props?.onload ?? svg?.props?.[':onload']).toBeUndefined()
})

it('should strip v-bind directive-form unsafe attributes from parsed HTML', async () => {
  const { body } = await parseMarkdown(`\
<a v-bind:href="javascript:alert(1)">click</a>
`.trim())

  const p = body.children[0] as MDCElement
  const a = p.children?.[0] as MDCElement

  expect(a.props?.href ?? a.props?.['v-bind:href']).toBeUndefined()
})
