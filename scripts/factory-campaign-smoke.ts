/**
 * 战役任务表与判定、奖励校验。
 * 运行：pnpm run smoke:factory-campaign
 */
import assert from 'node:assert/strict'
import { CAMPAIGN_CHAPTERS, CAMPAIGN_QUESTS, QUEST_MAP } from '@/config/factory/campaign'
import { createFactoryState, grantBuilding, isRecipeUnlocked } from '@/logic/factory/engine'
import { applyReward, isChapterUnlocked, isGoalMet, isQuestComplete, questStatus, type CampaignAccount, type CampaignContext } from '@/logic/factory/campaign'

const emptyCtx = (factory = createFactoryState('standard')): CampaignContext => ({
  factory,
  clearCounts: {},
  outposts: 0,
  routeCapacity: 0,
  ships: {},
  cycle: 1,
  launchCount: 0
})

// ---------- 表规模 ----------
assert.equal(CAMPAIGN_QUESTS.length, 130, `任务总数应为 130，实际 ${CAMPAIGN_QUESTS.length}`)
assert.deepEqual(
  CAMPAIGN_CHAPTERS.map(c => c.quests.length),
  [16, 18, 20, 18, 18, 20, 20],
  '各章任务数应为 16/18/20/18/18/20/20'
)
const ids = new Set(CAMPAIGN_QUESTS.map(q => q.id))
assert.equal(ids.size, 130, '任务 id 应唯一')

// ---------- 目标判定 ----------
{
  const factory = createFactoryState('standard')
  const ctx = emptyCtx(factory)
  assert.ok(!isGoalMet({ type: 'building', target: 'mine', amount: 1 }, ctx), '无矿井时目标未达成')
  grantBuilding(factory, 'mine')
  assert.ok(isGoalMet({ type: 'building', target: 'mine', amount: 1 }, ctx), '建成矿井后达成')
  factory.stock.ironOre = 60
  assert.ok(isGoalMet({ type: 'material', target: 'ironOre', amount: 50 }, ctx), '持有材料判定')
  assert.ok(!isGoalMet({ type: 'research', target: 'power', amount: 1 }, ctx), '未研究科技')
  factory.techs.push('power')
  assert.ok(isGoalMet({ type: 'research', target: 'power', amount: 1 }, ctx), '完成科技判定')
}

// ---------- 状态机与章节解锁 ----------
{
  const factory = createFactoryState('standard')
  const ctx = emptyCtx(factory)
  assert.equal(questStatus(QUEST_MAP['1-1']!, ctx, new Set()), 'active', '1-1 初始应为进行中')
  assert.equal(questStatus(QUEST_MAP['1-2']!, ctx, new Set()), 'locked', '1-2 前序未完成应锁定')
  assert.equal(questStatus(QUEST_MAP['2-1']!, ctx, new Set()), 'locked', '第 2 章未解锁')
  // 完成 1-1：矿井 + 铁矿石 50
  grantBuilding(factory, 'mine')
  factory.stock.ironOre = 60
  assert.ok(isQuestComplete(QUEST_MAP['1-1']!, ctx), '1-1 目标达成')
  assert.equal(questStatus(QUEST_MAP['1-1']!, ctx, new Set()), 'ready', '1-1 达成可领取')
  assert.equal(questStatus(QUEST_MAP['1-2']!, ctx, new Set()), 'active', '1-2 解锁为进行中')
  assert.ok(!isChapterUnlocked(2, ctx), '第 1 章未完第 2 章锁')
}

// ---------- 奖励发放 ----------
{
  const factory = createFactoryState('standard')
  const account: CampaignAccount = { ships: {}, darkMatter: 0 }
  const r3 = QUEST_MAP['3-3']!.reward // 塑料配方解锁
  applyReward(r3, factory, account)
  assert.ok(isRecipeUnlocked(factory, 'plastic'), '任务解锁塑料配方')
  assert.ok(!isRecipeUnlocked(factory, 'sulfuricAcid'), '未解锁的硫酸配方仍锁')

  const r2 = QUEST_MAP['1-2']!.reward // 铁板 ×100
  applyReward(r2, factory, account)
  assert.ok((factory.stock.ironPlate ?? 0) >= 140, '材料奖励入仓')

  applyReward({ buildings: { stoneFurnace: 1 } }, factory, account)
  assert.ok(factory.buildings.some(b => b.type === 'stoneFurnace'), '建筑实例奖励')

  applyReward({ buildingLevels: { electricFurnace: 1 } }, factory, account)
  const ef = factory.buildings.find(b => b.type === 'electricFurnace')
  assert.ok(ef && ef.level >= 2, '无实例时新建并给等级')

  applyReward({ recipeBonus: { copperCable: 0.1 } }, factory, account)
  assert.equal(factory.recipeBonus?.copperCable, 0.1, '配方产能加成')

  applyReward({ moduleSlotBonus: 1 }, factory, account)
  assert.equal(factory.moduleSlotBonus, 1, '模块槽位加成')

  applyReward({ suit: 'reinforced' }, factory, account)
  assert.equal(factory.suit, 'reinforced', '工程服解锁')

  applyReward({ darkMatter: 500, ships: { 大型货船: 2 } }, factory, account)
  assert.equal(account.darkMatter, 500, '暗物质奖励')
  assert.equal(account.ships['大型货船'], 2, '舰船奖励')
}

console.log('战役冒烟通过：130 条任务表、目标判定、状态机、奖励发放')
