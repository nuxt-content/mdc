import { getQuery } from 'h3'
import { useRuntimeConfig } from '#imports'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const tag = String(query.tag || '')

  const config = useRuntimeConfig()
  const customElements = config.public?.mdc?.components?.customElements || []

  return {
    tag,
    isCustomElement: customElements.includes(tag),
  }
})
