/**
 * 服务端启动器
 *
 * 单进程同时提供：
 * - 静态资源（docs/，即前端构建产物）
 * - WebSocket 游戏协议（/ws）
 * - 运维接口（/health、/api/info）
 * - 世界 tick 与自动存档
 */
import http from 'node:http'
import { join } from 'node:path'
import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import type { Locale } from '@/locales'
import { PROTOCOL_VERSION } from '@/core/protocol'
import type { ClientMessage, ServerMessage, VisibilityMode } from '@/core/protocol'
import { Room } from './room'
import type { ClientConnection } from './room'
import { createStaticHandler, sendJson } from './http'
import { loadWorld, saveWorld } from './persist'
import { createState } from './state'
import type { ServerState } from './state'

export interface StartOptions {
  port?: number
  host?: string
  /** 前端构建产物目录 */
  staticDir: string
  /** 存档目录；不传则只在内存中运行（测试用） */
  dataDir?: string
  visibility?: VisibilityMode
  gameSpeed?: number
  battleToFinish?: boolean
  locale?: Locale
  /** 新账号新手保护期（小时） */
  protectionHours?: number
  /** 每秒命令上限 */
  commandRateLimit?: number
  /** tick 间隔（毫秒） */
  tickMs?: number
  /** 自动存档间隔（毫秒） */
  autosaveMs?: number
  /** 关闭静态资源服务（测试用） */
  serveStatic?: boolean
}

export interface RunningServer {
  port: number
  room: Room
  close: () => Promise<void>
}

export const startServer = async (options: StartOptions): Promise<RunningServer> => {
  const stateFile = options.dataDir ? join(options.dataDir, 'world.json') : null

  let state: ServerState | null = stateFile ? loadWorld(stateFile) : null
  if (!state) {
    state = createState({
      gameSpeed: options.gameSpeed,
      battleToFinish: options.battleToFinish,
      locale: options.locale
    })
    console.log('[server] 创建新世界：NPC 已按工厂版 §14.2 下线，星图地点由信号系统生成')
  } else {
    console.log(`[server] 读取存档：${Object.keys(state.players).length} 名玩家`)
  }

  const room = new Room(state, {
    visibility: options.visibility,
    defaultLocale: options.locale,
    protectionHours: options.protectionHours,
    commandRateLimit: options.commandRateLimit
  })

  // 预加载默认语言（报告文案需要）
  await room.ensureTranslator(state.locale)

  const staticHandler = options.serveStatic === false ? null : createStaticHandler(options.staticDir)

  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname

    // 非 Upgrade 请求访问 /ws 时给出明确状态，避免被 SPA 回退成 200 index.html
    if (pathname === '/ws') {
      res.statusCode = 426
      res.setHeader('Upgrade', 'websocket')
      res.setHeader('Connection', 'Upgrade')
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('WebSocket endpoint: connect with ws:// or wss://')
      return
    }

    if (pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        tick: room.tickCount,
        online: room.onlineCount,
        players: room.playerCount,
        uptime: Math.floor(process.uptime())
      })
      return
    }

    if (pathname === '/api/info') {
      sendJson(res, 200, {
        protocolVersion: PROTOCOL_VERSION,
        gameSpeed: state.gameSpeed,
        battleToFinish: state.battleToFinish,
        visibility: room.visibility,
        players: room.playerCount,
        online: room.onlineCount
      })
      return
    }

    if (staticHandler) {
      staticHandler(req, res)
      return
    }

    sendJson(res, 404, { error: 'not found' })
  })

  if (process.env.DEBUG_WS === '1') {
    server.on('upgrade', request => {
      console.log(
        `[ws] upgrade url=${request.url ?? ''} host=${request.headers.host ?? ''} ` +
          `upgrade=${request.headers.upgrade ?? ''} connection=${request.headers.connection ?? ''} ` +
          `remote=${request.socket.remoteAddress ?? ''}`
      )
    })
  }

  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 })

  wss.on('connection', (socket: WebSocket, request) => {
    if (process.env.DEBUG_WS === '1') {
      console.log(`[ws] connected url=${request.url ?? ''} remote=${request.socket.remoteAddress ?? ''}`)
    }
    let playerId: string | null = null

    const connection: ClientConnection = {
      send: (message: ServerMessage) => {
        // 1 = OPEN
        if (socket.readyState === 1) {
          socket.send(JSON.stringify(message))
        }
      },
      close: (reason?: string) => {
        try {
          socket.close(1000, reason)
        } catch {
          socket.terminate()
        }
      }
    }

    const sendError = (message: string): void => connection.send({ t: 'error', message })

    socket.on('message', async (raw: Buffer | string) => {
      let message: ClientMessage
      try {
        message = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')) as ClientMessage
      } catch {
        sendError('invalid json')
        return
      }

      if (!message || typeof message !== 'object' || typeof (message as { t?: unknown }).t !== 'string') {
        sendError('invalid message')
        return
      }

      // 未登录：只接受 hello
      if (!playerId) {
        if (message.t !== 'hello') {
          sendError('hello required')
          return
        }
        if (message.protocolVersion !== PROTOCOL_VERSION) {
          sendError(`protocol mismatch: server=${PROTOCOL_VERSION}`)
          connection.close('protocol mismatch')
          return
        }

        try {
          const result = await room.join(
            { name: message.name, password: message.password, token: message.token, locale: message.locale },
            connection
          )
          if (!result.ok) {
            // auth:* 供客户端本地化提示
            sendError(`auth:${result.error}`)
            return
          }
          playerId = result.player.id
          connection.send({
            t: 'welcome',
            protocolVersion: PROTOCOL_VERSION,
            playerId: result.player.id,
            token: result.account.token,
            tick: room.tickCount,
            serverTime: Date.now(),
            snapshot: result.snapshot
          })
          console.log(`[server] ${result.account.name}(${result.player.id}) 加入，在线 ${room.onlineCount} 人`)
        } catch (error) {
          console.error('[server] 加入失败', error)
          sendError('join failed')
        }
        return
      }

      // 已登录：命令 / 心跳
      if (message.t === 'cmd') {
        room.enqueueCommandFor(playerId, message.seq, message.command)
      } else if (message.t === 'ping') {
        connection.send({ t: 'pong', time: message.time })
      } else if (message.t === 'hello') {
        sendError('already joined')
      }
    })

    socket.on('close', () => {
      if (playerId) {
        room.leave(playerId, connection)
        console.log(`[server] ${playerId} 断开，在线 ${room.onlineCount} 人`)
      }
    })

    socket.on('error', error => {
      console.error('[server] socket 错误', error)
    })
  })

  // ----------------------------- tick 循环 -----------------------------
  const tickMs = options.tickMs ?? 1000
  const tickTimer = setInterval(() => {
    room.tickOnce(Date.now()).catch(error => console.error('[server] tick 失败', error))
  }, tickMs)

  // ----------------------------- 自动存档 -----------------------------
  const autosaveMs = options.autosaveMs ?? 30_000
  const saveTimer = stateFile
    ? setInterval(() => {
        if (!room.isDirty()) return
        if (saveWorld(stateFile, state)) room.markClean()
      }, autosaveMs)
    : null

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 25122, options.host ?? '0.0.0.0', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : (options.port ?? 25122)

  const close = async (): Promise<void> => {
    clearInterval(tickTimer)
    if (saveTimer) clearInterval(saveTimer)
    if (stateFile) saveWorld(stateFile, state)
    for (const client of wss.clients) {
      try {
        client.terminate()
      } catch {
        // ignore
      }
    }
    await new Promise<void>(resolve => wss.close(() => resolve()))
    await new Promise<void>(resolve => server.close(() => resolve()))
  }

  return { port, room, close }
}
