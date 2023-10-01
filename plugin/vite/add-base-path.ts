import { Plugin } from 'vite'
import { BASE } from '../../consts'

const replaceSlideMdPath = (html: string) => {
  return html.replace(/data-markdown="\//g, `data-markdown="${BASE}`)
}

export default function addBasePathPlugin(): Plugin {
  return {
    name: 'add-base-path',
    transformIndexHtml(html) {
      return replaceSlideMdPath(html)
    },
  }
}
