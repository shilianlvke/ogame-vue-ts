/**
 * 把服务端下发的快照/补丁应用到本地状态
 *
 * 这里刻意写成纯函数：传入的对象是 Pinia state 里的对象引用，
 * 函数只做「就地修改」，因此响应式更新可以正常触发；
 * 同时它不依赖 Vue，可以在 Node 里直接单测。
 */
import type { DebrisField, Planet, Player } from '@/types/game'
import type { ServerPatch, WorldSnapshot } from '@/core/protocol'

/** 需要被服务端状态覆盖的本地槽位 */
export interface GameStateTarget {
  player: Player
  planets: Record<string, Planet>
  debrisFields: Record<string, DebrisField>
}

/** 清空对象自身属性再拷贝（保持对象引用不变，Pinia 才能追踪） */
export const replaceObjectContents = (target: object, source: object): void => {
  for (const key of Object.keys(target)) {
    delete (target as Record<string, unknown>)[key]
  }
  Object.assign(target, source)
}

/** 清空 Record 再拷贝（保持引用） */
export const replaceRecord = <T>(target: Record<string, T>, source: Record<string, T>): void => {
  for (const key of Object.keys(target)) {
    delete target[key]
  }
  Object.assign(target, source)
}

/** 清空数组再填充（保持引用） */
export const replaceArrayContents = <T>(target: T[], source: T[]): void => {
  target.splice(0, target.length, ...source)
}

/** 当前选中的星球失效时，回退到母星 */
export const pickCurrentPlanetId = (player: Player, currentId: string): string => {
  if (currentId && player.planets.some(planet => planet.id === currentId)) return currentId
  const home = player.planets.find(planet => !planet.isMoon) ?? player.planets[0]
  return home?.id ?? ''
}

/**
 * 应用全量快照
 *
 * @returns 应用后应该选中的星球 ID
 */
export const applySnapshot = (target: GameStateTarget, snapshot: WorldSnapshot): { currentPlanetId: string } => {
  replaceObjectContents(target.player, snapshot.self)
  replaceRecord(target.planets, snapshot.planets)
  replaceRecord(target.debrisFields, snapshot.debrisFields)
  if (snapshot.caravans) (target as { caravans?: typeof snapshot.caravans }).caravans = snapshot.caravans
  return { currentPlanetId: pickCurrentPlanetId(target.player, '') }
}

/**
 * 应用增量补丁
 *
 * @returns 如果当前星球需要切换，返回新的 ID；否则返回空对象
 */
export const applyPatch = (target: GameStateTarget, patch: ServerPatch, currentPlanetId: string): { currentPlanetId?: string } => {
  if (patch.self) {
    Object.assign(target.player, patch.self)
  }
  if (patch.reports) {
    Object.assign(target.player, patch.reports)
  }
  if (patch.planets) {
    for (const [key, planet] of Object.entries(patch.planets)) {
      target.planets[key] = planet
    }
  }
  if (patch.removedPlanets) {
    for (const key of patch.removedPlanets) {
      delete target.planets[key]
    }
  }
  if (patch.debrisFields) {
    replaceRecord(target.debrisFields, patch.debrisFields)
  }

  const nextPlanetId = pickCurrentPlanetId(target.player, currentPlanetId)
  if (nextPlanetId !== currentPlanetId) {
    return { currentPlanetId: nextPlanetId }
  }
  return {}
}
