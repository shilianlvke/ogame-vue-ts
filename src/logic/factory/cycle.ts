import type { LaunchSelection, MaterialId, PlanetFactory } from '@/types/factory'
import { CARGO_POD_INITIAL_MATERIAL, CYCLE_HP_FACTOR, CYCLE_MAX, CYCLE_RARE_ORE_FACTOR } from '@/config/factory/balance'
import type { OrePreset } from '@/config/factory/balance'
import { createFactoryState } from './engine'
import { cancelAllOrders, type MarketState } from './market'

/**
 * 火箭发射与周目系统，对应规划书 §12。
 * 发射火箭 → 选择载荷 → 周目 +1 → 按重置表处理 → 星图换 seed。
 */

export interface CycleState {
  /** 当前周目 1~12 */
  cycle: number
  /** 累计火箭发射次数，跨周目累加 */
  launchCount: number
}

export function createCycleState(): CycleState {
  return { cycle: 1, launchCount: 0 }
}

/** 周目难度：锈群 HP 系数 */
export function cycleHpFactor(cycle: number): number {
  return 1 + CYCLE_HP_FACTOR * (cycle - 1)
}

/** 周目难度：稀有矿脉储量系数 */
export function cycleRareOreFactor(cycle: number): number {
  return 1 + CYCLE_RARE_ORE_FACTOR * (cycle - 1)
}

/** 下一周目，第 12 周目通关后回到第 1 周目 */
export function nextCycle(cycle: number): number {
  const next = cycle + 1
  return next > CYCLE_MAX ? 1 : next
}

/** 物资舱折算的初始材料，4 种基础矿均分 */
export const CARGO_POD_ORES: MaterialId[] = ['ironOre', 'copperOre', 'coal', 'stone']

/**
 * 按周目重置表处理母星工厂，返回新的工厂状态。
 * 装备、工程服、无限研究、循环残片保留；科技仅保留数据核心指定的 1 项；
 * 建筑仅保留工业种子指定的 1 座（等级保留）；库存清空后写入循环残片与物资舱初始材料。
 */
export function resetFactory(
  factory: PlanetFactory,
  preset: OrePreset,
  cycle: number,
  carryCargoPod: boolean,
  selection: LaunchSelection
): PlanetFactory {
  const fresh = createFactoryState(preset)
  // 稀有矿脉储量随周目系数放大（铀矿；原油储量尚未初始化，暂不处理）
  const rare = cycleRareOreFactor(cycle)
  fresh.oreReserve.uraniumOre = Math.round((fresh.oreReserve.uraniumOre ?? 0) * rare)
  if (fresh.oreReserveMax) fresh.oreReserveMax.uraniumOre = Math.round((fresh.oreReserveMax.uraniumOre ?? 0) * rare)
  // 装备、工程服、无限研究、循环残片跨周目保留
  fresh.equipment = { ...(factory.equipment ?? {}) }
  fresh.suit = factory.suit
  fresh.infiniteResearch = { ...factory.infiniteResearch }
  // 科技：全部清零，仅保留数据核心指定的 1 项
  const tech = selection.tech && factory.techs.includes(selection.tech) ? selection.tech : undefined
  if (tech) fresh.techs = [tech]
  // 建筑：全部清空，仅保留工业种子指定的 1 座（等级保留，槽位清空）
  const inst = selection.buildingInstanceId
    ? factory.buildings.find(b => b.id === selection.buildingInstanceId)
    : undefined
  if (inst) {
    fresh.buildings = [
      {
        id: inst.id,
        type: inst.type,
        level: inst.level,
        enabled: true,
        slots: Array.from({ length: Math.max(1, inst.level) }, () => ({ recipeId: null, progress: 0, status: 'idle' as const })),
        modules: []
      }
    ]
  }
  // 库存：清空，写入循环残片与物资舱折算初始材料
  const shards = factory.stock.cycleShard ?? 0
  fresh.stock = {}
  if (shards > 0) fresh.stock.cycleShard = shards
  if (carryCargoPod) {
    const per = Math.floor(CARGO_POD_INITIAL_MATERIAL / CARGO_POD_ORES.length)
    for (const ore of CARGO_POD_ORES) fresh.stock[ore] = per
  }
  return fresh
}

/** 撤回市场挂单并把矿业公会声望减半（周目重置时调用） */
export function resetMarket(market: MarketState, factory: PlanetFactory): void {
  cancelAllOrders(market, factory)
  market.minersGuildRep = Math.floor(market.minersGuildRep / 2)
}
