import type { MaterialId, PlanetFactory } from '@/types/factory'
import { AMMO, DEFENSE_BASE_SECONDS, DISTURBANCE_ENERGY_WEIGHT, DISTURBANCE_LEVEL_WEIGHT, DISTURBANCE_MAX_LEVEL, DISTURBANCE_PRODUCTION_WEIGHT, DISTURBANCE_THRESHOLD, ORE_PRESETS, OVERLOAD_AMMO, OVERLOAD_DPS, WALL_SECONDS_PER_LEVEL, WAVE_BASE_HP, WAVE_DISTURBANCE_FACTOR, WAVE_ELITE_EVERY, WAVE_ELITE_HP, WAVE_ELITE_WRECK, WAVE_EXPONENT, WAVE_FLOOD_EVERY, WAVE_FLOOD_HP, WAVE_FLOOD_WRECK, WAVE_MAX } from '@/config/factory/balance'

export type OrePresetKey = keyof typeof ORE_PRESETS

/** 扰动值：能耗(MW) × 0.6 + 累计产量(万) × 0.1 + 建筑总等级 × 0.05 */
export function disturbanceValue(state: PlanetFactory): number {
  const demandMW = 0
  const energy = demandMW * DISTURBANCE_ENERGY_WEIGHT
  const production = state.lifetimeProduced * DISTURBANCE_PRODUCTION_WEIGHT
  const levelSum = state.buildings.reduce((a, b) => a + b.level, 0) * DISTURBANCE_LEVEL_WEIGHT
  return energy + production + levelSum
}

export function disturbanceLevel(state: PlanetFactory): number {
  const value = disturbanceValue(state)
  return Math.max(1, Math.min(DISTURBANCE_MAX_LEVEL, Math.floor(value / DISTURBANCE_THRESHOLD) + 1))
}

export function maxWave(state: PlanetFactory): number {
  return disturbanceLevel(state) * 5
}

export function isElite(n: number): boolean {
  return n % WAVE_ELITE_EVERY === 0
}

export function isFlood(n: number): boolean {
  return n % WAVE_FLOOD_EVERY === 0
}

export function hpMultiplier(n: number): number {
  if (isFlood(n)) return WAVE_FLOOD_HP
  if (isElite(n)) return WAVE_ELITE_HP
  return 1
}

export function wreckMultiplier(n: number): number {
  if (isFlood(n)) return WAVE_FLOOD_WRECK
  if (isElite(n)) return WAVE_ELITE_WRECK
  return 1
}

/** 第 N 波 HP，含扰动与周目系数 */
export function waveHp(n: number, distLevel: number, cycle = 1): number {
  const cycleFactor = 1 + 0.15 * (cycle - 1)
  const base = WAVE_BASE_HP * Math.pow(n, WAVE_EXPONENT) * (1 + WAVE_DISTURBANCE_FACTOR * distLevel) * cycleFactor
  return Math.round(base * hpMultiplier(n))
}

/** 防线长度（秒） */
export function defenseLine(state: PlanetFactory): number {
  let seconds = DEFENSE_BASE_SECONDS
  for (const b of state.buildings) {
    if (b.type === 'wall' && b.enabled) seconds += b.level * WALL_SECONDS_PER_LEVEL
  }
  if (state.techs.includes('wallFortify')) {
    for (const b of state.buildings) {
      if (b.type === 'wall' && b.enabled) seconds += b.level * 10
    }
  }
  return seconds
}

interface TurretLoadout {
  /** 各弹种等级合计 */
  levels: Record<string, number>
}

/** 炮塔弹种分配：每个炮塔按等级取可用弹种中 DPS 最高者，弹药不足时逐级降级 */
export function turretLoadout(state: PlanetFactory): TurretLoadout {
  const out: TurretLoadout = { levels: {} }
  for (const b of state.buildings) {
    if (b.type !== 'turret' || !b.enabled) continue
    const usable = AMMO.filter(a => b.level >= a.minLevel)
    if (!usable.length) continue
    const pick = usable.find(a => (state.stock[a.id] ?? 0) > 0) ?? usable[0]!
    out.levels[pick.id] = (out.levels[pick.id] ?? 0) + b.level
  }
  return out
}

export interface ActiveBattle {
  wave: number
  hp: number
  progress: number
  overload: boolean
  /** 连续无输出秒数 */
  silentSeconds: number
  finished: boolean
  won: boolean
  /** 本场消耗的各弹种数量 */
  ammoUsed: Partial<Record<MaterialId, number>>
  /** 弹药耗尽时的缓冲提示 */
  message?: string
}

export function createBattle(state: PlanetFactory, wave: number, cycle = 1, overload = false): ActiveBattle {
  return {
    wave,
    hp: waveHp(wave, disturbanceLevel(state), cycle),
    progress: 0,
    overload,
    silentSeconds: 0,
    finished: false,
    won: false,
    ammoUsed: {}
  }
}

/** 每 tick 推进战斗 */
export function stepBattle(state: PlanetFactory, battle: ActiveBattle, dt = 1): void {
  if (battle.finished) return
  const loadout = turretLoadout(state)
  const line = defenseLine(state)

  let dps = 0
  let fired = false
  const techBoost = 1 + 0.25 * (state.techs.includes('turretUpgrade') ? 1 : 0) + 0.1 * (state.infiniteResearch?.weapon ?? 0)

  for (const ammo of AMMO) {
    const level = loadout.levels[ammo.id] ?? 0
    if (level <= 0) continue
    const need = level * ammo.rate * dt
    const have = state.stock[ammo.id] ?? 0
    if (have <= 0) continue
    const used = Math.min(need, have)
    state.stock[ammo.id] = have - used
    battle.ammoUsed[ammo.id] = (battle.ammoUsed[ammo.id] ?? 0) + used
    const actualLevel = used / (ammo.rate * dt)
    const boost = battle.overload ? OVERLOAD_DPS : 1
    dps += actualLevel * ammo.dps * boost * techBoost
    fired = true
  }

  if (battle.overload) {
    for (const k of Object.keys(battle.ammoUsed)) battle.ammoUsed[k as MaterialId] = (battle.ammoUsed[k as MaterialId] ?? 0) * OVERLOAD_AMMO
  }

  if (!fired) {
    battle.silentSeconds += dt
  } else {
    battle.silentSeconds = 0
  }

  battle.hp -= dps * dt
  battle.progress += dt / line

  if (battle.hp <= 0) {
    battle.hp = 0
    battle.finished = true
    battle.won = true
  } else if (battle.progress >= 1 || battle.silentSeconds >= 10) {
    battle.finished = true
    battle.won = false
  }
}

export interface WaveDrops {
  rustAlloy: number
  neuralCord: number
  damagedBlueprint: number
  cycleShard: number
  rustCore: number
  rustWreck: number
}

/** 掉落基数，应用首通/重复系数前 */
export function baseDrops(n: number, preset: OrePresetKey): WaveDrops {
  const elite = isElite(n)
  const flood = isFlood(n)
  const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1))
  return {
    rustAlloy: rand(4, 8),
    neuralCord: elite ? rand(3, 6) : 0,
    damagedBlueprint: flood ? 3 : 0,
    cycleShard: 1,
    rustCore: elite ? 1 + (flood ? 1 : 0) : 0,
    rustWreck: Math.round((10 + n) * ORE_PRESETS[preset].wreckMultiplier * wreckMultiplier(n))
  }
}

/** 首通与重复系数：首通 100%、第 2 次 50%、第 3 次 25%、第 4 次起 10%，每日首通额外 +50% */
export function rewardFactor(clearCount: number, dailyBonus: boolean): number {
  const base = clearCount === 0 ? 1 : clearCount === 1 ? 0.5 : clearCount === 2 ? 0.25 : 0.1
  return base + (dailyBonus ? 0.5 : 0)
}

export function applyDrops(state: PlanetFactory, drops: WaveDrops, factor: number): WaveDrops {
  const applied: WaveDrops = {
    rustAlloy: Math.round(drops.rustAlloy * factor),
    neuralCord: Math.round(drops.neuralCord * factor),
    damagedBlueprint: Math.round(drops.damagedBlueprint * factor),
    cycleShard: Math.round(drops.cycleShard * factor),
    rustCore: Math.round(drops.rustCore * factor),
    rustWreck: Math.round(drops.rustWreck * factor)
  }
  const map: Partial<Record<MaterialId, number>> = {
    rustAlloy: applied.rustAlloy,
    neuralCord: applied.neuralCord,
    damagedBlueprint: applied.damagedBlueprint,
    cycleShard: applied.cycleShard,
    rustCore: applied.rustCore,
    rustWreck: applied.rustWreck
  }
  for (const [k, v] of Object.entries(map)) {
    if ((v as number) > 0) state.stock[k as MaterialId] = (state.stock[k as MaterialId] ?? 0) + (v as number)
  }
  return applied
}

export { WAVE_MAX }
