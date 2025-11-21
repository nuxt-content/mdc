import { expect, it, describe } from 'vitest'
import { parseMarkdown, stringifyMarkdown } from '../utils/parser'

describe('stringify ordered list (ol)', () => {
  it('should stringify complex AST with steps component', async () => {
    const md = [
      '::container{padding="0px"}',
      '  :::container',
      '  ---',
      '  styles: |',
      '    pre {',
      '      border: 1px solid red !important;',
      '',
      '      span {',
      '        line-height: 1;',
      '      }',
      '    }',
      '  ---',
      '  This container has a code block.',
      '',
      '  ```js',
      '  function test() {',
      '    console.log("test");',
      '  }',
      '  ```',
      '  :::',
      '::',
      ''
    ].join('\n')
    

    const { body } = await parseMarkdown(md)
    const result = await stringifyMarkdown(body)
    expect(result).toBe(md)
  })
})
