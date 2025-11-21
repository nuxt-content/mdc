import { expect, test, describe } from 'vitest'
import { parseMarkdown, stringifyMarkdown } from '../utils/parser'

describe('stringify unordered list (ul)', () => {
  test('should stringify ul correctly', async () => {
    const md = [
      '- This is a list item.',
      '  - This is a CHILD list item.',
      '    - This is a GRANDCHILD list item.',
      '',
    ].join('\n')
    const { body } = await parseMarkdown(md)
    const result = await stringifyMarkdown(body)
    expect(result).toBe(md)
  })
})
