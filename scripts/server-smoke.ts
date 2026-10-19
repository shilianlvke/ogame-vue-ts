/**
 * 服务端冒烟测试
 *
 * 在同一个进程里拉起服务器，用真实 WebSocket 客户端验证：
 * 1. /health 与 /api/info 可用
 * 2. 两个玩家能登录、拿到快照、互相看见（且看不到对方的敏感数据）
 * 3. 命令经服务端校验后生效，并回推增量补丁
 * 4. 服务端 tick 会推进资源产出
 * 5. 存档落盘 + 重启后玩家与令牌仍然有效
 *
 * 运行：pnpm smoke:server
 */
// 必须先于其它 import：为客户端 store 补 localStorage/location
import './node-shims'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import WebSocket from 'ws'
import { createPinia, setActivePinia } from 'pinia'
import type { ClientMessage, ServerMessage, WorldSnapshot } from '@/core/protocol'
import { PROTOCOL_VERSION } from '@/core/protocol'
import { dispatchCommand } from '@/core/runtime'
import { PHALANX_SCAN_COST } from '@/core/commands'
import { useGameStore } from '@/stores/gameStore'
import { useUniverseStore } from '@/stores/universeStore'
import { useNPCStore } from '@/stores/npcStore'
import { useNetStore } from '@/stores/netStore'
import { BuildingType, DefenseType, MissionType, ShipType, TechnologyType } from '@/types/game'
import { startServer } from '../server/app'
import type { RunningServer } from '../server/app'
import type { Room } from '../server/room'

const fail = (message: string): never => {
  console.error(`❌ ${message}`)
  process.exit(1)
}

const assert = (condition: unknown, message: string): void => {
  if (!condition) fail(message)
}

/** 简单 WebSocket 测试客户端：按需等待特定消息 */
class TestClient {
  readonly ws: WebSocket
  /** 连接被关闭时解析（用于验证「顶号」行为） */
  readonly closed: Promise<{ code: number; reason: string }>
  private readonly buffered: ServerMessage[] = []
  private readonly waiters: Array<{ predicate: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }> = []

  constructor(url: string) {
    this.ws = new WebSocket(url)
    this.closed = new Promise(resolve => {
      this.ws.on('close', (code: number, reason: Buffer) => resolve({ code, reason: reason.toString() }))
    })
    this.ws.on('message', data => {
      const message = JSON.parse(data.toString()) as ServerMessage
      const index = this.waiters.findIndex(waiter => waiter.predicate(message))
      if (index >= 0) {
        const [waiter] = this.waiters.splice(index, 1)
        waiter.resolve(message)
      } else {
        this.buffered.push(message)
      }
    })
  }

  ready(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return Promise.resolve()
    return new Promise((resolveReady, rejectReady) => {
      this.ws.once('open', () => resolveReady())
      this.ws.once('error', rejectReady)
    })
  }

  send(message: ClientMessage): void {
    this.ws.send(JSON.stringify(message))
  }

  /** 等待满足条件的消息（先查已缓冲的消息） */
  next(predicate: (m: ServerMessage) => boolean, timeoutMs = 5000, label = 'message'): Promise<ServerMessage> {
    const index = this.buffered.findIndex(predicate)
    if (index >= 0) {
      const [message] = this.buffered.splice(index, 1)
      return Promise.resolve(message)
    }
    return new Promise((resolveNext, rejectNext) => {
      const timer = setTimeout(() => {
        const at = this.waiters.findIndex(waiter => waiter.resolve === wrappedResolve)
        if (at >= 0) this.waiters.splice(at, 1)
        rejectNext(new Error(`等待 ${label} 超时`))
      }, timeoutMs)

      const wrappedResolve = (message: ServerMessage): void => {
        clearTimeout(timer)
        resolveNext(message)
      }

      this.waiters.push({ predicate, resolve: wrappedResolve })
    })
  }

  close(): void {
    this.ws.close()
  }
}

const DEFAULT_PASSWORD = 'test-pass-1234'

const connectAndJoin = async (
  port: number,
  name: string,
  token?: string,
  protocolVersion: number = PROTOCOL_VERSION,
  locale?: 'zh-CN' | 'en',
  password?: string
): Promise<{ client: TestClient; playerId: string; token: string; snapshot: WorldSnapshot }> => {
  const client = new TestClient(`ws://127.0.0.1:${port}/ws`)
  await client.ready()
  client.send({
    t: 'hello',
    protocolVersion,
    name,
    // 有令牌时默认不带密码；显式传入密码时总是带上（用于「令牌与昵称不匹配」场景）
    password: password ?? (token ? undefined : DEFAULT_PASSWORD),
    token,
    locale
  })
  const welcome = (await client.next(m => m.t === 'welcome', 5000, `${name} 的 welcome`)) as Extract<
    ServerMessage,
    { t: 'welcome' }
  >
  return { client, playerId: welcome.playerId, token: welcome.token, snapshot: welcome.snapshot }
}

const main = async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ogame-server-'))
  const staticDir = resolve('docs')
  let carolId = ''

  let server: RunningServer = await startServer({
    port: 0,
    host: '127.0.0.1',
    staticDir,
    dataDir,
    visibility: 'public',
    npcCount: 40,
    tickMs: 3_600_000, // 测试中手动推进 tick
    autosaveMs: 3_600_000
  })

  const base = `http://127.0.0.1:${server.port}`

  // 1) 运维接口
  const health = (await (await fetch(`${base}/health`)).json()) as { ok: boolean; npcs: number }
  assert(health.ok === true, '/health 未返回 ok')
  const info = (await (await fetch(`${base}/api/info`)).json()) as { protocolVersion: number; visibility: string }
  assert(info.protocolVersion === PROTOCOL_VERSION, '/api/info 协议版本不正确')
  assert(info.visibility === 'public', '/api/info 可见性模式不正确')

  // 2) 协议版本不匹配必须被拒绝
  {
    const client = new TestClient(`ws://127.0.0.1:${server.port}/ws`)
    await client.ready()
    client.send({ t: 'hello', protocolVersion: 999, name: 'Mismatch' })
    const error = (await client.next(m => m.t === 'error', 3000, '协议不匹配错误')) as Extract<ServerMessage, { t: 'error' }>
    assert(error.message.includes('protocol'), '协议不匹配未返回 protocol 错误')
    client.close()
  }

  // 3) 两个玩家登录（Bob 使用英文，顺带验证服务端按玩家语言生成名称）
  const alice = await connectAndJoin(server.port, 'Alice')
  const bob = await connectAndJoin(server.port, 'Bob', undefined, PROTOCOL_VERSION, 'en')
  assert(alice.snapshot.self.planets.length === 1, '玩家没有初始母星')
  assert(alice.snapshot.self.planets[0].ownerId === alice.playerId, '母星归属错误')
  assert(bob.snapshot.self.planets[0].position !== alice.snapshot.self.planets[0].position, '两个玩家母星坐标冲突')
  assert(alice.snapshot.self.planets[0].name !== 'planet.homePlanet', '中文母星名称未翻译')
  assert(bob.snapshot.self.planets[0].name !== 'planet.homePlanet', '英文母星名称未翻译')
  assert(alice.snapshot.self.planets[0].name !== bob.snapshot.self.planets[0].name, '不同语言的母星名称相同（语言未生效）')
  // Bob 上线后，Alice 必须立刻收到在线状态补丁
  await alice.client.next(
    m => m.t === 'patch' && !!m.players?.some(player => player.id === bob.playerId && player.online === true),
    5000,
    '玩家上线补丁'
  )
  console.log('[players] 玩家上线实时推送正常')
  assert(alice.snapshot.npcs.length > 0, '快照中没有 NPC')
  const npcSample = alice.snapshot.npcs.find(npc => npc.planets.length > 0)
  assert(!!npcSample, 'NPC 未携带公开星球视图')
  assert((npcSample!.planets[0].resources.metal ?? -1) === 0, 'NPC 星球公开视图泄露了资源')
  assert(Object.keys(npcSample!.planets[0].fleet).length === 0, 'NPC 星球公开视图泄露了舰队')

  // 3.5) 账号体系：密码注册 / 密码错误 / 无密码 / 换设备登录
  {
    const carol = await connectAndJoin(server.port, 'Carol', undefined, PROTOCOL_VERSION, undefined, 'carol-pass-1234')
    carolId = carol.playerId

    // 密码错误
    const wrong = new TestClient(`ws://127.0.0.1:${server.port}/ws`)
    await wrong.ready()
    wrong.send({ t: 'hello', protocolVersion: PROTOCOL_VERSION, name: 'Carol', password: 'bad-password' })
    const wrongError = (await wrong.next(m => m.t === 'error', 3000, '密码错误')) as Extract<ServerMessage, { t: 'error' }>
    assert(wrongError.message === 'auth:wrong_password', `密码错误提示不正确：${wrongError.message}`)
    wrong.close()

    // 无密码登录已有账号
    const noPassword = new TestClient(`ws://127.0.0.1:${server.port}/ws`)
    await noPassword.ready()
    noPassword.send({ t: 'hello', protocolVersion: PROTOCOL_VERSION, name: 'Carol' })
    const noPasswordError = (await noPassword.next(m => m.t === 'error', 3000, '缺少密码')) as Extract<
      ServerMessage,
      { t: 'error' }
    >
    assert(noPasswordError.message === 'auth:password_required', '缺少密码没有被拒绝')
    noPassword.close()

    // 换设备登录：用密码回到同一个玩家
    const reLogin = await connectAndJoin(server.port, 'Carol', undefined, PROTOCOL_VERSION, undefined, 'carol-pass-1234')
    assert(reLogin.playerId === carol.playerId, '密码登录没有回到同一个玩家')
    assert(reLogin.token !== carol.token, '密码登录应续发新令牌')

    reLogin.client.close()
    carol.client.close()
    await new Promise(resolveSleep => setTimeout(resolveSleep, 50))
    console.log('[auth] 密码注册 / 错误密码 / 缺少密码 / 换设备登录 全部正常')
  }

  // 在线状态：服务端会话列表必须同步到所有玩家档案
  {
    const onlineIds = server.room.onlinePlayerIds()
    assert(onlineIds.includes(alice.playerId) && onlineIds.includes(bob.playerId), '在线会话列表缺少玩家')
    const profiles = server.room.snapshotFor(alice.playerId)!.players
    const onlineSet = new Set(onlineIds)
    assert(profiles.length >= 3, '玩家档案数量不足')
    assert(
      profiles.every(profile => profile.online === onlineSet.has(profile.id)),
      '玩家档案的在线状态与会话列表不一致'
    )
    console.log('[players] 在线状态快照与会话列表一致')
  }

  // Bob 的初始快照里已经能看到 Alice 的星球
  const aliceHomeKey = Object.keys(bob.snapshot.planets).find(key => bob.snapshot.planets[key].ownerId === alice.playerId)
  assert(!!aliceHomeKey, 'Bob 看不到 Alice 的星球')

  // —— 可见性：别人家的资源/舰队必须是空的 ——
  const visibleAlice = bob.snapshot.planets[aliceHomeKey!]
  assert(visibleAlice.resources.metal === 0, '公开视图泄露了他人资源')
  assert(Object.keys(visibleAlice.fleet).length === 0, '公开视图泄露了他人舰队')
  assert(visibleAlice.name.length > 0 && visibleAlice.position.galaxy > 0, '公开视图缺少基础信息')

  // 4) 命令校验：资源不足时被拒绝
  alice.client.send({ t: 'cmd', seq: 1, command: { type: 'building.upgrade', planetId: alice.snapshot.self.planets[0].id, buildingType: BuildingType.MetalMine } })
  const rejected = (await alice.client.next(m => m.t === 'reject', 5000, '拒绝消息')) as Extract<ServerMessage, { t: 'reject' }>
  assert(rejected.seq === 1, '拒绝消息 seq 不匹配')
  assert(!!rejected.reason, '拒绝消息缺少原因')

  // 5) 给 Alice 资源与前置建筑后，命令成功并下发补丁
  const alicePlayer = server.room.profileOf(alice.playerId)!
  const aliceHome = alicePlayer.planets[0]
  aliceHome.resources.metal = 1_000_000
  aliceHome.resources.crystal = 1_000_000
  aliceHome.resources.deuterium = 1_000_000
  aliceHome.buildings[BuildingType.SolarPlant] = 1

  alice.client.send({ t: 'cmd', seq: 2, command: { type: 'building.upgrade', planetId: aliceHome.id, buildingType: BuildingType.MetalMine } })
  const ack = (await alice.client.next(m => m.t === 'ack', 5000, 'ack')) as Extract<ServerMessage, { t: 'ack' }>
  assert(ack.seq === 2, 'ack seq 不匹配')

  const buildPatch = (await alice.client.next(m => m.t === 'patch' && !!m.self?.planets, 5000, '建筑补丁')) as Extract<
    ServerMessage,
    { t: 'patch' }
  >
  const aliceHomeInPatch = buildPatch.self?.planets?.find(planet => planet.id === aliceHome.id)
  assert(!!aliceHomeInPatch, '补丁中没有自己的母星')
  assert((aliceHomeInPatch!.buildQueue.length ?? 0) === 1, '补丁中没有建造队列项')
  assert((aliceHomeInPatch!.resources.metal ?? Number.MAX_SAFE_INTEGER) < 1_000_000, '补丁中资源没有扣除')
  assert(server.room.profileOf(alice.playerId)!.planets[0].buildQueue.length === 1, '服务端状态未入队')

  // 5.1) 等待队列命令：服务端必须真正写入，并通过补丁同步，不能被下一份补丁覆盖
  aliceHome.buildings[BuildingType.Shipyard] = 1
  alicePlayer.technologies[TechnologyType.CombustionDrive] = 1
  aliceHome.resources = { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 }

  alice.client.send({
    t: 'cmd',
    seq: 3,
    command: {
      type: 'queue.addWaiting',
      kind: 'ship',
      planetId: aliceHome.id,
      itemType: ShipType.LightFighter,
      quantity: 1
    }
  })
  await alice.client.next(m => m.t === 'ack' && m.seq === 3, 5000, '舰船等待队列 ack')
  const shipWaitingPatch = (await alice.client.next(
    m => m.t === 'patch' && !!m.self?.planets?.some(planet => planet.id === aliceHome.id && (planet.waitingBuildQueue?.length ?? 0) > 0),
    5000,
    '舰船等待队列补丁'
  )) as Extract<ServerMessage, { t: 'patch' }>
  const shipWaitingPlanet = shipWaitingPatch.self!.planets!.find(planet => planet.id === aliceHome.id)!
  assert(shipWaitingPlanet.waitingBuildQueue.some(item => item.type === 'ship' && item.quantity === 1), '补丁中没有舰船等待队列项')
  assert(aliceHome.waitingBuildQueue.length === 1, '服务端没有保存舰船等待队列项')

  alice.client.send({
    t: 'cmd',
    seq: 4,
    command: {
      type: 'queue.addWaiting',
      kind: 'defense',
      planetId: aliceHome.id,
      itemType: DefenseType.RocketLauncher,
      quantity: 1
    }
  })
  await alice.client.next(m => m.t === 'ack' && m.seq === 4, 5000, '防御等待队列 ack')
  const defenseWaitingPatch = (await alice.client.next(
    m => m.t === 'patch' && !!m.self?.planets?.some(planet => planet.id === aliceHome.id && (planet.waitingBuildQueue?.length ?? 0) > 1),
    5000,
    '防御等待队列补丁'
  )) as Extract<ServerMessage, { t: 'patch' }>
  const defenseWaitingPlanet = defenseWaitingPatch.self!.planets!.find(planet => planet.id === aliceHome.id)!
  assert(defenseWaitingPlanet.waitingBuildQueue.some(item => item.type === 'defense' && item.quantity === 1), '补丁中没有防御等待队列项')
  assert(aliceHome.waitingBuildQueue.length === 2, '服务端没有保存防御等待队列项')

  // 清理等待项，避免影响后续 tick 场景
  aliceHome.waitingBuildQueue.splice(0, aliceHome.waitingBuildQueue.length)

  // Bob 收到的是 Alice 星球的公开视图变化（公开字段变了才推送）
  const aliceHomeRef = server.room.profileOf(alice.playerId)!.planets[0]
  aliceHomeRef.name = 'Alice Prime'
  await server.room.tickOnce(Date.now() + 1000)
  const bobPatch = (await bob.client.next(
    m => m.t === 'patch' && !!m.planets && Object.values(m.planets).some(planet => planet.name === 'Alice Prime'),
    5000,
    'Bob 的补丁'
  )) as Extract<ServerMessage, { t: 'patch' }>
  const bobSeesAlice = Object.values(bobPatch.planets ?? {}).find(p => p.ownerId === alice.playerId)
  assert(!!bobSeesAlice, 'Bob 的补丁没有包含 Alice 的星球变化')
  assert(bobSeesAlice?.name === 'Alice Prime', 'Bob 没看到星球改名')
  assert((bobSeesAlice?.buildQueue.length ?? -1) === 0, '公开补丁泄露了他人建造队列')
  assert((bobSeesAlice?.resources.metal ?? -1) === 0, '公开补丁泄露了他人资源')

  // 6) 服务端 tick 会推进资源产出（先把矿场建成，并把资源清空避免被仓储上限截断）
  aliceHome.buildQueue.splice(0, aliceHome.buildQueue.length)
  aliceHome.buildings[BuildingType.MetalMine] = 1
  aliceHome.resources.metal = 0
  const metalBefore = aliceHome.resources.metal
  let simNow = Date.now() + 10_000
  for (let i = 0; i < 3; i++) {
    simNow += 1000
    await server.room.tickOnce(simNow)
  }
  assert(aliceHome.resources.metal > metalBefore, 'tick 后资源没有增长')
  assert(server.room.tickCount >= 3, 'tick 计数未增加')

  // 7.0) 新手保护：保护期内不能攻击其他玩家
  {
    const alicePlayer = server.room.profileOf(alice.playerId)!
    const bobPlayer = server.room.profileOf(bob.playerId)!
    assert((alicePlayer.protectionUntil ?? 0) > Date.now(), '新账号没有设置保护期')

    alicePlayer.planets[0].fleet.lightFighter = 10
    alicePlayer.planets[0].resources.deuterium = 1_000_000

    alice.client.send({
      t: 'cmd',
      seq: 19,
      command: {
        type: 'fleet.send',
        originPlanetId: alicePlayer.planets[0].id,
        targetPosition: { ...bobPlayer.planets[0].position },
        missionType: MissionType.Attack,
        fleet: { lightFighter: 10 }
      }
    })

    const protectedReject = (await alice.client.next(
      m => m.t === 'reject' && m.seq === 19,
      5000,
      '保护期拒绝'
    )) as Extract<ServerMessage, { t: 'reject' }>
    assert(protectedReject.reason === 'errors.targetProtected', `保护期拒绝原因不正确：${protectedReject.reason}`)

    // 解除保护，供后续 PvP 测试使用
    alicePlayer.protectionUntil = 0
    bobPlayer.protectionUntil = 0
    console.log('[auth] 新手保护生效，拒绝跨玩家攻击')
  }

  // 7.5) PvP：Alice 攻击 Bob —— 双方都要收到战报，防守方还要有来袭警报
  {
    const alicePlayer = server.room.profileOf(alice.playerId)!
    const bobPlayer = server.room.profileOf(bob.playerId)!
    const aliceOrigin = alicePlayer.planets[0]
    const bobHomePlanet = bobPlayer.planets[0]

    aliceOrigin.fleet.lightFighter = 60
    aliceOrigin.resources.deuterium = 1_000_000

    const bobReportsBefore = bobPlayer.battleReports.length
    const aliceReportsBefore = alicePlayer.battleReports.length
    const bobAlertsBefore = bobPlayer.incomingFleetAlerts?.length ?? 0

    alice.client.send({
      t: 'cmd',
      seq: 20,
      command: {
        type: 'fleet.send',
        originPlanetId: aliceOrigin.id,
        targetPosition: { ...bobHomePlanet.position },
        missionType: MissionType.Attack,
        fleet: { lightFighter: 60 }
      }
    })

    const pvpAck = (await alice.client.next(m => m.t === 'ack' && m.seq === 20, 5000, 'PvP 派遣 ack')) as Extract<
      ServerMessage,
      { t: 'ack' }
    >
    assert(!!pvpAck, 'PvP 派遣没有被接受')

    // 防守方立刻收到来袭警报
    assert(
      (bobPlayer.incomingFleetAlerts?.length ?? 0) === bobAlertsBefore + 1,
      '防守方没有收到 PvP 来袭警报'
    )

    const pvpMission = alicePlayer.fleetMissions.find(mission => mission.missionType === MissionType.Attack)
    assert(!!pvpMission, 'PvP 攻击任务未创建')

    // 推进到舰队到达
    await server.room.tickOnce(pvpMission!.arrivalTime + 1000)

    assert(bobPlayer.battleReports.length === bobReportsBefore + 1, '防守方没有收到战报')
    assert(alicePlayer.battleReports.length === aliceReportsBefore + 1, '攻击方没有收到战报')
    assert(
      (bobPlayer.incomingFleetAlerts?.length ?? 0) === bobAlertsBefore,
      '来袭警报没有在结算后清除'
    )

    const defenderReport = bobPlayer.battleReports[bobPlayer.battleReports.length - 1]
    assert(defenderReport.attackerId === alice.playerId, '防守方战报的攻击者不正确')
    assert(defenderReport.defenderId === bob.playerId, '防守方战报的防守者不正确')

    // 防守方通过补丁拿到战报
    const battlePatch = (await bob.client.next(
      m => m.t === 'patch' && Array.isArray(m.reports?.battleReports),
      5000,
      'Bob 的战报补丁'
    )) as Extract<ServerMessage, { t: 'patch' }>
    assert(Array.isArray(battlePatch.reports?.battleReports), '防守方没有收到包含战报的补丁')
    console.log(`[pvp] 战报已双向送达：${defenderReport.attackerId.slice(0, 6)} → ${defenderReport.defenderId.slice(0, 6)}，胜者 ${defenderReport.winner}`)
  }

  // 7.5.1) 消息中心：已读 / 清空必须写服务端，新战报不能把已清除的旧战报带回来
  {
    const bobPlayer = server.room.profileOf(bob.playerId)!
    const report = bobPlayer.battleReports[bobPlayer.battleReports.length - 1]
    assert(!!report, '消息测试缺少战报')

    // 先制造一个未读状态，再通过命令标记已读
    report.read = false
    bob.client.send({
      t: 'cmd',
      seq: 22,
      command: { type: 'messages.markRead', collections: ['battleReports'], id: report.id }
    })
    await bob.client.next(m => m.t === 'ack' && m.seq === 22, 5000, '消息已读 ack')
    await bob.client.next(
      m =>
        m.t === 'patch' &&
        Array.isArray(m.reports?.battleReports) &&
        (m.reports!.battleReports as Array<{ id: string; read?: boolean }>).some(
          item => item.id === report.id && item.read === true
        ),
      5000,
      '消息已读补丁'
    )
    assert((report as { read?: boolean }).read === true, '服务端没有保存消息已读状态')

    // 清空战报：服务端数组与客户端补丁都必须为空
    bob.client.send({
      t: 'cmd',
      seq: 23,
      command: { type: 'messages.clear', collections: ['battleReports'] }
    })
    await bob.client.next(m => m.t === 'ack' && m.seq === 23, 5000, '消息清空 ack')
    await bob.client.next(
      m => m.t === 'patch' && Array.isArray(m.reports?.battleReports) && m.reports.battleReports.length === 0,
      5000,
      '消息清空补丁'
    )
    assert(bobPlayer.battleReports.length === 0, '服务端没有清空战报')

    // 新战报到达后只应看到新战报，已清除的旧战报不能复活
    const newReport = { ...report, id: 'battle_smoke_new', timestamp: Date.now(), read: false }
    bobPlayer.battleReports.push(newReport)
    await server.room.tickOnce(Date.now() + 1000)
    await bob.client.next(
      m =>
        m.t === 'patch' &&
        Array.isArray(m.reports?.battleReports) &&
        (m.reports!.battleReports as Array<{ id: string }>).some(item => item.id === 'battle_smoke_new'),
      5000,
      '新战报补丁'
    )
    assert(bobPlayer.battleReports.length === 1, '新战报到达后旧战报复活')
    assert(bobPlayer.battleReports[0]!.id === 'battle_smoke_new', '新战报到达后数组内容不正确')
    console.log('[messages] 已读/清空持久化，新通知不会带回旧通知')
  }

  // 7.5.2) 玩家间交易：创建 -> 接收方接受 -> 双方资源与提议同步
  {
    const alicePlayer = server.room.profileOf(alice.playerId)!
    const bobPlayer = server.room.profileOf(bob.playerId)!
    const alicePlanet = alicePlayer.planets[0]
    const bobPlanet = bobPlayer.planets[0]
    alicePlanet.resources = { metal: 10_000, crystal: 10_000, deuterium: 1_000_000, darkMatter: 0, energy: 0 }
    bobPlanet.resources = { metal: 10_000, crystal: 10_000, deuterium: 1_000_000, darkMatter: 0, energy: 0 }

    alice.client.send({
      t: 'cmd',
      seq: 5,
      command: {
        type: 'player.trade.create',
        toPlayerId: bob.playerId,
        offer: { metal: 1_000, crystal: 0, deuterium: 0 },
        request: { metal: 0, crystal: 500, deuterium: 0 }
      }
    })
    await alice.client.next(m => m.t === 'ack' && m.seq === 5, 5000, '交易创建 ack')
    assert((alicePlayer.playerTrades?.length ?? 0) === 1, '发起方没有交易提议')
    assert((bobPlayer.playerTrades?.length ?? 0) === 1, '接收方没有交易提议')
    const tradeId = alicePlayer.playerTrades![0]!.id

    bob.client.send({
      t: 'cmd',
      seq: 6,
      command: { type: 'player.trade.respond', offerId: tradeId, action: 'accept' }
    })
    await bob.client.next(m => m.t === 'ack' && m.seq === 6, 5000, '交易接受 ack')
    assert((alicePlayer.playerTrades?.length ?? 0) === 1, '接受后发起方交易卡片丢失')
    assert((bobPlayer.playerTrades?.length ?? 0) === 1, '接受后接收方交易卡片丢失')
    assert(alicePlayer.playerTrades![0]!.status === 'accepted', '发起方交易状态未更新为 accepted')
    assert(bobPlayer.playerTrades![0]!.status === 'accepted', '接收方交易状态未更新为 accepted')
    assert(
      alicePlanet.resources.metal === 9_000 && alicePlanet.resources.crystal === 10_500,
      '接受交易后发起方资源不正确'
    )
    assert(
      bobPlanet.resources.metal === 11_000 && bobPlanet.resources.crystal === 9_500,
      '接受交易后接收方资源不正确'
    )

    // 重复接受必须被拒绝，且不能把已接受状态覆盖成 expired
    bob.client.send({
      t: 'cmd',
      seq: 7,
      command: { type: 'player.trade.respond', offerId: tradeId, action: 'accept' }
    })
    const duplicateReject = (await bob.client.next(
      m => m.t === 'reject' && m.seq === 7,
      5000,
      '重复接受交易'
    )) as Extract<ServerMessage, { t: 'reject' }>
    assert(!!duplicateReject.reason, '重复接受交易缺少拒绝原因')
    assert(bobPlayer.playerTrades![0]!.status === 'accepted', '重复接受覆盖了已接受状态')

    // 复原资源，避免影响后续场景
    alicePlanet.resources = { metal: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000, darkMatter: 0, energy: 0 }
    bobPlanet.resources = { metal: 1_000_000, crystal: 1_000_000, deuterium: 1_000_000, darkMatter: 0, energy: 0 }
    console.log('[players] 玩家交易创建/接受与资源结算正常')
  }

  // 7.6) PvP：Alice 侦查 Bob —— 防守方收到被侦查通知
  {
    const alicePlayer = server.room.profileOf(alice.playerId)!
    const bobPlayer = server.room.profileOf(bob.playerId)!
    const bobHomePlanet = bobPlayer.planets[0]
    alicePlayer.planets[0].fleet.espionageProbe = 5
    const spiedBefore = bobPlayer.spiedNotifications?.length ?? 0

    alice.client.send({
      t: 'cmd',
      seq: 21,
      command: {
        type: 'fleet.send',
        originPlanetId: alicePlayer.planets[0].id,
        targetPosition: { ...bobHomePlanet.position },
        missionType: MissionType.Spy,
        fleet: { espionageProbe: 5 }
      }
    })
    await alice.client.next(m => m.t === 'ack' && m.seq === 21, 5000, '侦查 ack')

    const spyMission = alicePlayer.fleetMissions.find(mission => mission.missionType === MissionType.Spy)
    assert(!!spyMission, '侦查任务未创建')
    await server.room.tickOnce(spyMission!.arrivalTime + 1000)

    assert((bobPlayer.spiedNotifications?.length ?? 0) === spiedBefore + 1, '防守方没有收到被侦查通知')
    assert((alicePlayer.spyReports?.length ?? 0) > 0, '攻击方没有拿到侦查报告')
    console.log('[pvp] 侦查通知与侦查报告均已送达')
  }

  // 7.7) 传感器阵列：服务端结算扫描结果
  {
    const alicePlayer = server.room.profileOf(alice.playerId)!
    const bobPlayer = server.room.profileOf(bob.playerId)!
    const bobHomePlanet = bobPlayer.planets[0]
    const aliceOrigin = alicePlayer.planets[0]

    // 给 Bob 造一颗月球（扫描的发起地）
    const moon = {
      ...(JSON.parse(JSON.stringify(bobHomePlanet)) as typeof bobHomePlanet),
      id: `${bobHomePlanet.id}_moon`,
      name: 'Bob Moon',
      isMoon: true,
      parentPlanetId: bobHomePlanet.id,
      lastUpdate: Date.now()
    }
    moon.resources.deuterium = 100_000
    // 传感器阵列是扫描的前提（射程按航道跳数计算）
    moon.buildings[BuildingType.SensorPhalanx] = 1
    bobPlayer.planets.push(moon)

    // Alice 派一支舰队飞向 Bob（让扫描有东西可看）
    aliceOrigin.fleet.lightFighter = 30
    aliceOrigin.resources.deuterium = 1_000_000
    alice.client.send({
      t: 'cmd',
      seq: 30,
      command: {
        type: 'fleet.send',
        originPlanetId: aliceOrigin.id,
        targetPosition: { ...bobHomePlanet.position },
        missionType: MissionType.Attack,
        fleet: { lightFighter: 30 }
      }
    })
    await alice.client.next(m => m.t === 'ack' && m.seq === 30, 5000, '扫描前置攻击 ack')

    // Bob 用月球扫描自己的坐标
    bob.client.send({
      t: 'cmd',
      seq: 31,
      command: {
        type: 'phalanx.scan',
        moonId: moon.id,
        targetPosition: { ...bobHomePlanet.position }
      }
    })
    await bob.client.next(m => m.t === 'ack' && m.seq === 31, 5000, '扫描 ack')

    const scanMessage = (await bob.client.next(m => m.t === 'scan', 5000, '扫描结果')) as Extract<
      ServerMessage,
      { t: 'scan' }
    >
    assert(scanMessage.fleets.length > 0, '扫描没有返回任何舰队')
    assert(
      scanMessage.fleets.some(mission => mission.playerId === alice.playerId),
      '扫描结果里没有 Alice 的来袭舰队'
    )
    assert(
      moon.resources.deuterium === 100_000 - PHALANX_SCAN_COST,
      '扫描没有扣除重氢'
    )
    console.log(`[phalanx] 扫描成功：发现 ${scanMessage.fleets.length} 支舰队，扣除重氢 ${PHALANX_SCAN_COST}`)
  }

  // 7.8) 聊天：公共频道 / 防刷屏 / 私聊不泄露
  {
    const bobPlayer = server.room.profileOf(bob.playerId)!
    const carolPlayer = carolId ? server.room.profileOf(carolId) : undefined
    const bobBefore = bobPlayer.chatMessages?.length ?? 0

    alice.client.send({ t: 'cmd', seq: 40, command: { type: 'chat.send', text: 'hello galaxy' } })
    await alice.client.next(m => m.t === 'ack' && m.seq === 40, 5000, '公共聊天 ack')
    await waitFor(() => (bobPlayer.chatMessages?.length ?? 0) === bobBefore + 1, 3000, 'Bob 收到公共聊天')

    const latest = bobPlayer.chatMessages![bobPlayer.chatMessages!.length - 1]!
    assert(latest.text === 'hello galaxy', '公共聊天内容不正确')
    assert(latest.fromId === alice.playerId, '公共聊天发送者 ID 不正确')
    assert(latest.fromName === 'Alice', `公共聊天发送者昵称不正确：${latest.fromName}`)

    // 客户端应当通过补丁的 reports 收到聊天记录
    const chatPatch = (await bob.client.next(
      m => m.t === 'patch' && Array.isArray(m.reports?.chatMessages),
      5000,
      '聊天补丁'
    )) as Extract<ServerMessage, { t: 'patch' }>
    assert(Array.isArray(chatPatch.reports?.chatMessages), '聊天没有随补丁下发')

    // 防刷屏：1 秒内再发一条会被拒绝
    alice.client.send({ t: 'cmd', seq: 41, command: { type: 'chat.send', text: 'spam' } })
    const spamReject = (await alice.client.next(m => m.t === 'reject' && m.seq === 41, 5000, '刷屏拒绝')) as Extract<
      ServerMessage,
      { t: 'reject' }
    >
    assert(!!spamReject, '刷屏没有被拒绝')

    // 私聊：只投递给双方，不会出现在第三方聊天记录里
    await new Promise(resolveSleep => setTimeout(resolveSleep, 1100))
    const bobPrivateBefore = bobPlayer.chatMessages?.length ?? 0
    alice.client.send({
      t: 'cmd',
      seq: 42,
      command: { type: 'chat.send', text: 'secret', toPlayerId: bob.playerId }
    })
    await alice.client.next(m => m.t === 'ack' && m.seq === 42, 5000, '私聊 ack')
    await waitFor(() => (bobPlayer.chatMessages?.length ?? 0) === bobPrivateBefore + 1, 3000, 'Bob 收到私聊')

    if (carolPlayer) {
      assert(
        !(carolPlayer.chatMessages ?? []).some(message => message.text === 'secret'),
        '私聊泄露给了其他玩家'
      )
    }
    console.log('[chat] 公共频道 / 私聊 / 防刷屏 全部正常')
  }

  // 7) 重连：令牌换回同一个玩家
  alice.client.close()
  await new Promise(resolveSleep => setTimeout(resolveSleep, 100))
  const aliceAgain = await connectAndJoin(server.port, 'Alice', alice.token)
  assert(aliceAgain.playerId === alice.playerId, '令牌重连没有回到同一个玩家')
  assert(aliceAgain.snapshot.self.planets[0].id === aliceHome.id, '重连后数据丢失')

  // 8) 存档 + 重启
  bob.client.close()
  aliceAgain.client.close()
  await new Promise(resolveSleep => setTimeout(resolveSleep, 100))
  await server.close()

  const saved = JSON.parse(readFileSync(join(dataDir, 'world.json'), 'utf8')) as {
    players: Record<string, unknown>
    npcs: unknown[]
  }
  assert(Object.keys(saved.players).length === 3, '存档中的玩家数量不正确')

  server = await startServer({
    port: 0,
    host: '127.0.0.1',
    staticDir,
    dataDir,
    visibility: 'public',
    npcCount: 40,
    tickMs: 3_600_000,
    autosaveMs: 3_600_000
  })

  const resumed = await connectAndJoin(server.port, 'Alice', alice.token)
  assert(resumed.playerId === alice.playerId, '重启后令牌失效')
  assert(resumed.snapshot.self.planets.length === 1, '重启后星球丢失')

  // 9) 在线人数统计
  assert(server.room.onlineCount === 1, '在线人数统计不正确')

  // 9.5) 顶号与令牌错配（同一浏览器两个窗口的典型场景）
  {
    const eva1 = await connectAndJoin(server.port, 'Eva', undefined, PROTOCOL_VERSION, undefined, 'eva-pass-1234')

    // 同令牌 + 同名 → 服务端踢掉旧连接，旧连接收到 replaced
    const eva2 = await connectAndJoin(server.port, 'Eva', eva1.token)
    const closed = await eva1.client.closed
    assert(closed.reason === 'replaced', `旧连接未被顶号（reason=${closed.reason}）`)

    // 同令牌 + 不同名 → 当作新账号，不会顶掉 Eva
    const frank = await connectAndJoin(server.port, 'Frank', eva2.token, PROTOCOL_VERSION, undefined, 'frank-pass-1234')
    assert(frank.playerId !== eva2.playerId, '令牌与昵称不匹配时仍然复用了原账号')

    // Eva 依然在线：还能发命令并收到 ack
    eva2.client.send({ t: 'cmd', seq: 90, command: { type: 'chat.send', text: 'still here' } })
    await eva2.client.next(m => m.t === 'ack' && m.seq === 90, 3000, 'Eva 仍在线')

    frank.client.close()
    eva2.client.close()
    await new Promise(resolveSleep => setTimeout(resolveSleep, 50))
    console.log('[auth] 顶号断开与令牌错配处理正常')
  }

  resumed.client.close()
  await new Promise(resolveSleep => setTimeout(resolveSleep, 50))

  // 10) 客户端 store 端到端（真实 Pinia + 真实 WebSocket 客户端）
  await runClientStoreScenario(server.port, server.room)

  await server.close()
  rmSync(dataDir, { recursive: true, force: true })

  console.log('✅ 服务端冒烟测试通过：登录/可见性/命令/补丁/tick/存档/重连/客户端同步 全部正常')
}

const waitFor = async (predicate: () => boolean, timeoutMs: number, label: string): Promise<void> => {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return
    await new Promise(resolveSleep => setTimeout(resolveSleep, 25))
  }
  fail(`等待超时：${label}`)
}

/**
 * 用真实的客户端 store 连服务器：
 * `useNetStore().connect()` → `handleWelcome` 写入 Pinia → `dispatchCommand` 走 WS → `handlePatch` 回写 Pinia
 */
const runClientStoreScenario = async (port: number, room: Room): Promise<void> => {
  setActivePinia(createPinia())

  const gameStore = useGameStore()
  const universeStore = useUniverseStore()
  const npcStore = useNPCStore()
  const netStore = useNetStore()

  let lastReject: string | undefined
  netStore.setHandlers({ onReject: reason => (lastReject = reason) })

  netStore.serverUrl = `ws://127.0.0.1:${port}/ws`
  netStore.name = 'ClientTester'
  netStore.password = 'client-pass-1234'
  netStore.connect()

  await waitFor(() => netStore.status === 'online', 5000, '客户端连接')
  await waitFor(() => gameStore.player.planets.length > 0, 5000, '快照写入 Pinia')

  assert(netStore.playerId === gameStore.player.id, '客户端玩家 ID 与服务端不一致')
  assert(Object.keys(universeStore.planets).length > 0, '客户端没有收到可见星球')
  assert(npcStore.npcs.length > 0, '客户端没有收到 NPC')

  // 服务端侧准备资源与前置建筑（模拟正常发育）
  const serverPlayer = room.profileOf(netStore.playerId)!
  const home = serverPlayer.planets[0]
  home.resources.metal = 1_000_000
  home.resources.crystal = 1_000_000
  home.resources.deuterium = 1_000_000
  home.buildings[BuildingType.SolarPlant] = 1

  // 命令：客户端 → 服务端
  const upgradeResult = dispatchCommand({
    type: 'building.upgrade',
    planetId: gameStore.player.planets[0].id,
    buildingType: BuildingType.MetalMine
  })
  assert(upgradeResult.ok, '联机模式下命令未提交')

  await waitFor(() => (gameStore.player.planets[0]?.buildQueue.length ?? 0) === 1, 5000, '补丁回写建造队列')

  // 拒绝路径：同一建筑重复入队会被服务端拒绝
  dispatchCommand({
    type: 'building.upgrade',
    planetId: gameStore.player.planets[0].id,
    buildingType: BuildingType.MetalMine
  })
  await waitFor(() => !!lastReject, 5000, '服务端拒绝命令')
  assert(lastReject === 'errors.buildingAlreadyInQueue', `拒绝原因不正确：${lastReject}`)

  // 传感器阵列：扫描结果通过 `scan` 消息单独返回（客户端要能等到它）
  const moon = {
    ...(JSON.parse(JSON.stringify(home)) as typeof home),
    id: `${home.id}_moon`,
    name: 'Client Moon',
    isMoon: true,
    parentPlanetId: home.id,
    lastUpdate: Date.now()
  }
  moon.resources.deuterium = 50_000
  // 扫描需要传感器阵列（射程按航道跳数计算）
  moon.buildings[BuildingType.SensorPhalanx] = 1
  serverPlayer.planets.push(moon)
  home.fleet.lightFighter = 5

  const scanTokenBefore = netStore.scanToken
  dispatchCommand({
    type: 'fleet.send',
    originPlanetId: home.id,
    targetPosition: { ...home.position },
    missionType: MissionType.Spy,
    fleet: { lightFighter: 1 }
  })
  dispatchCommand({
    type: 'phalanx.scan',
    moonId: moon.id,
    targetPosition: { ...home.position }
  })

  const scanned = await netStore.waitForScan(scanTokenBefore, 5000)
  assert(!!scanned && scanned.length > 0, '客户端没有等到扫描结果')

  netStore.disconnect()
  await waitFor(() => netStore.status === 'idle', 3000, '断开连接')
}

main().catch(error => {
  console.error('❌ 服务端冒烟测试异常：', error)
  process.exit(1)
})
