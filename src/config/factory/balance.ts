import type { InfiniteResearchId, MaterialId } from '@/types/factory'

/** 建筑等级与实例上限 */
export const MAX_LEVEL = 16
export const MAX_INSTANCES_PER_TYPE = 8
export const MAX_SLOTS_PER_TYPE = 128
export const MAX_INSTANCES = 96
export const MAX_INSTANCES_OUTPOST = 32
export const MAX_OUTPOSTS = 5

/** 成本曲线 */
export const UPGRADE_MULTIPLIER = 1.35
export const UPGRADE_MULTIPLIER_POWER = 1.6
export const UPGRADE_MULTIPLIER_SILO = 2.0
export const DEMOLISH_REFUND = 0.5

/** 仓库与流体 */
export const DEFAULT_STORAGE = 5000
export const FLUID_CAPACITY = 10000

/** 采矿 */
export const MINE_YIELD_PER_SLOT = 0.5
export const MINE_COAL_FACTOR = 0.5
export const MINE_COAL_PER_SLOT = 0.025
export const MINE_POWER_PER_SLOT = 90
export const PUMP_YIELD_PER_SLOT = 500
export const OIL_YIELD_PER_SLOT = 0.4
export const OIL_DECAY_FLOOR = 0.2

/** 电力 */
export const BOILER_POWER_PER_LEVEL = 900
export const BOILER_COAL_PER_SECOND = 0.225
export const BOILER_SOLID_FUEL_PER_SECOND = 0.075
export const SOLAR_POWER_PER_LEVEL = 60
export const SOLAR_DAY_RATIO = 14 / 20
export const ACCUMULATOR_MJ_PER_LEVEL = 5
export const REACTOR_POWER_PER_LEVEL = 40000
export const REACTOR_FUEL_PER_SECOND = 0.02
export const DAY_SECONDS = 20 * 60
export const NIGHT_SECONDS = 6 * 60

/** 模块 */
export const MODULE_SLOT_DIVISOR = 4
export const MODULE_SPEED_BONUS = 0.2
export const MODULE_SPEED_POWER = 0.5
export const MODULE_PRODUCTIVITY_BONUS = 0.1
export const MODULE_PRODUCTIVITY_POWER = 0.4
export const MODULE_EFFICIENCY_SAVING = 0.3

/** 研究 */
export const RESEARCH_UNITS_PER_SLOT = 1

/** 离线结算 */
export const OFFLINE_MAX_HOURS = 12
export const OFFLINE_STEP_SECONDS = 60

/** 波次 */
export const WAVE_BASE_HP = 3000
export const WAVE_EXPONENT = 1.5
export const WAVE_DISTURBANCE_FACTOR = 0.08
export const WAVE_MAX = 40
export const WAVE_ELITE_EVERY = 5
export const WAVE_FLOOD_EVERY = 20
export const WAVE_ELITE_HP = 3
export const WAVE_ELITE_WRECK = 3
export const WAVE_FLOOD_HP = 3
export const WAVE_FLOOD_WRECK = 5
export const DEFENSE_BASE_SECONDS = 40
export const WALL_SECONDS_PER_LEVEL = 20
export const WAVE_COOLDOWN_MINUTES = 30
export const WAVE_MAX_PER_SESSION = 5

/** 扰动 */
export const DISTURBANCE_ENERGY_WEIGHT = 0.6
export const DISTURBANCE_PRODUCTION_WEIGHT = 0.1
export const DISTURBANCE_LEVEL_WEIGHT = 0.05
export const DISTURBANCE_THRESHOLD = 8
export const DISTURBANCE_MAX_LEVEL = 8

/** 炮塔与弹药 */
export interface AmmoDef {
  id: 'magazine' | 'piercingMagazine' | 'artilleryShell'
  name: string
  damage: number
  rate: number
  dps: number
  minLevel: number
}

export const AMMO: AmmoDef[] = [
  { id: 'magazine', name: '机枪弹匣', damage: 10, rate: 3.0, dps: 30, minLevel: 1 },
  { id: 'piercingMagazine', name: '穿甲弹匣', damage: 25, rate: 2.4, dps: 60, minLevel: 6 },
  { id: 'artilleryShell', name: '炮弹', damage: 120, rate: 1.0, dps: 120, minLevel: 11 }
]

export const TURRET_POWER_PER_LEVEL = 50
export const OVERLOAD_DPS = 1.5
export const OVERLOAD_AMMO = 2.0

/** 矿石方案 */
export type OrePreset = 'poor' | 'standard' | 'rich'

export interface OrePresetDef {
  id: OrePreset
  name: string
  homeReserve: number
  outpostReserve: number
  wreckMultiplier: number
  rareOffset: number
}

export const ORE_PRESETS: Record<OrePreset, OrePresetDef> = {
  poor: { id: 'poor', name: '贫穷', homeReserve: 500000, outpostReserve: 4000000, wreckMultiplier: 2.0, rareOffset: 0.7 },
  standard: { id: 'standard', name: '标准', homeReserve: 1200000, outpostReserve: 8000000, wreckMultiplier: 1.0, rareOffset: 1.0 },
  rich: { id: 'rich', name: '富饶', homeReserve: 3000000, outpostReserve: 20000000, wreckMultiplier: 0.5, rareOffset: 1.4 }
}

/** 初始赠予 */
export const INITIAL_STOCK: Partial<Record<MaterialId, number>> = {
  coal: 200,
  ironOre: 100,
  stone: 50,
  ironPlate: 40
}

/** 舰船零件成本：舰体 / 推进器 / 武器 / 护盾 / 出港补给（机枪弹匣） */
export interface ShipCostDef {
  hull: number
  thruster: number
  weapon: number
  shield: number
  ammo: number
  cargo: number
  buildSeconds: number
}

export const SHIP_COSTS: Record<string, ShipCostDef> = {
  轻型战斗机: { hull: 1, thruster: 1, weapon: 1, shield: 0, ammo: 5, cargo: 0, buildSeconds: 30 },
  重型战斗机: { hull: 2, thruster: 2, weapon: 2, shield: 0, ammo: 10, cargo: 0, buildSeconds: 30 },
  巡洋舰: { hull: 4, thruster: 3, weapon: 4, shield: 1, ammo: 20, cargo: 0, buildSeconds: 30 },
  战列舰: { hull: 8, thruster: 5, weapon: 8, shield: 2, ammo: 40, cargo: 0, buildSeconds: 30 },
  战列巡洋舰: { hull: 10, thruster: 6, weapon: 10, shield: 3, ammo: 50, cargo: 0, buildSeconds: 30 },
  轰炸机: { hull: 6, thruster: 4, weapon: 10, shield: 1, ammo: 30, cargo: 0, buildSeconds: 30 },
  驱逐舰: { hull: 5, thruster: 5, weapon: 6, shield: 2, ammo: 25, cargo: 0, buildSeconds: 30 },
  小型货船: { hull: 1, thruster: 1, weapon: 0, shield: 0, ammo: 0, cargo: 600, buildSeconds: 20 },
  大型货船: { hull: 3, thruster: 2, weapon: 0, shield: 0, ammo: 0, cargo: 2500, buildSeconds: 20 },
  殖民船: { hull: 6, thruster: 3, weapon: 0, shield: 0, ammo: 0, cargo: 5000, buildSeconds: 20 },
  回收船: { hull: 2, thruster: 2, weapon: 0, shield: 0, ammo: 0, cargo: 800, buildSeconds: 20 },
  间谍卫星: { hull: 0, thruster: 1, weapon: 0, shield: 0, ammo: 0, cargo: 0, buildSeconds: 20 },
  太阳能卫星: { hull: 1, thruster: 1, weapon: 0, shield: 0, ammo: 0, cargo: 0, buildSeconds: 20 },
  暗物质采集船: { hull: 4, thruster: 4, weapon: 0, shield: 1, ammo: 0, cargo: 0, buildSeconds: 20 },
  死星: { hull: 50, thruster: 30, weapon: 60, shield: 20, ammo: 500, cargo: 0, buildSeconds: 60 }
}

/** 火箭 */
export const ROCKET_PARTS = 100

/** 前哨运输 */
export const TRANSPORT_SPEED = 1000
export const OUTPOST_MAX_BUILDINGS = 32

/** 无限研究初始等级 */
export const INITIAL_INFINITE: Record<InfiniteResearchId, number> = { mining: 0, smelting: 0, logistics: 0, weapon: 0 }
