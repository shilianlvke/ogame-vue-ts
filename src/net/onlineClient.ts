/**
 * WebSocket 客户端
 *
 * 只负责「连接 / 重连 / 收发消息」，不碰任何游戏状态，便于单独测试与复用。
 */
import { PROTOCOL_VERSION } from '@/core/protocol'
import type { ClientMessage, ServerMessage } from '@/core/protocol'
import type { CommandResult, GameCommand } from '@/core/commands'
import type { Locale } from '@/locales'

export type NetStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'error'

export interface OnlineClientOptions {
  url: string
  name: string
  /** 密码（新账号注册 / 换设备登录） */
  password?: string
  locale: Locale
  token?: string
  onWelcome: (message: Extract<ServerMessage, { t: 'welcome' }>) => void
  onPatch: (message: Extract<ServerMessage, { t: 'patch' }>) => void
  onReject: (message: Extract<ServerMessage, { t: 'reject' }>) => void
  onScan?: (message: Extract<ServerMessage, { t: 'scan' }>) => void
  onError: (message: string) => void
  onStatus: (status: NetStatus, detail?: string) => void
}

const RECONNECT_BASE_MS = 1000
const RECONNECT_MAX_MS = 15000
const PING_INTERVAL_MS = 20000

export class OnlineClient {
  private ws: WebSocket | null = null
  private readonly options: OnlineClientOptions
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private manuallyClosed = false
  private seq = 0
  private token: string | undefined

  constructor(options: OnlineClientOptions) {
    this.options = options
    this.token = options.token
  }

  /** 建立连接 */
  connect(): void {
    this.manuallyClosed = false
    this.clearReconnect()
    this.options.onStatus(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting')

    let socket: WebSocket
    try {
      socket = new WebSocket(this.options.url)
    } catch (error) {
      this.options.onStatus('error', error instanceof Error ? error.message : String(error))
      this.scheduleReconnect()
      return
    }

    this.ws = socket

    socket.onopen = () => {
      this.reconnectAttempt = 0
      this.send({
        t: 'hello',
        protocolVersion: PROTOCOL_VERSION,
        name: this.options.name,
        password: this.options.password,
        locale: this.options.locale,
        token: this.token
      })
      this.startPing()
    }

    socket.onmessage = event => {
      let message: ServerMessage
      try {
        message = JSON.parse(String(event.data)) as ServerMessage
      } catch {
        this.options.onError('invalid server message')
        return
      }

      switch (message.t) {
        case 'welcome':
          this.token = message.token
          this.options.onStatus('online')
          this.options.onWelcome(message)
          break
        case 'patch':
          this.options.onPatch(message)
          break
        case 'reject':
          this.options.onReject(message)
          break
        case 'scan':
          this.options.onScan?.(message)
          break
        case 'error':
          this.options.onError(message.message)
          break
        case 'pong':
          break
        default:
          break
      }
    }

    socket.onclose = event => {
      this.stopPing()
      this.ws = null
      if (this.manuallyClosed) {
        this.options.onStatus('idle')
        return
      }
      // 被服务端顶号（同一账号在别处登录）：不要自动重连，否则两个客户端会互相踢
      if (event.reason === 'replaced') {
        this.manuallyClosed = true
        this.options.onError('session:replaced')
        this.options.onStatus('error')
        return
      }
      this.options.onStatus('reconnecting')
      this.scheduleReconnect()
    }

    socket.onerror = () => {
      // 具体原因由 onclose 处理，这里只标记状态
      this.options.onError('connection error')
    }
  }

  /** 主动断开（不再重连） */
  disconnect(): void {
    this.manuallyClosed = true
    this.clearReconnect()
    this.stopPing()
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // ignore
      }
      this.ws = null
    }
    this.options.onStatus('idle')
  }

  /** 发送命令；未连接时立即失败 */
  sendCommand(command: GameCommand): CommandResult {
    const sent = this.send({ t: 'cmd', seq: ++this.seq, command })
    return sent ? { ok: true } : { ok: false }
  }

  get isOpen(): boolean {
    return this.ws?.readyState === 1
  }

  /** 当前令牌（重连后再读一次，服务端可能续发） */
  get currentToken(): string | undefined {
    return this.token
  }

  private send(message: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== 1) return false
    try {
      this.ws.send(JSON.stringify(message))
      return true
    } catch {
      return false
    }
  }

  private startPing(): void {
    this.stopPing()
    this.pingTimer = setInterval(() => {
      this.send({ t: 'ping', time: Date.now() })
    }, PING_INTERVAL_MS)
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnect()
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS)
    this.reconnectAttempt += 1
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
