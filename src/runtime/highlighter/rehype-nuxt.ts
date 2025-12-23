import type { HighlightResult, RehypeHighlightOption } from '@nuxtjs/mdc'
import { rehypeHighlight as rehypeHighlightUniversal } from './rehype'

class HighlighterError extends Error {
  constructor(
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message)
    this.name = 'HighlighterError'
  }
}

function isHighlightResult(res?: HighlightResult): res is HighlightResult {
  if (!res) return false
  return 'tree' in res
}

const defaults: RehypeHighlightOption = {
  theme: {},
  async highlighter(code, lang, theme, options) {
    try {
      if (import.meta.client && window.sessionStorage.getItem('mdc-shiki-highlighter') === 'browser') {
        return import('#mdc-highlighter').then(h => h.default(code, lang, theme, options)).catch(() => ({}))
      }

      const result = await $fetch<HighlightResult | undefined>('/api/_mdc/highlight', {
        params: {
          code,
          lang,
          theme: JSON.stringify(theme),
          options: JSON.stringify(options),
        },
      })
      if (!isHighlightResult(result)) {
        throw new HighlighterError(`result:${result}`)
      }
      return result
    }
    catch (e: any) {
      if (import.meta.client && (e?.response?.status > 399 || e?.name == 'HighlighterError')) {
        window.sessionStorage.setItem('mdc-shiki-highlighter', 'browser')
        return this.highlighter?.(code, lang, theme, options)
      }
    }

    return Promise.resolve({ tree: [{ type: 'text', value: code }], className: '', style: '' } as HighlightResult)
  },
}
export default rehypeHighlight

export function rehypeHighlight(opts: Partial<RehypeHighlightOption> = {}) {
  const options = { ...defaults, ...opts } as RehypeHighlightOption

  if (typeof options.highlighter !== 'function') {
    options.highlighter = defaults.highlighter
  }

  return rehypeHighlightUniversal(options)
}
