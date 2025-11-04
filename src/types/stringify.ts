import type { Options as RemarkStringifyOptions } from 'remark-stringify'
import type { RemarkMDCOptions, YamlToStringOptions } from 'remark-mdc'

export interface MDCStringifyOptions {
  frontMatter?: {
    options?: YamlToStringOptions
  }
  plugins?: {
    remarkStringify?: {
      options?: RemarkStringifyOptions
    }
    remarkMDC?: {
      options?: RemarkMDCOptions
    }
  }
}
