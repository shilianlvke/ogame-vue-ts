/**
 * 星图与 World 的桥接
 *
 * `World` 本身不持有整张星图（1024 个恒星系太大、也没必要落盘），
 * 这里按需构建并缓存在 world 上，供矿脉、NPC 难度、传感器阵列等逻辑查询。
 */
import { regionOfGalaxy } from '@/config/galaxyConfig'
import { DEFAULT_LAYOUT_SEED } from '@/config/galaxyConfig'
import { buildCycleLayout, getPlanetProfile } from '@/logic/galaxyGen'
import { laneHops } from '@/logic/hyperlaneLogic'
import { oreModifiers } from '@/logic/galaxyEconomyLogic'
import type { CycleLayout, PlanetProfile, StarSystem } from '@/types/galaxy'
import type { Planet, Position } from '@/types/game'
import type { World } from './types'

/** 当前世界使用的布局种子（P6 会改为按周目随机并落盘） */
export const layoutSeedOf = (world: World): number => world.layoutSeed ?? DEFAULT_LAYOUT_SEED

/** 当前世界的周目 */
export const worldCycle = (world: World): number => world.cycle ?? 1

/** 取当前周目的星图（惰性构建 + 缓存在 world 上） */
export const getWorldLayout = (world: World): CycleLayout => {
  const seed = layoutSeedOf(world)
  const cycle = worldCycle(world)
  const key = `${seed}:${cycle}`
  if (world.galaxyLayout && world.galaxyLayoutKey === key) return world.galaxyLayout
  const layout = buildCycleLayout(seed, cycle)
  world.galaxyLayout = layout
  world.galaxyLayoutKey = key
  return layout
}

/** 坐标 → 恒星系 id（`cycle:region:index`） */
export const systemIdAt = (world: World, position: Position): string =>
  `${worldCycle(world)}:${regionOfGalaxy(position.galaxy)}:${position.system}`

/** 坐标 → 恒星系 */
export const getSystemAt = (world: World, position: Position): StarSystem | undefined =>
  getWorldLayout(world).systemIndex.get(systemIdAt(world, position))

/** 坐标 → 行星档案 */
export const getProfileAt = (world: World, position: Position): PlanetProfile =>
  getPlanetProfile(layoutSeedOf(world), worldCycle(world), regionOfGalaxy(position.galaxy), position.system, position.position)

/** 坐标 → 矿脉修正 */
export const oreModifiersAt = (world: World, position: Position): { metal: number; crystal: number; deuterium: number } =>
  oreModifiers(getSystemAt(world, position), getProfileAt(world, position))

/** 两个坐标之间的航道跳数（用于传感器阵列射程） */
export const hopsBetween = (world: World, from: Position, to: Position, maxHops: number): number =>
  laneHops(getWorldLayout(world).adjacency, systemIdAt(world, from), systemIdAt(world, to), maxHops)

/** 星球所在的恒星系 */
export const systemOfPlanet = (world: World, planet: Planet): StarSystem | undefined => getSystemAt(world, planet.position)
