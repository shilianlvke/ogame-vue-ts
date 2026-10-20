/**
 * 星际通讯站解锁条件
 *
 * 通讯站不是一开始就能使用：需要建造「深空通讯阵列」并研究「量子通讯技术」。
 * 所有等级取玩家星球/科技中的最高值，方便 UI 与战役目标复用。
 */
import { BuildingType, TechnologyType, type Player } from '@/types/game'

export const COMMUNICATION_STATION_BUILDING = BuildingType.DeepSpaceArray
export const COMMUNICATION_STATION_TECHNOLOGY = TechnologyType.QuantumCommunication
export const COMMUNICATION_STATION_BUILDING_LEVEL = 1
export const COMMUNICATION_STATION_TECHNOLOGY_LEVEL = 1

export interface CommunicationStationStatus {
  unlocked: boolean
  buildingLevel: number
  technologyLevel: number
}

export const getCommunicationStationStatus = (player: Player): CommunicationStationStatus => {
  const buildingLevel = Math.max(
    0,
    ...player.planets.map(planet => planet.buildings[COMMUNICATION_STATION_BUILDING] ?? 0)
  )
  const technologyLevel = player.technologies[COMMUNICATION_STATION_TECHNOLOGY] ?? 0

  return {
    unlocked:
      buildingLevel >= COMMUNICATION_STATION_BUILDING_LEVEL &&
      technologyLevel >= COMMUNICATION_STATION_TECHNOLOGY_LEVEL,
    buildingLevel,
    technologyLevel
  }
}
