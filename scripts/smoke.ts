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
import { generateNpcPlanets } from '@/core/generate'
import { tick, tickNpcPhase } from '@/core/engine'
import { createEngineContext } from '@/core/types'
import type { EngineEvent } from '@/core/types'
import { applyCommand } from '@/core/commands'
import { buildPatch, buildSnapshot, createPatchState, seedPatchState } from '@/core/protocol'
import { applyPatch, applySnapshot } from '@/net/apply'
import { ensureNpcRegistry, updateNpcBehavior, updateNpcGrowth } from '@/core/npc'
import { selectNPCBehaviorTarget } from '@/logic/npcBehaviorLogic'
import * as gameLogic from '@/logic/gameLogic'
import * as planetLogic from '@/logic/planetLogic'
import * as fleetLogic from '@/logic/fleetLogic'
import * as buildingLogic from '@/logic/buildingLogic'
import * as waitingQueueLogic from '@/logic/waitingQueueLogic'
import type {
  Resources,
  FleetMission,
  Planet,
  NPC,
  DebrisField,
  SpiedNotification,
  GiftNotification,
  TradeOffer,
  JointAttackInvite
} from '@/types/game'
import { BuildingType, DefenseType, MissionType, NPCAIType, OfficerType, ShipType } from '@/types/game'

const t = (key: string) => key
let eventCount = 0
const ctx = createEngineContext({ t, emit: () => (eventCount += 1) })

const player = gameLogic.initializePlayer('player1', 'Tester')
const home = planetLogic.createInitialPlanet(player.id, 'Home')
player.planets = [home]

const world = createWorld({
  player,
  planets: {},
  npcs: [],
  debrisFields: {},
  locale: 'zh-CN',
  gameSpeed: 1,
  battleToFinish: true
})

generateNpcPlanets(world, 'Planet', 200)

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

  // 直接攻击一个 NPC 星球，验证 Node 环境下战斗执行器（直算）可用
  const target = Object.values(world.planets).find(p => !!p.ownerId && p.ownerId !== player.id)
  if (!target) fail('未找到可攻击的 NPC 星球')

  const mission: FleetMission = {
    id: 'smoke-mission-1',
    playerId: player.id,
    originPlanetId: home.id,
    targetPosition: { ...target!.position },
    targetPlanetId: target!.id,
    missionType: MissionType.Attack,
    fleet: { lightFighter: 50, cruiser: 10 },
    cargo: { ...emptyCargo },
    departureTime: Date.now(),
    arrivalTime: Date.now(),
    status: 'outbound'
  }

  const attackResult = await fleetLogic.processAttackArrival(mission, target!, player, null, player.planets, true)
  if (!attackResult) fail('战斗结算返回空（processAttackArrival 失败）')
  const rounds = attackResult!.battleResult.rounds ?? 0
  console.log(`战斗结算成功：回合=${rounds}，胜者=${attackResult!.battleResult.winner}`)
  assertFinite('战报掠夺金属', attackResult!.battleResult.plunder.metal)
  assertFinite('战报残骸金属', attackResult!.battleResult.debrisField.metal)

  // 玩家积分需要 >= 1000 才会脱离 NPC 新手保护，否则 NPC 不会侦查/攻击
  player.points = 5000

  // 先跑一个 tick 让 NPC 注册表建立
  let now = Date.now()
  await tick(world, ctx, now, 5)
  if (world.npcs.length === 0) fail('首个 tick 后 NPC 注册表仍未建立')

  // 强制若干 NPC 进入敌对状态并具备侦查/攻击能力，确定性验证行为链路
  const hostileTargets = world.npcs.slice(0, 5)
  hostileTargets.forEach(npc => {
    if (!npc.relations) npc.relations = {}
    npc.relations[player.id] = {
      fromId: npc.id,
      toId: player.id,
      reputation: -80,
      status: 'hostile',
      lastUpdated: now,
      history: []
    }
    npc.lastSpyTime = 0
    npc.lastAttackTime = 0
    npc.fleetMissions = []
    const npcPlanet = npc.planets.find(p => !p.isMoon) ?? npc.planets[0]
    if (npcPlanet) {
      npcPlanet.fleet.espionageProbe = Math.max(npcPlanet.fleet.espionageProbe ?? 0, 10)
      npcPlanet.fleet.lightFighter = Math.max(npcPlanet.fleet.lightFighter ?? 0, 200)
    }
  })

  // 预置一份对玩家母星的侦查报告，让「NPC 主动攻击」这条链路不依赖侦查飞行的随机时序
  {
    const seeded = hostileTargets[0]
    const targetPlanet = player.planets[0]
    if (seeded && targetPlanet) {
      seeded.playerSpyReports = {
        [targetPlanet.id]: {
          id: 'seed-spy-report',
          timestamp: now,
          spyId: seeded.id,
          targetPlanetId: targetPlanet.id,
          targetPlanetName: targetPlanet.name,
          targetPosition: targetPlanet.position,
          targetPlayerId: player.id,
          resources: { ...targetPlanet.resources },
          fleet: { ...targetPlanet.fleet },
          defense: { ...targetPlanet.defense },
          buildings: { ...targetPlanet.buildings },
          technologies: { ...player.technologies },
          detectionChance: 100
        }
      }
    }
  }

  // 快进模拟：每个 tick 代表 5 秒，共 6 小时
  const TICKS = 4320
  const STEP_MS = 5000
  const started = Date.now()

  for (let i = 0; i < TICKS; i++) {
    now += STEP_MS
    await tick(world, ctx, now, STEP_MS / 1000)
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(2)
  console.log(`模拟完成：${TICKS} ticks（${(TICKS * STEP_MS) / 3600000} 小时），耗时 ${elapsed}s，事件 ${eventCount} 个`)

  // 校验
  if (world.npcs.length === 0) fail('NPC 注册表未建立')

  const missionCount = world.npcs.reduce((sum, npc) => sum + (npc.fleetMissions?.length ?? 0), 0)
  const spiedByNpc = player.spiedNotifications?.length ?? 0
  console.log(`NPC 数量：${world.npcs.length}，在途 NPC 任务：${missionCount}，被侦查通知：${spiedByNpc}`)
  if (spiedByNpc === 0) fail('6 小时内没有任何 NPC 侦查玩家，行为系统可能未运行')
  if (player.battleReports.length === 0) fail('6 小时内没有任何 NPC 攻击结算，战斗链路可能未运行')
  console.log(`玩家战报：${player.battleReports.length}（含 NPC 来袭）`)

  assertFinite('玩家金属', home.resources.metal)
  assertFinite('玩家晶体', home.resources.crystal)
  assertFinite('玩家重氢', home.resources.deuterium)
  if (home.resources.metal < 0) fail('玩家金属为负')

  let planetCount = 0
  for (const planet of Object.values(world.planets)) {
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

  // 场景 E：验证 NPC 在多个玩家之间分配注意力
  await runMultiPlayerNpcScenario()

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
    player: gameLogic.initializePlayer('player2', 'ClientTester'),
    planets: {} as Record<string, Planet>,
    npcs: [] as NPC[],
    debrisFields: {} as Record<string, DebrisField>
  })

  const home = planetLogic.createInitialPlanet('player2', 'Home2')
  state.player.planets = [home]

  const world = createWorld({
    player: state.player,
    planets: state.planets,
    npcs: state.npcs,
    debrisFields: state.debrisFields,
    locale: 'zh-CN'
  })

  generateNpcPlanets(world, 'Planet', 50)
  const generated = Object.keys(state.planets).length
  if (generated === 0 || generated > 50) fail(`场景 B：星球未写入响应式 state（${generated} 个）`)

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
  if (world.npcs !== state.npcs) fail('场景 B：world.npcs 引用被切断')

  // 就地修改必须可见
  if (state.npcs.length === 0) fail('场景 B：NPC 注册表未写入响应式数组')
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

  console.log(`场景 B（Pinia 引用语义）通过：NPC ${state.npcs.length} 个，事件 ${events.length} 个，金属矿 Lv${home.buildings.metalMine}`)
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
  const player = gameLogic.initializePlayer('player3', 'CmdTester')
  const home = planetLogic.createInitialPlanet('player3', 'Home3')
  player.planets = [home]

  const world = createWorld({
    player,
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    gameSpeed: 1,
    battleToFinish: true
  })
  generateNpcPlanets(world, 'Planet', 20)

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
  const foreignPlanet = Object.values(world.planets).find(planet => !!planet.ownerId)
  if (foreignPlanet) {
    const foreign = applyCommand(world, ctx, {
      type: 'building.upgrade',
      planetId: foreignPlanet.id,
      buildingType: BuildingType.MetalMine
    })
    if (foreign.ok) fail('场景 C：竟然能操作他人星球')
  }

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
  const firstSpied: SpiedNotification = {
    id: 'smoke-spied-1',
    timestamp: messageTime,
    npcId: 'npc_smoke',
    npcName: 'Smoke NPC',
    targetPlanetId: home.id,
    targetPlanetName: home.name,
    detectionSuccess: true,
    read: false
  }
  const secondSpied: SpiedNotification = {
    ...firstSpied,
    id: 'smoke-spied-2',
    timestamp: messageTime + 1
  }
  player.spiedNotifications = [firstSpied, secondSpied]

  const markRead = applyCommand(world, ctx, {
    type: 'messages.markRead',
    collections: ['spiedNotifications'],
    id: firstSpied.id
  })
  if (!markRead.ok || !firstSpied.read) fail('场景 C：消息已读命令未生效')
  if (secondSpied.read) fail('场景 C：消息已读命令误改了其他通知')

  const deleted = applyCommand(world, ctx, {
    type: 'messages.delete',
    collection: 'spiedNotifications',
    id: secondSpied.id
  })
  if (!deleted.ok || player.spiedNotifications.length !== 1) fail('场景 C：消息删除命令未生效')

  const cleared = applyCommand(world, ctx, {
    type: 'messages.clear',
    collections: ['spiedNotifications']
  })
  if (!cleared.ok || player.spiedNotifications.length !== 0) fail('场景 C：消息清空命令未生效')

  // 4.4) 外交通知的接受/拒绝必须走命令层，并真正修改服务端状态
  ensureNpcRegistry(world, ctx)
  const npc = world.npcs[0]
  if (!npc) fail('场景 C：没有可用于外交测试的 NPC')
  if (!npc.relations) npc.relations = {}
  if (!npc.relations[player.id]) {
    npc.relations[player.id] = {
      fromId: npc.id,
      toId: player.id,
      reputation: 0,
      status: 'neutral',
      lastUpdated: messageTime,
      history: []
    }
  }

  const gift: GiftNotification = {
    id: 'smoke-gift-1',
    timestamp: messageTime,
    fromNpcId: npc.id,
    fromNpcName: npc.name,
    resources: { metal: 100, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 },
    currentReputation: npc.relations[player.id].reputation,
    expectedReputationGain: 5,
    expiresAt: messageTime + 60_000,
    read: false
  }
  home.resources = { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 }
  player.giftNotifications = [gift]
  const acceptedGift = applyCommand(world, ctx, {
    type: 'diplomacy.respond',
    kind: 'gift',
    action: 'accept',
    id: gift.id
  })
  if (!acceptedGift.ok || player.giftNotifications.length !== 0) fail('场景 C：接受礼物命令未移除通知')
  if (home.resources.metal !== 100) fail('场景 C：接受礼物命令未发放资源')

  const npcPlanet = npc.planets[0]
  if (!npcPlanet) fail('场景 C：NPC 没有星球')
  npcPlanet.resources = { metal: 10_000, crystal: 10_000, deuterium: 10_000, darkMatter: 0, energy: 0 }
  home.resources = { metal: 1_000, crystal: 1_000, deuterium: 1_000, darkMatter: 0, energy: 0 }
  const offer: TradeOffer = {
    id: 'smoke-trade-1',
    npcId: npc.id,
    npcName: npc.name,
    timestamp: messageTime,
    offeredResources: { type: 'metal', amount: 500 },
    requestedResources: { type: 'crystal', amount: 200 },
    expiresAt: messageTime + 60_000,
    status: 'pending',
    read: false
  }
  player.tradeOffers = [offer]
  const acceptedTrade = applyCommand(world, ctx, {
    type: 'diplomacy.respond',
    kind: 'trade',
    action: 'accept',
    id: offer.id
  })
  if (!acceptedTrade.ok || player.tradeOffers.length !== 0) fail('场景 C：接受贸易命令未移除提议')
  if (home.resources.metal !== 1_500 || home.resources.crystal !== 800) fail('场景 C：接受贸易命令资源结算错误')

  const invite: JointAttackInvite = {
    id: 'smoke-joint-1',
    fromNpcId: npc.id,
    fromNpcName: npc.name,
    timestamp: messageTime,
    targetNpcId: 'npc_target',
    targetNpcName: 'Target NPC',
    targetPlanetId: 'planet_target',
    targetPosition: { galaxy: 1, system: 1, position: 1 },
    npcFleetCommitment: { lightFighter: 1 },
    expectedLootRatio: 0.5,
    expiresAt: messageTime + 60_000,
    status: 'pending',
    read: false
  }
  const reputationBefore = npc.relations[player.id].reputation
  player.jointAttackInvites = [invite]
  const acceptedJoint = applyCommand(world, ctx, {
    type: 'diplomacy.respond',
    kind: 'jointAttack',
    action: 'accept',
    id: invite.id
  })
  if (!acceptedJoint.ok || player.jointAttackInvites.length !== 0) fail('场景 C：接受联合攻击命令未移除邀请')
  if (npc.relations[player.id].reputation !== Math.min(100, reputationBefore + 15)) {
    fail('场景 C：接受联合攻击命令未提升好感度')
  }

  // 4.5) 战役对话的声望/分支也必须走命令层
  const reputationBeforeChoice = npc.relations[player.id].reputation
  const choiceResult = applyCommand(world, ctx, {
    type: 'campaign.choice',
    effect: 'reputation_up',
    npcId: npc.id
  })
  if (!choiceResult.ok) fail(`场景 C：战役声望选项失败（${choiceResult.reason}）`)
  if (npc.relations[player.id].reputation !== Math.min(100, reputationBeforeChoice + 10)) {
    fail('场景 C：战役声望选项数值不正确')
  }

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
  const target = Object.values(world.planets).find(planet => planet.ownerId && planet.ownerId !== player.id)
  if (!target) fail('场景 C：未找到可攻击的 NPC 星球')

  const sent = applyCommand(world, ctx, {
    type: 'fleet.send',
    originPlanetId: home.id,
    targetPosition: target!.position,
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
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN'
  })
  generateNpcPlanets(world, 'Planet', 5)

  const ctx = createEngineContext({ t, emit: () => {} })
  ensureNpcRegistry(world, ctx)

  // 客户端本地状态（模拟 Pinia 里的对象引用）
  const clientState = {
    player: gameLogic.initializePlayer('local', 'Local'),
    planets: {} as Record<string, Planet>,
    npcs: [] as NPC[],
    debrisFields: {} as Record<string, DebrisField>
  }

  // —— 全量快照 ——
  const snapshotWire = JSON.parse(JSON.stringify(buildSnapshot(world, alice, { visibility: 'public', tick: 7 })))
  const { currentPlanetId } = applySnapshot(clientState, snapshotWire)

  if (currentPlanetId !== 'alice_home') fail(`场景 D：快照应用后未选中母星（${currentPlanetId}）`)
  if (clientState.player.id !== 'alice') fail('场景 D：玩家没有切换到服务器玩家')
  if (clientState.npcs.length === 0) fail('场景 D：NPC 列表为空')
  if ((clientState.npcs[0].planets.length ?? 0) === 0) fail('场景 D：NPC 未携带公开星球视图')

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

  console.log(`场景 D（客户端同步）通过：可见星球 ${Object.keys(clientState.planets).length} 个，NPC ${clientState.npcs.length} 个`)
}

/**
 * 场景 E：NPC 多玩家化
 *
 * 验证服务端多人时 NPC 不会只盯着一个玩家：
 * - 敌对优先：NPC 只对 B 敌对时，即使 A 更近也会选 B；
 * - 距离兜底：双方都是中立时选最近的玩家；
 * - 行为落地：两端玩家都能收到 NPC 的侦查通知。
 */
const runMultiPlayerNpcScenario = async () => {
  const alice = gameLogic.initializePlayer('npc_test_alice', 'Alice')
  const bob = gameLogic.initializePlayer('npc_test_bob', 'Bob')

  const aliceHome = planetLogic.createInitialPlanet(alice.id, 'Alice Home')
  aliceHome.id = 'alice_home_npc'
  aliceHome.position = { galaxy: 1, system: 1, position: 1 }
  alice.planets = [aliceHome]

  const bobHome = planetLogic.createInitialPlanet(bob.id, 'Bob Home')
  bobHome.id = 'bob_home_npc'
  bobHome.position = { galaxy: 9, system: 9, position: 9 }
  bob.planets = [bobHome]

  // 双方都要脱离新手保护，否则 NPC 不会侦查/攻击
  alice.points = 5000
  bob.points = 5000

  const world = createWorld({
    player: alice,
    players: [alice, bob],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN'
  })

  // 4 个 NPC 靠近 Alice，4 个靠近 Bob
  let index = 0
  for (let i = 0; i < 4; i++) {
    const planet = planetLogic.createNPCPlanet(index++, { galaxy: 1, system: 1, position: 2 + i }, 'Planet')
    world.planets[`${planet.position.galaxy}:${planet.position.system}:${planet.position.position}`] = planet
  }
  for (let i = 0; i < 4; i++) {
    const planet = planetLogic.createNPCPlanet(index++, { galaxy: 9, system: 9, position: 5 + i }, 'Planet')
    world.planets[`${planet.position.galaxy}:${planet.position.system}:${planet.position.position}`] = planet
  }

  const ctx = createEngineContext({ t, emit: () => {} })
  ensureNpcRegistry(world, ctx)
  if (world.npcs.length !== 8) fail(`场景 E：NPC 注册表数量异常（${world.npcs.length}）`)

  // 全部设为侵略型、与双方敌对、冷却清零
  world.npcs.forEach(npc => {
    npc.aiType = NPCAIType.Aggressive
    npc.relations = npc.relations ?? {}
    for (const player of [alice, bob]) {
      npc.relations[player.id] = {
        fromId: npc.id,
        toId: player.id,
        reputation: -80,
        status: 'hostile' as const,
        lastUpdated: Date.now(),
        history: []
      }
    }
    npc.lastSpyTime = 0
    npc.lastAttackTime = 0
  })

  // —— 目标选择：敌对优先 + 距离兜底 ——
  const aliceSideNpc = world.npcs.find(npc => npc.planets[0]?.position.galaxy === 1) ?? fail('场景 E：没找到靠近 Alice 的 NPC')

  aliceSideNpc.relations![alice.id]!.status = 'neutral'
  aliceSideNpc.relations![bob.id]!.status = 'hostile'
  const hostileChoice = selectNPCBehaviorTarget(aliceSideNpc, [alice, bob])
  if (hostileChoice?.id !== bob.id) {
    fail(`场景 E：敌对优先失效（选中 ${hostileChoice?.id}）`)
  }

  aliceSideNpc.relations![alice.id]!.status = 'neutral'
  aliceSideNpc.relations![bob.id]!.status = 'neutral'
  const nearestChoice = selectNPCBehaviorTarget(aliceSideNpc, [alice, bob])
  if (nearestChoice?.id !== alice.id) {
    fail(`场景 E：距离兜底失效（选中 ${nearestChoice?.id}）`)
  }

  // 恢复双方敌对，驱动真实行为
  world.npcs.forEach(npc => {
    npc.relations![alice.id]!.status = 'hostile'
    npc.relations![bob.id]!.status = 'hostile'
    npc.lastSpyTime = 0
  })

  // 先跑一次成长，确保 NPC 有间谍探测器等基础配置
  updateNpcGrowth(world, ctx, 5)

  // 多轮行为决策：生成侦查/攻击任务
  for (let i = 0; i < 8; i++) {
    updateNpcBehavior(world, ctx, 5)
  }

  const generated = world.npcs.reduce((sum, npc) => sum + (npc.fleetMissions?.length ?? 0), 0)
  if (generated === 0) fail('场景 E：NPC 没有产生任何舰队任务')

  // 再推进一次时间，让任务到达并产生通知
  await tickNpcPhase(world, ctx, Date.now() + 3_600_000, 5)

  const aliceSpied = alice.spiedNotifications?.length ?? 0
  const bobSpied = bob.spiedNotifications?.length ?? 0

  if (aliceSpied === 0) fail('场景 E：Alice 没有收到任何 NPC 侦查（NPC 注意力分配失败）')
  if (bobSpied === 0) fail('场景 E：Bob 没有收到任何 NPC 侦查（NPC 只盯着一个玩家）')

  console.log(`场景 E（NPC 多玩家）通过：Alice 被侦查 ${aliceSpied} 次，Bob 被侦查 ${bobSpied} 次`)
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