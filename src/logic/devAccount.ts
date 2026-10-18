/**
 * 开发用"满级账号"
 *
 * 用途：测试星图/舰队/周目等后期玩法时，不必从零爬科技。
 * 只改玩家自身的建筑、科技、资源、舰船，不触碰世界其他部分。
 */
import { BuildingType, TechnologyType } from '@/types/game'
import type { Player } from '@/types/game'

/** 建筑等级上限（游戏内实际上限可能更高，这里取一个足够测试的值） */
export const DEV_MAX_BUILDING = 40
/** 科技等级 */
export const DEV_MAX_TECH = 25
/** 资源 */
export const DEV_MAX_RESOURCES = 1_000_000_000

const fillLevels = <T extends string>(types: readonly T[], level: number): Record<T, number> =>
  Object.fromEntries(types.map(type => [type, level])) as Record<T, number>

/**
 * 把玩家拉满：所有星球建筑、所有科技、资源、舰船
 */
export const applyMaxAccount = (player: Player): void => {
  for (const planet of player.planets) {
    planet.buildings = {
      ...(planet.buildings ?? {}),
      ...fillLevels(Object.values(BuildingType), DEV_MAX_BUILDING)
    } as typeof planet.buildings
    planet.resources = {
      ...planet.resources,
      metal: DEV_MAX_RESOURCES,
      crystal: DEV_MAX_RESOURCES,
      deuterium: DEV_MAX_RESOURCES,
      darkMatter: 1_000_000
    }
  }

  player.technologies = {
    ...player.technologies,
    ...fillLevels(Object.values(TechnologyType), DEV_MAX_TECH)
  } as typeof player.technologies
}
