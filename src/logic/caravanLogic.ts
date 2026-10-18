/**
 * NPC 商队（P5 最后一块）
 *
 * 目的：让星门有**稳定收益**，而不是只有玩家路过才收得到钱。
 *
 * 实现尽量轻：
 * - 商队沿一条星门航道单向飞行（不建完整 AI）；
 * - 到达时向该星门所有者缴纳过路费（玩家所有者入账，派系视为系统回收）；
 * - 星图上可以按 `progress` 插值画成移动光点。
 */
import { gateTollOf } from './gateLogic'
import { resolveGateOwner } from './tollLogic'
import type { CycleLayout } from '@/types/galaxy'
import type { World } from '@/core/types'

/** 商队生成间隔 */
export const CARAVAN_INTERVAL_MS = 10 * 60 * 1000
/** 同时最多存在多少商队 */
export const MAX_CARAVANS = 6

export interface Caravan {
  id: string
  laneA: string
  laneB: string
  departAt: number
  arriveAt: number
}

/** 0..1 的飞行进度（用于星图插值） */
export const caravanProgress = (caravan: Caravan, now: number): number => {
  const span = caravan.arriveAt - caravan.departAt
  if (span <= 0) return 1
  return Math.max(0, Math.min(1, (now - caravan.departAt) / span))
}

/**
 * 生成一批商队：从星门航道里按确定性顺序挑
 */
export const spawnCaravans = (world: World, layout: CycleLayout, now: number, count = 2): Caravan[] => {
  const gates = layout.gates
  if (gates.length === 0) return []
  const existing = world.caravans?.length ?? 0
  const room = Math.max(0, MAX_CARAVANS - existing)
  const total = Math.min(count, room)
  const created: Caravan[] = []

  for (let i = 0; i < total; i += 1) {
    const lane = gates[(now / 1000 + i + (world.layoutSeed ?? 0)) % gates.length | 0]!
    const travelMs = 4 * 60 * 1000
    created.push({
      id: `caravan_${now}_${i}`,
      laneA: lane.a,
      laneB: lane.b,
      departAt: now,
      arriveAt: now + travelMs
    })
  }
  return created
}

/**
 * 推进商队：到达的商队缴费并移除
 */
export const tickCaravans = (world: World, now: number): { arrived: number; credits: Record<string, number> } => {
  const credits: Record<string, number> = {}
  if (!world.caravans || world.caravans.length === 0) return { arrived: 0, credits }

  const remaining: Caravan[] = []
  let arrived = 0
  for (const caravan of world.caravans) {
    if (caravan.arriveAt > now) {
      remaining.push(caravan)
      continue
    }
    arrived += 1
    const { owner } = resolveGateOwner(world, caravan.laneB)
    const toll = owner === 'neutral' ? 0 : gateTollOf(owner as never, 2)
    if (toll > 0 && world.players) {
      const player = world.players.find(candidate => candidate.id === owner)
      if (player?.planets[0]) {
        player.planets[0].resources.deuterium += toll
        credits[owner] = (credits[owner] ?? 0) + toll
      }
    }
  }
  world.caravans = remaining
  return { arrived, credits }
}

/** 到点就生成新商队 */
export const maybeSpawnCaravans = (world: World, layout: CycleLayout, now: number): void => {
  const last = world.caravanSpawnAt ?? 0
  if (now - last < CARAVAN_INTERVAL_MS) return
  world.caravanSpawnAt = now
  world.caravans = [...(world.caravans ?? []), ...spawnCaravans(world, layout, now)]
}
