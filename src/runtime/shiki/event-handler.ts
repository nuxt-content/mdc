import type { Lang } from 'shiki-es'
import { eventHandler, getQuery } from 'h3'
import { useShikiHighlighter } from './highlighter'
import type { Theme, TokenStyleMap } from './types'

export default eventHandler(async (event) => {
  const { code, lang, theme: themeString, highlights: highlightsString } = getQuery(event)
  const theme = JSON.parse(themeString as string)
  const highlights = JSON.parse(highlightsString as string) as number[]

  const shikiHighlighter = useShikiHighlighter({})

  const styleMap: TokenStyleMap = {}

  const { tree, className } = await shikiHighlighter.getHighlightedAST(code as string, lang as Lang, theme as Theme, { styleMap, highlights })

  return {
    tree,
    className,
    style: shikiHighlighter.generateStyles(styleMap),
    styleMap
  }
})
