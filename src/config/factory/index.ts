import type { BuildingId, MaterialId, RecipeDef, TechId } from '@/types/factory'
import { BUILDINGS, DEFAULT_BUILDINGS } from './buildings'
import { DEFAULT_RECIPES, RECIPES } from './recipes'
import { TECHS, TECH_MAP } from './techs'
import { MAX_LEVEL, UPGRADE_MULTIPLIER, UPGRADE_MULTIPLIER_POWER, UPGRADE_MULTIPLIER_SILO, DEMOLISH_REFUND } from './balance'

export * from './balance'
export * from './buildings'
export * from './materials'
export * from './recipes'
export * from './techs'
export * from './icons'
export * from './market'

/** 建筑槽位数：等级即槽位数，上限 16 */
export function slotsOfLevel(level: number): number {
  return Math.max(1, Math.min(MAX_LEVEL, level))
}

/** 升级倍率，发电 1.6、发射井 2.0，其余 1.35 */
function upgradeMultiplier(id: BuildingId): number {
  if (id === 'rocketSilo') return UPGRADE_MULTIPLIER_SILO
  if (BUILDINGS[id].powerPerLevel) return UPGRADE_MULTIPLIER_POWER
  return UPGRADE_MULTIPLIER
}

/** 新建一座实例的成本 */
export function newCost(id: BuildingId): Partial<Record<MaterialId, number>> {
  return BUILDINGS[id].baseCost
}

/** 从当前等级升到 nextLevel 的成本；nextLevel 为 1 时等同新建 */
export function upgradeCost(id: BuildingId, nextLevel: number): Partial<Record<MaterialId, number>> {
  if (nextLevel <= 1) return newCost(id)
  const factor = Math.pow(upgradeMultiplier(id), nextLevel - 1)
  const out: Partial<Record<MaterialId, number>> = {}
  for (const [k, v] of Object.entries(BUILDINGS[id].baseCost)) {
    out[k as MaterialId] = Math.ceil((v as number) * factor)
  }
  return out
}

/** 拆除返还 */
export function demolishRefund(id: BuildingId, level: number): Partial<Record<MaterialId, number>> {
  const out: Partial<Record<MaterialId, number>> = {}
  for (const [k, v] of Object.entries(BUILDINGS[id].baseCost)) {
    out[k as MaterialId] = Math.floor((v as number) * level * DEMOLISH_REFUND)
  }
  return out
}

/** 依据已完成科技，得到可用的配方 */
export function unlockedRecipes(techs: readonly TechId[]): RecipeDef[] {
  const set = new Set(DEFAULT_RECIPES)
  for (const t of techs) {
    const def = TECH_MAP[t]
    def?.unlockRecipes?.forEach(r => set.add(r))
  }
  return RECIPES.filter(r => set.has(r.id))
}

/** 依据已完成科技，得到可用的建筑 */
export function unlockedBuildings(techs: readonly TechId[]): BuildingId[] {
  const set = new Set<BuildingId>(DEFAULT_BUILDINGS)
  for (const t of techs) {
    const def = TECH_MAP[t]
    def?.unlockBuildings?.forEach(b => set.add(b))
  }
  return [...set]
}

/** 科技当前是否可研究：前置全部完成 */
export function canResearch(id: TechId, techs: readonly TechId[]): boolean {
  const def = TECH_MAP[id]
  if (!def) return false
  if (techs.includes(id)) return false
  return def.requires.every(r => techs.includes(r))
}

/** 下一项可研究的科技 */
export function availableTechs(techs: readonly TechId[]): TechId[] {
  return TECHS.filter(t => canResearch(t.id, techs)).map(t => t.id)
}
