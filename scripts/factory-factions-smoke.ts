/**
 * 派系声望、蓝图与自由舰队事件校验。
 * 运行：pnpm run smoke:factory-factions
 */
import assert from 'node:assert/strict'
import {
  addRep,
  blueprintPrice,
  BLUEPRINT_TOTAL,
  createEvent,
  eventMeta,
  halfRep,
  hasCombatShip,
  FACTION_MAX
} from '@/logic/factory/factions'

// ---------- 声望 ----------
assert.equal(addRep(0, 100), 100, '声望增加')
assert.equal(addRep(990, 100), FACTION_MAX, '声望封顶 1000')
assert.equal(addRep(10, -50), 0, '声望不为负')
assert.equal(halfRep(101), 50, '声望减半向下取整')

// ---------- 蓝图定价 ----------
assert.equal(blueprintPrice(0), 2000, '0 声望原价 2000')
assert.equal(blueprintPrice(1000), 1000, '1000 声望半价')
assert.equal(blueprintPrice(2000), 1, '满折扣不低于 1')
assert.equal(BLUEPRINT_TOTAL, 14, '蓝图总库存 14')

// ---------- 事件 ----------
{
  const caravan = createEvent('caravan', 1000)
  assert.equal(caravan.doneAt, 1000 + 40 * 60, '商队 40 分钟')
  assert.equal(eventMeta('caravan').rep, 5, '商队声望 +5')
  const escort = createEvent('escort', 1000)
  assert.equal(escort.doneAt, 1000 + 2 * 3600, '护航 2 小时')
  assert.equal(eventMeta('escort').rep, 10, '护航声望 +10')
  const raid = createEvent('raid', 1000)
  assert.equal(raid.doneAt, 1000, '劫掠即时')
  assert.equal(eventMeta('raid').rep, -20, '劫掠声望 −20')
  assert.ok(Object.keys(raid.reward).length === 1, '事件报酬单一材料')
}

// ---------- 舰队判定 ----------
assert.ok(!hasCombatShip({}), '无舰队')
assert.ok(!hasCombatShip({ 大型货船: 5 }), '货船不算战斗舰')
assert.ok(hasCombatShip({ 轻型战斗机: 1 }), '有战斗舰')

console.log('派系冒烟通过：声望、蓝图定价、事件、舰队判定')
