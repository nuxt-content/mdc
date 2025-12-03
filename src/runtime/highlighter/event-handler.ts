import { getQuery, type H3Event } from 'h3'
// @ts-expect-error - cachedEventHandler is not exported from h3
import { cachedEventHandler } from '#imports'

export default cachedEventHandler(async (event: H3Event) => {
  const { code, lang, theme: themeString, options: optionsStr } = getQuery(event)
  const theme = JSON.parse(themeString as string)
  const options = optionsStr ? JSON.parse(optionsStr as string) : {}
  const highlighter = await import('#mdc-highlighter').then(m => m.default)
  return await highlighter(code, lang, theme, options)
}, {
  maxAge: 60 * 60 * 24 * 30,
  swr: true,
})
