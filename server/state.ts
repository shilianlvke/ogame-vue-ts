/**
 * 服务端世界状态：定义、创建、序列化
 */
import type { DebrisField, NPC, Planet, Player } from '@/types/game'
import type { Locale } from '@/locales'
import { createWorld } from '@/core/world'
import { generateNpcPlanets } from '@/core/generate'
import * as gameLogic from '@/logic/gameLogic'

/** 存档格式版本 */
export const STATE_VERSION = 1

/** 账号（令牌用于断线重连，密码用于换设备登录） */
export interface Account {
  id: string
  name: string
  token: string
  locale: Locale
  createdAt: number
  lastSeenAt: number
  /** 密码哈希（scrypt）；老账号可能没有，只能靠令牌重连 */
  passwordHash?: string
  passwordSalt?: string
}

/** 服务端完整世界 */
export interface ServerState {
  version: number
  createdAt: number
  gameSpeed: number
  battleToFinish: boolean
  locale: Locale
  accounts: Record<string, Account>
  players: Record<string, Player>
  /** NPC 星球（key = galaxy:system:position） */
  planets: Record<string, Planet>
  npcs: NPC[]
  debrisFields: Record<string, DebrisField>
  /** 每个玩家的成就检查累加器（秒） */
  achievementAccum: Record<string, number>
  /** 星门状态（玩家占领结果需要落盘） */
  gates?: Record<string, import('@/logic/gateCaptureLogic').GateState>
}

export interface CreateStateOptions {
  gameSpeed?: number
  battleToFinish?: boolean
  locale?: Locale
  npcCount?: number
  planetPrefix?: string
}

/** 创建一份全新的世界状态（含 NPC 星球） */
export const createState = (options: CreateStateOptions = {}): ServerState => {
  const locale = options.locale ?? 'zh-CN'
  const state: ServerState = {
    version: STATE_VERSION,
    createdAt: Date.now(),
    gameSpeed: options.gameSpeed ?? 1,
    battleToFinish: options.battleToFinish ?? false,
    locale,
    accounts: {},
    players: {},
    planets: {},
    npcs: [],
    debrisFields: {},
    achievementAccum: {}
  }

  // 用一个占位玩家构造 World，只为生成 NPC 星球
  const placeholder = gameLogic.initializePlayer('system', 'System')
  const world = createWorld({
    player: placeholder,
    planets: state.planets,
    npcs: state.npcs,
    debrisFields: state.debrisFields,
    locale,
    gameSpeed: state.gameSpeed,
    battleToFinish: state.battleToFinish
  })

  generateNpcPlanets(world, options.planetPrefix ?? 'Planet', options.npcCount ?? 200)

  return state
}

/** 序列化（落盘用） */
export const serializeState = (state: ServerState): string => JSON.stringify(state)

/** 反序列化（带版本校验，失败返回 null） */
export const parseState = (raw: string): ServerState | null => {
  try {
    const parsed = JSON.parse(raw) as ServerState
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.version !== STATE_VERSION) {
      console.warn(`[state] 存档版本不匹配：${parsed.version} != ${STATE_VERSION}`)
      return null
    }
    parsed.accounts ??= {}
    parsed.players ??= {}
    parsed.planets ??= {}
    parsed.npcs ??= []
    parsed.debrisFields ??= {}
    parsed.achievementAccum ??= {}
    return parsed
  } catch (error) {
    console.error('[state] 存档解析失败', error)
    return null
  }
}
