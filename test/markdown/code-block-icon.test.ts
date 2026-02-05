import { describe, expect, it } from 'vitest'
import { parseMarkdown } from '../utils/parser'

describe('Code block with icon syntax', () => {
  it('parses filename with icon and position', async () => {
    const md = `
\`\`\`python [Script|logos:python|right]
print("test")
\`\`\`
`.trim()

    const { body } = await parseMarkdown(md, {
      highlight: false,
    })

    expect(body.children).toHaveLength(1)
    expect(body.children[0].props.filename).toBe('Script')
    expect(body.children[0].props.icon).toBe('logos:python')
    expect(body.children[0].props.iconPosition).toBe('right')
    expect(body.children[0].props.language).toBe('python')
  })

  it('parses filename with icon (default position)', async () => {
    const md = `
\`\`\`javascript [app.js|logos:javascript]
console.log("hello")
\`\`\`
`.trim()

    const { body } = await parseMarkdown(md, {
      highlight: false,
    })

    expect(body.children).toHaveLength(1)
    expect(body.children[0].props.filename).toBe('app.js')
    expect(body.children[0].props.icon).toBe('logos:javascript')
    expect(body.children[0].props.iconPosition).toBeUndefined()
  })

  it('parses icon only without filename', async () => {
    const md = `
\`\`\`typescript [|devicon:typescript|left]
const x: number = 1
\`\`\`
`.trim()

    const { body } = await parseMarkdown(md, {
      highlight: false,
    })

    expect(body.children).toHaveLength(1)
    expect(body.children[0].props.filename).toBeUndefined()
    expect(body.children[0].props.icon).toBe('devicon:typescript')
    expect(body.children[0].props.iconPosition).toBe('left')
  })

  it('parses icon with highlights and meta', async () => {
    const md = `
\`\`\`vue {1-3} [Component.vue|logos:vue|right] showLineNumbers
<template>
  <div>Hello</div>
</template>
\`\`\`
`.trim()

    const { body } = await parseMarkdown(md, {
      highlight: false,
    })

    expect(body.children).toHaveLength(1)
    expect(body.children[0].props.filename).toBe('Component.vue')
    expect(body.children[0].props.icon).toBe('logos:vue')
    expect(body.children[0].props.iconPosition).toBe('right')
    expect(body.children[0].props.highlights).toEqual([1, 2, 3])
    expect(body.children[0].props.meta).toBe('showLineNumbers')
  })

  it('preserves backward compatibility with plain filename', async () => {
    const md = `
\`\`\`ts [server/api/users.ts]
export default defineEventHandler(() => {})
\`\`\`
`.trim()

    const { body } = await parseMarkdown(md, {
      highlight: false,
    })

    expect(body.children).toHaveLength(1)
    expect(body.children[0].props.filename).toBe('server/api/users.ts')
    expect(body.children[0].props.icon).toBeUndefined()
    expect(body.children[0].props.iconPosition).toBeUndefined()
  })

  it('handles empty brackets', async () => {
    const md = `
\`\`\`js []
const x = 1
\`\`\`
`.trim()

    const { body } = await parseMarkdown(md, {
      highlight: false,
    })

    expect(body.children).toHaveLength(1)
    expect(body.children[0].props.filename).toBeUndefined()
    expect(body.children[0].props.icon).toBeUndefined()
  })

  it('handles various icon providers', async () => {
    const providers = [
      { icon: 'logos:react', expected: 'logos:react' },
      { icon: 'devicon:go', expected: 'devicon:go' },
      { icon: 'vscode-icons:file-type-rust', expected: 'vscode-icons:file-type-rust' },
      { icon: 'simple-icons:docker', expected: 'simple-icons:docker' },
    ]

    for (const { icon, expected } of providers) {
      const md = `
\`\`\`text [Test|${icon}]
content
\`\`\`
`.trim()

      const { body } = await parseMarkdown(md, {
        highlight: false,
      })

      expect(body.children[0].props.icon).toBe(expected)
    }
  })
})
