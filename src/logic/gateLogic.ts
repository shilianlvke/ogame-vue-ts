/**
 * 星门归属（P5 第一步：只读模型）
 *
 * 当前实现只做"确定性归属 + 界面展示"：
 * 每座星门锚定在一个恒星系上，由布局种子决定归属（中立 / NPC 派系）。
 *
 * 后续步骤（尚未实现）：
 * - 驻守舰队推进控制点，满 100 换手（玩家可占领）
 * - 他国舰队通过时收过路费
 * - 封锁航道
 */
import { hashString, mulberry32 } from '@/utils/random'
import type { CycleLayout } from '@/types/galaxy'

export type GateOwner = 'neutral' | 'miners_guild' | 'deep_council' | 'free_fleet' | 'swarm'

export interface GateInfo {
  /** 星门所在的恒星系 id */
  systemId: string
  owner: GateOwner
  /** 过路费（重氢），中立为 0 */
  toll: number
}

const FACTIONS: Array<{ id: GateOwner; weight: number }> = [
  { id: 'neutral', weight: 35 },
  { id: 'miners_guild', weight: 20 },
  { id: 'deep_council', weight: 18 },
  { id: 'free_fleet', weight: 15 },
  { id: 'swarm', weight: 12 }
]

/** 星门所属恒星系：取航道两端中 id 字典序较小的一端，保证稳定 */
export const gatewaySystemOf = (lane: { a: string; b: string }): string => (lane.a < lane.b ? lane.a : lane.b)

/**
 * 某座星门的归属（确定性）
 */
export const gateOwnerOf = (layoutSeed: number, systemId: string): GateOwner => {
  const rand = mulberry32(hashString(`${layoutSeed}:gate:${systemId}`))
  const roll = rand() * 100
  let acc = 0
  for (const faction of FACTIONS) {
    acc += faction.weight
    if (roll <= acc) return faction.id
  }
  return 'neutral'
}

/** 过路费：按繁荣度粗分三档 */
export const gateTollOf = (owner: GateOwner, wealth: number): number => {
  if (owner === 'neutral') return 0
  return wealth >= 3 ? 800 : wealth >= 2 ? 400 : 200
}

/**
 * 构建整张星图的星门归属表
 */
export const buildGateInfos = (layout: CycleLayout): Record<string, GateInfo> => {
  const result: Record<string, GateInfo> = {}
  for (const lane of layout.gates) {
    const systemId = gatewaySystemOf(lane)
    if (result[systemId]) continue
    const system = layout.systemIndex.get(systemId)
    const owner = gateOwnerOf(layout.seed, systemId)
    result[systemId] = {
      systemId,
      owner,
      toll: gateTollOf(owner, system?.wealth ?? 1)
    }
  }
  return result
}

/** 被封锁的星门恒星系（来自运行时状态） */
export const blockedGateSystems = (gates: Record<string, { blockaded: boolean }> | undefined): Set<string> => {
  const result = new Set<string>()
  if (!gates) return result
  for (const [systemId, state] of Object.entries(gates)) {
    if (state.blockaded) result.add(systemId)
  }
  return result
}
