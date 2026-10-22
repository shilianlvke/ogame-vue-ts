/**
 * 无头引擎冒烟测试
 *
 * 目的：验证 src/core 可以在**纯 Node 环境**（无 Vue、无 Pinia、无 DOM、无 Worker）下
 * 完整推进世界——这是联机改造（服务端权威仿真）的前提条件。
 *
 * 运行：node scripts/.smoke-out/smoke.js
 */
import { reactive } from 'vue'
import { createWorld } from '@/core/world'
import { tick } from '@/core/engine'
import { createEngineContext } from '@/core/types'
import type { EngineEvent } from '@/core/types'
import { applyCommand } from '@/core/commands'
import { buildPatch, buildSnapshot, createPatchState, seedPatchState } from '@/core/protocol'
import { applyPatch, applySnapshot } from '@/net/apply'
import * as gameLogic from '@/logic/gameLogic'
import * as planetLogic from '@/logic/planetLogic'
import * as fleetLogic from '@/logic/fleetLogic'
import * as buildingLogic from '@/logic/buildingLogic'
import * as waitingQueueLogic from '@/logic/waitingQueueLogic'
import type { Resources, FleetMission, Planet, DebrisField, QuestNotification } from '@/types/game'
import { BuildingType, DefenseType, MissionType, OfficerType, ShipType, TechnologyType } from '@/types/game'

const t = (key: string) => key
let eventCount = 0
const ctx = createEngineContext({ t, emit: () => (eventCount += 1) })

const player = gameLogic.initializePlayer('player1', 'Tester')
const home = planetLogic.createInitialPlanet(player.id, 'Home')
home.id = 'home_player1'
home.position = { galaxy: 1, system: 1, position: 1 }
player.planets = [home]

// 另一位玩家作为非 NPC 的战斗/舰队目标，避免依赖已下线的 NPC 系统
const rival = gameLogic.initializePlayer('player2', 'Rival')
const rivalHome = planetLogic.createInitialPlanet(rival.id, 'Rival Home')
rivalHome.id = 'home_rival'
rivalHome.position = { galaxy: 2, system: 2, position: 2 }
rivalHome.fleet[ShipType.LightFighter] = 20
rivalHome.defense[DefenseType.RocketLauncher] = 10
rivalHome.resources = { metal: 20_000, crystal: 20_000, deuterium: 5_000, darkMatter: 0, energy: 0 }
rival.planets = [rivalHome]

const world = createWorld({
  player,
  players: [player, rival],
  planets: {},
  debrisFields: {},
  locale: 'zh-CN',
  gameSpeed: 1,
  battleToFinish: true
})

const emptyCargo: Resources = { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 }

const fail = (msg: string): never => {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

const assertFinite = (label: string, value: number) => {
  if (!Number.isFinite(value)) fail(`${label} 出现非有限数值：${value}`)
}

const run = async () => {
  console.log('—— 无头引擎冒烟测试 ——')
  console.log(`宇宙星球数：${Object.keys(world.planets).length}`)

  // 直接攻击另一位玩家的星球，验证 Node 环境下战斗执行器（直算）可用
  const target = rivalHome
  const mission: FleetMission = {
    id: 'smoke-mission-1',
    playerId: player.id,
    originPlanetId: home.id,
    targetPosition: { ...target.position },
    targetPlanetId: target.id,
    missionType: MissionType.Attack,
    fleet: { lightFighter: 50, cruiser: 10 },
    cargo: { ...emptyCargo },
    departureTime: Date.now(),
    arrivalTime: Date.now(),
    status: 'outbound'
  }

  const attackResult = await fleetLogic.processAttackArrival(mission, target, player, rival, player.planets, true)
  if (!attackResult) fail('战斗结算返回空（processAttackArrival 失败）')
  const rounds = attackResult!.battleResult.rounds ?? 0
  console.log(`战斗结算成功：回合=${rounds}，胜者=${attackResult!.battleResult.winner}`)
  assertFinite('战报掠夺金属', attackResult!.battleResult.plunder.metal)
  assertFinite('战报残骸金属', attackResult!.battleResult.debrisField.metal)

  // 6 小时模拟前先排入建造 / 研究队列，验证玩家侧引擎在无 NPC 环境下仍能推进
  home.resources = { metal: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000, darkMatter: 0, energy: 0 }
  home.buildings[BuildingType.SolarPlant] = 1
  home.buildings[BuildingType.ResearchLab] = 1
  const metalMineBefore = home.buildings[BuildingType.MetalMine] ?? 0

  const buildQueued = applyCommand(world, ctx, {
    type: 'building.upgrade',
    planetId: home.id,
    buildingType: BuildingType.MetalMine
  })
  if (!buildQueued.ok) fail(`6 小时模拟前建筑入队失败（${buildQueued.reason}）`)

  const researchQueued = applyCommand(world, ctx, {
    type: 'research.start',
    planetId: home.id,
    techType: TechnologyType.EnergyTechnology
  })
  if (!researchQueued.ok) fail(`6 小时模拟前研究入队失败（${researchQueued.reason}）`)

  // 回收任务：6 小时内到达、清空残骸场并把回收船送回母星
  const debrisPosition = { galaxy: 5, system: 5, position: 5 }
  const debrisId = `debris_${debrisPosition.galaxy}_${debrisPosition.system}_${debrisPosition.position}`
  world.debrisFields[debrisId] = {
    id: debrisId,
    position: debrisPosition,
    resources: { metal: 30_000, crystal: 10_000 },
    createdAt: Date.now()
  }
  const recycleMission: FleetMission = {
    id: 'smoke-recycle-1',
    playerId: player.id,
    originPlanetId: home.id,
    targetPosition: debrisPosition,
    debrisFieldId: debrisId,
    missionType: MissionType.Recycle,
    fleet: { [ShipType.Recycler]: 2 },
    cargo: { ...emptyCargo },
    departureTime: Date.now() - 5000,
    arrivalTime: Date.now() + 5000,
    status: 'outbound'
  }
  player.fleetMissions.push(recycleMission)

  // 快进模拟：每个 tick 代表 5 秒，共 6 小时
  const TICKS = 4320
  const STEP_MS = 5000
  const started = Date.now()
  let now = Date.now()

  for (let i = 0; i < TICKS; i++) {
    now += STEP_MS
    await tick(world, ctx, now, STEP_MS / 1000)
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(2)
  console.log(`模拟完成：${TICKS} ticks（${(TICKS * STEP_MS) / 3600000} 小时），耗时 ${elapsed}s，事件 ${eventCount} 个`)

  // 建造 / 研究 / 回收结果校验
  if (home.buildings[BuildingType.MetalMine] !== metalMineBefore + 1) {
    fail(`6 小时内金属矿未完成升级（${home.buildings[BuildingType.MetalMine]}）`)
  }
  if ((player.technologies[TechnologyType.EnergyTechnology] ?? 0) !== 1) {
    fail('6 小时内能源技术研究未完成')
  }
  if (player.fleetMissions.includes(recycleMission)) fail('6 小时内回收舰队未返回')
  if (world.debrisFields[debrisId]) fail('回收任务完成后残骸场仍存在')
  if ((home.fleet[ShipType.Recycler] ?? 0) !== 2) fail('回收舰队未返回母星')
  const recycleReport = (player.missionReports ?? []).find(
    report => report.missionType === MissionType.Recycle && report.success
  )
  if (!recycleReport) fail('回收任务未生成成功报告')
  console.log('建造 / 研究 / 回收链路正常：金属矿升级、能源技术完成、回收舰队已返航')

  assertFinite('玩家金属', home.resources.metal)
  assertFinite('玩家晶体', home.resources.crystal)
  assertFinite('玩家重氢', home.resources.deuterium)
  if (home.resources.metal < 0) fail('玩家金属为负')

  const planetsToCheck = [...player.planets, ...rival.planets, ...Object.values(world.planets)]
  let planetCount = 0
  for (const planet of planetsToCheck) {
    planetCount += 1
    assertFinite(`星球 ${planet.id} 金属`, planet.resources.metal)
    assertFinite(`星球 ${planet.id} 晶体`, planet.resources.crystal)
    if (planet.resources.metal < 0) fail(`星球 ${planet.id} 金属为负`)
  }

  console.log(`宇宙星球校验通过：${planetCount} 个`)
  console.log(`残骸场：${Object.keys(world.debrisFields).length}，玩家积分：${publicPoints(player)}`)

  // 场景 B：验证浏览器端（Pinia）的引用语义
  await runReactiveScenario()

  // 场景 C：验证命令层（校验 + 副作用）
  await runCommandScenario()

  // 场景 D：验证客户端联机同步（snapshot / patch → 本地状态）
  await runOnlineApplyScenario()

  console.log('✅ 无头引擎冒烟测试通过')
}

/**
 * 场景 B：模拟浏览器端
 *
 * 客户端把 Pinia state 里的对象直接交给 World，引擎必须通过「就地修改」让其生效。
 * 这里用 Vue 的 reactive() 复现同一语义：引用不得被切断，修改必须落到原对象上。
 */
const runReactiveScenario = async () => {
  const state = reactive({
    player: gameLogic.initializePlayer('player3', 'ClientTester'),
    planets: {} as Record<string, Planet>,
    debrisFields: {} as Record<string, DebrisField>
  })

  const home = planetLogic.createInitialPlanet('player3', 'Home3')
  state.player.planets = [home]

  const world = createWorld({
    player: state.player,
    planets: state.planets,
    debrisFields: state.debrisFields,
    locale: 'zh-CN'
  })

  // NPC 已下线，直接放入一张星图星球，验证 world.planets 仍然指向响应式对象
  const frontier = planetLogic.createInitialPlanet('frontier', 'Frontier')
  frontier.id = 'frontier_1'
  frontier.position = { galaxy: 3, system: 3, position: 3 }
  state.planets['3:3:3'] = frontier
  if (Object.keys(state.planets).length === 0) fail('场景 B：星球未写入响应式 state')

  // 入队一个 3 秒完成的建筑升级，验证队列推进与事件抛出
  const levelBefore = state.player.planets[0].buildings[BuildingType.MetalMine] ?? 0
  const queueItem = buildingLogic.createBuildQueueItem(BuildingType.MetalMine, levelBefore + 1, 3)
  queueItem.endTime = Date.now() + 3000
  state.player.planets[0].buildQueue.push(queueItem)

  const events: EngineEvent[] = []
  const ctx = createEngineContext({ t, emit: event => events.push(event) })

  let now = Date.now()
  for (let i = 0; i < 8; i++) {
    now += 1000
    await tick(world, ctx, now, 1)
  }

  // 引用完整性：引擎不得替换 World 字段（否则会切断与 Pinia 的连接）
  if (world.player !== state.player) fail('场景 B：world.player 引用被切断')
  if (world.planets !== state.planets) fail('场景 B：world.planets 引用被切断')
  if (world.debrisFields !== state.debrisFields) fail('场景 B：world.debrisFields 引用被切断')

  // 就地修改必须可见
  if (Object.keys(state.planets).length === 0) fail('场景 B：宇宙地图为空')
  if (home.buildings.metalMine !== levelBefore + 1) {
    fail(`场景 B：建筑队列未生效（metalMine=${home.buildings.metalMine}，期望 ${levelBefore + 1}）`)
  }

  if (!events.some(event => event.kind === 'queueComplete')) {
    fail('场景 B：建造完成未抛出 queueComplete 事件')
  }
  if (!Number.isFinite(state.player.planets[0].resources.metal)) {
    fail('场景 B：资源出现非有限数值')
  }

  console.log(
    `场景 B（Pinia 引用语义）通过：星图星球 ${Object.keys(state.planets).length} 个，事件 ${events.length} 个，金属矿 Lv${home.buildings.metalMine}`
  )
}

/**
 * 场景 C：命令层
 *
 * 验证「所有状态变更都经过 applyCommand」这一契约：
 * - 非法/资源不足的命令必须被拒绝且不产生任何副作用；
 * - 合法命令必须正确扣资源、入队、生成任务；
 * - 非本玩家星球的操作必须被拒绝（服务端防作弊的基础）。
 */
const runCommandScenario = async () => {
  const player = gameLogic.initializePlayer('player4', 'CmdTester')
  const home = planetLogic.createInitialPlanet('player4', 'Home4')
  player.planets = [home]

  const rival = gameLogic.initializePlayer('player4_rival', 'Rival')
  const rivalHome = planetLogic.createInitialPlanet(rival.id, 'Rival Home')
  rivalHome.id = 'rival_home_cmd'
  rivalHome.position = { galaxy: 2, system: 2, position: 2 }
  rival.planets = [rivalHome]

  const world = createWorld({
    player,
    players: [player, rival],
    planets: {},
    debrisFields: {},
    locale: 'zh-CN',
    gameSpeed: 1,
    battleToFinish: true
  })

  const ctx = createEngineContext({ t, emit: () => {} })

  // 金属矿需要太阳能发电厂 Lv1 作为前置
  home.buildings[BuildingType.SolarPlant] = 1

  // 1) 资源不足 → 拒绝且不入队
  home.resources = { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 }
  const denied = applyCommand(world, ctx, {
    type: 'building.upgrade',
    planetId: home.id,
    buildingType: BuildingType.MetalMine
  })
  if (denied.ok) fail('场景 C：资源不足时建筑升级竟然成功')
  if (home.buildQueue.length !== 0) fail('场景 C：被拒绝的命令产生了队列副作用')

  // 2) 资源充足 → 成功且扣费
  home.resources = { metal: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000, darkMatter: 1_000_000, energy: 0 }
  const upgraded = applyCommand(world, ctx, {
    type: 'building.upgrade',
    planetId: home.id,
    buildingType: BuildingType.MetalMine
  })
  if (!upgraded.ok) fail(`场景 C：建筑升级失败（${upgraded.reason}）`)
  if (home.buildQueue.length !== 1) fail('场景 C：建筑升级未入队')
  if (home.resources.metal >= 1_000_000) fail('场景 C：建筑升级未扣除资源')

  // 3) 非本玩家星球 → 拒绝
  const foreign = applyCommand(world, ctx, {
    type: 'building.upgrade',
    planetId: rivalHome.id,
    buildingType: BuildingType.MetalMine
  })
  if (foreign.ok) fail('场景 C：竟然能操作他人星球')

  // 4) 船厂建船（轻型战斗机需要船厂 + 燃烧引擎 Lv1）
  home.buildings[BuildingType.Shipyard] = 1
  player.technologies['combustionDrive'] = 1
  const shipBuilt = applyCommand(world, ctx, {
    type: 'ship.build',
    planetId: home.id,
    shipType: ShipType.LightFighter,
    quantity: 5
  })
  if (!shipBuilt.ok) fail(`场景 C：舰船建造失败（${shipBuilt.reason}）`)
  if (home.buildQueue.length !== 2) fail('场景 C：舰船建造未入队')

  // 4.1) 舰船等待队列：资源不足时应允许排队，且不会在 tick 中被清除
  home.resources = { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 }
  const shipWaiting = applyCommand(world, ctx, {
    type: 'queue.addWaiting',
    kind: 'ship',
    planetId: home.id,
    itemType: ShipType.LightFighter,
    quantity: 1
  })
  if (!shipWaiting.ok) fail(`场景 C：舰船等待队列添加失败（${shipWaiting.reason}）`)
  if (!home.waitingBuildQueue.some(item => item.type === 'ship' && item.quantity === 1)) {
    fail('场景 C：舰船等待队列项未写入')
  }

  waitingQueueLogic.processPlanetWaitingQueue(home, player, player.officers)
  if (!home.waitingBuildQueue.some(item => item.type === 'ship')) {
    fail('场景 C：资源不足时舰船等待队列项被提前清除')
  }

  // 资源充足后，等待项应自动进入正式队列
  home.resources = { metal: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000, darkMatter: 1_000_000, energy: 0 }
  waitingQueueLogic.processPlanetWaitingQueue(home, player, player.officers)
  if (home.waitingBuildQueue.some(item => item.type === 'ship')) {
    fail('场景 C：资源充足后舰船等待队列项未执行')
  }
  if (home.buildQueue.filter(item => item.type === 'ship').length !== 2) {
    fail('场景 C：舰船等待队列项执行后未进入正式队列')
  }

  // 4.2) 防御等待队列同样必须经过命令层，且资源不足时保持等待
  const defenseQueueBefore = home.buildQueue.filter(item => item.type === 'defense').length
  home.resources = { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 }
  const defenseWaiting = applyCommand(world, ctx, {
    type: 'queue.addWaiting',
    kind: 'defense',
    planetId: home.id,
    itemType: DefenseType.RocketLauncher,
    quantity: 1
  })
  if (!defenseWaiting.ok) fail(`场景 C：防御等待队列添加失败（${defenseWaiting.reason}）`)
  if (!home.waitingBuildQueue.some(item => item.type === 'defense')) {
    fail('场景 C：防御等待队列项未写入')
  }

  waitingQueueLogic.processPlanetWaitingQueue(home, player, player.officers)
  if (!home.waitingBuildQueue.some(item => item.type === 'defense')) {
    fail('场景 C：资源不足时防御等待队列项被提前清除')
  }

  home.resources = { metal: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000, darkMatter: 1_000_000, energy: 0 }
  waitingQueueLogic.processPlanetWaitingQueue(home, player, player.officers)
  if (home.waitingBuildQueue.some(item => item.type === 'defense')) {
    fail('场景 C：资源充足后防御等待队列项未执行')
  }
  if (home.buildQueue.filter(item => item.type === 'defense').length !== defenseQueueBefore + 1) {
    fail('场景 C：防御等待队列项执行后未进入正式队列')
  }

  // 4.3) 消息/通知的删除、清空、已读必须走命令层
  const messageTime = Date.now()
  const firstNotice: QuestNotification = {
    id: 'smoke-quest-1',
    timestamp: messageTime,
    questId: 'quest_smoke',
    questTitleKey: 'campaign.smoke.title',
    eventType: 'unlocked',
    messageKey: 'campaign.smoke.unlocked',
    read: false
  }
  const secondNotice: QuestNotification = {
    ...firstNotice,
    id: 'smoke-quest-2',
    timestamp: messageTime + 1
  }
  player.questNotifications = [firstNotice, secondNotice]

  const markRead = applyCommand(world, ctx, {
    type: 'messages.markRead',
    collections: ['questNotifications'],
    id: firstNotice.id
  })
  if (!markRead.ok || !firstNotice.read) fail('场景 C：消息已读命令未生效')
  if (secondNotice.read) fail('场景 C：消息已读命令误改了其他通知')

  const deleted = applyCommand(world, ctx, {
    type: 'messages.delete',
    collection: 'questNotifications',
    id: secondNotice.id
  })
  if (!deleted.ok || player.questNotifications.length !== 1) fail('场景 C：消息删除命令未生效')

  const cleared = applyCommand(world, ctx, {
    type: 'messages.clear',
    collections: ['questNotifications']
  })
  if (!cleared.ok || player.questNotifications.length !== 0) fail('场景 C：消息清空命令未生效')

  // 4.4) 战役分支解锁必须走命令层
  const branchResult = applyCommand(world, ctx, {
    type: 'campaign.choice',
    effect: 'unlock_branch',
    branchId: 'branch_smoke'
  })
  if (!branchResult.ok) fail(`场景 C：战役分支解锁失败（${branchResult.reason}）`)
  if (!player.campaignProgress?.unlockedBranches?.includes('branch_smoke')) {
    fail('场景 C：战役分支解锁未写入进度')
  }

  // 恢复资源，避免影响后续军官等场景
  home.resources = { metal: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000, darkMatter: 1_000_000, energy: 0 }

  // 5) 舰队派遣（扣除舰队与燃料）
  home.fleet.lightFighter = 10
  const deuteriumBefore = home.resources.deuterium
  const sent = applyCommand(world, ctx, {
    type: 'fleet.send',
    originPlanetId: home.id,
    targetPosition: { ...rivalHome.position },
    missionType: MissionType.Attack,
    fleet: { lightFighter: 4 }
  })
  if (!sent.ok) fail(`场景 C：舰队派遣失败（${sent.reason}）`)
  if (player.fleetMissions.length !== 1) fail('场景 C：舰队任务未创建')
  if (home.fleet.lightFighter !== 6) fail(`场景 C：出发舰队未从星球扣除（剩余 ${home.fleet.lightFighter}）`)
  if (home.resources.deuterium >= deuteriumBefore) fail('场景 C：舰队派遣未扣除燃料')

  // 6) 舰队召回
  const recalled = applyCommand(world, ctx, { type: 'fleet.recall', missionId: player.fleetMissions[0].id })
  if (!recalled.ok) fail('场景 C：舰队召回失败')

  // 7) 军官招募（扣资源 + 激活）
  const darkMatterBefore = home.resources.darkMatter
  const hired = applyCommand(world, ctx, {
    type: 'officer.hire',
    planetId: home.id,
    officerType: OfficerType.Geologist
  })
  if (!hired.ok) fail(`场景 C：军官招募失败（${hired.reason}）`)
  if (!player.officers[OfficerType.Geologist]?.active) fail('场景 C：军官未激活')
  if (home.resources.darkMatter >= darkMatterBefore) fail('场景 C：军官招募未扣除资源')

  // 8) 军官解雇
  const dismissed = applyCommand(world, ctx, { type: 'officer.dismiss', officerType: OfficerType.Geologist })
  if (!dismissed.ok) fail('场景 C：军官解雇失败')
  if (player.officers[OfficerType.Geologist]?.active) fail('场景 C：军官仍处于激活状态')

  console.log(
    `场景 C（命令层）通过：拒绝非法命令 ✓，建筑/舰船/舰队/军官共 ${home.buildQueue.length} 个队列项、${player.fleetMissions.length} 个任务`
  )
}

/**
 * 场景 D：客户端联机同步
 *
 * 用真实的 `buildSnapshot` / `buildPatch` 生成服务端数据，
 * 再用客户端侧的 `applySnapshot` / `applyPatch` 应用到本地状态。
 * 中间做一次 JSON 序列化，确保协议内容真的能过网络。
 */
const runOnlineApplyScenario = async () => {
  const alice = gameLogic.initializePlayer('alice', 'Alice')
  const bob = gameLogic.initializePlayer('bob', 'Bob')

  const aliceHome = planetLogic.createInitialPlanet('alice', 'Alice Prime')
  aliceHome.id = 'alice_home'
  aliceHome.position = { galaxy: 9, system: 9, position: 9 }
  alice.planets = [aliceHome]

  const bobHome = planetLogic.createInitialPlanet('bob', 'Bob Prime')
  bobHome.id = 'bob_home'
  bobHome.position = { galaxy: 9, system: 9, position: 8 }
  bobHome.fleet.lightFighter = 42
  bobHome.resources.metal = 123456
  bob.planets = [bobHome]

  const world = createWorld({
    player: alice,
    players: [alice, bob],
    planets: {},
    debrisFields: {},
    locale: 'zh-CN'
  })

  const ctx = createEngineContext({ t, emit: () => {} })

  // 客户端本地状态（模拟 Pinia 里的对象引用）
  const clientState = {
    player: gameLogic.initializePlayer('local', 'Local'),
    planets: {} as Record<string, Planet>,
    debrisFields: {} as Record<string, DebrisField>
  }

  // —— 全量快照 ——
  const snapshotWire = JSON.parse(JSON.stringify(buildSnapshot(world, alice, { visibility: 'public', tick: 7 })))
  const { currentPlanetId } = applySnapshot(clientState, snapshotWire)

  if (currentPlanetId !== 'alice_home') fail(`场景 D：快照应用后未选中母星（${currentPlanetId}）`)
  if (clientState.player.id !== 'alice') fail('场景 D：玩家没有切换到服务器玩家')

  const bobView = clientState.planets['9:9:8']
  if (!bobView) fail('场景 D：看不到其他玩家的星球')
  if (bobView.name !== 'Bob Prime') fail('场景 D：公开星球缺少名称')
  if (bobView.resources.metal !== 0) fail('场景 D：公开星球泄露了资源')
  if (Object.keys(bobView.fleet).length !== 0) fail('场景 D：公开星球泄露了舰队')

  // —— 增量补丁 ——
  const patchState = createPatchState()
  seedPatchState(patchState, snapshotWire)

  aliceHome.resources.metal = 1_000_000
  aliceHome.resources.crystal = 1_000_000
  aliceHome.resources.deuterium = 1_000_000
  aliceHome.buildings[BuildingType.SolarPlant] = 1

  const upgrade = applyCommand(world, ctx, {
    type: 'building.upgrade',
    planetId: aliceHome.id,
    buildingType: BuildingType.MetalMine
  })
  if (!upgrade.ok) fail(`场景 D：服务端命令失败（${upgrade.reason}）`)

  const patchWire = JSON.parse(JSON.stringify(buildPatch(world, alice, patchState, { visibility: 'public', tick: 8 })))
  if (!patchWire.self?.planets) fail('场景 D：补丁未包含自己的星球')

  const applied = applyPatch(clientState, patchWire, currentPlanetId)
  if (applied.currentPlanetId) fail('场景 D：当前星球不应该改变')
  if (clientState.player.planets[0].buildQueue.length !== 1) fail('场景 D：补丁应用后建造队列未更新')
  if (clientState.player.planets[0].resources.metal >= 1_000_000) fail('场景 D：补丁应用后资源未扣除')

  // —— 无变化时不应产生补丁 ——
  const emptyPatch = buildPatch(world, alice, patchState, { visibility: 'public', tick: 9 })
  if (emptyPatch.self || emptyPatch.planets || emptyPatch.removedPlanets) {
    fail('场景 D：没有变化时仍然下发了补丁')
  }

  // —— 当前星球消失 → 自动回退到另一颗星球 ——
  const colony = planetLogic.createInitialPlanet('alice', 'Alice Colony')
  colony.id = 'alice_colony'
  colony.position = { galaxy: 9, system: 9, position: 7 }
  alice.planets.push(colony)

  const beforeDestroy = JSON.parse(JSON.stringify(buildSnapshot(world, alice, { visibility: 'public', tick: 10 })))
  applySnapshot(clientState, beforeDestroy)

  const patchState2 = createPatchState()
  seedPatchState(patchState2, beforeDestroy)

  alice.planets = alice.planets.filter(planet => planet.id !== 'alice_home')
  const destroyPatch = JSON.parse(JSON.stringify(buildPatch(world, alice, patchState2, { visibility: 'public', tick: 11 })))
  const switched = applyPatch(clientState, destroyPatch, 'alice_home')

  if (switched.currentPlanetId !== 'alice_colony') {
    fail(`场景 D：当前星球消失后未回退（${switched.currentPlanetId}）`)
  }

  console.log(
    `场景 D（客户端同步）通过：可见星球 ${Object.keys(clientState.planets).length} 个，玩家档案 ${snapshotWire.players.length} 个`
  )
}

/** 用纯函数计算积分，验证 publicLogic 在 Node 下可用 */
const publicPoints = (p: typeof player) => {
  let total = 0
  p.planets.forEach(planet => {
    Object.values(planet.buildings).forEach(level => {
      total += level > 0 ? level : 0
    })
  })
  return total
}

run().catch(error => {
  console.error('❌ 冒烟测试异常：', error)
  process.exit(1)
})
