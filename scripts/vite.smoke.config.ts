/**
 * 冒烟测试专用构建配置：把 TypeScript 源码打成可在 Node 直接运行的 ESM 文件。
 * 不使用主 vite.config.ts，避免引入 Vue/PWA 插件。
 */
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// 允许通过 SMOKE_ENTRY 指定入口，便于临时调试
const entry = process.env.SMOKE_ENTRY ?? 'scripts/smoke.ts'

export default defineConfig({
  root,
  // 冒烟测试不需要拷贝 public 资源
  publicDir: false,
  resolve: {
    alias: { '@': path.resolve(root, 'src') }
  },
  build: {
    ssr: path.resolve(root, entry),
    outDir: path.resolve(root, 'scripts/.smoke-out'),
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      output: { entryFileNames: 'smoke.js', format: 'es' }
    }
  }
})
