/**
 * 世界生成：NPC 星球初始化
 */
import type { World } from './types'
import { positionKey } from './world'
import { oreModifiersAt } from './galaxyContext'
import * as gameLogic from '@/logic/gameLogic'
import * as planetLogic from '@/logic/planetLogic'

/** 默认生成的 NPC 星球数量 */
export const DEFAULT_NPC_PLANET_COUNT = 200

/**
 * 在宇宙地图中生成 NPC 星球（与原有实现一致：随机坐标，跳过已占用位置）
 *
 * 注意：这里只写 `world.planets`（宇宙地图），NPC 注册表会在 NPC 成长阶段自动建立。
 */
export const generateNpcPlanets = (world: World, planetPrefix: string, count: number = DEFAULT_NPC_PLANET_COUNT): void => {
  const cycle = world.cycle ?? 1
  for (let i = 0; i < count; i++) {
    const position = gameLogic.generateRandomPosition()
    const key = positionKey(position)
    if (world.planets[key]) continue
    world.planets[key] = planetLogic.createNPCPlanet(i, position, planetPrefix, cycle, oreModifiersAt(world, position))
  }
}
