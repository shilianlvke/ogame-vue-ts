/**
 * 战役集成测试：第 6 章「星海导航」的五个新目标能否被真实玩法推进
 */
import assert from 'node:assert/strict'
import { createWorld } from '@/core/world'
import { initializeCampaignProgress, startQuest, updateQuestProgress } from '@/logic/campaignLogic'
import { getQuestsByChapter } from '@/config/campaignConfig'
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

  const player = initializePlayer('p_campaign', 'Campaigner')
  const planet = createInitialPlanet('p_campaign', 'Camp')
  planet.position = { galaxy: 1, system: 1, position: 1 }
  player.planets = [planet]

  const world = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
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
  let result = updateQuestProgress(player, 'quest_6_1', [], world)
  assert.equal(result.questCompleted, true, '扫描后 6_1 应完成')
  console.log('[campaign] quest_6_1 完成（扫描）')

  // 任务 6_2：命名
  assert.equal(startQuest(player, 'quest_6_2').success, true)
  player.discoveredSystems!['1:1:1'] = { at: Date.now(), scans: 1, named: true, name: 'Haven' } as never
  result = updateQuestProgress(player, 'quest_6_2', [], world)
  assert.equal(result.questCompleted, true, '命名后 6_2 应完成')
  console.log('[campaign] quest_6_2 完成（命名）')

  // 任务 6_3：信号
  assert.equal(startQuest(player, 'quest_6_3').success, true)
  player.discoveredSystems!['1:1:1'] = { at: Date.now(), scans: 1, signalClaimed: true } as never
  result = updateQuestProgress(player, 'quest_6_3', [], world)
  assert.equal(result.questCompleted, true, '回收信号后 6_3 应完成')
  console.log('[campaign] quest_6_3 完成（信号）')

  // 任务 6_4：星门
  assert.equal(startQuest(player, 'quest_6_4').success, true)
  world.gates = { '1:1:9': { systemId: '1:1:9', owner: player.id, control: 0, blockaded: false } }
  result = updateQuestProgress(player, 'quest_6_4', [], world)
  assert.equal(result.questCompleted, true, '占领星门后 6_4 应完成')
  console.log('[campaign] quest_6_4 完成（星门）')

  // 任务 6_5：跃迁
  assert.equal(startQuest(player, 'quest_6_5').success, true)
  player.cycle = 2
  result = updateQuestProgress(player, 'quest_6_5', [], world)
  assert.equal(result.questCompleted, true, '跃迁后 6_5 应完成')
  console.log('[campaign] quest_6_5 完成（跃迁）')

  console.log('✅ 战役第 6 章测试通过：5 个任务均可被真实玩法推进')
}

void main()
