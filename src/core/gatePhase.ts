/**
 * 星门相位：把驻守舰队转换成控制点
 *
 * 每 tick 调用一次：收集所有玩家在该星门恒星系的驻守舰队（`MissionType.Station`），
 * 按战力推进控制点；满 100 换手。
 */
import { regionOfGalaxy } from '@/config/galaxyConfig'
import { buildGateInfos } from '@/logic/gateLogic'
import { advanceGateControl, createGateState } from '@/logic/gateCaptureLogic'
import type { Garrison, GateState } from '@/logic/gateCaptureLogic'
import { MissionType } from '@/types/game'
import { getWorldLayout } from './galaxyContext'
import { maybeSpawnCaravans, tickCaravans } from '@/logic/caravanLogic'
import { allPlayers } from './world'
import type { World } from './types'

/** 首次访问时按布局种子建立星门状态表 */
export const ensureGateStates = (world: World): Record<string, GateState> => {
  if (world.gates) return world.gates

  const layout = getWorldLayout(world)
  const infos = buildGateInfos(layout)
  const gates: Record<string, GateState> = {}
  for (const info of Object.values(infos)) {
    gates[info.systemId] = createGateState(info.systemId, info.owner)
  }
  world.gates = gates
  return gates
}

/** 坐标 → 恒星系 id */
const systemIdOf = (world: World, position: { galaxy: number; system: number }): string =>
  `${world.cycle ?? 1}:${regionOfGalaxy(position.galaxy)}:${position.system}`

/**
 * 推进所有星门的控制点
 *
 * @returns 本次换手的星门（供调用方广播事件）
 */
export const tickGatePhase = (world: World, deltaSeconds: number, now: number = Date.now()): Array<{ systemId: string; capturedBy: string }> => {
  if (deltaSeconds <= 0) return []
  const gates = ensureGateStates(world)

  // NPC 商队：定期生成、到点缴费
  const layout = getWorldLayout(world)
  maybeSpawnCaravans(world, layout, now)
  tickCaravans(world, now)

  // 收集驻守：Station 任务、未返航、目标在星门所在恒星系
  const garrisons = new Map<string, Garrison[]>()
  for (const player of allPlayers(world)) {
    for (const mission of player.fleetMissions) {
      if (mission.missionType !== MissionType.Station) continue
      if (mission.status === 'returning') continue
      const systemId = systemIdOf(world, mission.targetPosition)
      if (!gates[systemId]) continue

      const power = Object.values(mission.fleet ?? {}).reduce((sum, count) => sum + (count ?? 0), 0)
      if (power <= 0) continue

      const list = garrisons.get(systemId) ?? []
      list.push({ ownerId: player.id, power })
      garrisons.set(systemId, list)
    }
  }

  const captures: Array<{ systemId: string; capturedBy: string }> = []
  for (const state of Object.values(gates)) {
    const result = advanceGateControl(state, garrisons.get(state.systemId) ?? [], deltaSeconds)
    if (result.capturedBy) captures.push({ systemId: state.systemId, capturedBy: result.capturedBy })
  }
  return captures
}
