import { defineConfig } from 'vite'
import { BASE } from './consts'
import addBasePathPlugin from './plugin/vite/add-base-path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  base: BASE,
  plugins: [
    addBasePathPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: './src/slide.md',
          dest: './',
          transform: (contents) => {
            return contents.toString().replace(/src="\//g, `src="${BASE}`)
          },
        },
      ],
    }),
  ],
})
