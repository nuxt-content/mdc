import { expect, it, describe } from 'vitest'
import { parseMarkdown, stringifyMarkdown } from '../utils/parser'

describe('stringify format', () => {
  it('should stringify format correctly', async () => {
    const md = [
      '::container{background-color="#eee" padding="20px"}',
      '# This is a header',
      '',
      ':icon{color="#000" name="mdi:github" size="36px"}',
      '',
      '  :::content2',
      '  Well',
      '  :::',
      '::',
      '',
    ].join('\n')

    const { body } = await parseMarkdown(md)
    const result = await stringifyMarkdown(body)
    expect(result).toBe(md)
  })
})
