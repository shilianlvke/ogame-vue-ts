/**
 * 成就判定校验。
 * 运行：pnpm run smoke:factory-achievements
 */
import assert from 'node:assert/strict'
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from '@/config/factory/achievements'
import { createFactoryState } from '@/logic/factory/engine'
import { createAchievementStats, evaluateAchievements, hasAllMaterials, totalMaterials, type AchievementContext } from '@/logic/factory/achievements'
import type { Outpost } from '@/logic/factory/outposts'

const emptyCtx = (factory = createFactoryState('standard')): AchievementContext => ({
  factory,
  outposts: [],
  cycle: 1,
  launchCount: 0,
  now: 0
})

const outpost = (mineSlots: number): Outpost => ({
  id: `op${mineSlots}`,
  name: '前哨',
  ore: 'ironOre',
  mineSlots,
  warehouseLevel: 0,
  solarLevel: 0,
  stock: 0,
  reserve: 100000,
  reserveMax: 100000,
  cargo: 0,
  distance: 20000
})

// ---------- 表规模 ----------
assert.equal(ACHIEVEMENTS.length, 12, '成就应为 12 条')
assert.equal(new Set(ACHIEVEMENTS.map(a => a.id)).size, 12, '成就 id 应唯一')

// ---------- 判定 ----------
{
  const factory = createFactoryState('standard')
  const ctx = emptyCtx(factory)
  const stats = createAchievementStats()
  assert.equal(evaluateAchievements(ctx, stats).size, 0, '初始无成就')

  stats.builtMine = true
  assert.ok(evaluateAchievements(ctx, stats).has('firstMine'), '第一步')
  stats.fullLoadSeconds = 600
  assert.ok(evaluateAchievements(ctx, stats).has('fullLoad'), '满负荷')
  stats.salvagedWreck = 1000
  assert.ok(evaluateAchievements(ctx, stats).has('salvager'), '拆解工')
  stats.rustHpKilled = 1_000_000
  assert.ok(evaluateAchievements(ctx, stats).has('rustSlayer'), '锈群克星')
  stats.powerOut = true
  assert.ok(evaluateAchievements(ctx, stats).has('powerOut'), '断电')
  stats.zeroLoss = true
  assert.ok(evaluateAchievements(ctx, stats).has('zeroLoss'), '零损失')
  stats.minimalLaunch = true
  assert.ok(evaluateAchievements(ctx, stats).has('minimal'), '极简')
}

// ---------- 收藏家 / 循环者 / 星际矿工 ----------
{
  const factory = createFactoryState('standard')
  const ctx: AchievementContext = { factory, outposts: [outpost(1), outpost(1), outpost(1), outpost(1), outpost(1)], cycle: 12, launchCount: 12, now: 0 }
  const stats = createAchievementStats()
  assert.ok(evaluateAchievements(ctx, stats).has('cycler'), '循环者')
  assert.ok(evaluateAchievements(ctx, stats).has('miner'), '星际矿工')
  assert.ok(!hasAllMaterials(factory), '初始未集齐 62 种材料')
  assert.ok(totalMaterials(factory) > 0, '初始材料总量为正')
}

// ---------- 破产：归零后 1 小时内恢复到 10 万 ----------
{
  const factory = createFactoryState('standard')
  factory.stock = {}
  factory.fluids = {}
  const ctx: AchievementContext = { factory, outposts: [], cycle: 1, launchCount: 0, now: 0 }
  const stats = createAchievementStats()
  assert.equal(totalMaterials(factory), 0, '归零')
  stats.bankruptAt = 100
  ctx.now = 100 + 1800 // 30 分钟后
  factory.stock.ironPlate = 100000
  assert.ok(evaluateAchievements(ctx, stats).has('bankrupt'), '1 小时内恢复达成破产')
}

// ---------- 奖励引用完整 ----------
for (const a of ACHIEVEMENTS) {
  assert.ok(ACHIEVEMENT_MAP[a.id], `成就 ${a.id} 应有映射`)
  assert.ok(Object.keys(a.reward).length > 0, `成就 ${a.id} 应有奖励`)
}

console.log('成就冒烟通过：12 条、判定逻辑、破产计时、奖励完整')
