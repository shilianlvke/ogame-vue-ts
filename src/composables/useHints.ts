/**
 * 弱引导系统 - 非阻塞式、可关闭的页面提示
 * 用温和的引导替代强制性教程
 */
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'

// 提示定义 - 用户首次访问页面时显示一次
export interface Hint {
  id: string
  route: string // 显示此提示的路由路径
  titleKey: string // 标题的 i18n 键
  messageKey: string // 消息的 i18n 键
  icon?: string // 可选的图标名称
  delay?: number // 显示前的延迟毫秒数（默认 500）
}

// 所有可用的提示
const hints: Hint[] = [
  {
    id: 'overview_intro',
    route: '/overview',
    titleKey: 'hints.overview.title',
    messageKey: 'hints.overview.message',
    icon: 'home',
    delay: 1000
  },
  {
    id: 'base_intro',
    route: '/base',
    titleKey: 'hints.base.title',
    messageKey: 'hints.base.message',
    icon: 'building',
    delay: 500
  },
  {
    id: 'fleet_intro',
    route: '/fleet',
    titleKey: 'hints.fleet.title',
    messageKey: 'hints.fleet.message',
    icon: 'plane',
    delay: 500
  },
  {
    id: 'galaxy_intro',
    route: '/galaxy',
    titleKey: 'hints.galaxy.title',
    messageKey: 'hints.galaxy.message',
    icon: 'globe',
    delay: 500
  },
  {
    id: 'diplomacy_intro',
    route: '/diplomacy',
    titleKey: 'hints.diplomacy.title',
    messageKey: 'hints.diplomacy.message',
    icon: 'handshake',
    delay: 500
  },
  {
    id: 'messages_intro',
    route: '/messages',
    titleKey: 'hints.messages.title',
    messageKey: 'hints.messages.message',
    icon: 'mail',
    delay: 500
  },
  {
    id: 'officers_intro',
    route: '/officers',
    titleKey: 'hints.officers.title',
    messageKey: 'hints.officers.message',
    icon: 'users',
    delay: 500
  },
  {
    id: 'simulator_intro',
    route: '/battle-simulator',
    titleKey: 'hints.simulator.title',
    messageKey: 'hints.simulator.message',
    icon: 'swords',
    delay: 500
  },
  {
    id: 'campaign_intro',
    route: '/campaign',
    titleKey: 'hints.campaign.title',
    messageKey: 'hints.campaign.message',
    icon: 'map',
    delay: 500
  },
  {
    id: 'settings_intro',
    route: '/settings',
    titleKey: 'hints.settings.title',
    messageKey: 'hints.settings.message',
    icon: 'settings',
    delay: 500
  },
  {
    id: 'gm_intro',
    route: '/gm',
    titleKey: 'hints.gm.title',
    messageKey: 'hints.gm.message',
    icon: 'wand',
    delay: 500
  }
]

// 全局UI状态（不需要持久化）
const currentHint = ref<Hint | null>(null)
const isHintVisible = ref(false)

let hintTimeout: ReturnType<typeof setTimeout> | null = null

// 不要以 pkg.name 开头：saveStorage 会把该前缀的 localStorage 当成旧存档迁移到 IndexedDB。
const HINT_STORAGE_PREFIX = 'ogame-hints-v1:'
let lastAccountKey: string | null = null

interface HintStorage {
  read: (key: string) => string[]
  write: (key: string, ids: string[]) => void
  remove: (key: string) => void
}

const hintStorage: HintStorage = {
  read(key) {
    if (typeof localStorage === 'undefined') return []
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '[]')
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
    } catch {
      return []
    }
  },
  write(key, ids) {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(key, JSON.stringify([...new Set(ids)]))
    } catch {
      // 隐私模式等场景下写入失败时，当前会话仍然有效
    }
  },
  remove(key) {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}

export const useHints = () => {
  const router = useRouter()
  const gameStore = useGameStore()

  // 确保 dismissedHints 数组已初始化
  if (!gameStore.player.dismissedHints) {
    gameStore.player.dismissedHints = []
  }

  // 确保 hintsEnabled 已初始化（默认为 true）
  if (gameStore.player.hintsEnabled === undefined) {
    gameStore.player.hintsEnabled = true
  }

  const accountKey = (): string => `${HINT_STORAGE_PREFIX}${gameStore.player.id || 'local'}`

  /**
   * 提示进度按账号存在 localStorage：
   * - 同一账号重新登录、换页面后不会重新出现；
   * - 不同账号之间不共享已读提示。
   */
  const syncAccountHints = (): void => {
    const key = accountKey()
    const stored = hintStorage.read(key)

    if (lastAccountKey === null) {
      // 首次加载：严格读取该账号的记录，避免把上一个账号的已读提示带进来
      gameStore.player.dismissedHints = stored
    } else if (lastAccountKey !== key) {
      // 切换账号：严格使用新账号的已读记录，避免串号
      gameStore.player.dismissedHints = stored
    } else if (stored.length > 0) {
      gameStore.player.dismissedHints = [...new Set([...(gameStore.player.dismissedHints ?? []), ...stored])]
    }

    lastAccountKey = key
  }

  const persistAccountHints = (): void => {
    hintStorage.write(accountKey(), gameStore.player.dismissedHints ?? [])
  }

  const markHintSeen = (hintId: string): void => {
    if (!gameStore.player.dismissedHints) gameStore.player.dismissedHints = []
    if (!gameStore.player.dismissedHints.includes(hintId)) {
      gameStore.player.dismissedHints.push(hintId)
    }
    persistAccountHints()
  }

  syncAccountHints()

  // 检查提示是否已被关闭
  const isHintDismissed = (hintId: string): boolean => {
    return gameStore.player.dismissedHints?.includes(hintId) ?? false
  }

  // 检查当前路由是否应该显示提示
  const checkForHint = (routePath: string) => {
    if (!gameStore.player.hintsEnabled) return

    // 清除任何待显示的提示
    if (hintTimeout) {
      clearTimeout(hintTimeout)
      hintTimeout = null
    }

    // 导航时隐藏当前提示
    isHintVisible.value = false
    currentHint.value = null

    // 基地已合并为一个栏目，只使用一条 Base 提示
    const hint = hints.find(h => routePath.startsWith(h.route))
    if (!hint) return

    // 检查是否已经看过
    if (isHintDismissed(hint.id)) return

    // 延迟后显示提示；显示即视为已读，后续登录不再重复弹出
    const delay = hint.delay ?? 500
    hintTimeout = setTimeout(() => {
      markHintSeen(hint.id)
      currentHint.value = hint
      isHintVisible.value = true
    }, delay)
  }

  // 关闭当前提示（不再显示）
  const dismissHint = (dontShowAgain = true) => {
    if (currentHint.value && dontShowAgain) {
      markHintSeen(currentHint.value.id)
    }
    isHintVisible.value = false
    currentHint.value = null
  }

  // 暂时关闭提示（本次不显示）
  const closeHint = () => {
    isHintVisible.value = false
    currentHint.value = null
  }

  // 重置所有提示（重新显示）
  const resetHints = () => {
    gameStore.player.dismissedHints = []
    hintStorage.remove(accountKey())
  }

  // 切换提示开关
  const setHintsEnabled = (enabled: boolean) => {
    gameStore.player.hintsEnabled = enabled
    if (!enabled) {
      isHintVisible.value = false
      currentHint.value = null
    }
  }

  // 账号切换时重新加载该账号的提示记录
  watch(
    () => gameStore.player.id,
    () => syncAccountHints()
  )

  // 监听路由变化
  watch(
    () => router.currentRoute.value.path,
    newPath => {
      checkForHint(newPath)
    },
    { immediate: true }
  )

  return {
    // 状态
    currentHint: computed(() => currentHint.value),
    isHintVisible: computed(() => isHintVisible.value),
    hintsEnabled: computed(() => gameStore.player.hintsEnabled ?? true),
    dismissedCount: computed(() => gameStore.player.dismissedHints?.length ?? 0),
    totalHints: computed(() => hints.length),

    // 操作
    dismissHint,
    closeHint,
    resetHints,
    setHintsEnabled,
    checkForHint
  }
}
