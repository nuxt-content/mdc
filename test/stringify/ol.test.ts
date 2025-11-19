import { expect, it, describe } from 'vitest'
import { stringifyMarkdown } from '../utils/parser'

const ast = {
  type: 'root',
  children: [
    {
      type: 'element',
      tag: 'steps',
      props: {},
      children: [
        {
          type: 'element',
          tag: 'h3',
          props: { id: 'create-your-docs-directory' },
          children: [{ type: 'text', value: 'Create your docs directory' }],
        },
        {
          type: 'element',
          tag: 'p',
          props: {},
          children: [
            { type: 'text', value: 'Use the ' },
            {
              type: 'element',
              tag: 'code',
              props: {},
              children: [{ type: 'text', value: 'create-docus' }],
            },
            { type: 'text', value: ' CLI to create a new Docus project:' },
          ],
        },
        {
          type: 'element',
          tag: 'pre',
          props: {
            className: 'language-bash shiki shiki-themes material-theme-lighter material-theme material-theme-palenight',
            code: 'npx create-docus my-docs\n',
            filename: 'Terminal',
            language: 'bash',
            meta: '',
            style: '',
          },
          children: [
            {
              type: 'element',
              tag: 'code',
              props: { __ignoreMap: '' },
              children: [
                {
                  type: 'element',
                  tag: 'span',
                  props: { class: 'line', line: 1 },
                  children: [
                    {
                      type: 'element',
                      tag: 'span',
                      props: { class: 'sBMFI' },
                      children: [{ type: 'text', value: 'npx' }],
                    },
                    {
                      type: 'element',
                      tag: 'span',
                      props: { class: 'sfazB' },
                      children: [{ type: 'text', value: ' create-docus' }],
                    },
                    {
                      type: 'element',
                      tag: 'span',
                      props: { class: 'sfazB' },
                      children: [{ type: 'text', value: ' my-docs\n' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'element',
          tag: 'p',
          props: {},
          children: [{ type: 'text', value: 'You can choose between two templates:' }],
        },
        {
          type: 'element',
          tag: 'ul',
          props: {},
          children: [
            {
              type: 'element',
              tag: 'li',
              props: {},
              children: [
                {
                  type: 'element',
                  tag: 'code',
                  props: {},
                  children: [{ type: 'text', value: 'default' }],
                },
                { type: 'text', value: ': Basic Docus setup for single-language documentation' },
              ],
            },
            {
              type: 'element',
              tag: 'li',
              props: {},
              children: [
                {
                  type: 'element',
                  tag: 'code',
                  props: {},
                  children: [{ type: 'text', value: 'i18n' }],
                },
                { type: 'text', value: ': Includes internationalization support for multi-language documentation' },
              ],
            },
          ],
        },
      ],
    },
  ],
}

describe('stringify ordered list (ol)', () => {
  it('should stringify complex AST with steps component', async () => {
    const markdown = await stringifyMarkdown(ast, {})

    expect(markdown).toBeTruthy()
    expect(markdown).toContain('::steps')
    expect(markdown).toContain('### Create your docs directory')
    expect(markdown).toContain('Use the `create-docus` CLI')
    expect(markdown).toContain('```bash [Terminal]')
    expect(markdown).toContain('npx create-docus my-docs')
    expect(markdown).toContain('You can choose between two templates:')
    expect(markdown).toContain('- `default`: Basic Docus setup')
    expect(markdown).toContain('- `i18n`: Includes internationalization support')
    expect(markdown).toContain('::')
  })

  it('should stringify nested elements correctly', async () => {
    const markdown = await stringifyMarkdown(ast, {})

    // Check that inline code is preserved
    expect(markdown).toMatch(/`create-docus`/)
    expect(markdown).toMatch(/`default`/)
    expect(markdown).toMatch(/`i18n`/)

    // Check that code block format is correct
    expect(markdown).toMatch(/```bash \[Terminal\]\s+npx create-docus my-docs/)
  })

  it('should handle empty data parameter', async () => {
    const markdown = await stringifyMarkdown(ast)
    expect(markdown).toBeTruthy()
    expect(typeof markdown).toBe('string')
  })

  it('should preserve list structure', async () => {
    const markdown = await stringifyMarkdown(ast, {})

    // Count list items
    const listItemMatches = markdown.match(/^- /gm)
    expect(listItemMatches).toHaveLength(2)
  })

  it('should preserve children order', async () => {
    const markdown = await stringifyMarkdown(ast, {})

    // Extract the structure by finding key elements in order
    const h3Index = markdown.indexOf('### Create your docs directory')
    const firstParagraphIndex = markdown.indexOf('Use the `create-docus` CLI')
    const preIndex = markdown.indexOf('```bash [Terminal]')
    const secondParagraphIndex = markdown.indexOf('You can choose between two templates:')
    const listIndex = markdown.indexOf('- `default`')

    // Verify all elements are present
    expect(h3Index).toBeGreaterThan(-1)
    expect(firstParagraphIndex).toBeGreaterThan(-1)
    expect(preIndex).toBeGreaterThan(-1)
    expect(secondParagraphIndex).toBeGreaterThan(-1)
    expect(listIndex).toBeGreaterThan(-1)

    // Verify order: h3 -> paragraph -> pre -> paragraph -> paragraph(ul)
    expect(h3Index).toBeLessThan(firstParagraphIndex)
    expect(firstParagraphIndex).toBeLessThan(preIndex)
    expect(preIndex).toBeLessThan(secondParagraphIndex)
    expect(secondParagraphIndex).toBeLessThan(listIndex)

    // Verify ul is wrapped in paragraph (list comes after paragraph text)
    const paragraphBeforeList = markdown.substring(secondParagraphIndex, listIndex)
    expect(paragraphBeforeList).toContain('You can choose between two templates:')
  })
})
