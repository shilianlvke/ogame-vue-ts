import { defineConfig, type Plugin, type ViteDevServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 构建元信息：bundle 与 version.json 必须使用同一份值 */
const buildInfo = {
  version: pkg.version,
  buildTime: new Date().toISOString()
}

/**
 * 输出 /version.json，供客户端判断站点是否已经部署了新构建。
 * 版本号或构建时间任意一个变化都算新构建。
 */
const appVersionPlugin: Plugin = {
  name: 'app-version',
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if ((req.url ?? '').split('?')[0] !== '/version.json') {
        next()
        return
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(buildInfo))
    })
  },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify(buildInfo, null, 2)
    })
  }
}

// @ts-expect-error - Vite CSS transformer type
export default defineConfig(async () => {
  const plugins = [
    vue(),
    appVersionPlugin,
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // 不自动注册 SW：避免浏览器一直跑缓存里的旧 JS
      injectRegister: null,
      manifest: {
        name: pkg.name,
        short_name: pkg.title,
        description: 'Conquer the stars',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'fullscreen',
        orientation: 'any',
        icons: [{ src: 'logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mp3,wav,json}'],
        // version.json 必须走网络，不能被旧 Service Worker 缓存
        globIgnores: ['**/version.json'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image' || request.destination === 'audio',
            handler: 'CacheFirst', // 优先使用缓存
            options: { cacheName: 'game-assets', expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 } }
          }
        ]
      }
    })
  ]

  return {
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(buildInfo.version),
      __BUILD_TIME__: JSON.stringify(buildInfo.buildTime)
    },
    build: {
      outDir: 'docs',
      sourcemap: false,
      cssCodeSplit: true,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // Vue 核心框架
            if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/')) return 'vendor-vue-core'
            // Vue 生态
            if (id.includes('node_modules/vue-router')) return 'vendor-vue-router'
            if (id.includes('node_modules/pinia')) return 'vendor-pinia'
            // UI 组件库
            if (id.includes('node_modules/reka-ui')) return 'vendor-reka-ui'
            if (id.includes('node_modules/@vueuse/core')) return 'vendor-vueuse'
            if (id.includes('node_modules/lucide-vue-next')) return 'vendor-icons'
            // 工具库
            if (id.includes('node_modules/crypto-js')) return 'vendor-crypto'
            if (id.includes('node_modules/file-saver')) return 'vendor-utils'
            if (id.includes('node_modules/clsx') || id.includes('node_modules/tailwind-merge')) return 'vendor-utils'
            // Tailwind CSS
            if (id.includes('node_modules/@tailwindcss') || id.includes('node_modules/tailwindcss')) return 'vendor-tailwind'
            // 游戏逻辑模块
            if (id.includes('/src/logic/')) return 'game-logic'
            // 配置和类型
            if (id.includes('/src/config/') || id.includes('/src/types/')) return 'game-config'
            // 本地化 - 只打包默认语言和index，其他语言通过动态导入自动分割
            if (id.includes('/src/locales/index') || id.includes('/src/locales/zh-CN')) return 'locale-default'
            // 其他语言文件不指定chunk，让Vite根据动态导入自动分割
            // 其他 node_modules 依赖
            if (id.includes('node_modules/')) return 'vendor-others'
          },
          // 优化输出文件名
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    },
    plugins,
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    css: {
      // 使用 lightningcss 处理 CSS，自动转换 oklch 等新语法为兼容格式
      transformer: 'lightningcss',
      lightningcss: {
        // 目标浏览器：降低到更保守的版本以支持华为等国产手机 WebView
        targets: {
          android: (4 << 16) | (4 << 8), // Android 4.4
          chrome: 49 << 16, // Chrome 49 (Android 4.4 WebView)
          ios_saf: (9 << 16) | (3 << 8) // iOS Safari 9.3
        },
        // 禁用现代 CSS 特性，确保兼容旧版浏览器
        drafts: { customMedia: false }
      }
    },
    // 优化依赖预构建
    optimizeDeps: { include: ['vue', 'vue-router', 'pinia', 'reka-ui', '@vueuse/core', 'lucide-vue-next', 'crypto-js', 'file-saver'] }
  }
})
