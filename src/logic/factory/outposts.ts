import type { MaterialId } from '@/types/factory'
import { MINEABLE } from '@/config/factory/materials'
import { MAX_OUTPOSTS, MINE_YIELD_PER_SLOT, ORE_PRESETS, TRANSPORT_SPEED } from '@/config/factory/balance'
import type { OrePresetKey } from './waves'

export interface Outpost {
  id: string
  name: string
  ore: MaterialId
  /** 矿井合计等级，即槽位数 */
  mineSlots: number
  warehouseLevel: number
  solarLevel: number
  /** 待运回的库存 */
  stock: number
  reserve: number
  reserveMax: number
  /** 分配给该航线的货船货舱容量 */
  cargo: number
  /** 航程距离 */
  distance: number
}

export function createOutpost(name: string, ore: MaterialId, preset: OrePresetKey, distance = 20000): Outpost {
  const reserveMax = Math.round(ORE_PRESETS[preset].outpostReserve)
  return {
    id: `op${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    name,
    ore,
    mineSlots: 0,
    warehouseLevel: 0,
    solarLevel: 0,
    stock: 0,
    reserve: reserveMax,
    reserveMax,
    cargo: 0,
    distance
  }
}

export function outpostYieldRate(o: Outpost): number {
  if (o.mineSlots <= 0) return 0
  const ratio = o.reserveMax > 0 ? o.reserve / o.reserveMax : 1
  const efficiency = ratio > 0.4 ? 1 : ratio > 0.2 ? 0.5 : 0.2
  return MINE_YIELD_PER_SLOT * o.mineSlots * efficiency
}

/** 每分钟运回量 */
export function transportRatePerMinute(o: Outpost): number {
  if (o.cargo <= 0) return 0
  const roundTripMinutes = (2 * o.distance) / TRANSPORT_SPEED
  return o.cargo / roundTripMinutes
}

/** 前哨一个 tick 的结算 */
export function tickOutpost(o: Outpost, dt: number): { mined: number; shipped: number } {
  const rate = outpostYieldRate(o)
  const mined = Math.min(rate * dt, o.reserve)
  o.reserve -= mined
  o.stock += mined

  const ship = Math.min(o.stock, (transportRatePerMinute(o) / 60) * dt)
  o.stock -= ship
  return { mined, shipped: ship }
}

/** 前哨仓库容量，防止无限堆积 */
export function outpostStockCap(o: Outpost): number {
  return (o.warehouseLevel + 1) * 5000
}

export function tickOutpostCapped(o: Outpost, dt: number): { mined: number; shipped: number } {
  const before = o.stock
  const result = tickOutpost(o, dt)
  const cap = outpostStockCap(o)
  if (o.stock > cap) {
    o.stock = cap
    o.reserve += result.mined - (cap - before + result.shipped)
    if (o.reserve > o.reserveMax) o.reserve = o.reserveMax
  }
  return result
}

export { MAX_OUTPOSTS }

export const OUTPOST_ORES: MaterialId[] = MINEABLE.filter(ore => ore !== 'uraniumOre')
