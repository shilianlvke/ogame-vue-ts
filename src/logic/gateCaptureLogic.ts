/**
 * 星门占领：控制点推进（纯函数，可单测）
 *
 * 规则（见 doc/GALAXY_SYSTEMS_DETAIL.md §3）：
 * - 驻守舰队按战力推进控制点，速率 = clamp(power / 10000, 0.5, 6) 点/分钟；
 * - 无驻守时控制点缓慢衰减；
 * - 挑战方净推进，满 100 换手，控制点清零。
 */

/** 控制点上限 */
export const GATE_CONTROL_MAX = 100
/** 无人驻守时的衰减（点/分钟） */
export const GATE_CONTROL_DECAY = 0.5

export type GateOwnerId = string

export interface GateState {
  /** 星门所在的恒星系 id */
  systemId: string
  /** 当前归属：'neutral' | 派系 id | 玩家 id */
  owner: GateOwnerId
  /** 控制点 0..100 */
  control: number
  /** 是否封锁 */
  blockaded: boolean
}

export interface Garrison {
  ownerId: GateOwnerId
  /** 驻守战力（舰船数加权后的值） */
  power: number
}

/** 战力 → 控制点速率（点/分钟） */
export const controlRateOf = (power: number): number => {
  if (power <= 0) return 0
  return Math.min(6, Math.max(0.5, power / 10000))
}

const clampControl = (value: number): number => Math.max(0, Math.min(GATE_CONTROL_MAX, value))

/**
 * 推进控制点，返回是否发生换手
 *
 * @param deltaSeconds 经过的秒数
 */
export const advanceGateControl = (
  state: GateState,
  garrisons: Garrison[],
  deltaSeconds: number
): { capturedBy?: GateOwnerId } => {
  const byOwner = new Map<GateOwnerId, number>()
  for (const garrison of garrisons) {
    if (garrison.power <= 0) continue
    byOwner.set(garrison.ownerId, (byOwner.get(garrison.ownerId) ?? 0) + garrison.power)
  }

  const minutes = deltaSeconds / 60
  const ownerPower = byOwner.get(state.owner) ?? 0

  // 找最强挑战者
  let challenger: { ownerId: GateOwnerId; power: number } | null = null
  for (const [ownerId, power] of byOwner) {
    if (ownerId === state.owner) continue
    if (!challenger || power > challenger.power) challenger = { ownerId, power }
  }

  if (!challenger) {
    // 无人挑战：有驻守则维持/恢复，无驻守则衰减
    const delta = ownerPower > 0 ? controlRateOf(ownerPower) : -GATE_CONTROL_DECAY
    state.control = clampControl(state.control + delta * minutes)
    return {}
  }

  const challengerRate = controlRateOf(challenger.power)
  const defenseRate = ownerPower > 0 ? controlRateOf(ownerPower) : 0
  const net = challengerRate - defenseRate
  state.control = clampControl(state.control + net * minutes)

  // 防守方反推：控制点归零且防守方明显更强
  if (state.control <= 0 && defenseRate > challengerRate) {
    state.control = 0
    return {}
  }

  if (state.control >= GATE_CONTROL_MAX) {
    const capturedBy = challenger.ownerId
    state.owner = capturedBy
    state.control = 0
    return { capturedBy }
  }

  return {}
}

/** 新建一座中立星门 */
export const createGateState = (systemId: string, owner: GateOwnerId = 'neutral'): GateState => ({
  systemId,
  owner,
  control: 0,
  blockaded: false
})
