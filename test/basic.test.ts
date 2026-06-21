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

  it('blocks dangerous root tags from frontmatter', async () => {
    const html = await $fetch('/xss/xss-root-component')

    // Extract the content inside #dangerous-iframe
    const iframeSection = html.match(/<p id="dangerous-iframe">(.*?)<\/p>/)?.[1] || ''
    expect(iframeSection).not.toContain('<iframe')
    expect(iframeSection).toContain('iframe test')

    // Extract the content inside #dangerous-script
    const scriptSection = html.match(/<p id="dangerous-script">(.*?)<\/p>/)?.[1] || ''
    expect(scriptSection).not.toContain('<script')
    expect(scriptSection).toContain('script test')

    // srcdoc prop should be stripped everywhere
    expect(iframeSection).not.toMatch(/srcdoc\s*=/)
    const srcdocSection = html.match(/<p id="dangerous-srcdoc">(.*?)<\/p>/)?.[1] || ''
    expect(srcdocSection).not.toMatch(/srcdoc\s*=/)

    // Safe component should still render normally
    expect(html).toContain('Hello')
  })

  it('validates frontmatter POC: iframe srcdoc root is blocked by renderer', async () => {
    const html = await $fetch('/xss/xss-frontmatter-poc')

    // Working payload: frontmatter root iframe with srcdoc — iframe replaced with div, srcdoc stripped
    const workingSection = html.match(/<p id="working-payload">(.*?)<\/p>/)?.[1] || ''
    expect(workingSection).not.toContain('<iframe')
    expect(workingSection).not.toMatch(/srcdoc\s*=/)
    expect(workingSection).toContain('safe')

    // Negative control: raw iframe in body AST (bypasses compiler validation) —
    // the iframe renders because propsToData doesn't re-validate; the compiler
    // is what strips srcdoc from child nodes. This confirms the fix targets
    // the frontmatter root path specifically, not breaking child-node behavior.
    const controlSection = html.match(/<p id="negative-control">(.*?)<\/p>/)?.[1] || ''
    expect(controlSection).toContain('<iframe')
  })
})
