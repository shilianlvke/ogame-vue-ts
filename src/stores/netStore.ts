/**
 * 联机状态 Store
 *
 * 职责：
 * - 管理连接参数（服务器地址 / 昵称 / 令牌），独立持久化到 localStorage，
 *   不污染单机存档；
 * - 连接时备份本地存档，退出联机时可一键恢复；
 * - 把服务端下发的 snapshot / patch 应用到其它 store；
 * - 把 UI 的 dispatchCommand 接到 WebSocket 上。
 */
import { defineStore } from 'pinia'
import pkg from '../../package.json'
import { saveStorage } from '@/services/saveStorage'
import { useGameStore } from './gameStore'
import { useUniverseStore } from './universeStore'
import { useNPCStore } from './npcStore'
import { OnlineClient } from '@/net/onlineClient'
import type { NetStatus } from '@/net/onlineClient'
import { applyPatch, applySnapshot } from '@/net/apply'
import { setOnlineTransport } from '@/core/runtime'
import type { EngineEvent } from '@/core/types'
import type { CommandResult, GameCommand } from '@/core/commands'
import type { PlayerPublicProfile, ScanMessage, ServerPatch, WelcomeMessage } from '@/core/protocol'
import type { FleetMission, Player } from '@/types/game'

/** 联机配置的独立存储键（与单机存档完全分开） */
const NET_STORAGE_KEY = `${pkg.name}-online`
/** 连接时备份单机存档，退出联机时恢复 */
const BACKUP_PREFIX = `${pkg.name}-local-backup:`
const LOCAL_SAVE_KEYS = [pkg.name, `${pkg.name}-universe`, `${pkg.name}-npcs`]

/**
 * 只属于本地客户的玩家字段：连接/重连时不应被服务端数据覆盖
 * （主题、引导、隐私协议等偏好属于本机）
 */
const LOCAL_PLAYER_FIELDS = [
  'privacyAgreed',
  'hintsEnabled',
  'dismissedHints',
  'backgroundEnabled',
  'tutorialProgress',
  'fleetPresets',
  'lastVersionCheckTime',
  'lastManualUpdateCheck'
] as const

interface NetSettings {
  enabled: boolean
  serverUrl: string
  name: string
  token: string
  /** 令牌所属的账号昵称（用于判断令牌是否适用于当前输入的昵称） */
  accountName: string
}

/**
 * 默认服务器地址
 *
 * - 生产环境：始终使用当前页面的同源地址。
 *   这样经过 Lucky / nginx / SakuraFrp 等反向代理、且外部端口不是 25122 时，
 *   会自动得到 `wss://当前域名:当前端口/ws`，而不是错误地连到 25122。
 * - Vite 开发环境：前端在 25121，后端在 25122，仍然指向当前主机的 25122。
 * - Electron file://：回退到本机 25122。
 */
export const defaultServerUrl = (): string => {
  if (typeof location === 'undefined') return 'ws://localhost:25122/ws'
  if (location.protocol === 'file:') return 'ws://localhost:25122/ws'

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  // server smoke / 纯 Node 类型检查没有 vite/client 的 ImportMeta 扩展，做一次安全读取
  const viteEnv = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env
  if (viteEnv?.DEV) {
    return `${protocol}//${location.hostname}:25122/ws`
  }
  return `${protocol}//${location.host}/ws`
}

/**
 * 兼容旧版本写入 localStorage 的错误默认值。
 *
 * 旧逻辑在页面端口不是 25122/80/443 时，会强制写成 `hostname:25122`。
 * 典型场景就是公网 HTTPS 端口 60465，结果浏览器一直去连 25122。
 * 只有“存储值恰好等于旧默认值”时才纠正，用户手动填写的其他地址保持不动。
 */
const normalizeLegacyServerUrl = (serverUrl: string, fallback: string): string => {
  if (typeof location === 'undefined') return serverUrl
  if (!location.port || location.port === '25122' || location.port === '80' || location.port === '443') {
    return serverUrl
  }

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const legacyDefault = `${protocol}//${location.hostname}:25122/ws`
  return serverUrl === legacyDefault ? fallback : serverUrl
}

const readSettings = (): NetSettings => {
  const fallback: NetSettings = { enabled: false, serverUrl: defaultServerUrl(), name: '', token: '', accountName: '' }
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(NET_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<NetSettings>
    return {
      enabled: parsed.enabled === true,
      serverUrl: normalizeLegacyServerUrl(parsed.serverUrl || fallback.serverUrl, fallback.serverUrl),
      name: parsed.name ?? '',
      token: parsed.token ?? '',
      accountName: parsed.accountName ?? ''
    }
  } catch {
    return fallback
  }
}

const writeSettings = (settings: NetSettings): void => {
  try {
    localStorage.setItem(NET_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // 隐私模式/配额不足时忽略
  }
}

/** 备份当前单机存档（已存在则保留最早的一份） */
const backupLocalSave = (): void => {
  try {
    for (const key of LOCAL_SAVE_KEYS) {
      const backupKey = `${BACKUP_PREFIX}${key}`
      if (saveStorage.getItem(backupKey) !== null) continue
      const value = saveStorage.getItem(key)
      if (value !== null) saveStorage.setItem(backupKey, value)
    }
  } catch {
    // ignore
  }
}

/** 恢复单机存档（返回是否真的恢复了内容） */
const restoreLocalSave = (): boolean => {
  let restored = false
  try {
    for (const key of LOCAL_SAVE_KEYS) {
      const value = saveStorage.getItem(`${BACKUP_PREFIX}${key}`)
      if (value === null) continue
      saveStorage.setItem(key, value)
      restored = true
    }
  } catch {
    // ignore
  }
  return restored
}

/* ------------------------- 模块级（非响应式）资源 ------------------------- */

let client: OnlineClient | null = null
let eventHandler: ((event: EngineEvent) => void) | null = null
let rejectHandler: ((reason?: string) => void) | null = null
let errorHandler: ((message: string) => void) | null = null

interface ScanWaiter {
  after: number
  resolve: (fleets: FleetMission[]) => void
  timer: ReturnType<typeof setTimeout>
}

let scanWaiters: ScanWaiter[] = []

export const useNetStore = defineStore('net', {
  state: () => {
    const settings = readSettings()
    return {
      /** 是否处于联机模式（持久化） */
      enabled: settings.enabled,
      serverUrl: settings.serverUrl,
      name: settings.name,
      token: settings.token,
      /** 令牌所属账号昵称 */
      accountName: settings.accountName,
      /** 密码（只存在于内存，不落盘） */
      password: '',
      status: 'idle' as NetStatus,
      playerId: '',
      error: '',
      players: [] as PlayerPublicProfile[],
      /** 最近一次收到补丁的时间 */
      lastPatchAt: 0,
      /** 最近一次传感器阵列扫描结果 */
      lastScan: [] as FleetMission[],
      /** 扫描结果序号（每收到一次 +1，用于等待特定扫描） */
      scanToken: 0,
      /** 服务端可能把旧连接踢掉 */
      kicked: false
    }
  },
  getters: {
    isOnline: state => state.enabled && state.status === 'online',
    isBusy: state => state.status === 'connecting' || state.status === 'reconnecting',
    /** 当前令牌是否适用于输入框里的昵称（不适用时需要用密码登录） */
    tokenUsable: state => !!state.token && (!state.accountName || state.accountName === state.name.trim()),
    statusText: state => {
      switch (state.status) {
        case 'connecting':
          return 'connecting'
        case 'online':
          return 'online'
        case 'reconnecting':
          return 'reconnecting'
        case 'error':
          return 'error'
        default:
          return 'offline'
      }
    },
    /** 在线玩家数（页面展示的“在线玩家”） */
    playerCount: state => state.players.filter(player => player.online).length,
    /** 服务器注册玩家总数 */
    totalPlayerCount: state => state.players.length
  },
  actions: {
    /** 注册 UI 回调（App.vue 在挂载时调用） */
    setHandlers(handlers: {
      onEvent?: (event: EngineEvent) => void
      onReject?: (reason?: string) => void
      onError?: (message: string) => void
    }): void {
      if (handlers.onEvent) eventHandler = handlers.onEvent
      if (handlers.onReject) rejectHandler = handlers.onReject
      if (handlers.onError) errorHandler = handlers.onError
    },

    /** 启动时调用：若上次处于联机模式则自动连接 */
    init(): boolean {
      const settings = readSettings()
      this.enabled = settings.enabled
      this.serverUrl = settings.serverUrl
      this.name = settings.name
      this.token = settings.token
      if (!settings.enabled) return false
      this.connect()
      return true
    },

    /** 连接服务器 */
    connect(): void {
      if (client) return
      const url = this.serverUrl.trim()
      if (!/^wss?:\/\//.test(url)) {
        this.error = 'invalid_url'
        this.status = 'error'
        errorHandler?.(this.error)
        return
      }

      // 第一次进入联机模式：备份单机存档
      if (!this.enabled) {
        backupLocalSave()
      }

      this.enabled = true
      this.error = ''
      this.status = 'connecting'
      this.persist()

      const gameStore = useGameStore()
      const locale = gameStore.locale

      // 只有「当前输入的昵称」与令牌所属账号一致时才用令牌重连。
      // 否则（例如同一浏览器开了两个窗口、换了昵称）会以新账号登录，
      // 避免两个窗口被服务端当成同一个玩家而互相顶号。
      const typedName = this.name.trim()
      const useToken = this.tokenUsable ? this.token : undefined

      client = new OnlineClient({
        url,
        name: typedName || 'Commander',
        password: this.password || undefined,
        locale,
        token: useToken,
        onStatus: (status, detail) => {
          this.status = status
          if (status === 'error' && detail) this.error = detail
        },
        onWelcome: message => this.handleWelcome(message),
        onPatch: message => this.handlePatch(message),
        onScan: message => this.handleScan(message),
        onReject: message => {
          if (message.reason) rejectHandler?.(message.reason)
          // 有扫描在等待时，拒绝意味着这次扫描不会再有结果（通常是重氢不足）
          if (scanWaiters.length > 0) {
            const waiters = scanWaiters
            scanWaiters = []
            waiters.forEach(waiter => {
              clearTimeout(waiter.timer)
              waiter.resolve([])
            })
          }
        },
        onError: message => {
          this.error = message
          errorHandler?.(message)
          // 认证失败 / 被顶号时不要再无限重连，交给用户处理
          if (message.startsWith('auth:') || message === 'session:replaced') {
            client?.disconnect()
            client = null
            setOnlineTransport(null)
            this.enabled = false
            this.status = 'error'
            if (message.startsWith('auth:')) {
              // 令牌已失效（例如服务器重置过世界），清掉避免下次仍用旧令牌重试
              this.token = ''
              this.accountName = ''
            }
            this.persist()
          }
        }
      })

      setOnlineTransport({
        sendCommand: (command: GameCommand): CommandResult => {
          const result = client?.sendCommand(command)
          return result ?? { ok: false }
        }
      })

      client.connect()
    },

    /** 断开连接（可选择恢复单机存档并刷新页面） */
    disconnect(options: { restoreLocal?: boolean } = {}): void {
      const { restoreLocal = false } = options
      client?.disconnect()
      client = null
      setOnlineTransport(null)

      this.status = 'idle'
      this.enabled = false
      this.playerId = ''
      this.players = []
      this.persist()

      if (restoreLocal) {
        const restored = restoreLocalSave()
        // 恢复后必须刷新，让 Pinia 从 localStorage 重新水合
        console.info(restored ? '[net] 已恢复单机存档，正在刷新' : '[net] 未找到单机存档备份，直接刷新')
        location.reload()
      }
    },

    persist(): void {
      const token = client?.currentToken ?? this.token
      if (token) this.token = token
      writeSettings({
        enabled: this.enabled,
        serverUrl: this.serverUrl,
        name: this.name,
        token: this.token,
        accountName: this.accountName
      })
    },

    /* --------------------------- 服务端消息处理 --------------------------- */

    handleWelcome(message: WelcomeMessage): void {
      const gameStore = useGameStore()
      const universeStore = useUniverseStore()
      const npcStore = useNPCStore()

      // 保留本机偏好字段（隐私协议、引导、主题等）
      const carryOver: Partial<Player> = {}
      for (const field of LOCAL_PLAYER_FIELDS) {
        if (field in gameStore.player) {
          ;(carryOver as Record<string, unknown>)[field] = (gameStore.player as unknown as Record<string, unknown>)[field]
        }
      }

      const target = {
        player: gameStore.player,
        planets: universeStore.planets,
        npcs: npcStore.npcs,
        debrisFields: universeStore.debrisFields
      }

      const { currentPlanetId } = applySnapshot(target, message.snapshot)
      Object.assign(gameStore.player, carryOver)

      gameStore.currentPlanetId = currentPlanetId
      this.playerId = message.playerId
      this.token = message.token
      // 记录令牌归属的账号名：服务端返回的玩家名就是账号名
      this.accountName = message.snapshot.self.name
      this.name = message.snapshot.self.name
      this.password = ''
      this.players = message.snapshot.players
      this.lastPatchAt = Date.now()
      this.persist()
    },

    handlePatch(message: ServerPatch): void {
      const gameStore = useGameStore()
      const universeStore = useUniverseStore()
      const npcStore = useNPCStore()

      const target = {
        player: gameStore.player,
        planets: universeStore.planets,
        npcs: npcStore.npcs,
        debrisFields: universeStore.debrisFields
      }

      const { currentPlanetId } = applyPatch(target, message, gameStore.currentPlanetId)
      if (currentPlanetId) {
        gameStore.currentPlanetId = currentPlanetId
      }

      if (message.players) {
        this.players = message.players
      }

      if (message.events) {
        for (const event of message.events) {
          eventHandler?.(event)
        }
      }

      this.lastPatchAt = Date.now()
    },

    /** 服务端下发传感器阵列扫描结果 */
    handleScan(message: ScanMessage): void {
      this.lastScan = message.fleets
      this.scanToken += 1
      const token = this.scanToken

      const ready = scanWaiters.filter(waiter => waiter.after < token)
      scanWaiters = scanWaiters.filter(waiter => waiter.after >= token)
      ready.forEach(waiter => {
        clearTimeout(waiter.timer)
        waiter.resolve(message.fleets)
      })
    },

    /**
     * 等待一次新的扫描结果
     *
     * @param afterToken 发起扫描前的 `scanToken`
     * @returns 扫描结果；超时返回 null
     */
    waitForScan(afterToken: number, timeoutMs = 5000): Promise<FleetMission[] | null> {
      if (this.scanToken > afterToken) {
        return Promise.resolve(this.lastScan)
      }
      return new Promise(resolve => {
        const timer = setTimeout(() => {
          scanWaiters = scanWaiters.filter(waiter => waiter.timer !== timer)
          resolve(null)
        }, timeoutMs)
        scanWaiters.push({ after: afterToken, resolve, timer })
      })
    }
  }
})
