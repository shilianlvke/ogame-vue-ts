import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import './style.css'
import App from './App.vue'
import router from './router'
import { initSaveStorage } from './services/saveStorage'
import { initRouteModeFromEnv } from './config/routeMode'

const app = createApp(App)
const pinia = createPinia()

pinia.use(piniaPluginPersistedstate)

app.use(pinia)
app.use(router)

// 存档层初始化（IndexedDB 预载 + 旧 localStorage 迁移）必须在挂载前完成：
// 这样 Pinia 的持久化插件仍能同步水合，不会出现"先渲染默认状态再被覆盖"的闪烁。
initRouteModeFromEnv()

void (async () => {
  try {
    await initSaveStorage()
  } catch (error) {
    console.error('[save] 存档层初始化失败，回退到 localStorage', error)
  }
  app.mount('#app')
})()
