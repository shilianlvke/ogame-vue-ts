/**
 * 星图 POI（原「未知信号」）——工厂版 §9.5
 *
 * 每个恒星系按布局种子确定性地生成（或不生成）一个地点：
 * - derelict：残骸，给旧资源
 * - ruin：遗迹，给旧资源 + 少量工厂材料（锈蚀合金）
 * - tradingPost：贸易站，3 个随机商品位，暗物质购买，每 6 小时刷新
 * - lair：巢穴，一次性波次挑战，给旧资源 + 工厂材料
 * - wormhole：虫洞，可直达另一个恒星系
 *
 * 不再生成 NPC 星球；NPC 行为/成长/外交已按 §14.2 下线。
 */
import { hashString, mulberry32 } from '@/utils/random'

export type SignalKind = 'derelict' | 'ruin' | 'tradingPost' | 'lair' | 'wormhole'

/** 贸易站商品：用旧资源结算，价格以暗物质计 */
export interface TradeGood {
  /** metal / crystal / deuterium */
  material: 'metal' | 'crystal' | 'deuterium'
  amount: number
  /** 暗物质单价 */
  price: number
}

export interface Signal {
  systemId: string
  kind: SignalKind
  /** 奖励（残骸/遗迹/巢穴）；虫洞与贸易站为 0 */
  reward: { metal: number; crystal: number; deuterium: number }
  /** 虫洞目标恒星系 id */
  targetSystemId?: string
  /** 贸易站商品（仅 tradingPost） */
  goods?: TradeGood[]
  /** 贸易站刷新批次（仅 tradingPost），每 6 小时 +1 */
  tradeBucket?: number
  /** 巢穴挑战建议战力（仅 lair） */
  lairPower?: number
}

/** 出现概率（每个恒星系） */
export const SIGNAL_CHANCE = 0.08

/** 贸易站刷新间隔（毫秒） */
export const TRADE_REFRESH_MS = 6 * 60 * 60 * 1000

/** 贸易站商品可选材料与价格区间 */
const TRADE_MATERIALS: TradeGood['material'][] = ['metal', 'crystal', 'deuterium']

const REWARD_TABLE: Record<'derelict' | 'ruin' | 'lair', { metal: number; crystal: number; deuterium: number }> = {
  derelict: { metal: 4000, crystal: 2000, deuterium: 500 },
  ruin: { metal: 1000, crystal: 3000, deuterium: 800 },
  lair: { metal: 6000, crystal: 4000, deuterium: 1500 }
}

/**
 * 当前贸易站批次。
 * 以 Unix 纪元为基准，6 小时一个批次；服务端/客户端用同一个时间即可得到同一批商品。
 */
export const tradeBucketOf = (now: number = Date.now()): number => Math.floor(now / TRADE_REFRESH_MS)

/** 生成某个贸易站当前批次的 3 个商品位 */
const buildTradeGoods = (layoutSeed: number, systemId: string, bucket: number): TradeGood[] => {
  const rand = mulberry32(hashString(`${layoutSeed}:trade:${systemId}:${bucket}`))
  return Array.from({ length: 3 }, () => {
    const material = TRADE_MATERIALS[Math.floor(rand() * TRADE_MATERIALS.length) % TRADE_MATERIALS.length]!
    const amount = 500 + Math.floor(rand() * 1501)
    const price = 200 + Math.floor(rand() * 601)
    return { material, amount, price }
  })
}

/** 巢穴建议战力：随恒星系危险度与周目增长 */
const lairPowerOf = (systemId: string, cycle: number): number => {
  const rand = mulberry32(hashString(`lair:${systemId}`))
  const base = 400 + Math.floor(rand() * 600)
  return Math.round(base * (1 + 0.15 * Math.max(0, cycle - 1)))
}

/**
 * 某个恒星系的地点（确定性；没有则返回 null）
 *
 * @param now 传入时间用于贸易站 6 小时刷新；省略时按当前时间。
 * @param cycle 当前周目，用于巢穴战力提示。
 */
export const signalOf = (
  layoutSeed: number,
  systemId: string,
  allSystemIds?: string[],
  now: number = Date.now(),
  cycle: number = 1
): Signal | null => {
  const rand = mulberry32(hashString(`${layoutSeed}:signal:${systemId}`))
  if (rand() > SIGNAL_CHANCE) return null

  const roll = rand()
  if (roll < 0.1) {
    // 虫洞：随机指向另一个恒星系
    const pool = (allSystemIds ?? []).filter(id => id !== systemId)
    if (pool.length === 0) return null
    const target = pool[Math.floor(rand() * pool.length) % pool.length]!
    return { systemId, kind: 'wormhole', reward: { metal: 0, crystal: 0, deuterium: 0 }, targetSystemId: target }
  }

  if (roll < 0.35) {
    return { systemId, kind: 'ruin', reward: { ...REWARD_TABLE.ruin } }
  }
  if (roll < 0.6) {
    return { systemId, kind: 'derelict', reward: { ...REWARD_TABLE.derelict } }
  }
  if (roll < 0.85) {
    const bucket = tradeBucketOf(now)
    return {
      systemId,
      kind: 'tradingPost',
      reward: { metal: 0, crystal: 0, deuterium: 0 },
      goods: buildTradeGoods(layoutSeed, systemId, bucket),
      tradeBucket: bucket
    }
  }
  return { systemId, kind: 'lair', reward: { ...REWARD_TABLE.lair }, lairPower: lairPowerOf(systemId, cycle) }
}
