/**
 * Parses the value defined next to 3 back ticks
 * in a codeblock and set line-highlights or
 * filename from it
 *
 * Supports icon syntax: [filename|icon|position]
 * Examples:
 *   [Script|logos:python|right] - filename with icon on right
 *   [Script|logos:python] - filename with icon on left (default)
 *   [|logos:python|right] - icon only, no filename
 */
export function parseThematicBlock(lang: string) {
  /**
   * Language property on node is missing
   */
  if (!lang?.trim()) {
    return {
      language: undefined,
      highlights: undefined,
      filename: undefined,
      meta: undefined,
      icon: undefined,
      iconPosition: undefined,
    }
  }

  const languageMatches = lang.replace(/[{|[](.+)/, '').match(/^[^ \t]+(?=[ \t]|$)/)
  const highlightTokensMatches = lang.match(/\{([^}]*)\}/)
  const filenameMatches = lang.match(/\[(.*)\]/)

  const meta = lang
    .replace(languageMatches?.[0] ?? '', '')
    .replace(highlightTokensMatches?.[0] ?? '', '')
    .replace(filenameMatches?.[0] ?? '', '')
    .trim()

  // Process filename and extract icon syntax
  let filename: string | undefined
  let icon: string | undefined
  let iconPosition: 'left' | 'right' | undefined

  if (filenameMatches?.[1]) {
    const bracketContent = filenameMatches[1]

    // Check if it contains pipe delimiter for icon syntax
    if (bracketContent.includes('|')) {
      const parts = bracketContent.split('|')
      // [filename|icon] or [filename|icon|position]
      const rawFilename = parts[0]?.trim()
      const rawIcon = parts[1]?.trim()
      const rawPosition = parts[2]?.trim()

      filename = rawFilename || undefined
      icon = rawIcon || undefined
      if (rawPosition === 'left' || rawPosition === 'right') {
        iconPosition = rawPosition
      }
    }
    else {
      // Only unescape special regex characters but preserve path backslashes
      filename = bracketContent.replace(/\\([[\]{}().*+?^$|])/g, '$1')
    }
  }

  return {
    language: languageMatches?.[0] || undefined,
    highlights: parseHighlightedLines(highlightTokensMatches?.[1] || undefined),
    // https://github.com/nuxt/content/pull/2169
    filename,
    meta,
    icon,
    iconPosition,
  }
}

function parseHighlightedLines(lines?: string | null) {
  const lineArray = String(lines || '')
    .split(',')
    .filter(Boolean)
    .flatMap((line) => {
      const [start, end] = line.trim().split('-').map(a => Number(a.trim()))
      return Array.from({ length: (end || start || 0) - ((start || 0)) + 1 }).map((_, i) => (start || 0) + i)
    })
  return lineArray.length ? lineArray : undefined
}

const TAG_NAME_REGEXP = /^<\/?([\w-]+)(\s[^>]*?)?\/?>/
export function getTagName(value: string) {
  const result = String(value).match(TAG_NAME_REGEXP)

  return result && result[1]
}
