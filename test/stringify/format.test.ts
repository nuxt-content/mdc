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

  it('should stringify format correctly with children', async () => {
    const md = [
      '::container',
      '---',
      'background-image:',
      '  url: https://example.com',
      '  background-size: contain',
      'another: property',
      'foo: bar',
      'styles: |',
      '  p {',
      '    color: red;',
      '  }',
      '---',
      '::',
      '',
    ].join('\n')

    const { body } = await parseMarkdown(md)
    const result = await stringifyMarkdown(body)
    expect(result).toBe(md)
  })

  it('should stringify format correctly with yaml props', async () => {
    const md = [
      '::page-container',
      '---',
      'simple-array:',
      '  - item1',
      '  - item2',
      '  - item3',
      '---',
      '::',
      '',
      '::page-container',
      '---',
      'items:',
      '  - name: Item 1',
      '    description: First item',
      '  - name: Item 2',
      '    description: Second item',
      '---',
      '::',
      '',
      '::page-container',
      '---',
      'attributes:',
      '  - domains:',
      '      - internal',
      '  - env:',
      '      - dev',
      '      - staging',
      '      - prod',
      '  - dogs:',
      '      - husky',
      '      - beagle',
      '---',
      '::',
      '',
    ].join('\n')

    const { body } = await parseMarkdown(md)
    const result = await stringifyMarkdown(body)
    expect(result).toBe(md)
  })

  it('should stringify format correctly with yaml props and nested objects', async () => {
    const md = [
      '::page-section',
      '  :::page-section',
      '  #tagline',
      '  {{ $doc.snippet.tagline }}',
      '',
      '  #title',
      '  {{ $doc.snippet.title }}',
      '',
      '  #description',
      '  {{ $doc.snippet.description }}',
      '',
      '    ::::button{:to="$doc.snippet.link" appearance="primary"}',
      '    Button Text',
      '    ::::',
      '',
      '    ::::button{:to="$doc.snippet.link" appearance="primary"}',
      '    Button Text',
      '    ::::',
      '',
      '    ::::button',
      '    ---',
      '    :data-testid: $doc.snippet.description',
      '    external: true',
      '    :to: $doc.snippet.link',
      '    appearance: primary',
      '    ---',
      '    Button Text',
      '    ::::',
      '  :::',
      '::',
      '',
    ].join('\n')
    const { body } = await parseMarkdown(md)
    const result = await stringifyMarkdown(body)
    expect(result).toBe(md)
  })
})
