/**
 * 过路费：v2 航线经过他国星门时收费
 *
 * 规则（P5）：
 * - 中立星门免费；
 * - 玩家拥有的星门：路过的其他玩家缴纳 `gateTollOf(owner, wealth)` 重氢，归所有者；
 * - NPC 派系拥有的星门：同样收费，但收益进"系统"（不发给任何人）。
 */
import { gateOwnerOf, gatewaySystemOf, gateTollOf } from './gateLogic'
import type { GateState } from './gateCaptureLogic'
import type { World } from '@/core/types'
import type { PlannedLeg } from './fleetRouteLogic'

export interface TollDetail {
  systemId: string
  ownerId: string
  amount: number
}

export interface TollResult {
  total: number
  details: TollDetail[]
  /** 玩家所有者应得的重氢（ownerId → amount） */
  credits: Record<string, number>
}

/** 解析某座星门的当前归属：运行时状态优先，否则按种子推导 */
export const resolveGateOwner = (world: World, systemId: string): { owner: string; toll: number } => {
  const live = world.gates?.[systemId]
  const layout = (world as World & { galaxyLayout?: { systemIndex: Map<string, { wealth: 1 | 2 | 3 }> } }).galaxyLayout
  const wealth = layout?.systemIndex.get(systemId)?.wealth ?? 2

  if (live) {
    const toll = live.owner === 'neutral' ? 0 : gateTollOf(live.owner as never, wealth)
    return { owner: live.owner, toll }
  }

  const owner = gateOwnerOf(world.layoutSeed ?? 20261018, systemId)
  return { owner, toll: owner === 'neutral' ? 0 : gateTollOf(owner, wealth) }
}

/**
 * 计算一条航线要交的过路费
 */
export const computeRouteTolls = (world: World, legs: PlannedLeg[], travelerId: string): TollResult => {
  const details: TollDetail[] = []
  const credits: Record<string, number> = {}

  for (const leg of legs) {
    if (!leg.gate) continue
    const systemId = leg.systemId
    const { owner, toll } = resolveGateOwner(world, systemId)
    if (owner === 'neutral' || owner === travelerId || toll <= 0) continue

    details.push({ systemId, ownerId: owner, amount: toll })
    // 只有玩家所有者能收到钱（NPC 派系的收益视为系统回收）
    if (!owner.startsWith('npc_') && owner !== 'miners_guild' && owner !== 'deep_council' && owner !== 'free_fleet' && owner !== 'swarm') {
      credits[owner] = (credits[owner] ?? 0) + toll
    }
  }

  return { total: details.reduce((sum, detail) => sum + detail.amount, 0), details, credits }
}

/** 便捷：某座星门是不是"别人家的" */
export const isForeignGate = (world: World, systemId: string, travelerId: string): boolean => {
  const { owner } = resolveGateOwner(world, systemId)
  return owner !== 'neutral' && owner !== travelerId
}

export type { GateState }
export { gatewaySystemOf }
