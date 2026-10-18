/**
 * 未知信号（P7 第一步：确定性生成）
 *
 * 每个恒星系按布局种子确定性地生成（或不生成）一个异常信号：
 * - derelict：残骸，给资源
 * - ruin：遗迹，给科技点/研究加成
 * - wormhole：虫洞，可直达另一个恒星系
 *
 * 只读模型：目前只负责"哪里有信号、是什么、给什么"，
 * 扫描发现与领取奖励在后续步骤接入 `galaxy.scan`。
 */
import { hashString, mulberry32 } from '@/utils/random'

export type SignalKind = 'derelict' | 'ruin' | 'wormhole'

export interface Signal {
  systemId: string
  kind: SignalKind
  /** 奖励（残骸/遗迹）；虫洞为 0 */
  reward: { metal: number; crystal: number; deuterium: number }
  /** 虫洞目标恒星系 id */
  targetSystemId?: string
}

/** 出现概率（每个恒星系） */
export const SIGNAL_CHANCE = 0.08

const REWARD_TABLE: Record<Exclude<SignalKind, 'wormhole'>, { metal: number; crystal: number; deuterium: number }> = {
  derelict: { metal: 4000, crystal: 2000, deuterium: 500 },
  ruin: { metal: 1000, crystal: 3000, deuterium: 800 }
}

/**
 * 某个恒星系的信号（确定性；没有则返回 null）
 */
export const signalOf = (layoutSeed: number, systemId: string, allSystemIds?: string[]): Signal | null => {
  const rand = mulberry32(hashString(`${layoutSeed}:signal:${systemId}`))
  if (rand() > SIGNAL_CHANCE) return null

  const roll = rand()
  if (roll < 0.15) {
    // 虫洞：随机指向另一个恒星系
    const pool = (allSystemIds ?? []).filter(id => id !== systemId)
    if (pool.length === 0) return null
    const target = pool[Math.floor(rand() * pool.length) % pool.length]!
    return { systemId, kind: 'wormhole', reward: { metal: 0, crystal: 0, deuterium: 0 }, targetSystemId: target }
  }

  const kind: SignalKind = roll < 0.6 ? 'derelict' : 'ruin'
  return { systemId, kind, reward: { ...REWARD_TABLE[kind] } }
}
