import { getQuery } from 'h3'
import { cachedEventHandler } from '#imports'

export default cachedEventHandler(async (event) => {
  const { code, lang, theme: themeString, options: optionsStr } = getQuery(event)
  const theme = JSON.parse(themeString as string)
  const options = optionsStr ? JSON.parse(optionsStr as string) : {}
  const highlighter = await import('#mdc-highlighter').then(m => m.default)
  return await highlighter(code, lang, theme, options)
}, {
  maxAge: 60 * 60 * 24 * 30,
  swr: true
})
