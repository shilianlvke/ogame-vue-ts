/**
 * 离线结算校验。
 * 运行：pnpm run smoke:factory-offline
 */
import assert from 'node:assert/strict'
import { addBuilding, createFactoryState, setOreSlot, simulateOffline } from '@/logic/factory/engine'
import { createMarketState } from '@/logic/factory/market'
import { diffReport, formatDuration, offlineCapSeconds, snapshot } from '@/logic/factory/offline'
import { OFFLINE_EXTEND_DARK_MATTER, OFFLINE_EXTEND_HOURS, OFFLINE_MAX_HOURS } from '@/config/factory/balance'

// ---------- 上限与格式化 ----------
assert.equal(offlineCapSeconds(0), OFFLINE_MAX_HOURS * 3600, '默认上限 12 小时')
assert.equal(offlineCapSeconds(OFFLINE_EXTEND_HOURS), (OFFLINE_MAX_HOURS + OFFLINE_EXTEND_HOURS) * 3600, '延长后 24 小时')
assert.equal(OFFLINE_EXTEND_DARK_MATTER, 100, '延长消耗 100 暗物质')
assert.equal(formatDuration(43200), '12 小时 0 分', '时长格式化')
assert.equal(formatDuration(150), '2 分', '分钟格式化')

// ---------- 快照与差值 ----------
{
  const factory = createFactoryState('standard')
  const market = createMarketState(0)
  const before = snapshot(factory, market)
  factory.stock.ironPlate = (factory.stock.ironPlate ?? 0) + 1000
  market.credit = 500
  const after = snapshot(factory, market)
  const report = diffReport(before, after, 100)
  assert.equal(report.materialsGained, 1000, '材料差值')
  assert.equal(report.creditsGained, 500, '星币差值')
}

// ---------- 离线批量模拟：燃煤矿井 12 小时产矿 ----------
{
  const state = createFactoryState('standard')
  const mine = addBuilding(state, 'mine')!
  assert.ok(mine, '矿井应当可以建造')
  mine.coalMode = true
  assert.ok(setOreSlot(state, mine.id, 0, 'ironOre'), '指定铁矿石')
  state.stock.coal = 10000
  const ctx = { now: 0, preset: 'standard' as const, techs: [], infinite: { mining: 0, smelting: 0, logistics: 0, weapon: 0 } }
  simulateOffline(state, ctx, 12 * 3600, 60)
  const ore = state.stock.ironOre ?? 0
  assert.ok(ore >= 5000, `12 小时离线应产出铁矿石（受仓容封顶 5000），实际 ${ore}`)
  assert.ok((state.stock.coal ?? 0) < 10000, '燃煤应被消耗')
}

console.log('离线冒烟通过：上限、时长格式化、快照差值、批量模拟')
