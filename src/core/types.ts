/**
 * 无头世界模型（World）
 *
 * 设计目标：让「游戏推进」完全脱离 Vue / Pinia / 浏览器 API，从而可以被
 * 1) 现有浏览器客户端直接驱动（单机模式，零行为变化）
 * 2) Node 服务端驱动（联机模式的权威仿真源）
 * 3) 单元测试/快进模拟（无需 UI）
 *
 * 约定：
 * - `World` 只持有普通对象引用，客户端会把这些引用指向 Pinia state 里的对象，
 *   因此引擎的写入会自然触发 Vue 响应式更新；
 * - 引擎只做「就地修改」(in-place mutation)，**不允许重新赋值** `World` 的字段
 *   （否则会切断与 store 的引用关系），数组变更一律走 splice/push/pop。
 */
import type { Player, Planet, NPC, DebrisField } from '@/types/game'
import type { Locale } from '@/locales'

/** 单玩家视角的世界 */
export interface World {
  /** 当前行动玩家（单机：本地玩家；服务端：该阶段正在处理的玩家） */
  player: Player
  /**
   * 当前所处的周目（1 起）。
   * 所有"按玩家/按星球遍历"的查询都会按它过滤；未设置时视为单层世界（兼容旧逻辑）。
   */
  cycle?: number
  /**
   * 联机模式下的所有玩家。
   * 单机模式可省略（省略时等价于 `[player]`），服务端必须设置。
   */
  players?: Player[]
  /** 非玩家星球，key = `galaxy:system:position`（对应 universeStore.planets） */
  planets: Record<string, Planet>
  /** NPC 列表（对应 npcStore.npcs） */
  npcs: NPC[]
  /** 残骸场，key = debris id（对应 universeStore.debrisFields） */
  debrisFields: Record<string, DebrisField>
  /** 语言（影响 NPC 名称生成等） */
  locale: Locale
  /** 游戏速度倍率 */
  gameSpeed: number
  /** 战斗到底模式 */
  battleToFinish: boolean
  /** NPC 成长累加秒数（按周目分别累计，避免多层互相清零） */
  npcGrowthAccum: Record<number, number>
  /** NPC 行为累加秒数（按周目分别累计） */
  npcBehaviorAccum: Record<number, number>
  /** NPC 注册表当前对应的周目（切换周目时重建） */
  npcRegistryCycle?: number
  /** NPC 商队（P5） */
  caravans?: Array<import('@/logic/caravanLogic').Caravan>
  /** 上次生成商队的时间 */
  caravanSpawnAt?: number
  /** 星门状态（键 = 恒星系 id），首次访问时按布局种子建立 */
  gates?: Record<string, import('@/logic/gateCaptureLogic').GateState>
  /** 星图布局种子（见 core/galaxyContext.ts） */
  layoutSeed?: number
  /** 当前周目的星图缓存（不落盘，按需构建） */
  galaxyLayout?: import('@/types/galaxy').CycleLayout
  /** 缓存对应的 `${seed}:${cycle}` */
  galaxyLayoutKey?: string
  /** 成就检查累加秒数（原 achievementCheckCounter） */
  achievementAccum: number
}

/** 翻译函数签名（与 useI18n 的 t 兼容；服务端可注入 key 直传实现） */
export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

/** 提示条变体 */
export type ToastVariant = 'success' | 'info' | 'warning' | 'error'

/**
 * 引擎向外抛出的事件
 *
 * 引擎自身不弹 UI，只描述「发生了什么」，由客户端决定如何呈现；
 * 服务端则可以把它翻译成推送给对应玩家的消息。
 */
export type EngineEvent =
  /** 建造/研究队列完成（原 handleNotification 的入参） */
  | { kind: 'queueComplete'; category: 'building' | 'technology' | 'ship' | 'defense'; itemType: string; level?: number }
  /** 新解锁内容（原 handleUnlockNotification 的入参） */
  | { kind: 'unlocks'; items: Array<{ type: 'building' | 'technology'; id: string; name: string }> }
  /** 通用提示条 */
  | {
      kind: 'toast'
      variant: ToastVariant
      messageKey: string
      messageParams?: Record<string, string | number>
      descriptionKey?: string
      descriptionParams?: Record<string, string | number>
    }
  /** 成就解锁 */
  | { kind: 'achievement'; id: string; tier: string }

/** 引擎运行上下文 */
export interface EngineContext {
  /** 翻译函数 */
  t: TranslateFn
  /** 事件出口；联机模式下可指定事件属于哪个玩家（NPC 可能针对不同玩家行动） */
  emit: (event: EngineEvent, playerId?: string) => void
  /**
   * 随机数源（默认 Math.random）。
   * 服务端可注入可复现的 PRNG，便于回放与测试。
   */
  random?: () => number
  /** 时间源（默认 Date.now） */
  now?: () => number
}

/** 创建引擎上下文（未提供 random / now 时使用默认实现） */
export const createEngineContext = (ctx: {
  t: TranslateFn
  emit: (event: EngineEvent, playerId?: string) => void
  random?: () => number
  now?: () => number
}): EngineContext => ({
  t: ctx.t,
  emit: ctx.emit,
  random: ctx.random ?? Math.random,
  now: ctx.now ?? Date.now
})
