import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, watchEffect } from 'vue'
import {
  MAX_BINDING_LENGTH,
  MAX_BINDINGS,
  MAX_TEMPLATE_LENGTH,
  hasTemplate,
  isInterpolatedProp,
  resolvePropTemplate,
} from '../../src/runtime/utils/template'

const WARN_PREFIX = '[@nuxtjs/mdc] removing invalid or unsafe dynamic attribute: '

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
})

const resolve = (template: string, context: Record<string, unknown> = {}, attribute = 'to') =>
  resolvePropTemplate(template, context, { attribute })

describe('limits', () => {
  it('exports the documented limits', () => {
    expect(MAX_TEMPLATE_LENGTH).toBe(4096)
    expect(MAX_BINDINGS).toBe(16)
    expect(MAX_BINDING_LENGTH).toBe(256)
  })
})

describe('hasTemplate', () => {
  it('is true for a string with a complete binding', () => {
    expect(hasTemplate('a {{ b }}')).toBe(true)
  })

  it('is false for non-strings', () => {
    expect(hasTemplate(1)).toBe(false)
    expect(hasTemplate(null)).toBe(false)
    expect(hasTemplate(undefined)).toBe(false)
    expect(hasTemplate({})).toBe(false)
    expect(hasTemplate(['{{ a }}'])).toBe(false)
  })

  it('is false without braces or with incomplete braces', () => {
    expect(hasTemplate('no braces')).toBe(false)
    expect(hasTemplate('{{ unterminated')).toBe(false)
    expect(hasTemplate('}} {{')).toBe(false)
    expect(hasTemplate('{{')).toBe(false)
  })
})

describe('isInterpolatedProp', () => {
  it.each(['key', 'ref', 'is', 'style', '.style', '^is', 'STYLE', '.Key', '^REF'])('rejects reserved attribute %s', (name) => {
    expect(isInterpolatedProp(name, '{{ a }}')).toBe(false)
  })

  it.each(['to', 'title', '.href', '^title', 'data-key'])('accepts attribute %s with a template', (name) => {
    expect(isInterpolatedProp(name, 'x {{ a }}')).toBe(true)
  })

  it('rejects values without a template', () => {
    expect(isInterpolatedProp('to', 'plain')).toBe(false)
    expect(isInterpolatedProp('to', 1)).toBe(false)
  })
})

describe('basics', () => {
  it('resolves a suffix binding', () => {
    expect(resolve('https://h/r/{{a.id}}', { a: { id: 'x1' } })).toBe('https://h/r/x1')
  })

  it('resolves a binding in the middle', () => {
    expect(resolve('/x/{{a}}/y', { a: 'm' })).toBe('/x/m/y')
  })

  it('resolves a binding at the start', () => {
    expect(resolve('{{a}}/x', { a: 'm' })).toBe('m/x')
  })

  it('resolves multiple bindings', () => {
    expect(resolve('/{{a}}/{{b}}/{{a}}', { a: '1', b: '2' })).toBe('/1/2/1')
  })

  it('accepts whitespace variants', () => {
    expect(resolve('/{{a}}', { a: 'v' })).toBe('/v')
    expect(resolve('/{{  a  }}', { a: 'v' })).toBe('/v')
    expect(resolve('/{{\ta\t}}', { a: 'v' })).toBe('/v')
  })

  it('does not warn on success', () => {
    resolve('/{{a}}', { a: 'v' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not mutate the context', () => {
    const context = Object.freeze({ a: Object.freeze({ b: 'c' }) })
    expect(resolve('/{{a.b}}', context)).toBe('/c')
  })
})

describe('defaults', () => {
  it('uses a single quoted default for a missing value', () => {
    expect(resolve('/{{ a || \'d\' }}', {})).toBe('/d')
  })

  it('uses a double quoted default for a missing value', () => {
    expect(resolve('/{{ a || "d" }}', {})).toBe('/d')
  })

  it('returns an empty string for a missing value without default', () => {
    expect(resolve('/x/{{ a }}', {})).toBe('/x/')
  })

  it('allows special characters in a default', () => {
    expect(resolve('/{{ a || \'{}\' }}', {})).toBe('/{}')
    expect(resolve('/{{ a || \'a|b\' }}', {})).toBe('/a|b')
    expect(resolve('/{{ a || \'x || y\' }}', {})).toBe('/x || y')
    expect(resolve('/{{ a || "x || y" }}', {})).toBe('/x || y')
  })

  it('does not use the default when the value resolves', () => {
    expect(resolve('/{{ a || \'d\' }}', { a: 'v' })).toBe('/v')
  })

  it('keeps a resolved empty string', () => {
    expect(resolve('/{{ a || \'d\' }}', { a: '' })).toBe('/')
  })

  it('accepts no space around the operator', () => {
    expect(resolve('/{{a||\'d\'}}', {})).toBe('/d')
  })

  it('cleans control characters in a default like a value', () => {
    expect(resolve('/{{ a || \'x\ty\' }}', {})).toBe('/x y')
    expect(resolve('/{{ a || \'x\u0000y\' }}', {})).toBe('/xy')
  })
})

describe('paths', () => {
  it('resolves array indexes', () => {
    expect(resolve('/{{ list[0].name }}', { list: [{ name: 'first' }, { name: 'second' }] })).toBe('/first')
    expect(resolve('/{{ list[1].name }}', { list: [{ name: 'first' }, { name: 'second' }] })).toBe('/second')
  })

  it('resolves $doc and $document prefixes', () => {
    const context = { $doc: { title: 'T' }, $document: { title: 'T' } }
    expect(resolve('/{{ $doc.title }}', context)).toBe('/T')
    expect(resolve('/{{ $document.title }}', context)).toBe('/T')
  })

  it('resolves hyphenated keys', () => {
    expect(resolve('/{{ my-key.x }}', { 'my-key': { x: 'h' } })).toBe('/h')
  })

  it('resolves nested frontmatter tags', () => {
    expect(resolve('/{{ post.tags[0] }}', { post: { tags: ['one', 'two'] } })).toBe('/one')
    expect(resolve('/{{ $doc.post.tags[1] }}', { $doc: { post: { tags: ['one', 'two'] } } })).toBe('/two')
  })
})

describe('stringify', () => {
  it('converts numbers', () => {
    expect(resolve('/{{ n }}', { n: 0 })).toBe('/0')
    expect(resolve('/{{ n }}', { n: 1.5 })).toBe('/1.5')
    expect(resolve('/{{ n }}', { n: -3 })).toBe('/-3')
  })

  it('converts booleans', () => {
    expect(resolve('/{{ b }}', { b: true })).toBe('/true')
    expect(resolve('/{{ b }}', { b: false })).toBe('/false')
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['null', null],
    ['undefined', undefined],
    ['object', { a: 1 }],
    ['array', [1, 2]],
    ['function', () => 'x'],
    ['Date', new Date(0)],
    ['symbol', Symbol('s')],
    ['bigint', BigInt(1)],
  ])('treats %s as unresolved', (_name, value) => {
    expect(resolve('/{{ v }}', { v: value })).toBe('/')
    expect(resolve('/{{ v || \'d\' }}', { v: value })).toBe('/d')
  })
})

describe('resolver security', () => {
  it('blocks prototype segments', () => {
    expect(resolve('/{{ __proto__.x }}', {})).toBe('/')
    expect(resolve('/{{ constructor.name }}', {})).toBe('/')
    expect(resolve('/{{ a.constructor.constructor }}', { a: {} })).toBe('/')
    expect(resolve('/{{ a.prototype }}', { a: {} })).toBe('/')
    expect(resolve('/{{ a.__proto__.polluted }}', { a: {} })).toBe('/')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('blocks a blocked segment even when it is an own property', () => {
    const own = JSON.parse('{"__proto__": {"x": "leak"}, "constructor": "c", "prototype": "p"}')
    expect(resolve('/{{ a.__proto__.x }}', { a: own })).toBe('/')
    expect(resolve('/{{ a.constructor }}', { a: own })).toBe('/')
    expect(resolve('/{{ a.prototype }}', { a: own })).toBe('/')
  })

  it('ignores inherited properties', () => {
    const proto = { inherited: 'leak' }
    const child = Object.create(proto) as Record<string, unknown>
    expect(resolve('/{{ toString }}', {})).toBe('/')
    expect(resolve('/{{ a.toString }}', { a: {} })).toBe('/')
    expect(resolve('/{{ a.inherited }}', { a: child })).toBe('/')
    expect(resolve('/{{ a.hasOwnProperty }}', { a: {} })).toBe('/')
  })

  it('never calls functions', () => {
    const fn = vi.fn(() => 'called')
    expect(resolve('/{{ fn }}', { fn })).toBe('/')
    expect(resolve('/{{ a.fn }}', { a: { fn } })).toBe('/')
    expect(resolve('/{{ a.fn.name }}', { a: { fn } })).toBe('/')
    expect(fn).not.toHaveBeenCalled()
  })

  it('does not read through string midpoints', () => {
    expect(resolve('/{{ a.length }}', { a: 'abc' })).toBe('/')
    expect(resolve('/{{ a[0] }}', { a: 'abc' })).toBe('/')
  })

  it.each([
    '$route.query.x',
    '$route',
    'runtimeData.x',
    'updateRuntimeData',
    'a.runtimeData',
    '$doc.$route.x',
    '$doc.runtimeData.x',
    '$document.updateRuntimeData',
    '$doc.tags.X',
    '$document.tags.X',
    'tags.X',
    'tags[0]',
  ])('blocks %s', (path) => {
    // Root `tags` must be a map, so a missing block rule leaks the value.
    const tags = { X: 'secret', 0: 'secret' }
    const context = {
      $route: { query: { x: 'secret' } },
      runtimeData: { x: 'secret' },
      updateRuntimeData: 'secret',
      tags,
      a: { runtimeData: 'secret' },
      $doc: { $route: { x: 'secret' }, runtimeData: { x: 'secret' }, tags },
      $document: { updateRuntimeData: 'secret', tags },
    }
    expect(resolve(`/{{ ${path} }}`, context)).toBe('/')
  })

  it('does not block tags deeper in the path', () => {
    expect(resolve('/{{ $doc.post.tags[0] }}', { $doc: { post: { tags: ['t'] } } })).toBe('/t')
    expect(resolve('/{{ a.b.tags }}', { a: { b: { tags: 'ok' } } })).toBe('/ok')
  })

  it('uses the default for blocked paths', () => {
    expect(resolve('/{{ $route.query.x || \'d\' }}', { $route: { query: { x: 'secret' } } })).toBe('/d')
  })
})

describe('no re-evaluation', () => {
  it('keeps template syntax in a data value literal', () => {
    expect(resolve('x/{{ a }}', { a: '{{ b }}', b: 'LEAK' })).toBe('x/{{ b }}')
  })

  it('keeps template syntax in a default literal', () => {
    expect(resolve('x/{{ a || \'{{ b\' }}', { b: 'LEAK' })).toBe('x/{{ b')
    expect(resolve('x/{{ a || \'{ b }\' }}', { b: 'LEAK' })).toBe('x/{ b }')
  })
})

describe('malformed templates', () => {
  it.each([
    ['unterminated binding', '{{ x'],
    ['single closing brace', '{{ x }'],
    ['triple braces', '{{{ x }}}'],
    ['two identifiers', '{{ a b }}'],
    ['unknown filter raw', '{{ x | raw }}'],
    ['unknown filter encode', '{{ x | encode }}'],
    ['empty body', '{{ }}'],
    ['no body', '{{}}'],
    ['trailing dot', '{{ a.b. }}'],
    ['leading digit', '{{ 1a }}'],
    ['call syntax', '{{ a() }}'],
    ['expression', '{{ a + b }}'],
    ['default with closing braces', '{{ a || \'x}}y\' }}'],
    ['unquoted default', '{{ a || d }}'],
    ['unterminated default', '{{ a || \'d }}'],
    ['second binding malformed', '/{{ a }}/{{ b c }}'],
    ['non-numeric index', '{{ a[b] }}'],
    ['bracket string index', '{{ a["b"] }}'],
  ])('drops %s', (_name, template) => {
    const secret = 'SECRETVALUE'
    expect(resolve(template, { a: secret, x: secret }, 'title')).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    const message = warn.mock.calls[0]!.join(' ')
    expect(message).toBe(`${WARN_PREFIX}title`)
    expect(message).not.toContain(secret)
    expect(message).not.toContain('{{')
  })
})

describe('caps', () => {
  it('drops a template over the length cap', () => {
    const template = `{{ a }}${'x'.repeat(MAX_TEMPLATE_LENGTH + 1 - 7)}`
    expect(template).toHaveLength(MAX_TEMPLATE_LENGTH + 1)
    expect(resolve(template, { a: 'v' })).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('allows a template of exactly the length cap', () => {
    const template = `{{a}}${'x'.repeat(MAX_TEMPLATE_LENGTH - 5)}`
    expect(template).toHaveLength(MAX_TEMPLATE_LENGTH)
    const output = resolve(template, { a: '' })
    expect(output).toHaveLength(MAX_TEMPLATE_LENGTH - 5)
    expect(warn).not.toHaveBeenCalled()
  })

  it('drops more bindings than the cap', () => {
    expect(resolve('{{a}}'.repeat(MAX_BINDINGS + 1), { a: 'v' })).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('allows exactly the maximum number of bindings', () => {
    expect(resolve('{{a}}'.repeat(MAX_BINDINGS), { a: 'v' })).toBe('v'.repeat(MAX_BINDINGS))
  })

  it('drops a binding body over the cap', () => {
    const body = 'a'.repeat(MAX_BINDING_LENGTH + 1)
    expect(resolve(`{{ ${body} }}`, { [body]: 'v' })).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('allows a binding body at the cap', () => {
    const body = 'a'.repeat(MAX_BINDING_LENGTH)
    expect(resolve(`/{{${body}}}`, { [body]: 'v' })).toBe('/v')
  })

  it('drops an output over the length cap', () => {
    expect(resolve('/{{ a }}', { a: 'x'.repeat(MAX_TEMPLATE_LENGTH + 10) })).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('allows an output at the length cap', () => {
    const output = resolve('/{{ a }}', { a: 'x'.repeat(MAX_TEMPLATE_LENGTH - 1) })
    expect(output).toHaveLength(MAX_TEMPLATE_LENGTH)
  })
})

describe('control characters', () => {
  it.each([
    ['tab', 'java\tscript:alert(1)'],
    ['newline', 'java\nscript:alert(1)'],
    ['carriage return', 'java\rscript:alert(1)'],
    ['nul', 'java\u0000script:alert(1)'],
    ['delete', 'java\u007Fscript:alert(1)'],
    ['leading nul', '\u0000javascript:alert(1)'],
  ])('drops a %s smuggled scheme', (_name, value) => {
    expect(resolve('{{ u }}', { u: value }, 'to')).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('turns line breaks and tabs into one space', () => {
    expect(resolve('{{ d }}', { d: 'Line one\nLine two' }, 'title')).toBe('Line one Line two')
    expect(resolve('{{ d }}', { d: 'one\r\ntwo' }, 'aria-label')).toBe('one two')
    expect(resolve('/{{ a }}', { a: 'a\tb' })).toBe('/a b')
    expect(resolve('{{ x || \'a\nb\' }}', {}, 'title')).toBe('a b')
  })

  it('strips other control characters from a benign value', () => {
    expect(resolve('/{{ a }}', { a: 'a\u0000b\u007Fc\u001Fd' })).toBe('/abcd')
    expect(resolve('/{{ a }}', { a: 'a\nb\u0000c' })).toBe('/a bc')
  })

  it.each([
    '\njavascript:alert(1)',
    'java\n\tscript:alert(1)',
    'java\r\nscript:alert(1)',
    'vb\tscript:x',
  ])('still drops a scheme hidden behind line breaks: %j', (value) => {
    expect(resolve('{{ u }}', { u: value }, 'to')).toBeUndefined()
    expect(resolve('{{ u }}', { u: value }, 'href')).toBeUndefined()
  })

  it('keeps non-control whitespace and unicode', () => {
    expect(resolve('/{{ a }}', { a: 'a b é' })).toBe('/a b é')
  })
})

describe('final validation', () => {
  it.each(['to', 'href', 'url', 'title'])('drops dangerous schemes for %s', (attribute) => {
    for (const u of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'vbscript:x',
      'data:text/html,<script>alert(1)</script>',
    ]) {
      expect(resolve('{{ u }}', { u }, attribute)).toBeUndefined()
    }
    expect(warn).toHaveBeenCalledTimes(5)
  })

  it('drops a scheme assembled from several bindings', () => {
    expect(resolve('{{a}}{{b}}', { a: 'java', b: 'script:alert(1)' })).toBeUndefined()
  })

  it('drops a scheme assembled from literal text and a value', () => {
    expect(resolve('javascript:{{a}}', { a: 'alert(1)' })).toBeUndefined()
  })

  it('drops percent encoded schemes', () => {
    expect(resolve('{{ u }}', { u: '%6Aavascript:alert(1)' })).toBeUndefined()
  })

  it('drops malformed percent encoding without throwing', () => {
    expect(() => resolve('{{ u }}', { u: '%' }, 'href')).not.toThrow()
    expect(resolve('{{ u }}', { u: '%' }, 'href')).toBeUndefined()
    expect(resolve('{{ u }}', { u: '%E0%A4%A' }, 'href')).toBeUndefined()
  })

  it.each(['onclick', 'srcdoc', 'onerror', '.onclick', 'formaction'])('drops the unsafe attribute %s', (attribute) => {
    expect(resolve('{{ a }}', { a: 'harmless' }, attribute)).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]!.join(' ')).toBe(`${WARN_PREFIX}${attribute}`)
  })

  it('does not throw on a lone surrogate', () => {
    expect(() => resolve('{{ a }}', { a: '\uD800' })).not.toThrow()
  })
})

describe('valid values', () => {
  it('returns safe values', () => {
    expect(resolve('{{ u }}', { u: 'https://ok.example/a' })).toBe('https://ok.example/a')
    expect(resolve('{{ u }}', { u: '/p?x=1' })).toBe('/p?x=1')
    expect(resolve('mailto:{{e}}', { e: 'a@b.c' })).toBe('mailto:a@b.c')
    expect(resolve('tel:{{n}}', { n: '+123' })).toBe('tel:+123')
    expect(resolve('?q={{x}}', { x: 'v' })).toBe('?q=v')
    expect(resolve('#{{x}}', { x: 'v' })).toBe('#v')
    expect(warn).not.toHaveBeenCalled()
  })

  it('inserts values verbatim without encoding', () => {
    expect(resolve('/s?q={{ x }}', { x: 'a b&c=d' })).toBe('/s?q=a b&c=d')
  })

  it('allows text with a colon in a title', () => {
    expect(resolve('Note: {{x}}', { x: 'v' }, 'title')).toBe('Note: v')
    expect(resolve('Version {{ v || \'1.0\' }}', {}, 'title')).toBe('Version 1.0')
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('warn behaviour', () => {
  it('warns once with the attribute name only', () => {
    expect(resolve('{{ u }}', { u: 'javascript:SECRETPAYLOAD' }, 'href')).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    const args = warn.mock.calls[0]!
    expect(args).toHaveLength(1)
    expect(args[0]).toBe(`${WARN_PREFIX}href`)
  })
})

describe('reactivity', () => {
  it('tracks the key read so a watcher re-runs on change', () => {
    const context = reactive<Record<string, unknown>>({ a: { id: 'one' } })
    const seen: Array<string | undefined> = []
    const stop = watchEffect(() => {
      seen.push(resolvePropTemplate('/x/{{ a.id }}', context, { attribute: 'to' }))
    }, { flush: 'sync' })
    expect(seen).toEqual(['/x/one'])
    ;(context.a as Record<string, unknown>).id = 'two'
    expect(seen).toEqual(['/x/one', '/x/two'])
    context.a = { id: 'three' }
    expect(seen).toEqual(['/x/one', '/x/two', '/x/three'])
    stop()
  })

  it('tracks a key that does not exist yet', () => {
    const context = reactive<Record<string, unknown>>({})
    const seen: Array<string | undefined> = []
    const stop = watchEffect(() => {
      seen.push(resolvePropTemplate('/x/{{ a }}', context, { attribute: 'to' }))
    }, { flush: 'sync' })
    context.a = 'later'
    expect(seen).toEqual(['/x/', '/x/later'])
    stop()
  })
})

describe('performance', () => {
  const cases: Array<[string, string]> = [
    ['spaces in an open binding', `{{${' '.repeat(4000)}`],
    ['repeated open braces', '{{ '.repeat(1300)],
    ['repeated single close braces', `{{${'} '.repeat(2000)}`],
    ['over-cap input', `{{${' '.repeat(100000)}`],
    ['long closed body of spaces', `{{${' '.repeat(3000)}}}`],
    ['long default with pipes', `{{ a || '${'|'.repeat(200)}`],
  ]

  it.each(cases)('drops %s quickly', (_name, template) => {
    const start = performance.now()
    const output = resolve(template, {})
    const elapsed = performance.now() - start
    expect(output).toBeUndefined()
    // A cubic pattern needs seconds here, so a loose limit still guards it.
    expect(elapsed).toBeLessThan(500)
  })
})

describe('non-link props', () => {
  it('keeps a percent sign in text props', () => {
    expect(resolve('Save {{ n }}%', { n: 50 }, 'title')).toBe('Save 50%')
    expect(resolve('{{ n }}%', { n: '100' }, 'label')).toBe('100%')
  })

  it('keeps text that is not a valid URL in text props', () => {
    expect(resolve('See {{ u }}', { u: 'http://' }, 'title')).toBe('See http://')
    expect(resolve('{{ u }}', { u: '//' }, 'title')).toBe('//')
  })

  it('still drops a malformed percent sequence in link props', () => {
    expect(resolve('{{ n }}%', { n: '100' }, 'href')).toBeUndefined()
    expect(resolve('{{ n }}%', { n: '100' }, 'src')).toBeUndefined()
  })

  it('still drops an unsafe scheme next to a malformed percent sequence', () => {
    expect(resolve('{{ u }}%', { u: 'javascript:alert(1)' }, 'to')).toBeUndefined()
    expect(resolve('{{ u }}%', { u: 'vbscript:x' }, 'title')).toBeUndefined()
  })
})

describe('hostile context', () => {
  it('drops the prop when a getter throws', () => {
    const context = {
      x: {
        get y(): string {
          throw new Error('boom')
        },
      },
    }
    expect(() => resolve('/{{ x.y }}', context)).not.toThrow()
    expect(resolve('/{{ x.y }}', context)).toBeUndefined()
    expect(warn).toHaveBeenCalledWith(`${WARN_PREFIX}to`)
  })

  it('drops the prop when a proxy trap throws', () => {
    const trap = new Proxy({}, {
      has() {
        throw new Error('boom')
      },
      get() {
        throw new Error('boom')
      },
      getOwnPropertyDescriptor() {
        throw new Error('boom')
      },
    })
    expect(() => resolve('/{{ x.y }}', { x: trap })).not.toThrow()
    expect(resolve('/{{ x.y }}', { x: trap })).toBeUndefined()
  })

  it('drops the prop when a proxy is revoked', () => {
    const { proxy, revoke } = Proxy.revocable({ y: 'v' }, {})
    revoke()
    expect(resolve('/{{ x.y }}', { x: proxy })).toBeUndefined()
  })

  it('does not run a getter on an inherited key', () => {
    const getter = vi.fn(() => 'called')
    const proto = Object.defineProperty({}, 'y', { get: getter })
    const child = Object.create(proto) as Record<string, unknown>
    expect(resolve('/{{ x.y }}', { x: child })).toBe('/')
    expect(getter).not.toHaveBeenCalled()
  })

  it('drops early when inserted values exceed the cap', () => {
    const big = 'a'.repeat(5_000_000)
    const start = performance.now()
    const template = Array.from({ length: MAX_BINDINGS }, () => '{{ a }}').join('')
    expect(resolve(template, { a: big })).toBeUndefined()
    expect(performance.now() - start).toBeLessThan(500)
  })
})

describe('script-capable data URLs', () => {
  it.each([
    'data: text/html,<script>alert(1)</script>',
    'data: application/xhtml+xml,<html/>',
  ])('drops %j in any prop', (value) => {
    for (const attribute of ['src', 'to', 'title']) {
      expect(resolve('{{ v }}', { v: value }, attribute)).toBeUndefined()
    }
  })
})

describe('isInterpolatedProp keeps legacy values', () => {
  it.each([
    '[{"label":"{{ name }}"}]',
    '{"template":"Hello {{ name }}"}',
    '["{{ a }}", "{{ b }}"]',
    ' {"a": "{{ x }}"} ',
  ])('skips JSON object and array values: %s', (value) => {
    expect(isInterpolatedProp('items', value)).toBe(false)
  })

  it.each([
    '{{ a }}',
    '{{ a }} and {{ b }}',
    '[{{ a }}]',
    '{{ a }}}',
    '/x/{{ a }}',
  ])('still interpolates invalid JSON: %s', (value) => {
    expect(isInterpolatedProp('items', value)).toBe(true)
  })

  it.each([
    ['unterminated binding', 'Use {{ name'],
    ['filter syntax', 'Use {{ name | upper }}'],
    ['empty binding', 'Use {{ }}'],
    ['expression', 'Use {{ a + b }}'],
    ['trailing dot', '/x/{{ a.b. }}'],
    ['default with close braces', '{{ a || \'x}}y\' }}'],
    ['over the length cap', `{{ a }}${'x'.repeat(MAX_TEMPLATE_LENGTH)}`],
    ['too many bindings', '{{ a }}'.repeat(MAX_BINDINGS + 1)],
    ['body over the length cap', `{{ ${'a'.repeat(MAX_BINDING_LENGTH)} }}`],
  ])('skips a malformed template (%s)', (_name, value) => {
    expect(isInterpolatedProp('title', value)).toBe(false)
  })

  it('does not warn when it skips a value', () => {
    isInterpolatedProp('title', 'Use {{ name | upper }}')
    isInterpolatedProp('items', '["{{ a }}"]')
    expect(warn).not.toHaveBeenCalled()
  })

  it('still drops a malformed template in resolvePropTemplate', () => {
    expect(resolve('Use {{ name | upper }}', {}, 'title')).toBeUndefined()
  })
})

describe('path syntax', () => {
  it.each([
    ['unicode letters', '/{{ café }}', { café: 'z' }, '/z'],
    ['non-latin keys', '/{{ 日本.名前 }}', { 日本: { 名前: 'n' } }, '/n'],
    ['numeric dot segment', '/{{ a.0 }}', { a: ['first'] }, '/first'],
    ['numeric segment in the middle', '/{{ a.1.b }}', { a: [{}, { b: 'x' }] }, '/x'],
    ['numeric segment under $doc', '/{{ $doc.items.1 }}', { $doc: { items: ['a', 'b'] } }, '/b'],
  ])('resolves %s', (_name, template, context, expected) => {
    expect(resolve(template, context)).toBe(expected)
  })

  it.each([
    ['numeric first segment', '{{ 1 }}'],
    ['leading dot', '{{ .a }}'],
    ['double dot', '{{ a..b }}'],
    ['trailing dot', '{{ a. }}'],
    ['bracket text index', '{{ a[b] }}'],
    ['space in a path', '{{ a b }}'],
  ])('rejects %s', (_name, template) => {
    expect(resolve(template, { a: ['x'] })).toBeUndefined()
  })

  it('stays linear on long dotted paths', () => {
    const start = performance.now()
    expect(resolve(`{{ ${'a.'.repeat(120)}! }}`, {})).toBeUndefined()
    expect(resolve(`{{ ${'é'.repeat(250)}! }}`, {})).toBeUndefined()
    expect(performance.now() - start).toBeLessThan(500)
  })
})
