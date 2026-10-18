/**
 * 运行时（Runtime）
 *
 * 把「当前世界 + 引擎上下文」暴露给 UI 层，让视图通过 `dispatchCommand()` 发起操作。
 * 服务端不需要这个单例：它可以直接用 `applyCommand(world, ctx, command)`。
 */
import type { EngineContext, World } from './types'
import { applyCommand } from './commands'
import type { CommandResult, GameCommand } from './commands'

export interface GameRuntime {
  world: World
  ctx: EngineContext
  /** 每次派发命令前同步 store 侧可变字段（客户端用） */
  sync?: () => void
}

/** 联机模式下的命令通道（由网络层注入） */
export interface CommandTransport {
  sendCommand(command: GameCommand): CommandResult
}

let currentRuntime: GameRuntime | null = null
let onlineTransport: CommandTransport | null = null

/** 注册运行时（App 初始化时调用） */
export const setGameRuntime = (runtime: GameRuntime | null): void => {
  currentRuntime = runtime
}

/** 获取当前运行时 */
export const getGameRuntime = (): GameRuntime | null => currentRuntime

/**
 * 注入/清除联机命令通道
 * 注入后所有命令改为发往服务端，本地不再自行结算（保证唯一权威源）
 */
export const setOnlineTransport = (transport: CommandTransport | null): void => {
  onlineTransport = transport
}

/** 当前是否处于联机模式 */
export const isOnlineMode = (): boolean => onlineTransport !== null

/**
 * 派发命令（UI 唯一的状态变更入口）
 *
 * - 单机：立即在本地 `applyCommand`
 * - 联机：交给网络层发送，本地等待服务端补丁
 *
 * 联机模式下这里返回 `{ ok: true }` 表示「已提交」，真正的拒绝会以
 * `reject` 消息异步返回（由网络层提示用户）。
 */
export const dispatchCommand = (command: GameCommand): CommandResult => {
  if (onlineTransport) {
    return onlineTransport.sendCommand(command)
  }
  if (!currentRuntime) {
    return { ok: false }
  }
  currentRuntime.sync?.()
  return applyCommand(currentRuntime.world, currentRuntime.ctx, command)
}
