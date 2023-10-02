import { defineConfig } from 'vite'
import { BASE } from './consts'
import addBasePathPlugin from './plugin/vite/add-base-path'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { resolve } from 'path'

export default defineConfig({
  base: BASE,
  root: 'src/pages',
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, './src/pages/index.html'),
        'with-note': resolve(__dirname, './src/pages/with-note/index.html'),
      },
    },
  },
  plugins: [
    addBasePathPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: resolve(__dirname, './src/slide.md'),
          dest: './',
          transform: (contents) => {
            return contents.toString().replace(/src="\//g, `src="${BASE}`)
          },
        },
      ],
    }),
  ],
})
