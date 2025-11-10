import { expect, it } from 'vitest'
import { parseMarkdown } from '../utils/parser'
import { stringifyMarkdown } from '../../src/runtime/stringify'

it('Element in heading', async () => {
  const { body } = await parseMarkdown('### :hello')
  expect(body).toHaveProperty('type', 'root')

  expect(body.children).toHaveLength(1)
  expect(body.children[0]).toMatchObject({
    type: 'element',
    tag: 'h3',
    props: { id: '' },
    children: [{ type: 'element', tag: 'hello', props: {}, children: [] }],
  })

  const result = await stringifyMarkdown(body)
  expect(result).toMatchInlineSnapshot(`
    "### :hello\n"
  `)
})
