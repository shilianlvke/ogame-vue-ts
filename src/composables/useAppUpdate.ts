/**
 * 自动检测站点是否部署了新构建
 *
 * 触发时机：启动后、每 5 分钟、窗口重新聚焦、页面从后台恢复。
 * 检测到更新后：
 * - 立即弹出一条可点击的“立即刷新”提示；
 * - 页面切到后台，或用户空闲 60 秒后，自动刷新（先落盘再清旧 SW 缓存）。
 */
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { useI18n } from '@/composables/useI18n'
import {
  fetchLatestBuildInfo,
  isBrowserRuntime,
  isBuildChanged,
  reloadForUpdate,
  type BuildInfo
} from '@/utils/appUpdate'

const POLL_INTERVAL_MS = 5 * 60 * 1000
const IDLE_RELOAD_MS = 60 * 1000
const INITIAL_CHECK_DELAY_MS = 10 * 1000
const IDLE_CHECK_INTERVAL_MS = 10 * 1000

export const useAppUpdate = () => {
  const { t } = useI18n()
  const updateAvailable = ref(false)
  const latestBuild = ref<BuildInfo | null>(null)

  let started = false
  let checking = false
  let notified = false
  let lastActivity = Date.now()
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let idleTimer: ReturnType<typeof setInterval> | null = null
  let initialTimer: ReturnType<typeof setTimeout> | null = null
  let focusHandler: (() => void) | null = null
  let visibilityHandler: (() => void) | null = null

  const markActivity = (): void => {
    lastActivity = Date.now()
  }

  const notify = (): void => {
    if (notified) return
    notified = true
    toast.info(t('settings.browserUpdateReady'), {
      duration: Infinity,
      dismissible: true,
      action: {
        label: t('settings.refreshNow'),
        onClick: () => {
          void reloadForUpdate()
        }
      }
    })
  }

  const check = async (): Promise<boolean> => {
    if (!isBrowserRuntime() || checking) return false

    checking = true
    try {
      const latest = await fetchLatestBuildInfo()
      if (!latest || !isBuildChanged(latest)) return false

      latestBuild.value = latest
      updateAvailable.value = true
      notify()
      return true
    } finally {
      checking = false
    }
  }

  const maybeAutoReload = (): void => {
    if (!updateAvailable.value) return
    if (document.visibilityState === 'hidden' || Date.now() - lastActivity >= IDLE_RELOAD_MS) {
      void reloadForUpdate()
    }
  }

  const start = (): void => {
    if (started || !isBrowserRuntime()) return
    started = true
    lastActivity = Date.now()

    window.addEventListener('pointerdown', markActivity, { passive: true })
    window.addEventListener('keydown', markActivity)
    window.addEventListener('touchstart', markActivity, { passive: true })
    window.addEventListener('wheel', markActivity, { passive: true })

    focusHandler = () => {
      void check()
      maybeAutoReload()
    }
    visibilityHandler = () => {
      if (document.visibilityState === 'hidden') {
        maybeAutoReload()
      } else {
        lastActivity = Date.now()
        void check()
      }
    }

    window.addEventListener('focus', focusHandler)
    document.addEventListener('visibilitychange', visibilityHandler)

    initialTimer = window.setTimeout(() => {
      void check()
    }, INITIAL_CHECK_DELAY_MS)
    pollTimer = window.setInterval(() => {
      void check()
    }, POLL_INTERVAL_MS)
    idleTimer = window.setInterval(maybeAutoReload, IDLE_CHECK_INTERVAL_MS)
  }

  const stop = (): void => {
    if (!started) return
    started = false

    window.removeEventListener('pointerdown', markActivity)
    window.removeEventListener('keydown', markActivity)
    window.removeEventListener('touchstart', markActivity)
    window.removeEventListener('wheel', markActivity)
    if (focusHandler) window.removeEventListener('focus', focusHandler)
    if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
    if (initialTimer) clearTimeout(initialTimer)
    if (pollTimer) clearInterval(pollTimer)
    if (idleTimer) clearInterval(idleTimer)

    initialTimer = null
    pollTimer = null
    idleTimer = null
    focusHandler = null
    visibilityHandler = null
  }

  return {
    start,
    stop,
    check,
    updateAvailable,
    latestBuild
  }
}
