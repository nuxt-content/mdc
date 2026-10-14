import { isAnchorLinkAllowed, validateProp } from '../parser/utils/props'

/** Maximum length of a template and of the assembled output. */
export const MAX_TEMPLATE_LENGTH = 4096

/** Maximum number of `{{ }}` bindings in one template. */
export const MAX_BINDINGS = 16

/** Maximum length of the text between `{{` and `}}`. */
export const MAX_BINDING_LENGTH = 256

/** Options for `resolvePropTemplate`. */
export interface ResolvePropTemplateOptions {
  /** Prop name without the `:` or `v-bind:` prefix. Used for validation and warnings. */
  attribute: string
}

const RESERVED_ATTRIBUTES = ['key', 'ref', 'is', 'style']
const BLOCKED_SEGMENTS = ['__proto__', 'constructor', 'prototype', '$route', 'runtimeData', 'updateRuntimeData']

/** One anchored pattern with no nested quantifiers, so matching is linear. */
const BINDING_PATTERN = /^([A-Z_$][\w$-]*(?:\.[A-Z_$][\w$-]*|\[\d+\])*)(?:[ \t]*\|\|[ \t]*(?:'([^']*)'|"([^"]*)"))?$/i

/** Control characters allow scheme smuggling such as `java\tscript:`. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/g

/**
 * Check if a value is a string with a `{{` followed later by `}}`.
 * Runs in linear time.
 *
 * @param value - Value to check.
 */
export function hasTemplate(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }
  const start = value.indexOf('{{')
  return start !== -1 && value.includes('}}', start + 2)
}

/** One parsed binding. */
interface Binding {
  /** Dotted path with optional index segments. */
  path: string
  /** Text used when the path does not resolve. */
  fallback: string
}

type TemplatePart = string | Binding

/** The parser stringifies object and array props to JSON. Those values keep their type. */
function isStructuredJson(value: string) {
  const first = value.trimStart()[0]
  if (first !== '[' && first !== '{') {
    return false
  }
  try {
    return typeof JSON.parse(value) === 'object'
  }
  catch {
    return false
  }
}

/**
 * Split a template into text and bindings.
 * Returns `undefined` when the template is malformed or over a limit.
 * Every cap is checked before any regex runs.
 */
function parseTemplate(template: string): TemplatePart[] | undefined {
  if (template.length > MAX_TEMPLATE_LENGTH) {
    return undefined
  }

  const bodies: Array<string | { body: string }> = []
  let position = 0
  let bindings = 0

  while (position < template.length) {
    const open = template.indexOf('{{', position)
    if (open === -1) {
      bodies.push(template.slice(position))
      break
    }
    const close = template.indexOf('}}', open + 2)
    if (close === -1) {
      return undefined
    }
    bindings++
    if (bindings > MAX_BINDINGS || close - (open + 2) > MAX_BINDING_LENGTH) {
      return undefined
    }
    if (open > position) {
      bodies.push(template.slice(position, open))
    }
    bodies.push({ body: template.slice(open + 2, close) })
    position = close + 2
  }

  const parts: TemplatePart[] = []
  for (const part of bodies) {
    if (typeof part === 'string') {
      parts.push(part)
      continue
    }
    const match = BINDING_PATTERN.exec(part.body.trim())
    if (!match) {
      return undefined
    }
    parts.push({ path: match[1]!, fallback: match[2] ?? match[3] ?? '' })
  }
  return parts
}

/**
 * Check if a prop value must be interpolated.
 * Other values keep the legacy behavior. These are:
 * - Reserved attributes `key`, `ref`, `is` and `style`.
 * - JSON object and array values.
 * - Malformed templates and templates over a limit.
 *
 * @param attribute - Prop name without the `:` or `v-bind:` prefix.
 * @param value - Prop value.
 */
export function isInterpolatedProp(attribute: string, value: unknown): boolean {
  const name = attribute.toLowerCase().replace(/^[.^]/, '')
  return !RESERVED_ATTRIBUTES.includes(name)
    && hasTemplate(value)
    && !isStructuredJson(value as string)
    && parseTemplate(value as string) !== undefined
}

function isBlocked(segments: string[], index: number) {
  const segment = segments[index]!
  if (BLOCKED_SEGMENTS.includes(segment)) {
    return true
  }
  if (segment !== 'tags') {
    return false
  }
  return index === 0 || (index === 1 && (segments[0] === '$doc' || segments[0] === '$document'))
}

function resolvePath(path: string, context: Record<string, unknown>): string | undefined {
  const segments = path.split(/\.|\[(\d+)\]/).filter(Boolean)
  let current: unknown = context

  for (let index = 0; index < segments.length; index++) {
    if (isBlocked(segments, index)) {
      return undefined
    }
    if (typeof current !== 'object' || current === null) {
      return undefined
    }
    const segment = segments[index]!
    // `in` tracks the key on Vue proxies. A getter on the prototype chain never runs.
    if (!(segment in current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }

  if (typeof current === 'string') {
    return current
  }
  if ((typeof current === 'number' && Number.isFinite(current)) || typeof current === 'boolean') {
    return String(current)
  }
  return undefined
}

function drop(attribute: string): undefined {
  console.warn('[@nuxtjs/mdc] removing invalid or unsafe dynamic attribute: ' + attribute)
  return undefined
}

/**
 * Replace `{{ path || 'default' }}` bindings in a prop template with context values.
 * The result is always a string. No JavaScript runs.
 * Values are inserted once and never evaluated again.
 *
 * @param template - Prop value that contains bindings.
 * @param context - Data used to resolve paths. The function does not change it.
 * @param options - Resolve options.
 * @returns The assembled string, or `undefined` when the prop must be dropped.
 */
export function resolvePropTemplate(
  template: string,
  context: Record<string, unknown>,
  options: ResolvePropTemplateOptions,
): string | undefined {
  const { attribute } = options

  const parts = parseTemplate(template)
  if (!parts) {
    return drop(attribute)
  }

  // Context data is not trusted. A getter or proxy trap can throw.
  try {
    let output = ''
    for (const part of parts) {
      if (typeof part === 'string') {
        output += part
        continue
      }
      const value = resolvePath(part.path, context) ?? part.fallback
      output += value.replace(CONTROL_CHARACTERS, '')
      // Stop early, so a huge value cannot grow the output.
      if (output.length > MAX_TEMPLATE_LENGTH) {
        return drop(attribute)
      }
    }

    // `validateProp` stays strict for link props. The scheme check is lenient so text such as `50%` survives.
    if (!validateProp(attribute, output) || !isAnchorLinkAllowed(output, { lenient: true })) {
      return drop(attribute)
    }
    return output
  }
  catch {
    return drop(attribute)
  }
}
