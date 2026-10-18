/**
 * 星系经济修正
 *
 * 把 `StarSystem` / `PlanetProfile` 翻译成具体的乘区：
 * - 矿脉储量（生成时一次性生效）
 * - 建造 / 研究 / 舰船 的成本与时间（P2 接入）
 *
 * 数值见 doc/GALAXY_BALANCE.md §6，所有乘区硬性截断在 ±20%。
 */
import type { PlanetProfile, StarSystem } from '@/types/galaxy'

export interface OreModifiers {
  metal: number
  crystal: number
  deuterium: number
}

export interface EconomyBonuses {
  buildCost: number
  buildTime: number
  researchSpeed: number
  shipBuildSpeed: number
  fuelCost: number
  cargoCapacity: number
  deuteriumProduction: number
}

export const NEUTRAL_ORE_MODIFIERS: OreModifiers = { metal: 1, crystal: 1, deuterium: 1 }

export const NEUTRAL_ECONOMY_BONUSES: EconomyBonuses = {
  buildCost: 1,
  buildTime: 1,
  researchSpeed: 1,
  shipBuildSpeed: 1,
  fuelCost: 1,
  cargoCapacity: 1,
  deuteriumProduction: 1
}

/** 加成上限（±20%），避免经济类型压过科技发展 */
const CAP = 0.2

const clampBonus = (value: number): number => 1 + Math.max(-CAP, Math.min(CAP, value))

/** 繁荣度：1 → -5%，2 → 0，3 → +5% */
const wealthBonus = (wealth: StarSystem['wealth']): number => (wealth - 2) * 0.05

/**
 * 矿脉修正：经济类型 + 繁荣度 + 行星资源偏向
 */
export const oreModifiers = (system: StarSystem | undefined, profile: PlanetProfile | undefined): OreModifiers => {
  if (!system) return { ...NEUTRAL_ORE_MODIFIERS }

  const metalBias = profile?.resourceBias === 'metal' ? 0.15 : 0
  const crystalBias = profile?.resourceBias === 'crystal' ? 0.15 : 0
  const deuteriumBias = profile?.resourceBias === 'deuterium' ? 0.15 : 0
  const wealth = wealthBonus(system.wealth)

  switch (system.economy) {
    case 'mining':
      return {
        metal: clampBonus(0.2 + metalBias + wealth),
        crystal: clampBonus(0.2 + crystalBias + wealth),
        deuterium: clampBonus(-0.05 + deuteriumBias + wealth)
      }
    case 'agriculture':
      return {
        metal: clampBonus(-0.05 + metalBias + wealth),
        crystal: clampBonus(crystalBias + wealth),
        deuterium: clampBonus(0.15 + deuteriumBias + wealth)
      }
    case 'military':
      return {
        metal: clampBonus(0.05 + metalBias + wealth),
        crystal: clampBonus(0.05 + crystalBias + wealth),
        deuterium: clampBonus(deuteriumBias + wealth)
      }
    default:
      return {
        metal: clampBonus(metalBias + wealth),
        crystal: clampBonus(crystalBias + wealth),
        deuterium: clampBonus(deuteriumBias + wealth)
      }
  }
}

/**
 * 生产 / 建造类修正（P2 接入调用点）
 */
export const economyBonuses = (system: StarSystem | undefined): EconomyBonuses => {
  if (!system) return { ...NEUTRAL_ECONOMY_BONUSES }

  const base: EconomyBonuses = { ...NEUTRAL_ECONOMY_BONUSES }
  switch (system.economy) {
    case 'industrial':
      base.buildCost = clampBonus(-0.08)
      base.buildTime = clampBonus(-0.05)
      break
    case 'tech':
      base.researchSpeed = clampBonus(0.15)
      break
    case 'trade':
      base.fuelCost = clampBonus(-0.1)
      base.cargoCapacity = clampBonus(0.1)
      break
    case 'agriculture':
      base.deuteriumProduction = clampBonus(0.15)
      break
    case 'military':
      base.shipBuildSpeed = clampBonus(0.15)
      break
    default:
      break
  }
  return base
}
