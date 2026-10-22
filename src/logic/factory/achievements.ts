import type { PlanetFactory } from '@/types/factory'
import { MATERIALS, MATERIAL_IDS } from '@/config/factory/materials'
import { recipeDiagnostics } from './diagnostics'
import type { Outpost } from './outposts'

/**
 * 成就判定，对应规划书 §10.7。
 * 累计统计存于 store 持久化，判定为纯函数，即时发放、周目不重置。
 */

/** 累计统计 */
export interface AchievementStats {
  /** 建成过矿井 */
  builtMine: boolean
  /** 全部生产槽位连续无空转秒数 */
  fullLoadSeconds: number
  /** 经历过满足率 ≤ 20% 的欠压 */
  undervoltSeen: boolean
  /** 欠压后已恢复 */
  powerOut: boolean
  /** 通过精英波且防线未受损 */
  zeroLoss: boolean
  /** 建筑 ≤ 20 时发射火箭 */
  minimalLaunch: boolean
  /** 累计消耗锈群残骸（rustWreck） */
  salvagedWreck: number
  /** 累计击杀锈群 HP */
  rustHpKilled: number
  /** 破产起始世界时间（秒），0 = 未破产 */
  bankruptAt: number
}

export function createAchievementStats(): AchievementStats {
  return {
    builtMine: false,
    fullLoadSeconds: 0,
    undervoltSeen: false,
    powerOut: false,
    zeroLoss: false,
    minimalLaunch: false,
    salvagedWreck: 0,
    rustHpKilled: 0,
    bankruptAt: 0
  }
}

/** 判定上下文 */
export interface AchievementContext {
  factory: PlanetFactory
  outposts: Outpost[]
  cycle: number
  launchCount: number
  /** 世界时间（秒） */
  now: number
}

/** 固体材料与流体总量（单位） */
export function totalMaterials(factory: PlanetFactory): number {
  let total = 0
  for (const v of Object.values(factory.stock)) total += v ?? 0
  for (const v of Object.values(factory.fluids)) total += v ?? 0
  return total
}

/** 是否同时持有全部 62 种材料各 ≥1 */
export function hasAllMaterials(factory: PlanetFactory): boolean {
  for (const id of MATERIAL_IDS) {
    const def = MATERIALS[id]
    const n = def.fluid ? (factory.fluids[id] ?? 0) : (factory.stock[id] ?? 0)
    if (n < 1) return false
  }
  return true
}

/** 返回当前达成的成就 id 集合 */
export function evaluateAchievements(ctx: AchievementContext, stats: AchievementStats): Set<string> {
  const result = new Set<string>()
  if (stats.builtMine) result.add('firstMine')
  if (stats.fullLoadSeconds >= 600) result.add('fullLoad')
  if (stats.zeroLoss) result.add('zeroLoss')
  if (stats.minimalLaunch) result.add('minimal')
  if (hasAllMaterials(ctx.factory)) result.add('collector')
  if (stats.powerOut) result.add('powerOut')
  if (stats.salvagedWreck >= 1000) result.add('salvager')
  if (ctx.outposts.length >= 5 && ctx.outposts.every(o => o.mineSlots > 0)) result.add('miner')
  if (ctx.launchCount >= 12) result.add('cycler')
  if (stats.rustHpKilled >= 1_000_000) result.add('rustSlayer')
  if (calculator(ctx.factory)) result.add('calculator')
  if (stats.bankruptAt > 0 && ctx.now - stats.bankruptAt <= 3600 && totalMaterials(ctx.factory) >= 100_000) result.add('bankrupt')
  return result
}

/** 精算师：任一配方实际产能达到理论值 99% 以上 */
function calculator(factory: PlanetFactory): boolean {
  const rows = recipeDiagnostics(factory)
  return rows.some(r => r.slots > 0 && r.theoretical > 0 && r.actual >= r.theoretical * 0.99)
}
