/**
 * 战役集成测试：第 6/7 章与旧存档迁移
 */
import assert from 'node:assert/strict'
import { createWorld } from '@/core/world'
import {
  CAMPAIGN_PROGRESS_VERSION,
  checkObjectiveProgress,
  claimQuestRewards,
  initializeCampaignProgress,
  startQuest,
  updateQuestProgress
} from '@/logic/campaignLogic'
import { getAllQuests, getQuestsByChapter } from '@/config/campaignConfig'
import { BuildingType, TechnologyType, QuestStatus } from '@/types/game'
import { initializePlayer } from '@/logic/gameLogic'
import { createInitialPlanet } from '@/logic/planetLogic'
import { DEFAULT_LAYOUT_SEED } from '@/config/galaxyConfig'

const main = async () => {
  // 章节存在性
  const chapter6 = getQuestsByChapter(6)
  assert.equal(chapter6.length, 5, '第 6 章应有 5 个任务')
  assert.deepEqual(
    chapter6.map(quest => quest.id),
    ['quest_6_1', 'quest_6_2', 'quest_6_3', 'quest_6_4', 'quest_6_5']
  )
  assert.deepEqual(
    chapter6.map(quest => quest.requiredQuestIds),
    [['quest_5_5'], ['quest_6_1'], ['quest_6_2'], ['quest_6_3'], ['quest_6_4']],
    '第 6 章任务链未正确接入第 5 章'
  )

  const chapter7 = getQuestsByChapter(7)
  assert.equal(chapter7.length, 5, '第 7 章应有 5 个任务')
  assert.deepEqual(
    chapter7.map(quest => quest.id),
    ['quest_7_1', 'quest_7_2', 'quest_7_3', 'quest_7_4', 'quest_7_5']
  )

  // 旧版存档已通关旧主线，并错误带有第 7 章完成状态：迁移必须清除，只解锁 7_1
  const legacy = initializePlayer('p_legacy', 'Legacy')
  const legacyPlanet = createInitialPlanet('p_legacy', 'Legacy')
  legacy.planets = [legacyPlanet]
  const oldQuestIds = getAllQuests().filter(quest => quest.chapter <= 6).map(quest => quest.id)
  legacy.campaignProgress = {
    campaignId: 'main_campaign',
    version: 1,
    currentChapter: 6,
    questProgress: {
      quest_7_1: { questId: 'quest_7_1', status: QuestStatus.Completed, objectives: {} },
      quest_7_2: { questId: 'quest_7_2', status: QuestStatus.Completed, objectives: {} }
    },
    completedQuests: [...oldQuestIds, 'quest_7_1', 'quest_7_2'],
    unlockedQuests: ['quest_7_1', 'quest_7_2'],
    branchChoices: {}
  }
  const migrated = initializeCampaignProgress(legacy)
  assert.equal(migrated.version, CAMPAIGN_PROGRESS_VERSION, '旧存档战役版本未升级')
  assert(!migrated.completedQuests.includes('quest_7_1'), '旧存档错误继承了第 7 章完成状态')
  assert(!migrated.completedQuests.includes('quest_7_2'), '旧存档错误继承了第 7 章完成状态')
  assert(migrated.unlockedQuests.includes('quest_7_1'), '旧存档应解锁第 7 章第一关')
  assert(!migrated.unlockedQuests.includes('quest_7_2'), '第 7 章第二关不应被提前解锁')
  assert.equal(migrated.currentChapter, 7, '迁移后应进入第 7 章')
  console.log('[campaign] 旧存档迁移：清除第 7 章错误完成状态，仅解锁 7_1')

  // 新建筑/科技可被战役目标检查识别
  legacyPlanet.buildings[BuildingType.Spaceport] = 1
  legacy.technologies[TechnologyType.HyperspaceTransfer] = 1
  assert.equal(checkObjectiveProgress(legacy, chapter7[0]!.objectives[0]!), 1, '航空港目标未识别')
  assert.equal(checkObjectiveProgress(legacy, chapter7[1]!.objectives[0]!), 1, '转移技术目标未识别')

  assert.equal(startQuest(legacy, 'quest_7_1').success, true, '应能接取 7_1')
  assert.equal(updateQuestProgress(legacy, 'quest_7_1').questCompleted, true, '7_1 应完成')
  assert.equal(claimQuestRewards(legacy, 'quest_7_1').success, true, '7_1 奖励应可领取')
  assert.equal(startQuest(legacy, 'quest_7_2').success, true, '领取 7_1 后应解锁 7_2')
  console.log('[campaign] 第 7 章航空港/转移技术任务链正常')

  const player = initializePlayer('p_campaign', 'Campaigner')
  const planet = createInitialPlanet('p_campaign', 'Camp')
  planet.position = { galaxy: 1, system: 1, position: 1 }
  player.planets = [planet]

  const world = createWorld({
    player,
    players: [player],
    planets: {},
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: DEFAULT_LAYOUT_SEED
  })

  // 测试环境：直接解锁第 6 章（正常玩法里由第 5 章完成解锁）
  const campaign = player.campaignProgress ?? initializeCampaignProgress(player)
  player.campaignProgress = campaign
  assert.ok(campaign, '玩家应初始化战役进度')
  for (const id of ['quest_6_1', 'quest_6_2', 'quest_6_3', 'quest_6_4', 'quest_6_5']) {
    if (!campaign!.unlockedQuests.includes(id)) campaign!.unlockedQuests.push(id)
  }

  // 任务 6_1：扫描
  const start = startQuest(player, 'quest_6_1')
  assert.equal(start.success, true, '应能接取 6_1')
  player.discoveredSystems = { '1:1:1': { at: Date.now(), scans: 1 } } as never
  let result = updateQuestProgress(player, 'quest_6_1', world)
  assert.equal(result.questCompleted, true, '扫描后 6_1 应完成')
  console.log('[campaign] quest_6_1 完成（扫描）')

  // 任务 6_2：命名
  assert.equal(startQuest(player, 'quest_6_2').success, true)
  player.discoveredSystems!['1:1:1'] = { at: Date.now(), scans: 1, named: true, name: 'Haven' } as never
  result = updateQuestProgress(player, 'quest_6_2', world)
  assert.equal(result.questCompleted, true, '命名后 6_2 应完成')
  console.log('[campaign] quest_6_2 完成（命名）')

  // 任务 6_3：信号
  assert.equal(startQuest(player, 'quest_6_3').success, true)
  player.discoveredSystems!['1:1:1'] = { at: Date.now(), scans: 1, signalClaimed: true } as never
  result = updateQuestProgress(player, 'quest_6_3', world)
  assert.equal(result.questCompleted, true, '回收信号后 6_3 应完成')
  console.log('[campaign] quest_6_3 完成（信号）')

  // 任务 6_4：星门
  assert.equal(startQuest(player, 'quest_6_4').success, true)
  world.gates = { '1:1:9': { systemId: '1:1:9', owner: player.id, control: 0, blockaded: false } }
  result = updateQuestProgress(player, 'quest_6_4', world)
  assert.equal(result.questCompleted, true, '占领星门后 6_4 应完成')
  console.log('[campaign] quest_6_4 完成（星门）')

  // 任务 6_5：跃迁
  assert.equal(startQuest(player, 'quest_6_5').success, true)
  player.cycle = 2
  result = updateQuestProgress(player, 'quest_6_5', world)
  assert.equal(result.questCompleted, true, '跃迁后 6_5 应完成')
  console.log('[campaign] quest_6_5 完成（跃迁）')

  console.log('✅ 战役第 6 章测试通过：5 个任务均可被真实玩法推进')
}

void main()
