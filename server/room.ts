/**
 * 房间（Room）：服务端的世界容器
 *
 * 负责：
 * - 玩家登录 / 重连 / 断线
 * - 每秒推进世界（玩家阶段 → NPC 阶段 → 收尾阶段）
 * - 把客户端命令排队后交给 `applyCommand`（与单机同一套校验）
 * - 为每个连接生成增量补丁
 *
 * 这里刻意不依赖 `ws`，只通过 `ClientConnection` 接口发送消息，便于测试。
 */
import type { Planet, Position, Player } from '@/types/game'
import type { Locale } from '@/locales'
import { loadLocale } from '@/locales'
import type { EngineContext, EngineEvent, TranslateFn, World } from '@/core/types'
import { createEngineContext } from '@/core/types'
import { allPlayers, createWorld, positionKey, replaceArray } from '@/core/world'
import { tickNpcPhase, tickPlayerPhase, tickPlayerPostPhase } from '@/core/engine'
import { ensureNpcRegistry } from '@/core/npc'
import { tickGatePhase } from '@/core/gatePhase'
import { getWorldLayout, oreModifiersAt } from '@/core/galaxyContext'
import { getPlanetProfile } from '@/logic/galaxyGen'
import { applyCommand } from '@/core/commands'
import type { GameCommand } from '@/core/commands'
import { buildPatch, buildSnapshot, createPatchState, seedPatchState } from '@/core/protocol'
import type { PatchState, ServerMessage, VisibilityMode, WorldSnapshot } from '@/core/protocol'
import { createTranslator } from '@/core/i18n'
import { generateNpcPlanets } from '@/core/generate'
import * as gameLogic from '@/logic/gameLogic'
import * as planetLogic from '@/logic/planetLogic'
import { generatePlanetName } from '@/logic/nameGenerator'
import * as oreDepositLogic from '@/logic/oreDepositLogic'
import { createToken, hashPassword, verifyPassword } from './auth'
import { applyMaxAccount } from '@/logic/devAccount'
import { checkAllActiveQuestsProgress, initializeCampaignProgress } from '@/logic/campaignLogic'
import type { Account, ServerState } from './state'

/** 与具体 WebSocket 实现解耦的连接抽象 */
export interface ClientConnection {
  send(message: ServerMessage): void
  close(reason?: string): void
}

export interface Session {
  playerId: string
  locale: Locale
  connection: ClientConnection
  patchState: PatchState
  events: EngineEvent[]
  /** 当前秒剩余可派发命令数（简单限流） */
  commandBudget: number
  budgetResetAt: number
}

export interface JoinInput {
  name?: string
  password?: string
  token?: string
  locale?: Locale
}

/** 登录失败原因（客户端据此提示） */
export type JoinFailure = 'name_taken' | 'wrong_password' | 'password_required'

export type JoinResult =
  | { ok: true; account: Account; player: Player; snapshot: WorldSnapshot; isNew: boolean }
  | { ok: false; error: JoinFailure }

export interface RoomOptions {
  visibility?: VisibilityMode
  defaultLocale?: Locale
  npcCount?: number
  /** 新账号的新手保护期（小时），0 表示不保护 */
  protectionHours?: number
  /** 每个连接最多缓存多少条待发事件 */
  maxEventsPerSession?: number
  /** 每秒最多接受多少条命令 */
  commandRateLimit?: number
}

interface PendingCommand {
  session: Session
  seq: number
  command: GameCommand
}

const MAX_NAME_LENGTH = 24
const MIN_PASSWORD_LENGTH = 4

const sanitizeName = (name?: string): string => {
  const cleaned = (name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return cleaned.length > 0 ? cleaned.slice(0, MAX_NAME_LENGTH) : 'Commander'
}

const randomToken = (bytes: number): string => createToken(bytes)

export class Room {
  readonly state: ServerState
  readonly world: World
  private readonly options: Required<RoomOptions>
  private readonly sessions = new Map<string, Session>()
  private readonly translators = new Map<Locale, TranslateFn>()
  private readonly pendingCommands: PendingCommand[] = []

  private lastTickAt = Date.now()
  private tick = 0
  private npcCursor = 0
  /** 内置满级账号是否已检查 */
  private builtinAccountReady = false
  /** 周目 → 保持全速 tick 的截止 tick（冻结层降频用） */
  private hotCycles = new Map<number, number>()
  private ticking = false
  private dirty = true

  /**
   * 当前需要模拟的周目。
   *
   * P6 之前只有第 1 层；多周目上线后改为「有在线玩家、或最近 10 分钟有活动的层」，
   * 其余层冻结（不 tick、不落盘）。见 doc/GALAXY_CYCLES.md §5。
   */
  private activeCycles(): number[] {
    const cycles = new Set<number>()
    for (const player of Object.values(this.state.players)) {
      cycles.add(player.cycle ?? 1)
    }
    return cycles.size > 0 ? [...cycles] : [1]
  }

  constructor(state: ServerState, options: RoomOptions = {}) {
    this.state = state
    this.options = {
      visibility: options.visibility ?? 'public',
      defaultLocale: options.defaultLocale ?? state.locale,
      npcCount: options.npcCount ?? 200,
      protectionHours: options.protectionHours ?? 24,
      maxEventsPerSession: options.maxEventsPerSession ?? 200,
      commandRateLimit: options.commandRateLimit ?? 30
    }

    const players = Object.values(state.players)
    this.world = createWorld({
      player: players[0] ?? gameLogic.initializePlayer('system', 'System'),
      players,
      planets: state.planets,
      npcs: state.npcs,
      debrisFields: state.debrisFields,
      locale: state.locale,
      gameSpeed: state.gameSpeed,
      battleToFinish: state.battleToFinish
    })
  }

  /* ------------------------------- 基础信息 ------------------------------- */

  get tickCount(): number {
    return this.tick
  }

  get onlineCount(): number {
    return this.sessions.size
  }

  get playerCount(): number {
    return Object.keys(this.state.players).length
  }

  get visibility(): VisibilityMode {
    return this.options.visibility
  }

  isDirty(): boolean {
    return this.dirty
  }

  markClean(): void {
    this.dirty = false
  }

  /* -------------------------------- 翻译 --------------------------------- */

  /** 预加载某个语言包（登录时调用，保证结算文案是玩家自己的语言） */
  async ensureTranslator(locale: Locale): Promise<TranslateFn> {
    const cached = this.translators.get(locale)
    if (cached) return cached
    const messages = await loadLocale(locale)
    const translator = createTranslator(messages)
    this.translators.set(locale, translator)
    return translator
  }

  private translator(locale: Locale): TranslateFn {
    return this.translators.get(locale) ?? ((key: string) => key)
  }

  private ctxFor(player: Player, locale: Locale): EngineContext {
    return createEngineContext({
      t: this.translator(locale),
      // NPC 行为可能针对不同玩家，事件按目标玩家投递
      emit: (event, playerId) => this.pushEvent(playerId ?? player.id, event)
    })
  }

  private localeOf(playerId: string): Locale {
    const account = this.state.accounts[playerId]
    return account?.locale ?? this.options.defaultLocale
  }

  /* -------------------------------- 事件 --------------------------------- */

  private pushEvent(playerId: string, event: EngineEvent): void {
    const session = this.sessions.get(playerId)
    if (!session) return
    session.events.push(event)
    const overflow = session.events.length - this.options.maxEventsPerSession
    if (overflow > 0) session.events.splice(0, overflow)
  }

  /* -------------------------------- 登录 --------------------------------- */

  private findAccountByToken(token?: string): Account | undefined {
    if (!token) return undefined
    return Object.values(this.state.accounts).find(account => account.token === token)
  }

  /** 按昵称查账号（不区分大小写，用于「换设备登录」与重名检测） */
  private findAccountByName(name: string): Account | undefined {
    const normalized = sanitizeName(name).toLowerCase()
    return Object.values(this.state.accounts).find(account => account.name.toLowerCase() === normalized)
  }

  private createAccount(name: string, locale: Locale, password?: string): Account {
    const id = `p_${randomToken(6)}`
    const account: Account = {
      id,
      name: sanitizeName(name),
      token: randomToken(24),
      locale,
      createdAt: Date.now(),
      lastSeenAt: Date.now()
    }
    if (password) {
      const { hash, salt } = hashPassword(password)
      account.passwordHash = hash
      account.passwordSalt = salt
    }
    this.state.accounts[id] = account
    return account
  }

  /** 找一个空闲坐标作为新玩家母星 */
  /**
   * 新玩家母星优先落在"乐土"（lush）：
   * 只在 danger=1 的恒星系里找 lush 轨道，找不到再退回普通分配。
   */
  private allocateParadisePosition(): Position | null {
    const layout = getWorldLayout(this.world)
    const cycle = this.world.cycle ?? 1
    const safeSystems = layout.regions.flatMap(region => region.systems).filter(system => system.danger === 1)

    for (const system of safeSystems) {
      for (let orbit = 1; orbit <= 10; orbit += 1) {
        const profile = getPlanetProfile(layout.seed, cycle, system.region, system.index, orbit)
        if (profile.biome !== 'lush') continue
        const candidate: Position = { galaxy: system.galaxy, system: system.index, position: orbit }
        if (!this.isPositionOccupied(candidate)) return candidate
      }
    }
    return null
  }


  private allocateHomePosition(): Position {
    for (let galaxy = 1; galaxy <= 9; galaxy++) {
      for (let system = 1; system <= 10; system++) {
        for (let position = 1; position <= 10; position++) {
          const candidate = { galaxy, system, position }
          if (!this.isPositionOccupied(candidate)) return candidate
        }
      }
    }
    // 兜底（理论上 900 个坐标足够）
    return { galaxy: 1, system: 1, position: 1 }
  }

  private isPositionOccupied(position: Position): boolean {
    const key = positionKey(position)
    if (this.state.planets[key]) return true
    for (const player of Object.values(this.state.players)) {
      for (const planet of player.planets) {
        if (positionKey(planet.position) === key) return true
      }
    }
    return false
  }

  private createHomePlanet(account: Account): Planet {
    const position = this.allocateParadisePosition() ?? this.allocateHomePosition()
    // 母星名与语言无关：用账号 id 派生的程序化英文名（同一账号永远同名）
    const planet = planetLogic.createInitialPlanet(account.id, generatePlanetName(`home:${account.id}`))
    planet.id = `planet_${account.id}_1`
    planet.position = position
    planet.oreDeposits = oreDepositLogic.generateOreDeposits(position, oreModifiersAt(this.world, position))
    planet.temperature = planetLogic.generatePlanetTemperature(position.position)
    planet.lastUpdate = Date.now()
    return planet
  }

  /** 星门换手：全服公告（走聊天频道） */
  private announceCaptures(captures: Array<{ systemId: string; capturedBy: string }>): void {
    if (captures.length === 0) return
    const now = Date.now()
    for (const capture of captures) {
      const player = this.state.players[capture.capturedBy]
      const text = `${player?.name ?? capture.capturedBy} 占领了星门 ${capture.systemId}`
      console.log(`[gate] ${text}`)
      for (const target of Object.values(this.state.players)) {
        const messages = (target.chatMessages ??= [])
        messages.push({
          id: `gate_${capture.systemId}_${now}`,
          timestamp: now,
          fromId: 'system',
          fromName: '系统',
          text
        })
        if (messages.length > 100) messages.splice(0, messages.length - 100)
      }
    }
  }


  /**
   * 内置满级账号（服务端环境变量 MAX_ACCOUNT=用户名:密码）
   *
   * 账号不存在时创建，并把建筑/科技/资源拉满。
   */
  ensureBuiltinAccount(username: string, password: string): void {
    // 注册生成的是 p_xxx 形式的 id，按名字查重，避免同名出现两个账号
    const existing = Object.values(this.state.accounts).find(account => account.name === username)
    if (existing) {
      const player = this.state.players[existing.id]
      if (player) applyMaxAccount(player)
      return
    }
    if (this.state.accounts[username]) return
    const account: Account = {
      id: username,
      name: username,
      token: randomToken(24),
      locale: this.state.locale,
      createdAt: Date.now(),
      lastSeenAt: Date.now()
    }
    const { hash, salt } = hashPassword(password)
    account.passwordHash = hash
    account.passwordSalt = salt
    this.state.accounts[username] = account
    const player = this.createPlayer(account)
    applyMaxAccount(player)
    console.log(`[room] 已创建内置满级账号：${username}`)
  }

  private createPlayer(account: Account): Player {
    const player = gameLogic.initializePlayer(account.id, account.name)
    player.planets = [this.createHomePlanet(account)]
    // 服务端创建玩家时初始化战役进度，否则 campaign.start 会报 notInitialized
    player.campaignProgress = initializeCampaignProgress(player)
    player.points = 0
    player.bonusPoints = 0
    if (this.options.protectionHours > 0) {
      player.protectionUntil = Date.now() + this.options.protectionHours * 3_600_000
    }
    this.state.players[player.id] = player
    this.state.achievementAccum[player.id] = 0
    return player
  }

  /** 让 World 里的 players 数组与存档保持一致（就地更新，避免断开引用） */
  private syncPlayers(): void {
    const players = Object.values(this.state.players)
    if (!this.world.players) {
      this.world.players = players
    } else {
      replaceArray(this.world.players, players)
    }
    if (players.length > 0 && !players.includes(this.world.player)) {
      this.world.player = players[0]
    }
  }

  /**
   * 玩家加入 / 重连
   *
   * @returns 是否为新账号
   */
  async join(input: JoinInput, connection: ClientConnection): Promise<JoinResult> {
    const locale = input.locale ?? this.options.defaultLocale
    await this.ensureTranslator(locale)

    // 1) 令牌重连：不需要密码
    let account = this.findAccountByToken(input.token)
    let isNew = false

    // 令牌与请求的昵称不一致时，说明这是另一个账号（典型场景：同一浏览器开了两个窗口，
    // 共享同一份 localStorage 里的令牌）。此时忽略令牌按新登录处理，
    // 否则两个窗口会互相顶号，表现为无限「断线-重连」。
    if (account && input.name && sanitizeName(input.name) !== account.name) {
      account = undefined
    }

    if (account) {
      account.lastSeenAt = Date.now()
    } else {
      // 2) 按昵称登录：已存在账号必须校验密码
      const existing = this.findAccountByName(input.name ?? '')
      if (existing) {
        if (!existing.passwordHash) {
          // 老账号没有密码，只能靠令牌重连，避免被同名抢占
          return { ok: false, error: 'name_taken' }
        }
        if (!input.password) {
          return { ok: false, error: 'password_required' }
        }
        if (!verifyPassword(input.password, existing.passwordHash, existing.passwordSalt)) {
          return { ok: false, error: 'wrong_password' }
        }
        // 换设备登录：续发新令牌
        existing.token = randomToken(24)
        existing.lastSeenAt = Date.now()
        existing.locale = locale
        account = existing
      } else {
        // 3) 新账号：必须设置密码
        if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
          return { ok: false, error: 'password_required' }
        }
        account = this.createAccount(input.name ?? '', locale, input.password)
        isNew = true
      }
    }

    const resolvedAccount = account

    let player = this.state.players[resolvedAccount.id]
    if (!player) {
      player = this.createPlayer(resolvedAccount)
    }
    this.syncPlayers()

    // 第一个玩家加入时立刻建立 NPC 注册表（否则要等第一个 tick 才有 NPC）
    if (this.state.npcs.length === 0) {
      this.world.player = player
      ensureNpcRegistry(this.world, this.ctxFor(player, this.localeOf(player.id)))
    }

    // 同一玩家重连：踢掉旧连接
    const existing = this.sessions.get(player.id)
    if (existing) {
      existing.connection.close('replaced')
      this.sessions.delete(player.id)
    }

    const session: Session = {
      playerId: player.id,
      locale: resolvedAccount.locale,
      connection,
      patchState: createPatchState(),
      events: [],
      commandBudget: this.options.commandRateLimit,
      budgetResetAt: Date.now() + 1000
    }

    const snapshot = buildSnapshot(this.world, player, {
      tick: this.tick,
      now: Date.now(),
      visibility: this.options.visibility
    })
    seedPatchState(session.patchState, snapshot)

    this.sessions.set(player.id, session)
    this.dirty = true

    return { ok: true, account: resolvedAccount, player, snapshot, isNew }
  }

  /** 连接断开（玩家数据保留，舰队继续飞行 = 离线进度） */
  leave(playerId: string, connection: ClientConnection): void {
    const session = this.sessions.get(playerId)
    if (session && session.connection === connection) {
      this.sessions.delete(playerId)
    }
    const account = this.state.accounts[playerId]
    if (account) account.lastSeenAt = Date.now()
  }

  /* -------------------------------- 命令 --------------------------------- */

  private consumeBudget(session: Session, now: number): boolean {
    if (now >= session.budgetResetAt) {
      session.commandBudget = this.options.commandRateLimit
      session.budgetResetAt = now + 1000
    }
    if (session.commandBudget <= 0) return false
    session.commandBudget -= 1
    return true
  }

  /** 接收命令：排队，保证不会在某个 tick 中途改变「当前玩家」 */
  enqueueCommand(session: Session, seq: number, command: GameCommand): void {
    if (!this.consumeBudget(session, Date.now())) {
      // 限流日志：便于发现异常客户端
      console.warn(`[room] 命令限流：${session.playerId}（${this.options.commandRateLimit}/s）`)
      session.connection.send({ t: 'reject', seq })
      return
    }
    this.pendingCommands.push({ session, seq, command })
    if (!this.ticking) {
      this.flushCommands(Date.now())
    }
  }

  /** 按玩家 ID 派发命令（供 WebSocket 层使用） */
  enqueueCommandFor(playerId: string, seq: number, command: GameCommand): void {
    const session = this.sessions.get(playerId)
    if (!session) return
    this.enqueueCommand(session, seq, command)
  }

  private flushCommands(now: number): void {
    let applied = false
    while (this.pendingCommands.length > 0) {
      const next = this.pendingCommands.shift()!
      if (this.applyCommandInternal(next, now)) applied = true
    }
    if (applied) {
      // 立即下发一次补丁，避免玩家等下一个 tick
      this.broadcast(now)
      this.dirty = true
    }
  }

  private applyCommandInternal(item: PendingCommand, _now: number): boolean {
    const player = this.state.players[item.session.playerId]
    if (!player) {
      item.session.connection.send({ t: 'reject', seq: item.seq })
      return false
    }
    this.world.player = player
    // 命令里的文本（如礼物报告）要按发起玩家的语言生成
    this.world.locale = item.session.locale
    // 有命令活动的周目保持全速 tick
    this.hotCycles.set(player.cycle ?? 1, this.tick + 120)
    const result = applyCommand(this.world, this.ctxFor(player, item.session.locale), item.command)

    const handledCommand = item.command
    if (handledCommand.type === 'galaxy.rename') {
      const discoverers = (this.world.players ?? []).filter(
        other => other.discoveredSystems?.[handledCommand.systemId]
      ).length
      console.log(
        `[room] 星系改名 ${player.id} ${handledCommand.systemId} → ${handledCommand.name} ok=${result.ok} 发现者=${discoverers}`
      )
    }

    // 诊断：确认改名命令是否真的到达服务端
    if (item.command.type === 'planet.rename') {
      console.log(
        `[room] 改名 ${player.id} ${item.command.planetId} → ${item.command.name} ok=${result.ok}` +
          (result.ok ? '' : ` reason=${result.reason ?? ''}`)
      )
    }
    if (!result.ok) {
      // 未知命令类型通常意味着客户端被篡改，记一条日志便于排查
      if (result.reason?.startsWith('unknown command')) {
        console.warn(`[room] 非法命令：${player.id} ${result.reason}`)
      }
      item.session.connection.send({ t: 'reject', seq: item.seq, reason: result.reason })
      return false
    }
    item.session.connection.send({ t: 'ack', seq: item.seq })

    // 传感器阵列这类「需要返回值」的命令，单独下发扫描结果
    if (result.scan) {
      item.session.connection.send({ t: 'scan', fleets: result.scan })
    }

    return true
  }

  /* -------------------------------- 推进 --------------------------------- */

  /**
   * 推进一个 tick
   *
   * 玩家阶段按玩家逐个执行；NPC 阶段每 tick 只执行一次
   * （NPC 行为需要一个「当前玩家」视角，取轮转到的玩家）。
   */
  async tickOnce(now: number = Date.now()): Promise<void> {
    if (this.ticking) return
    this.ticking = true

    try {
      // 先把排队的命令结算掉（此时不会与 tick 阶段交错）
      this.flushCommands(now)

      const players = Object.values(this.state.players)
      if (players.length === 0) {
        this.lastTickAt = now
        return
      }

      const delta = Math.min(Math.max((now - this.lastTickAt) / 1000, 0.001), 5)
      this.lastTickAt = now
      if (!this.builtinAccountReady) {
        this.builtinAccountReady = true
        const raw = process.env.MAX_ACCOUNT
        if (raw) {
          const [username, password] = raw.split(':')
          if (username && password) this.ensureBuiltinAccount(username, password)
        }
      }
      this.tick += 1

      // 按周目循环：每个活跃层单独跑三个阶段
      // 现在只有第 1 层有内容，但骨架先留着——否则 P6 上线时会漏改这里，
      // 导致第 2 层及以后的玩家永远不被 tick。
      for (const cycle of this.activeCycles()) {
        const cyclePlayers = players.filter(player => (player.cycle ?? 1) === cycle)
        if (cyclePlayers.length === 0) continue

        // 冻结层：最近 2 分钟没有命令活动的周目降频到每 30 tick 一次
        const hotUntil = this.hotCycles.get(cycle) ?? 0
        if (hotUntil <= this.tick && this.tick % 30 !== 0) continue

        this.world.cycle = cycle

        // 阶段 1：每个玩家的队列与任务
        for (const player of cyclePlayers) {
          this.world.player = player
          this.world.locale = this.localeOf(player.id)
          await tickPlayerPhase(this.world, this.ctxFor(player, this.localeOf(player.id)), now)
          if (this.world.player.campaignProgress) {
            checkAllActiveQuestsProgress(this.world.player, this.world.npcs, this.world)
          }
        }

        // 阶段 2：NPC 世界（轮转「当前玩家」视角）
        const ambient = cyclePlayers[this.npcCursor % cyclePlayers.length]
        this.npcCursor += 1
        this.world.player = ambient
        this.world.locale = this.localeOf(ambient.id)
        await tickNpcPhase(this.world, this.ctxFor(ambient, this.localeOf(ambient.id)), now, delta)
        if (!this.world.gates && this.state.gates) this.world.gates = this.state.gates
        const captures = tickGatePhase(this.world, delta)
        if (this.world.gates) this.state.gates = this.world.gates
        this.announceCaptures(captures)

        // 阶段 3：成就 / 战役 / 全局清理
        for (let i = 0; i < cyclePlayers.length; i++) {
          const player = cyclePlayers[i]
          this.world.player = player
          this.world.locale = this.localeOf(player.id)
          this.world.achievementAccum = this.state.achievementAccum[player.id] ?? 0
          tickPlayerPostPhase(this.world, this.ctxFor(player, this.localeOf(player.id)), delta, {
            cleanupEliminated: i === cyclePlayers.length - 1
          })
          this.state.achievementAccum[player.id] = this.world.achievementAccum
        }
      }

      this.broadcast(now)
      this.dirty = true
    } finally {
      this.ticking = false
    }
  }

  /* -------------------------------- 广播 --------------------------------- */

  private static isEmptyPatch(patch: ReturnType<typeof buildPatch>): boolean {
    return (
      !patch.self &&
      !patch.reports &&
      !patch.planets &&
      !patch.removedPlanets &&
      !patch.npcs &&
      !patch.debrisFields &&
      !patch.players &&
      !patch.events
    )
  }

  /** 给所有在线玩家下发增量补丁 */
  broadcast(now: number): void {
    for (const session of this.sessions.values()) {
      const player = this.state.players[session.playerId]
      if (!player) continue

      const events = session.events.splice(0, session.events.length)
      const patch = buildPatch(this.world, player, session.patchState, {
        tick: this.tick,
        now,
        visibility: this.options.visibility,
        events
      })

      if (Room.isEmptyPatch(patch)) continue
      session.connection.send(patch)
    }
  }

  /** 仅用于测试/诊断：当前在线玩家的 ID */
  onlinePlayerIds(): string[] {
    return [...this.sessions.keys()]
  }

  /** 仅用于测试/诊断：读取某个玩家的公开档案 */
  profileOf(playerId: string): Player | undefined {
    return this.state.players[playerId]
  }

  /** 仅用于测试/诊断：NPC 数量 */
  npcCount(): number {
    return this.state.npcs.length
  }

  /** 仅用于测试/诊断：可见星系快照（绕过 socket） */
  snapshotFor(playerId: string): WorldSnapshot | null {
    const player = this.state.players[playerId]
    if (!player) return null
    return buildSnapshot(this.world, player, { tick: this.tick, now: Date.now(), visibility: this.options.visibility })
  }

  /** 仅用于测试/诊断：当前所有玩家 */
  players(): Player[] {
    return allPlayers(this.world)
  }

  /** 仅用于测试/诊断：补充 NPC 星球（例如测试环境想快速加满） */
  ensureNpcPlanets(count: number, prefix = 'Planet'): void {
    generateNpcPlanets(this.world, prefix, count)
    this.dirty = true
  }
}
