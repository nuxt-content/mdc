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

  describe('component-like prop values', () => {
    const template = '<b>{{ 7 * 191 }}</b>'
    const render = async (md: string) => {
      const html = await $fetch<string>('/xss/root-component', { query: { md } })
      return html.slice(html.indexOf('id="root-component"'), html.indexOf('<div id="teleports"'))
    }

    it.each(['as', 'is', 'tag'])('does not compile a `template` object bound to `%s`', async (prop) => {
      const html = await render(`::poly{:${prop}='{"template":"${template}"}'}\n::`)
      expect(html).toContain('>poly<')
      expect(html).not.toContain('1337')
    })

    it('does not compile a nested `extends` component object', async () => {
      const html = await render(`::poly-icon{:icon='{"extends":{"template":"${template}"}}'}\n::`)
      expect(html).toContain('icon')
      expect(html).not.toContain('1337')
    })

    it('does not compile a component object from YAML props', async () => {
      const html = await render(`::poly-icon\n---\nicon:\n  extends:\n    template: "${template}"\n---\n::`)
      expect(html).not.toContain('1337')
    })

    it('does not compile a component object spread with `v-bind`', async () => {
      const html = await render(`::poly{v-bind='{"as":{"template":"${template}"}}'}\n::`)
      expect(html).toContain('>poly<')
      expect(html).not.toContain('1337')
    })

    it('does not compile a component object bound from frontmatter', async () => {
      const html = await render(`---\npayload:\n  template: "${template}"\n---\n\n::poly{:as="payload"}\n::`)
      expect(html).toContain('>poly<')
      expect(html).not.toContain('1337')
    })

    it('does not compile a root component object from frontmatter', async () => {
      const html = await render(`---\ncomponent:\n  template: "${template}"\n---\n\nroot content`)
      expect(html).toContain('root content')
      expect(html).not.toContain('1337')
    })

    it('does not compile a component object mapped in frontmatter', async () => {
      const html = await render(`---\nmdc:\n  components:\n    p:\n      template: "${template}"\n---\n\nroot content`)
      expect(html).toContain('root content')
      expect(html).not.toContain('1337')
    })

    it('keeps string tags', async () => {
      expect(await render('::poly{as="section"}\n::')).toContain('<section>poly</section>')
      expect(await render('::poly{:as=\'"article"\'}\n::')).toContain('<article>poly</article>')
    })

    it('keeps object and array data props', async () => {
      const html = await render('::poly-items{:items=\'[{"label":"a"}]\' :options=\'{"k":"v"}\'}\n::')
      expect(html).toContain('<li>a</li>')
      expect(html).toContain('data-options="{&quot;k&quot;:&quot;v&quot;}"')
    })
  })
})
