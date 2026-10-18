/**
 * 稳定的实体 ID 规则（多周目下必须全局唯一）
 *
 * 第 1 周目沿用旧格式（`npc_0` / `npc_planet_0`），保证旧存档、旧战报、
 * 旧外交关系零迁移；第 2 周目起加 `c{cycle}_` 前缀避免跨层冲突。
 */

/** NPC 归属 id */
export const npcIdOf = (cycle: number, index: number): string =>
  cycle === 1 ? `npc_${index}` : `npc_c${cycle}_${index}`

/** NPC 星球 id */
export const npcPlanetIdOf = (cycle: number, index: number): string =>
  cycle === 1 ? `npc_planet_${index}` : `npc_planet_c${cycle}_${index}`

/** 从 NPC id 反解周目（旧格式视为第 1 周目） */
export const cycleOfNpcId = (id: string): number => {
  const match = /^npc(?:_planet)?_c(\d+)_/.exec(id)
  return match ? Number(match[1]) : 1
}
