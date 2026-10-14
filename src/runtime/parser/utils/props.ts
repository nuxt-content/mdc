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
  'data:application/xhtml+xml',
  'data:application/xml',
]

/**
 * Options for `isAnchorLinkAllowed`.
 * @internal
 */
export interface AnchorLinkOptions {
  /** Accept values that are not decodable or not a valid URL. Only unsafe schemes fail. Use it for props that are not links. */
  lenient?: boolean
}

/**
 * Check if a value is a safe link target.
 *
 * @param value - Link value to check.
 * @param options - Check options.
 * @internal
 */
export function isAnchorLinkAllowed(value: string, options: AnchorLinkOptions = {}) {
  const { lenient = false } = options
  let decodedUrl = value
  try {
    decodedUrl = decodeURIComponent(value)
  }
  catch {
    // Malformed encoding is unsafe in a link.
    if (!lenient) {
      return false
    }
  }

  const urlSanitized = decodedUrl.replace(/&#x([0-9a-f]+);?/gi, '')
    .replace(/&#(\d+);?/g, '')
    .replace(/&[a-z]+;?/gi, '')

  try {
    const url = new URL(urlSanitized, 'http://example.com')
    if (url.origin === 'http://example.com') {
      return true
    }

    // The media type parser ignores spaces after `data:`, so `data: text/html` is still HTML.
    const href = url.href.toLowerCase().replace(/^data:\s+/, 'data:')
    if (unsafeLinkPrefix.some(prefix => href.startsWith(prefix))) {
      return false
    }
  }
  catch {
    return lenient
  }

  return true
}

export const validateProp = (attribute: string, value: string) => {
  attribute = attribute.toLowerCase()
    // `:`/`v-bind:` bindings, then Vue's `.prop` / `^attr` force modifiers
    .replace(/^(?::|v-bind:)?[.^]?/, '')
    .replace(/^(@|v-on:)/, 'on')
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
