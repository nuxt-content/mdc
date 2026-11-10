export const unsafeTags = [
  'object',
]

export const unsafeAttributes = [
  'srcdoc',
  'formaction',
  'innerhtml',
  'outerhtml',
]

export const unsafeLinkPrefix = [
  'javascript:',
  'data:text/html',
  'vbscript:',
  'data:text/javascript',
  'data:text/vbscript',
  'data:text/css',
  'data:text/plain',
  'data:text/xml',
]

function isAnchorLinkAllowed(value: string) {
  const decodedUrl = decodeURIComponent(value)
  const urlSanitized = decodedUrl.replace(/&#x([0-9a-f]+);?/gi, '')
    .replace(/&#(\d+);?/g, '')
    .replace(/&[a-z]+;?/gi, '')

  try {
    const url = new URL(urlSanitized, 'http://example.com')
    if (url.origin === 'http://example.com') {
      return true
    }

    if (unsafeLinkPrefix.some(prefix => url.href.toLowerCase().startsWith(prefix))) {
      return false
    }
  }
  catch {
    return false
  }

  return true
}

/**
 * Props whose value must be a string, as components use them to pick the element or component to render.
 */
const componentSelectors = ['as', 'is', 'tag']

/**
 * Keys that make a plain object a Vue component definition.
 * Markdown and JSON can't carry functions, so an object with these keys is never a legit component.
 */
const componentOptionKeys = new Set(['template', 'render', 'ssrrender', 'setup', 'extends', 'mixins'])

/**
 * Prefix of Vue's internal markers, such as `__v_isVNode`: an object with one is treated as a VNode or reactive value.
 */
const vueInternalKeyPrefix = '__v_'

/**
 * Whether a prop value could make Vue treat it as a component or VNode:
 * `as` / `is` / `tag` must be strings, and no object at any depth may carry component options or Vue internal markers.
 */
export const isComponentPropViolation = (attribute: string, value: unknown) => {
  if (componentSelectors.includes(normalizePropName(attribute)) && typeof value !== 'string') {
    return true
  }
  // Iterative with a visited set: cyclic or shared values neither overflow the stack nor get scanned twice
  const seen = new Set<object>()
  const pending: unknown[] = [value]
  while (pending.length) {
    const current = pending.pop()
    if (typeof current !== 'object' || current === null || seen.has(current)) {
      continue
    }
    seen.add(current)
    for (const [key, item] of Object.entries(current)) {
      const name = key.toLowerCase()
      if (!Array.isArray(current) && (componentOptionKeys.has(name) || name.startsWith(vueInternalKeyPrefix))) {
        return true
      }
      pending.push(item)
    }
  }
  return false
}

const rxBinding = /^(?::|v-bind:)/

function normalizePropName(attribute: string) {
  return attribute.toLowerCase()
    // `:`/`v-bind:` bindings, then Vue's `.prop` / `^attr` force modifiers
    .replace(/^(?::|v-bind:)?[.^]?/, '')
    .replace(/^(@|v-on:)/, 'on')
}

/**
 * Decode a bound (`:prop` / `v-bind`) value the way the renderer does, so it can be checked as a JS value.
 * Values that are not JSON are paths into the document data, checked by the renderer once resolved.
 */
function decodeBoundValue(attribute: string, value: unknown) {
  if ((attribute === 'v-bind' || rxBinding.test(attribute)) && typeof value === 'string') {
    try {
      return JSON.parse(value)
    }
    catch {
      return value
    }
  }
  return value
}

export const validateProp = (attribute: string, value: any) => {
  const decoded = decodeBoundValue(attribute, value)
  // `v-bind='{...}'` spreads its keys as props
  const boundProps = attribute === 'v-bind' && typeof decoded === 'object' && decoded !== null ? decoded : { [attribute]: decoded }
  if (Object.entries(boundProps).some(([key, item]) => isComponentPropViolation(key, item))) {
    return false
  }

  attribute = normalizePropName(attribute)
  if (attribute.startsWith('on') || unsafeAttributes.includes(attribute)) {
    return false
  }

  if (attribute === 'href' || attribute === 'src' || attribute === 'xlinkhref' || attribute === 'action') {
    return isAnchorLinkAllowed(value)
  }

  return true
}

export const validateProps = (type: string, props?: Record<string, any>) => {
  /**
   * If the tag is marked as unsafe, drop all props
   */
  if (unsafeTags.includes(type.toLowerCase())) {
    return {}
  }

  if (!props) {
    return {}
  }
  props = Object.fromEntries(
    Object.entries(props).filter(([name, value]) => {
      // remove duplicate props `:name` and `name`
      if (props?.[`:${name}`]) {
        return false
      }
      const isValid = validateProp(name, value)

      if (!isValid) {
        console.warn(`[@nuxtjs/mdc] removing unsafe attribute: ${name}="${value}"`)
      }

      return isValid
    }),
  )

  if (type === 'pre') {
    if (typeof props.highlights === 'string') {
      props.highlights = props.highlights.split(' ').map(i => Number.parseInt(i))
    }
  }

  return props
}
