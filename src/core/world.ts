/**
 * World 与宇宙地图的通用操作
 */
import type { Planet, NPC, Player, DebrisField } from '@/types/game'
import type { Locale } from '@/locales'
import type { World } from './types'
import * as gameLogic from '@/logic/gameLogic'
import { cycleOfGalaxy } from '@/config/galaxyConfig'
import { DEFAULT_LAYOUT_SEED } from '@/config/galaxyConfig'

/** 创建 World（客户端把引用指向 Pinia state，服务端传入普通对象） */
export const createWorld = (init: {
  player: Player
  planets: Record<string, Planet>
  npcs: NPC[]
  debrisFields: Record<string, DebrisField>
  locale: Locale
  gameSpeed?: number
  battleToFinish?: boolean
  players?: Player[]
  cycle?: number
  layoutSeed?: number
}): World => ({
  player: init.player,
  cycle: init.cycle ?? 1,
  layoutSeed: init.layoutSeed ?? DEFAULT_LAYOUT_SEED,
  players: init.players,
  planets: init.planets,
  npcs: init.npcs,
  debrisFields: init.debrisFields,
  locale: init.locale,
  gameSpeed: init.gameSpeed ?? 1,
  battleToFinish: init.battleToFinish ?? false,
  npcGrowthAccum: {},
  npcBehaviorAccum: {},
  achievementAccum: 0
})

/** 星球所属周目（由全局星区号推导） */
export const cycleOfPlanet = (planet: Planet): number => cycleOfGalaxy(planet.position.galaxy)

/** 星球是否位于当前上下文的周目 */
export const inCurrentCycle = (world: World, planet: Planet): boolean =>
  !world.cycle || cycleOfPlanet(planet) === world.cycle

/**
 * 世界中的全部玩家（单机模式下 players 未设置时等价于只有当前玩家）
 * 多周目下只返回当前周目的玩家——这是跨层隔离的核心入口。
 */
export const allPlayers = (world: World): Player[] => {
  const list = world.players && world.players.length > 0 ? world.players : [world.player]
  if (!world.cycle) return list
  return list.filter(player => (player.cycle ?? 1) === world.cycle)
}

/** 按 ID 查找玩家（用于解析防守方等） */
export const findPlayerById = (world: World, playerId?: string): Player | undefined => {
  if (!playerId) return undefined
  return allPlayers(world).find(player => player.id === playerId)
}

/** 坐标 key */
export const positionKey = (position: { galaxy: number; system: number; position: number }): string =>
  gameLogic.generatePositionKey(position.galaxy, position.system, position.position)

/** 判断星球是否位于指定坐标 */
const isAtPosition = (planet: Planet, position: { galaxy: number; system: number; position: number }): boolean =>
  planet.position.galaxy === position.galaxy &&
  planet.position.system === position.system &&
  planet.position.position === position.position

/**
 * 查找任务目标星球（保持原有解析顺序，确保行为一致）：
 * 1. 玩家自己的星球中匹配坐标（若任务指定了 targetIsMoon，则按类型精确匹配）
 * 2. 玩家自己的星球中匹配坐标（任意类型）
 * 3. 宇宙地图（非玩家星球）
 */
export const findMissionTarget = (
  world: World,
  mission: { targetPosition: { galaxy: number; system: number; position: number }; targetIsMoon?: boolean }
): Planet | undefined => {
  const { targetPosition } = mission

  const pick = (planets: Planet[]): Planet | undefined => {
    const exact = planets.find(planet => {
      if (!isAtPosition(planet, targetPosition)) return false
      if (mission.targetIsMoon !== undefined) return planet.isMoon === mission.targetIsMoon
      return !planet.isMoon
    })
    if (exact) return exact
    return planets.find(planet => isAtPosition(planet, targetPosition))
  }

  // 1. 自己（含月球类型精确匹配）
  const own = pick(world.player.planets)
  if (own) return own

  // 2. 其它玩家（联机 PvP 目标）
  for (const other of allPlayers(world)) {
    if (other.id === world.player.id) continue
    const hit = pick(other.planets)
    if (hit) return hit
  }

  // 3. 宇宙地图（NPC 等非玩家星球）
  const universePlanet = world.planets[positionKey(targetPosition)]
  return universePlanet && inCurrentCycle(world, universePlanet) ? universePlanet : undefined
}

/**
 * 查找坐标上的任意星球（玩家星球优先，其次宇宙地图）
 * 用于 NPC 任务、导弹等场景
 */
export const findPlanetAt = (
  world: World,
  position: { galaxy: number; system: number; position: number }
): Planet | undefined => {
  const own = world.player.planets.find(planet => isAtPosition(planet, position))
  if (own) return own

  for (const other of allPlayers(world)) {
    if (other.id === world.player.id) continue
    const hit = other.planets.find(planet => isAtPosition(planet, position))
    if (hit) return hit
  }

  const universePlanet = world.planets[positionKey(position)]
  return universePlanet && inCurrentCycle(world, universePlanet) ? universePlanet : undefined
}

/** 全宇宙星球（所有玩家星球 + 宇宙地图星球），NPC 行为决策需要 */
export const collectAllPlanets = (world: World): Planet[] => {
  const planets: Planet[] = []
  for (const player of allPlayers(world)) {
    planets.push(...player.planets)
  }
  for (const planet of Object.values(world.planets)) {
    if (inCurrentCycle(world, planet)) planets.push(planet)
  }
  return planets
}

/** 移除即将到来的舰队警报 */
export const removeIncomingFleetAlert = (world: World, missionId: string, owner: Player = world.player): void => {
  if (!owner.incomingFleetAlerts) return
  const index = owner.incomingFleetAlerts.findIndex(alert => alert.id === missionId)
  if (index > -1) {
    owner.incomingFleetAlerts.splice(index, 1)
  }
}

/**
 * 把 NPC 星球数据同步到宇宙地图
 * （原 syncNPCPlanetToUniverse，解决 npcStore 与 universeStore 数据不同步）
 */
export const syncNpcPlanetToUniverse = (world: World, npc: NPC): void => {
  npc.planets.forEach(npcPlanet => {
    const key = positionKey(npcPlanet.position)
    const universePlanet = world.planets[key]
    if (!universePlanet) return
    universePlanet.resources = { ...npcPlanet.resources }
    universePlanet.buildings = { ...npcPlanet.buildings }
    universePlanet.fleet = { ...npcPlanet.fleet }
    universePlanet.defense = { ...npcPlanet.defense }
  })
}

/**
 * 就地替换数组内容
 * 关键：不能直接给 World 字段重新赋值，否则会切断与 Pinia state 的引用
 */
export const replaceArray = <T>(target: T[], next: T[]): void => {
  target.splice(0, target.length, ...next)
}

/** 从宇宙地图中移除指定 NPC 的所有星球 */
export const removeNpcPlanetsFromUniverse = (world: World, npc: NPC): void => {
  npc.planets.forEach(planet => {
    const key = positionKey(planet.position)
    if (world.planets[key]) {
      delete world.planets[key]
    }
  })
}
