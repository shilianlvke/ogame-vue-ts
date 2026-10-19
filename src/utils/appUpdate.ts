/**
 * 浏览器端版本自更新
 *
 * 构建时 Vite 会同时写入：
 * - 当前 bundle 里的 `__APP_VERSION__` / `__BUILD_TIME__`
 * - 站点根目录的 `version.json`
 *
 * 运行时轮询 `version.json`，只要 version 或 buildTime 与当前 bundle 不同，
 * 就认为服务端已经部署了新构建，提示并（空闲/切后台时）自动刷新。
 * 单机存档在 IndexedDB/localStorage，刷新不会丢档。
 */
import { flushSaveStorage } from '@/services/saveStorage'

export interface BuildInfo {
  version: string
  buildTime: string
}

/** 当前 bundle 的版本与构建时间（由 Vite define 注入） */
export const CURRENT_BUILD_INFO: BuildInfo = {
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0',
  buildTime: typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : new Date(0).toISOString()
}

/** 只有 http(s) 页面才做“部署更新”检测；Electron file://、原生 App 跳过 */
export const isBrowserRuntime = (): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  return window.location.protocol === 'http:' || window.location.protocol === 'https:'
}

/** 读取站点上的 version.json（带时间戳，绕过 HTTP / CDN 缓存） */
export const fetchLatestBuildInfo = async (): Promise<BuildInfo | null> => {
  if (!isBrowserRuntime()) return null

  // 兼容没有 AbortController 的老 WebView；超时逻辑仅在支持时启用
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? window.setTimeout(() => controller.abort(), 5000) : null
  try {
    const url = new URL('version.json', document.baseURI)
    url.searchParams.set('_', String(Date.now()))
    const response = await fetch(url.toString(), {
      cache: 'no-store',
      signal: controller?.signal
    })
    if (!response.ok) return null

    const data = (await response.json()) as Partial<BuildInfo>
    if (typeof data.version !== 'string' || typeof data.buildTime !== 'string') return null
    return { version: data.version, buildTime: data.buildTime }
  } catch {
    // 离线、旧部署没有 version.json、请求超时都静默忽略
    return null
  } finally {
    if (timer !== null) window.clearTimeout(timer)
  }
}

/** 版本号或构建时间不同都视为新构建 */
export const isBuildChanged = (latest: BuildInfo, current: BuildInfo = CURRENT_BUILD_INFO): boolean =>
  latest.version !== current.version || latest.buildTime !== current.buildTime

let reloading = false

/** 刷新前落盘、清理旧 Service Worker / CacheStorage，再带版本参数重载 */
export const reloadForUpdate = async (): Promise<void> => {
  if (!isBrowserRuntime() || reloading) return
  reloading = true

  try {
    await flushSaveStorage()
  } catch {
    // 存档层不可用时也继续刷新
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map(registration => registration.unregister()))
    }
  } catch {
    // 某些 WebView 不支持 serviceWorker
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(key => caches.delete(key)))
    }
  } catch {
    // 忽略 CacheStorage 异常
  }

  const url = new URL(window.location.href)
  url.searchParams.set('_v', String(Date.now()))
  window.location.replace(url.toString())
}

/** 用于 About 面板展示的构建时间 */
export const formatBuildTime = (buildTime: string): string => {
  const date = new Date(buildTime)
  return Number.isNaN(date.getTime()) ? buildTime : date.toLocaleString()
}
