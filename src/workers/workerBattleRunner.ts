/**
 * 浏览器端的 BattleRunner 实现：把战斗计算转交给 Web Worker。
 * 服务端不会引入此文件。
 */
import type { BattleRunner } from '@/core/battleRunner'
import { workerManager } from './workerManager'

export const workerBattleRunner: BattleRunner = {
  simulateBattle: params => workerManager.simulateBattle(params),
  calculatePlunder: params => workerManager.calculatePlunder(params),
  calculateDebris: params => workerManager.calculateDebris(params)
}
