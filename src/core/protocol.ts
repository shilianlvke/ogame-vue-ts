/**
 * 联机协议（客户端 ↔ 服务端）
 *
 * 设计原则：
 * - 命令上行、状态下行；客户端只负责渲染与输入；
 * - 首次 `welcome` 下发全量快照，之后每秒下发增量 `patch`；
 * - 「可见性」由服务端决定：自己的星球全量，其他玩家的星球只给公开字段。
 *
 * 注意：本文件是纯函数/纯类型，客户端与服务端共用，不依赖 Node 或 DOM。
 */
import type {
  BuildingType,
  DebrisField,
  DefenseType,
  Fleet,
  FleetMission,
  NPC,
  Planet,
  Player,
  RankingEntry,
  Resources,
  TechnologyType
} from '@/types/game'
import type { Locale } from '@/locales'
import type { EngineEvent, World } from './types'
import type { GameCommand } from './commands'
import { allPlayers, inCurrentCycle, positionKey } from './world'
import { calculateNPCScores, calculatePlayerScores } from '@/logic/rankingLogic'

/** 协议版本：客户端与服务端不一致时拒绝连接 */
export const PROTOCOL_VERSION = 3

/**
 * 可见性模式
 * - `full`：与单机一致，下发其它星球的完整数据（便于客户端改造过渡期使用）
 * - `public`：只下发公开字段（推荐，防止 F12 透视）
 */
export type VisibilityMode = 'full' | 'public'

/** 公开玩家档案（排行榜、银河页展示用） */
export interface PlayerPublicProfile {
  id: string
  name: string
  points: number
  planetCount: number
  /** 各分类积分（联机排行榜用） */
  scores: RankingEntry['scores']
}

/* -------------------------------------------------------------------------- */
/*                                    客户端                                   */
/* -------------------------------------------------------------------------- */

/** 握手（首次连接） */
export interface HelloMessage {
  t: 'hello'
  protocolVersion: number
  name: string
  /** 密码：新账号注册时设置；老账号换设备登录时校验 */
  password?: string
  /** 重连令牌：服务端在 welcome 中下发 */
  token?: string
  locale?: Locale
}

/** 派发命令 */
export interface CommandMessage {
  t: 'cmd'
  seq: number
  command: GameCommand
}

/** 心跳 */
export interface PingMessage {
  t: 'ping'
  time: number
}

export type ClientMessage = HelloMessage | CommandMessage | PingMessage

/* -------------------------------------------------------------------------- */
/*                                    服务端                                   */
/* -------------------------------------------------------------------------- */

/** 全量快照 */
export interface WorldSnapshot {
  tick: number
  serverTime: number
  /** 自己的完整玩家数据 */
  self: Player
  /**
   * 其它可见星球（其他玩家 + NPC），key 为 `galaxy:system:position`；
   * 月球使用 `galaxy:system:position:moon`，避免与同坐标行星冲突。
   */
  planets: Record<string, Planet>
  /** NPC 列表（`planets` 字段为空数组，客户端按 ownerId 关联星球） */
  npcs: NPC[]
  debrisFields: Record<string, DebrisField>
  players: PlayerPublicProfile[]
  /** NPC 商队（P5）：星图上画移动光点用 */
  caravans?: Array<{ id: string; fromSystemId: string; toSystemId: string; departAt: number; arriveAt: number }>
}

/** 增量补丁 */
export interface ServerPatch {
  t: 'patch'
  tick: number
  serverTime: number
  /** 自己发生变化的顶层字段（浅合并） */
  self?: Partial<Player>
  /** 报告类数组（变化时整体替换，客户端按 id 去重） */
  reports?: Record<string, unknown>
  /** 新增/变化的可见星球 */
  planets?: Record<string, Planet>
  /** 被移除的星球 key */
  removedPlanets?: string[]
  /** NPC 列表（仅在 NPC 集合变化时下发） */
  npcs?: NPC[]
  debrisFields?: Record<string, DebrisField>
  players?: PlayerPublicProfile[]
  events?: EngineEvent[]
}

/** 握手成功 */
export interface WelcomeMessage {
  t: 'welcome'
  protocolVersion: number
  playerId: string
  token: string
  tick: number
  serverTime: number
  snapshot: WorldSnapshot
}

/** 命令被接受 */
export interface AckMessage {
  t: 'ack'
  seq: number
}

/** 命令被拒绝 */
export interface RejectMessage {
  t: 'reject'
  seq?: number
  reason?: string
}

/** 心跳响应 */
export interface PongMessage {
  t: 'pong'
  time: number
}

/** 传感器阵列扫描结果（命令结果无法同步返回，单独下发） */
export interface ScanMessage {
  t: 'scan'
  fleets: FleetMission[]
}

/** 通用错误 */
export interface ErrorMessage {
  t: 'error'
  message: string
}

export type ServerMessage = WelcomeMessage | ServerPatch | AckMessage | RejectMessage | PongMessage | ScanMessage | ErrorMessage

/* -------------------------------------------------------------------------- */
/*                                  可见性处理                                 */
/* -------------------------------------------------------------------------- */

const EMPTY_RESOURCES: Resources = { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 }

/**
 * 矿脉储量按千位取整
 *
 * 银河页只按 K/M/B 展示，取整后可以避免每秒都因为储量微变而推送星球增量。
 */
const roundDeposits = (planet: Planet): Planet['oreDeposits'] => {
  if (!planet.oreDeposits) return undefined
  const round = (value: number): number => Math.round(value / 1000) * 1000
  return {
    metal: round(planet.oreDeposits.metal),
    crystal: round(planet.oreDeposits.crystal),
    deuterium: round(planet.oreDeposits.deuterium),
    position: planet.oreDeposits.position
  }
}

/**
 * 星球公开视图：保留身份/坐标/矿脉等公开信息，
 * 隐藏资源、建筑、舰队、防御、队列等敏感数据。
 *
 * 注意：这里刻意不包含 `lastUpdate`，否则每个 tick 都会产生一次星球增量。
 */
export const toPublicPlanet = (planet: Planet): Planet => ({
  id: planet.id,
  name: planet.name,
  ownerId: planet.ownerId,
  position: planet.position,
  isMoon: planet.isMoon,
  parentPlanetId: planet.parentPlanetId,
  diameter: planet.diameter,
  temperature: planet.temperature,
  oreDeposits: roundDeposits(planet),
  maxSpace: planet.maxSpace,
  lastUpdate: 0,
  // —— 以下为敏感数据，公开视图中清空 ——
  resources: { ...EMPTY_RESOURCES },
  buildings: {} as Record<BuildingType, number>,
  fleet: {} as Fleet,
  defense: {} as Record<DefenseType, number>,
  buildQueue: [],
  waitingBuildQueue: [],
  maxFleetStorage: 0
})

/**
 * NPC 公开视图：保留外交关系与身份信息，
 * 隐藏科技等级、舰队任务、侦查报告等只能由侦查获得的情报。
 */
export const toPublicNpc = (npc: NPC): NPC => ({
  id: npc.id,
  name: npc.name,
  note: npc.note,
  planets: [], // 由 buildPublicNpcs 填充公开视图
  technologies: {} as Record<TechnologyType, number>,
  difficulty: npc.difficulty,
  aiType: npc.aiType,
  difficultyLevel: npc.difficultyLevel,
  distanceToHomeworld: npc.distanceToHomeworld,
  relations: npc.relations,
  allies: npc.allies,
  enemies: npc.enemies
})

/**
 * 构建 NPC 列表视图
 *
 * 公开模式下附带星球的**公开视图**，这样银河页/外交页仍能按 NPC 聚合星球，
 * 但看不到资源与舰队。星球对象来自世界地图，位置等静态信息是准确的。
 */
export const buildPublicNpcs = (world: World, visibility: VisibilityMode = 'public'): NPC[] => {
  // 只下发当前周目的 NPC（跨层 NPC 属于信息泄露）
  const npcs = world.cycle ? world.npcs.filter(npc => npc.planets.some(planet => inCurrentCycle(world, planet))) : world.npcs
  if (visibility === 'full') return npcs
  return npcs.map(npc => ({
    ...toPublicNpc(npc),
    // 公开视图会清空建筑/舰队/科技，积分必须在服务端算好再下发
    scores: calculateNPCScores(npc),
    planets: npc.planets.map(toPublicPlanet)
  }))
}

/**
 * NPC 增量签名：忽略星球数组
 *
 * 星球本身通过 `planets` 补丁单独下发，因此 NPC 列表只在
 * 身份/外交关系变化时才重发，避免每个 tick 重复几十 KB。
 */
const npcSignature = (npcs: NPC[]): string =>
  JSON.stringify(
    npcs.map(npc => [npc.id, npc.name, npc.aiType, npc.difficultyLevel, npc.distanceToHomeworld, npc.relations, npc.allies, npc.enemies])
  )

/** 星球在地图中的 key（月球加后缀，避免同坐标覆盖） */
export const planetMapKey = (planet: Planet): string =>
  planet.isMoon ? `${positionKey(planet.position)}:moon` : positionKey(planet.position)

/** 当前视角下可见的「非自己」星球 */
export const collectVisiblePlanets = (world: World, viewer: Player): Record<string, Planet> => {
  const result: Record<string, Planet> = {}

  for (const player of allPlayers(world)) {
    if (player.id === viewer.id) continue
    for (const planet of player.planets) {
      result[planetMapKey(planet)] = planet
    }
  }

  for (const planet of Object.values(world.planets)) {
    if (!inCurrentCycle(world, planet)) continue
    result[planetMapKey(planet)] = planet
  }

  return result
}

/** 公开玩家档案列表 */
export const collectPlayerProfiles = (world: World): PlayerPublicProfile[] =>
  allPlayers(world).map(player => ({
    id: player.id,
    name: player.name,
    points: player.points,
    planetCount: player.planets.length,
    scores: calculatePlayerScores(player)
  }))

/* -------------------------------------------------------------------------- */
/*                              快照 / 补丁构建                                */
/* -------------------------------------------------------------------------- */

const REPORT_KEYS = [
  'battleReports',
  'spyReports',
  'missionReports',
  'spiedNotifications',
  'npcActivityNotifications',
  'giftNotifications',
  'giftRejectedNotifications',
  'tradeOffers',
  'intelReports',
  'jointAttackInvites',
  'aidNotifications',
  'allyDefenseNotifications',
  'attitudeChangeNotifications',
  'diplomaticReports',
  'questNotifications',
  'chatMessages'
] as const

/** 把玩家数据拆成「常变字段」与「报告类字段（体积大、低频变化）」 */
const splitPlayer = (player: Player): { core: Record<string, unknown>; reports: Record<string, unknown> } => {
  const core: Record<string, unknown> = {}
  const reports: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(player)) {
    if ((REPORT_KEYS as readonly string[]).includes(key)) {
      reports[key] = value
    } else {
      core[key] = value
    }
  }
  return { core, reports }
}

export interface SnapshotOptions {
  visibility?: VisibilityMode
  tick?: number
  now?: number
}

/** 构建全量快照 */
export const buildSnapshot = (world: World, viewer: Player, options: SnapshotOptions = {}): WorldSnapshot => {
  const visibility = options.visibility ?? 'public'
  const visiblePlanets = collectVisiblePlanets(world, viewer)

  const planets: Record<string, Planet> = {}
  for (const [key, planet] of Object.entries(visiblePlanets)) {
    planets[key] = visibility === 'public' ? toPublicPlanet(planet) : planet
  }

  return {
    tick: options.tick ?? 0,
    serverTime: options.now ?? Date.now(),
    self: viewer,
    planets,
    npcs: buildPublicNpcs(world, visibility),
    debrisFields: world.debrisFields,
    caravans: world.caravans?.map(caravan => ({
      id: caravan.id,
      fromSystemId: caravan.laneA,
      toSystemId: caravan.laneB,
      departAt: caravan.departAt,
      arriveAt: caravan.arriveAt
    })),
    players: collectPlayerProfiles(world)
  }
}

/** 增量状态（按客户端保存） */
export interface PatchState {
  planets: Record<string, string>
  /** NPC 列表的签名（忽略星球数组） */
  npcsSignature: string
  players: string
  debris: string
  self: Record<string, string>
  reports: string
}

export const createPatchState = (): PatchState => ({
  planets: {},
  npcsSignature: '',
  players: '',
  debris: '',
  self: {},
  reports: ''
})

/** 用快照初始化增量基线，避免客户端刚连上就收到一份等价的重复数据 */
export const seedPatchState = (state: PatchState, snapshot: WorldSnapshot): void => {
  state.planets = {}
  for (const [key, planet] of Object.entries(snapshot.planets)) {
    state.planets[key] = JSON.stringify(planet)
  }
  state.npcsSignature = npcSignature(snapshot.npcs)
  state.players = JSON.stringify(snapshot.players)
  state.debris = JSON.stringify(snapshot.debrisFields)
  state.self = {}
  const { core, reports } = splitPlayer(snapshot.self)
  for (const [key, value] of Object.entries(core)) {
    state.self[key] = JSON.stringify(value)
  }
  state.reports = JSON.stringify(reports)
}

export interface PatchOptions extends SnapshotOptions {
  events?: EngineEvent[]
}

/**
 * 构建增量补丁（会就地更新 `state`）
 *
 * 只有当内容真的变化时才携带对应字段，避免每秒重复下发全宇宙。
 */
export const buildPatch = (world: World, viewer: Player, state: PatchState, options: PatchOptions = {}): ServerPatch => {
  const visibility = options.visibility ?? 'public'
  const now = options.now ?? Date.now()
  const patch: ServerPatch = { t: 'patch', tick: options.tick ?? 0, serverTime: now }

  // —— 可见星球 ——
  const visible = collectVisiblePlanets(world, viewer)
  const nextPlanets: Record<string, Planet> = {}
  for (const [key, planet] of Object.entries(visible)) {
    nextPlanets[key] = visibility === 'public' ? toPublicPlanet(planet) : planet
  }

  const changedPlanets: Record<string, Planet> = {}
  for (const [key, planet] of Object.entries(nextPlanets)) {
    const json = JSON.stringify(planet)
    if (state.planets[key] !== json) {
      changedPlanets[key] = planet
      state.planets[key] = json
    }
  }
  const removed = Object.keys(state.planets).filter(key => !(key in nextPlanets))
  removed.forEach(key => delete state.planets[key])
  if (Object.keys(changedPlanets).length > 0) patch.planets = changedPlanets
  if (removed.length > 0) patch.removedPlanets = removed

  // —— NPC 列表 ——
  // —— NPC 列表 ——
  // 签名必须基于「当前周目可见的 NPC」，否则其它层的 NPC 会让签名一直变化
  const cycleNpcs = world.cycle
    ? world.npcs.filter(npc => npc.planets.some(planet => inCurrentCycle(world, planet)))
    : world.npcs
  const signature = npcSignature(cycleNpcs)
  if (signature !== state.npcsSignature) {
    patch.npcs = buildPublicNpcs(world, visibility)
    state.npcsSignature = signature
  }

  // —— 玩家档案 ——
  const profiles = collectPlayerProfiles(world)
  const profilesJson = JSON.stringify(profiles)
  if (profilesJson !== state.players) {
    patch.players = profiles
    state.players = profilesJson
  }

  // —— 残骸场 ——
  const debrisJson = JSON.stringify(world.debrisFields)
  if (debrisJson !== state.debris) {
    patch.debrisFields = world.debrisFields
    state.debris = debrisJson
  }

  // —— 自己 ——
  const { core, reports } = splitPlayer(viewer)
  const changedSelf: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(core)) {
    const json = JSON.stringify(value)
    if (state.self[key] !== json) {
      changedSelf[key] = value
      state.self[key] = json
    }
  }
  if (Object.keys(changedSelf).length > 0) patch.self = changedSelf as Partial<Player>

  const reportsJson = JSON.stringify(reports)
  if (reportsJson !== state.reports) {
    patch.reports = reports
    state.reports = reportsJson
  }

  // —— 事件 ——
  if (options.events && options.events.length > 0) patch.events = options.events

  return patch
}
