/**
 * 服务端构建配置：把 server/ 打包成可在 Node 直接运行的 ESM 文件
 */
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

export default defineConfig({
  root,
  publicDir: false,
  resolve: {
    alias: { '@': path.resolve(root, 'src') }
  },
  build: {
    ssr: path.resolve(root, 'server/main.ts'),
    outDir: path.resolve(root, 'server-dist'),
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: 'chunks/[name]-[hash].js'
      }
    }
  }
})
