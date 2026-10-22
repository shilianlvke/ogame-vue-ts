import type { MaterialId } from '@/types/factory'
import { MATERIALS } from './materials'
import { RECIPES } from './recipes'

/**
 * 市场数值，对应规划书 §9.2。
 * 基础价由「原料等价 × 层级系数」推导，随配方表自动生成。
 */

/** T0 与流体锚点价 */
export const ANCHOR_PRICES: Partial<Record<MaterialId, number>> = {
  ironOre: 1.0,
  copperOre: 1.2,
  coal: 0.8,
  stone: 0.8,
  uraniumOre: 4.0,
  water: 0.01,
  crudeOil: 0.05,
  petroleumGas: 0.08,
  heavyOil: 0.1,
  lightOil: 0.1,
  sulfuricAcid: 0.14,
  lubricant: 0.3
}

/** 层级系数，按材料分级 */
export const TIER_COEFFICIENT: Record<string, number> = {
  T1: 1.2,
  T2: 1.4,
  T3: 1.6,
  T4: 2.0,
  T5: 2.2,
  T6: 2.5,
  T7: 1.8,
  T8: 1.5,
  T9: 1.8,
  T10: 3.0
}

/** 锚点之外的直接定价（规划书 §9.2 锚点表、推导示例与掉落物） */
export const DIRECT_PRICES: Partial<Record<MaterialId, number>> = {
  solidFuel: 1.2,
  plastic: 1.28,
  advancedCircuit: 29.5,
  processingUnit: 285.0,
  lowDensityStructure: 148.0,
  // T10 掉落物按 T10 层级系数 3.0 对铁矿石锚点计价
  rustAlloy: 3.0,
  neuralCord: 3.0,
  damagedBlueprint: 3.0,
  cycleShard: 3.0,
  rustCore: 3.0,
  rustWreck: 3.0
}

/**
 * 推导材料的基础价：Σ(输入基础价 × 数量) / 产出数量 × 层级系数。
 * 多产物配方按各产物数量分摊输入成本。
 */
export function deriveBasePrice(id: MaterialId, seen: Set<MaterialId> = new Set()): number {
  const anchor = ANCHOR_PRICES[id]
  if (anchor !== undefined) return anchor
  const direct = DIRECT_PRICES[id]
  if (direct !== undefined) return direct
  if (seen.has(id)) return 0
  seen.add(id)
  const recipe = RECIPES.find(r => Object.keys(r.outputs).includes(id))
  if (!recipe) return 0
  let total = 0
  for (const [k, v] of Object.entries(recipe.inputs)) {
    total += deriveBasePrice(k as MaterialId, seen) * (v as number)
  }
  // 单件成本 = 输入总价 / 该产物数量；多产物按产量分摊输入成本
  const outputSelf = (recipe.outputs[id] as number) || 1
  const coeff = TIER_COEFFICIENT[MATERIALS[id].tier] ?? 1
  return round2((total / outputSelf) * coeff)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 全部材料基础价表，构建期一次推导 */
export const BASE_PRICES: Record<string, number> = (() => {
  const out: Record<string, number> = {}
  for (const id of Object.keys(MATERIALS) as MaterialId[]) {
    out[id] = deriveBasePrice(id)
  }
  return out
})()

/** 取材料基础价，缺失时按 0 处理 */
export function basePrice(id: MaterialId): number {
  return BASE_PRICES[id] ?? 0
}

/** 市场可交易材料：可由配方生产的固体材料。掉落物、流体、载荷、装备、舰船零件不参与 */
const SHIP_PARTS = new Set(['hullFrame', 'thrusterAssembly', 'weaponAssembly', 'shieldAssembly'])

export function tradableMaterials(): MaterialId[] {
  const produced = new Set<string>()
  for (const r of RECIPES) {
    if (r.category === 'salvage' || r.category === 'payload' || r.category === 'equipment') continue
    for (const k of Object.keys(r.outputs)) produced.add(k)
  }
  return (Object.keys(MATERIALS) as MaterialId[]).filter(id => {
    const def = MATERIALS[id]
    if (def.fluid || def.drop) return false
    if (SHIP_PARTS.has(id)) return false
    return produced.has(id)
  })
}

/** 撮合与挂单参数 */
export const MARKET_MATCH_INTERVAL = 60
export const MARKET_ORDER_TTL_DAYS = 7
export const MARKET_PRICE_DEVIATION = 0.5
export const MARKET_FACTION_DEPTH = 5000
export const MARKET_FACTION_BUY_FACTOR = 0.95
export const MARKET_FACTION_SELL_FACTOR = 1.05
export const MARKET_FEE_BASE = 0.03
export const MARKET_FEE_MIN = 0.01
/** 矿业公会每 +1 声望所需的成交额（单位材料） */
export const MARKET_REP_PER_TRADE_VOLUME = 10000
export const MARKET_REP_MAX = 1000

/** 手续费率：随矿业公会声望由 3% 线性降至 1% */
export function marketFeeRate(guildRep: number): number {
  const rep = Math.max(0, Math.min(MARKET_REP_MAX, guildRep))
  return MARKET_FEE_BASE - (rep / MARKET_REP_MAX) * (MARKET_FEE_BASE - MARKET_FEE_MIN)
}

/** 挂单价偏离上限校验：不得超出基础价 ±50% */
export function withinPriceBand(id: MaterialId, price: number): boolean {
  const base = basePrice(id)
  if (base <= 0 || price <= 0) return false
  return price >= base * (1 - MARKET_PRICE_DEVIATION) && price <= base * (1 + MARKET_PRICE_DEVIATION)
}

/** 派系常驻盘买价 / 卖价 */
export function factionBuyPrice(id: MaterialId): number {
  return round2(basePrice(id) * MARKET_FACTION_BUY_FACTOR)
}

export function factionSellPrice(id: MaterialId): number {
  return round2(basePrice(id) * MARKET_FACTION_SELL_FACTOR)
}
