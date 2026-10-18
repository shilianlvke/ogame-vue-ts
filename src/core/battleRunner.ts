/**
 * 战斗执行器（BattleRunner）
 *
 * 战斗计算本身是纯函数（`src/utils/battleSimulator.ts`），但浏览器端为了不阻塞主线程，
 * 会把它放到 Web Worker 里执行。为了同时支持「浏览器（Worker）」和「Node 服务端（直算）」，
 * 这里提供一个可注入的执行器抽象：
 *
 * - 默认：同步直算（Node / 测试环境无需任何初始化即可使用）
 * - 浏览器：在应用启动时调用 `setBattleRunner(workerBattleRunner)` 切换到 Worker 版本
 *
 * 这样 `src/logic/battleLogic.ts` 不再依赖 Vue / Worker，可被服务端复用。
 */
import type { DefenseType, Fleet, Resources } from '@/types/game'
import {
  simulateBattle as simulateBattleDirect,
  calculatePlunder as calculatePlunderDirect,
  calculateDebrisField as calculateDebrisFieldDirect
} from '@/utils/battleSimulator'

/** 参战方输入 */
export interface BattleSideInput {
  ships: Partial<Fleet>
  defense?: Partial<Record<DefenseType, number>>
  weaponTech?: number
  shieldTech?: number
  armorTech?: number
}

/** 战斗损失结构 */
export interface BattleLosses {
  fleet: Partial<Fleet>
  defense: Partial<Record<DefenseType, number>>
}

export type BattleSimulationResult = ReturnType<typeof simulateBattleDirect>
export type PlunderResult = ReturnType<typeof calculatePlunderDirect>
export type DebrisResult = ReturnType<typeof calculateDebrisFieldDirect>

export interface SimulateBattleParams {
  attacker: BattleSideInput
  defender: BattleSideInput
  maxRounds?: number
}

export interface CalculatePlunderParams {
  defenderResources: Resources
  attackerFleet: Partial<Fleet>
}

export interface CalculateDebrisParams {
  attackerLosses: Partial<Fleet>
  defenderLosses: BattleLosses
}

/** 可注入的战斗执行器 */
export interface BattleRunner {
  simulateBattle(params: SimulateBattleParams): Promise<BattleSimulationResult>
  calculatePlunder(params: CalculatePlunderParams): Promise<PlunderResult>
  calculateDebris(params: CalculateDebrisParams): Promise<DebrisResult>
}

/** 直算执行器：不依赖 Worker，Node 与测试环境的默认实现 */
export const directBattleRunner: BattleRunner = {
  simulateBattle: async params => simulateBattleDirect(params.attacker, params.defender, params.maxRounds),
  calculatePlunder: async params => calculatePlunderDirect(params.defenderResources, params.attackerFleet),
  calculateDebris: async params => calculateDebrisFieldDirect(params.attackerLosses, params.defenderLosses)
}

let currentBattleRunner: BattleRunner = directBattleRunner

/** 替换全局战斗执行器（浏览器端注入 Worker 版本） */
export const setBattleRunner = (runner: BattleRunner): void => {
  currentBattleRunner = runner
}

/** 获取当前战斗执行器 */
export const getBattleRunner = (): BattleRunner => currentBattleRunner
