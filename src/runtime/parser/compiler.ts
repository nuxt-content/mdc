import type { RootContent, Root } from '../types/hast'
import type { MDCNode, MDCRoot } from '../types'
import { toString } from 'hast-util-to-string'
import Slugger from 'github-slugger'
import { validateProps } from './utils/props'

export function compileHast(this: any) {
  // Create new slugger for each Tree to generate
  const slugs = new Slugger()

  function compileToJSON(node: Root): MDCRoot;
  function compileToJSON(node: RootContent): MDCNode;
  function compileToJSON (node: Root | RootContent): MDCNode | MDCRoot | null {
    if (node.type === 'root') {
      return {
        type: 'root',
        children: node.children.map(compileToJSON).filter(Boolean)
      }
    }

    if (node.type === 'element') {
      // Remove empty paragraphs
      if (node.tagName === 'p' && node.children.every(child => child.type === 'text' && /^\s*$/.test(child.value))) {
        return null
      }

      if (node.tagName === 'li') {
        // unwrap unwanted paragraphs around `<li>` children
        let hasPreviousParagraph = false
        node.children = (node.children)?.flatMap((child) => {
          if (child.type === 'element' && child.tagName === 'p') {
            if (hasPreviousParagraph) {
              // Insert line break before new paragraph
              child.children!.unshift({
                type: 'element',
                tagName: 'br',
                properties: {},
                children: []
              })
            }

            hasPreviousParagraph = true
            return child.children
          }
          return child
        })
      }

      // Generate id for headings
      if (node.tagName?.match(/^h\d$/)) {
        node.properties = node.properties || {}
        node.properties.id = String(node.properties?.id || slugs.slug(toString(node as any)))
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .replace(/^(\d)/, '_$1')
      }

      // Convert component-slot tags to template
      if (node.tagName === 'component-slot') {
        node.tagName = 'template'
      }

      return {
        type: 'element',
        tag: node.tagName,
        props: validateProps(node.properties),
        children: node.children.map(compileToJSON).filter(Boolean)
      }
    }

    // Kepp none new line text nodes
    if (node.type === 'text' && node.value !== '\n') {
      return {
        type: 'text',
        value: node.value
      }
    }

    // Remove other nodes from tree
    return null
  }

  this.Compiler = (tree: Root) => {
    const body = compileToJSON(tree)

    let excerpt = undefined
    const excerptIndex = tree.children.findIndex(node => node.type === 'comment' && node.value?.trim() === 'more')
    if (excerptIndex !== -1) {
      excerpt = compileToJSON({
        type: 'root',
        children: tree.children.slice(0, excerptIndex)
      })

      // Include styles if excerpt contains code block
      if (excerpt.children.find(node => node.type === 'element' && node.tag === 'pre')) {
        const lastChild = body.children[body.children.length - 1]
        if (lastChild.type === 'element' && lastChild.tag === 'style') {
          excerpt.children.push(lastChild)
        }
      }
    }

    return {
      body,
      excerpt
    }
  }
}
