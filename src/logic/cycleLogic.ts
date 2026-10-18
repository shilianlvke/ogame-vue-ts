/**
 * 多周目跃迁（P6 第一步：纯逻辑）
 *
 * 规则（见 doc/GALAXY_CYCLES.md）：
 * - 科技、成就、军官、账号保留；
 * - 星球、舰队、资源按比例折算成"补给包"；
 * - 新周目随机落到一颗"乐土"（lush）星球，找不到则退回安全星系。
 */
import { buildCycleLayout, getPlanetProfile } from '@/logic/galaxyGen'
import { oreModifiersAt } from '@/core/galaxyContext'
import { generateOreDeposits } from '@/logic/oreDepositLogic'
import * as planetLogic from '@/logic/planetLogic'
import { GALAXY_CONFIG } from '@/config/galaxyConfig'
import { generatePlanetName } from '@/logic/nameGenerator'
import { allPlayers } from '@/core/world'
import type { World } from '@/core/types'
import type { Player, Position } from '@/types/game'

/** 跃迁前置：天体物理 1 级（后续可调） */
export const CYCLE_JUMP_TECH = 'astrophysics'
export const CYCLE_JUMP_TECH_LEVEL = 1

/** 跃迁准备期（24 小时） */
export const CYCLE_JUMP_COUNTDOWN_MS = 24 * 60 * 60 * 1000

/** 补给包 */
export const CYCLE_SUPPLY = { metal: 50000, crystal: 25000, deuterium: 10000 }

export interface CycleJumpPlan {
  fromCycle: number
  targetCycle: number
  position: Position
  supply: typeof CYCLE_SUPPLY
}

/** 目标周目的布局 */
export const layoutOfCycle = (world: World, cycle: number) => buildCycleLayout(world.layoutSeed ?? 20261018, cycle)

const isOccupied = (world: World, position: Position): boolean => {
  const key = `${position.galaxy}:${position.system}:${position.position}`
  if (world.planets?.[key]) return true
  return allPlayers(world).some(player => player.planets.some(planet => planet.position && `${planet.position.galaxy}:${planet.position.system}:${planet.position.position}` === key))
}

/**
 * 在目标周目找一颗空闲的"乐土"星球
 */
export const findCycleHome = (world: World, targetCycle: number): Position | null => {
  const layout = layoutOfCycle(world, targetCycle)
  const candidates = layout.regions.flatMap(region => region.systems).filter(system => system.danger === 1)

  for (const system of candidates) {
    for (let orbit = 1; orbit <= 10; orbit += 1) {
      const profile = getPlanetProfile(layout.seed, targetCycle, system.region, system.index, orbit)
      if (profile.biome !== 'lush') continue
      const position: Position = { galaxy: system.galaxy, system: system.index, position: orbit }
      if (!isOccupied(world, position)) return position
    }
  }

  // 兜底：任意空闲位置
  for (const system of candidates) {
    for (let orbit = 1; orbit <= 10; orbit += 1) {
      const position: Position = { galaxy: system.galaxy, system: system.index, position: orbit }
      if (!isOccupied(world, position)) return position
    }
  }
  return null
}

/**
 * 规划一次跃迁（不修改世界）
 */
export const planCycleJump = (world: World, player: Player): CycleJumpPlan | null => {
  const fromCycle = player.cycle ?? 1
  // 核心星门前置：至少要控制 1 座星门
  const controlsGate = Object.values(world.gates ?? {}).some(gate => gate.owner === player.id)
  if (!controlsGate) return null
  if (fromCycle >= GALAXY_CONFIG.MAX_CYCLES) return null
  if ((player.technologies?.[CYCLE_JUMP_TECH] ?? 0) < CYCLE_JUMP_TECH_LEVEL) return null
  if (player.planets.length === 0) return null

  const targetCycle = fromCycle + 1
  const position = findCycleHome(world, targetCycle)
  if (!position) return null

  return { fromCycle, targetCycle, position, supply: CYCLE_SUPPLY }
}

/**
 * 执行跃迁：拆掉旧帝国，在新周目建立殖民地
 *
 * @returns 实际执行的计划（前置不满足或已到最高周目时返回 null）
 */
export const applyCycleJump = (world: World, player: Player): CycleJumpPlan | null => {
  const plan = planCycleJump(world, player)
  if (!plan) return null

  // 1. 拆除旧星球（科技/成就/军官保留）
  player.planets = []

  // 2. 换周目
  player.cycle = plan.targetCycle
  world.cycle = plan.targetCycle

  // 3. 建新家
  const home = planetLogic.createInitialPlanet(player.id, generatePlanetName(`cycleHome:${player.id}:${plan.targetCycle}`))
  home.position = plan.position
  const modifiers = oreModifiersAt(world, plan.position)
  home.oreDeposits = generateOreDeposits(plan.position, modifiers)
  home.resources.metal += plan.supply.metal
  home.resources.crystal += plan.supply.crystal
  home.resources.deuterium += plan.supply.deuterium
  player.planets = [home]

  return plan
}


/** 排定一次跃迁（到时由 tick 执行） */
export const scheduleCycleJump = (world: World, player: Player, now: number): CycleJumpPlan | null => {
  if (player.cycleJumpAt) return null
  const plan = planCycleJump(world, player)
  if (!plan) return null
  player.cycleJumpAt = now + CYCLE_JUMP_COUNTDOWN_MS
  return plan
}
