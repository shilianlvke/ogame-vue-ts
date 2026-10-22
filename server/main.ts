/**
 * 服务端入口
 *
 * 用法：
 *   pnpm build:server && node server-dist/main.js
 *
 * 环境变量：
 *   PORT=25122            监听端口
 *   HOST=0.0.0.0          监听地址
 *   STATIC_DIR=docs       前端构建产物目录
 *   DATA_DIR=data         存档目录（world.json）
 *   GAME_SPEED=1          游戏速度倍率
 *   NPC_COUNT=200         新建世界时的 NPC 星球数（已废弃，NPC 已下线）
 *   VISIBILITY=public     public | full
 *   LOCALE=zh-CN          默认语言
 *   BATTLE_TO_FINISH=0    1 = 战斗到底模式
 *   NEWBIE_PROTECTION_HOURS=24  新账号新手保护期（0 = 关闭）
 *   COMMAND_RATE_LIMIT=30       每秒每人命令上限
 *   TICK_MS=1000          tick 间隔
 *   AUTOSAVE_MS=30000     自动存档间隔
 */
import { networkInterfaces } from 'node:os'
import { resolve } from 'node:path'
import type { Locale } from '@/locales'
import { startServer } from './app'
import { setRouteMode } from '@/config/routeMode'
import type { VisibilityMode } from '@/core/protocol'

const env = process.env
// 航线距离口径：legacy（默认）/ v2（方案 C）
setRouteMode(env.ROUTE_DISTANCE_MODE)

const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const bool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback
  return value === '1' || value.toLowerCase() === 'true'
}

const lanAddress = (): string => {
  const nets = networkInterfaces()
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return 'localhost'
}

const port = num(env.PORT, 25122)
const visibility = (env.VISIBILITY === 'full' ? 'full' : 'public') as VisibilityMode

const running = await startServer({
  port,
  host: env.HOST ?? '0.0.0.0',
  staticDir: resolve(env.STATIC_DIR ?? 'docs'),
  dataDir: resolve(env.DATA_DIR ?? 'data'),
  visibility,
  gameSpeed: num(env.GAME_SPEED, 1),
  battleToFinish: bool(env.BATTLE_TO_FINISH, false),
  locale: (env.LOCALE ?? 'zh-CN') as Locale,
  protectionHours: num(env.NEWBIE_PROTECTION_HOURS, 24),
  commandRateLimit: num(env.COMMAND_RATE_LIMIT, 30),
  tickMs: num(env.TICK_MS, 1000),
  autosaveMs: num(env.AUTOSAVE_MS, 30_000)
})

console.log('=======================================')
console.log('OGame Vue Ts 联机服务已启动')
console.log(`本地访问:   http://localhost:${running.port}`)
console.log(`局域网访问: http://${lanAddress()}:${running.port}`)
console.log(`WebSocket:  ws://localhost:${running.port}/ws`)
console.log(`健康检查:   http://localhost:${running.port}/health`)
console.log(`可见性模式: ${visibility}`)
console.log('=======================================')

let shuttingDown = false
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n[server] 收到 ${signal}，正在保存并退出…`)
  try {
    await running.close()
  } finally {
    process.exit(0)
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
