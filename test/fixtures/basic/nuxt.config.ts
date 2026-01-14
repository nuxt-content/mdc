import NuxtMDC from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    NuxtMDC,
  ],
  mdc: {
    components: {
      customElements: ['x-foo'],
    },
  },
  future: {
    compatibilityVersion: 4,
  },
  compatibilityDate: '2025-03-19',
})
