import { defineNuxtModule, extendViteConfig, addComponent, addComponentsDir, createResolver, addServerHandler, addTemplate, addImports, addServerImports, useNitro } from '@nuxt/kit'
import fs from 'fs'
import { mdcImportTemplate } from './utils/templates'
import type { ModuleOptions } from './types'
import { defu } from 'defu'
import { registerMDCSlotTransformer } from './utils/vue-mdc-slot'
import { pathToFileURL } from 'url'
import type { Theme } from './runtime/shiki/types'

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@nuxtjs/mdc',
    configKey: 'mdc'
  },
  // Default configuration options of the Nuxt module
  defaults: {
    remarkPlugins: {},
    rehypePlugins: {},
    highlight: false,
    headings: {
      anchorLinks: {
        h1: false,
        h2: true,
        h3: true,
        h4: true,
        h5: false,
        h6: false
      }
    },
    components: {
      prose: true,
      map: {}
    }
  },
  async setup (options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.options.runtimeConfig.public.mdc = defu(nuxt.options.runtimeConfig.public.mdc, {
      components: {
        prose: options.components!.prose!,
        map: options.components!.map!
      },
      headings: options.headings!
    })

    // @ts-ignore
    nuxt.options.runtimeConfig.mdc = defu(nuxt.options.runtimeConfig.mdc, {
      highlight: options.highlight ? {
        theme: options.highlight!.theme!,
        preload: options.highlight!.preload!,
        wrapperStyle: options.highlight!.wrapperStyle!
      } : {}
    })

    nuxt.hook('vite:extendConfig', (viteConfig) => {
      const optimizeList = ['debug', 'flat', 'node-emoji', 'extend', 'hast-util-raw']

      viteConfig.optimizeDeps ||= {}
      viteConfig.optimizeDeps.include ||= []
      const list = viteConfig.optimizeDeps.include
      optimizeList.forEach((pkg) => {
        if (!list.includes(pkg)) {
          list.push(pkg)
        }
      })
    })

    if (options.highlight) {
      // Enable unwasm for shikiji
      nuxt.hook('ready', () => {
        const nitro = useNitro()
        const addWasmSupport = (_nitro: typeof nitro) => {
          if (nitro.options.experimental?.wasm) { return }
          _nitro.options.externals = _nitro.options.externals || {}
          _nitro.options.externals.inline = _nitro.options.externals.inline || []
          _nitro.options.externals.inline.push(id => id.endsWith('.wasm'))
          _nitro.hooks.hook('rollup:before', async (_, rollupConfig) => {
            const { rollup: unwasm } = await import('unwasm/plugin')
            rollupConfig.plugins = rollupConfig.plugins || []
            ;(rollupConfig.plugins as any[]).push(unwasm({
              ..._nitro.options.wasm as any,
            }))
          })
        }
        addWasmSupport(nitro)
        nitro.hooks.hook('prerender:init', (prerenderer) => {
          addWasmSupport(prerenderer)
        })
      })

      // Add server handlers
      addServerHandler({ route: '/api/_mdc/highlight', handler: resolver.resolve('./runtime/shiki/event-handler') })

      options.rehypePlugins = options.rehypePlugins || {}
      options.rehypePlugins.highlight = options.rehypePlugins.highlight || {}
      options.rehypePlugins.highlight.src = options.rehypePlugins.highlight.src || await resolver.resolvePath('./runtime/shiki/index')
    }

    // Add imports template
    const { dst: templatePath } = addTemplate({ filename: 'mdc-imports.mjs', getContents: mdcImportTemplate, options, write: true })
    nuxt.options.alias['#mdc-imports'] = process.env.NODE_ENV === 'development' ? pathToFileURL(templatePath).href : templatePath
    nuxt.options.nitro.alias = nuxt.options.nitro.alias || {}
    nuxt.options.nitro.alias['#mdc-imports'] = nuxt.options.alias['#mdc-imports']

    // Add components
    addComponent({ name: 'MDC', filePath: resolver.resolve('./runtime/components/MDC') })
    addComponent({ name: 'MDCRenderer', filePath: resolver.resolve('./runtime/components/MDCRenderer') })
    addComponent({ name: 'MDCSlot', filePath: resolver.resolve('./runtime/components/MDCSlot') })

    // Add composables
    addImports({ from: resolver.resolve('./runtime/utils/node'), name: 'flatUnwrap', as: 'unwrapSlot' })

    // Add parser
    addImports({ from: resolver.resolve('./runtime/parser'), name: 'parseMarkdown', as: 'parseMarkdown' })
    addServerImports([{ from: resolver.resolve('./runtime/parser'), name: 'parseMarkdown', as: 'parseMarkdown' }])

    // Register prose components
    if (options.components?.prose) {
      addComponentsDir({
        path: resolver.resolve('./runtime/components/prose'),
        pathPrefix: false,
        prefix: '',
        global: true
      })
    }

    extendViteConfig((config) => {
      config.optimizeDeps = config.optimizeDeps || {}
      config.optimizeDeps.exclude = config.optimizeDeps.exclude || []
      config.optimizeDeps.exclude.push('@nuxtjs/mdc')
    })

    // Register user global components
    const _layers = [...nuxt.options._layers].reverse()
    for (const layer of _layers) {
      const srcDir = layer.config.srcDir
      const globalComponents = resolver.resolve(srcDir, 'components/mdc')
      const dirStat = await fs.promises.stat(globalComponents).catch(() => null)
      if (dirStat && dirStat.isDirectory()) {
        nuxt.hook('components:dirs', (dirs: any[]) => {
          dirs.unshift({
            path: globalComponents,
            global: true,
            pathPrefix: false,
            prefix: ''
          })
        })
      }
    }

    registerMDCSlotTransformer(resolver)
  }
})

declare module '@nuxt/schema' {
  interface RuntimeConfig {
    mdc: {
      highlight: {
        theme?: Theme
        preload?: string[]
        wrapperStyle?: boolean | string
      }
    }
  }
  interface PublicRuntimeConfig {
    mdc: {
      components: {
        prose: boolean
        map: Record<string, string>
      }
      headings: ModuleOptions['headings']
    }
  }

  interface ConfigSchema {
    runtimeConfig: {
      public?: {
        mdc: {
          components: {
            prose: boolean
            map: Record<string, string>
          }
        }
        headings: ModuleOptions['headings']
      }
    }
  }
}
