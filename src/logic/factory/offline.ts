import type { PlanetFactory } from '@/types/factory'
import { OFFLINE_EXTEND_DARK_MATTER, OFFLINE_EXTEND_HOURS, OFFLINE_MAX_HOURS } from '@/config/factory/balance'
import type { MarketState } from './market'

/**
 * 离线结算，对应规划书 §6.8。
 * 单次最多结算 12 小时（可用暗物质延长），固定 60 秒步长批量模拟，离线不触发战斗。
 */

/** 结算前的状态快照 */
export interface FactorySnapshot {
  materials: number
  credits: number
  techs: number
  rockets: number
}

/** 离线结算报告 */
export interface OfflineReport {
  seconds: number
  materialsGained: number
  creditsGained: number
  techsGained: number
  rocketsGained: number
}

export function snapshot(factory: PlanetFactory, market: MarketState): FactorySnapshot {
  let materials = 0
  for (const v of Object.values(factory.stock)) materials += v ?? 0
  for (const v of Object.values(factory.fluids)) materials += v ?? 0
  return {
    materials,
    credits: market.credit,
    techs: factory.techs.length,
    rockets: factory.rockets ?? 0
  }
}

export function diffReport(before: FactorySnapshot, after: FactorySnapshot, seconds: number): OfflineReport {
  return {
    seconds,
    materialsGained: Math.round(after.materials - before.materials),
    creditsGained: Math.round((after.credits - before.credits) * 100) / 100,
    techsGained: after.techs - before.techs,
    rocketsGained: after.rockets - before.rockets
  }
}

/** 离线结算上限（秒） */
export function offlineCapSeconds(extendHours = 0): number {
  return (OFFLINE_MAX_HOURS + extendHours) * 3600
}

/** 每延长一段的暗物质消耗 */
export const offlineExtendCost = (): number => OFFLINE_EXTEND_DARK_MATTER
/** 每延长一段的时长（小时） */
export const offlineExtendHours = (): number => OFFLINE_EXTEND_HOURS

/** 秒数格式化为「X 小时 Y 分」 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  return `${m} 分`
}
