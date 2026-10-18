/**
 * 命令层（Command Layer）
 *
 * 所有会改变游戏状态的操作都必须走这里，而不是由 UI 直接改 store。
 * 这样做的目的：
 * 1. 服务端可以复用同一套校验逻辑（防作弊）；
 * 2. 玩家操作变成可序列化的数据，便于联机传输与回放；
 * 3. UI 只关心「成功/失败」，不关心规则细节。
 *
 * 约定：
 * - 命令只描述「意图」，所有校验与副作用都在这里完成；
 * - 成功返回 `{ ok: true }`（需要时带产物）；
 * - 失败返回 `{ ok: false, reason? }`，reason 是 i18n key，缺省时由调用方给出兜底文案。
 */
import type {
  BuildQueueItem,
  ChatMessage,
  DefenseType,
  ExpeditionZone,
  Fleet,
  FleetMission,
  MissileAttack,
  OfficerType,
  Planet,
  Player,
  Position,
  Resources
} from '@/types/game'
import { BuildingType, MissionType, ShipType, TechnologyType } from '@/types/game'
import type { EngineContext, World } from './types'
import { allPlayers, collectAllPlanets, findPlanetAt, findPlayerById, replaceArray } from './world'
import { getWorldLayout, hopsBetween, systemIdAt } from './galaxyContext'
import { laneHops } from '@/logic/hyperlaneLogic'
import { planMissionRoute, resolveDistance } from '@/logic/fleetRouteLogic'
import { computeRouteTolls } from '@/logic/tollLogic'
import { scheduleCycleJump } from '@/logic/cycleLogic'
import { signalOf } from '@/logic/signalLogic'
import { getRouteMode } from '@/config/routeMode'
import * as buildingLogic from '@/logic/buildingLogic'
import * as buildingValidation from '@/logic/buildingValidation'
import * as researchLogic from '@/logic/researchLogic'
import * as researchValidation from '@/logic/researchValidation'
import * as shipLogic from '@/logic/shipLogic'
import * as shipValidation from '@/logic/shipValidation'
import * as fleetLogic from '@/logic/fleetLogic'
import * as missileLogic from '@/logic/missileLogic'
import * as officerLogic from '@/logic/officerLogic'
import * as planetLogic from '@/logic/planetLogic'
import * as resourceLogic from '@/logic/resourceLogic'
import * as waitingQueueLogic from '@/logic/waitingQueueLogic'
import * as gameLogic from '@/logic/gameLogic'
import { EXPEDITION_ZONES } from '@/config/gameConfig'

/** 传感器阵列单次扫描消耗的重氢（原先硬编码在 GalaxyView 中） */
export const PHALANX_SCAN_COST = 5000

/** 星图扫描：每跳消耗的重氢 */
export const GALAXY_SCAN_DEUTERIUM_PER_HOP = 25
/** 星图扫描：同一恒星系的冷却时间 */
export const GALAXY_SCAN_COOLDOWN_MS = 10 * 60 * 1000
/** 星图扫描：基础射程（跳），再叠加天体物理等级 */
export const GALAXY_SCAN_RANGE_BASE = 2

/** 单条聊天消息最大长度 */
export const MAX_CHAT_LENGTH = 160
/** 同一玩家发送聊天的最小间隔 */
export const CHAT_COOLDOWN_MS = 1000
/** 每个玩家保留的聊天记录条数 */
export const MAX_CHAT_HISTORY = 100

/** 舰队派遣命令参数 */
export interface FleetSendCommand {
  type: 'fleet.send'
  originPlanetId: string
  targetPosition: Position
  missionType: MissionType
  fleet: Partial<Fleet>
  cargo?: Resources
  /** 目标是否为月球 */
  isMoonTarget?: boolean
  /** 是否为赠送资源（仅运输任务） */
  isGift?: boolean
  giftTargetNpcId?: string
  /** 探险区域（仅探险任务） */
  expeditionZone?: ExpeditionZone
}

/** 所有可派发的游戏命令 */
export type GameCommand =
  // 建筑
  | { type: 'building.upgrade'; planetId: string; buildingType: BuildingType }
  | { type: 'building.demolish'; planetId: string; buildingType: BuildingType }
  | { type: 'building.cancel'; planetId: string; queueId: string }
  // 研究
  | { type: 'research.start'; planetId: string; techType: TechnologyType }
  | { type: 'research.cancel'; planetId: string; queueId: string }
  // 船厂 / 防御
  | { type: 'ship.build'; planetId: string; shipType: ShipType; quantity: number }
  | { type: 'ship.scrap'; planetId: string; shipType: ShipType; quantity: number }
  | { type: 'defense.build'; planetId: string; defenseType: DefenseType; quantity: number }
  // 舰队 / 导弹
  | FleetSendCommand
  | { type: 'fleet.recall'; missionId: string }
  | {
      type: 'missile.launch'
      planetId: string
      targetPosition: Position
      targetPlanetId?: string
      missileCount: number
    }
  // 传感器阵列扫描
  | { type: 'phalanx.scan'; moonId: string; targetPosition: Position }
  // 军官
  | { type: 'officer.hire'; planetId: string; officerType: OfficerType; duration?: number }
  | { type: 'officer.renew'; planetId: string; officerType: OfficerType; duration?: number }
  | { type: 'officer.dismiss'; officerType: OfficerType }
  // 星球
  | { type: 'planet.abandon'; planetId: string }
  // 等待队列
  | { type: 'queue.removeWaiting'; itemId: string; isResearch: boolean; planetId?: string }
  // 聊天（联机模式）
  | { type: 'chat.send'; text: string; toPlayerId?: string }
  // 星图（扫描 / 命名）
  | { type: 'galaxy.scan'; planetId: string; targetSystemId: string }
  | { type: 'galaxy.rename'; systemId: string; name: string }
  | { type: 'galaxy.jump' }
  | { type: 'signal.collect'; systemId: string }
  | { type: 'signal.warp'; systemId: string }
  | { type: 'planet.rename'; planetId: string; name: string }
  | { type: 'queue.addWaiting'; kind: 'building' | 'research'; planetId?: string; itemType: string; targetLevel: number }

/** 命令成功 */
export interface CommandSuccess {
  ok: true
  queueItem?: BuildQueueItem
  mission?: FleetMission
  missileAttack?: MissileAttack
  /** 传感器阵列扫描结果（只在 phalanx.scan 时返回） */
  scan?: FleetMission[]
  /** 星图扫描结果（只在 galaxy.scan 时返回） */
  galaxyScan?: { systemId: string; scans: number; tier: 1 | 2 }
}

/** 命令失败 */
export interface CommandFailure {
  ok: false
  /** i18n key，缺省时由调用方给出兜底文案 */
  reason?: string
}

export type CommandResult = CommandSuccess | CommandFailure

const succeed = (payload: Omit<CommandSuccess, 'ok'> = {}): CommandSuccess => ({ ok: true, ...payload })
const fail = (reason?: string): CommandFailure => ({ ok: false, reason })

/** 在当前玩家的星球中查找目标星球（服务端同样适用：只有自己的星球能被操作） */
const findOwnPlanet = (world: World, planetId: string): Planet | undefined =>
  world.player.planets.find(planet => planet.id === planetId)

const isAtPosition = (
  position: { galaxy: number; system: number; position: number },
  target: { galaxy: number; system: number; position: number }
): boolean =>
  position.galaxy === target.galaxy && position.system === target.system && position.position === target.position

/** 是否处于新手保护期 */
const isProtected = (player: Player, now: number): boolean => (player.protectionUntil ?? 0) > now

/**
 * 收集与目标坐标相关的舰队任务（出发地或目的地在该坐标）
 *
 * 这是传感器阵列的「可见范围」：扫描一个有舰队停靠/进出的坐标，
 * 能看到所有经过这里的任务（NPC 与其它玩家的都算）。
 */
export const collectFleetsAt = (world: World, target: Position): FleetMission[] => {
  const planets = collectAllPlanets(world)
  const originAtTarget = (planetId: string): boolean => {
    const planet = planets.find(candidate => candidate.id === planetId)
    return planet ? isAtPosition(planet.position, target) : false
  }

  const result: FleetMission[] = []
  const push = (missions?: FleetMission[]): void => {
    for (const mission of missions ?? []) {
      if (mission.status === 'arrived') continue
      if (isAtPosition(mission.targetPosition, target) || originAtTarget(mission.originPlanetId)) {
        result.push(mission)
      }
    }
  }

  for (const npc of world.npcs) push(npc.fleetMissions)
  for (const player of allPlayers(world)) push(player.fleetMissions)
  return result
}

/**
 * 执行一条命令
 *
 * @param world 世界状态（就地修改）
 * @param ctx 引擎上下文
 * @param command 命令
 */
export const applyCommand = (world: World, ctx: EngineContext, command: GameCommand): CommandResult => {
  const now = ctx.now?.() ?? Date.now()
  const player = world.player

  switch (command.type) {
    /* ---------------------------------- 建筑 ---------------------------------- */
    case 'building.upgrade': {
      const planet = findOwnPlanet(world, command.planetId)
      if (!planet) return fail()

      const validation = buildingValidation.validateBuildingUpgrade(planet, command.buildingType, player.technologies, player.officers)
      if (!validation.valid) return fail(validation.reason)

      // 追踪资源消耗（必须在扣除前计算成本）
      const currentLevel = planet.buildings[command.buildingType] || 0
      const cost = buildingLogic.calculateBuildingCost(command.buildingType, currentLevel + 1)
      gameLogic.trackResourceConsumption(player, cost)

      const queueItem = buildingValidation.executeBuildingUpgrade(planet, command.buildingType, player.officers)
      planet.buildQueue.push(queueItem)
      return succeed({ queueItem })
    }

    case 'building.demolish': {
      const planet = findOwnPlanet(world, command.planetId)
      if (!planet) return fail()

      const validation = buildingValidation.validateBuildingDemolish(planet, command.buildingType, player.officers)
      if (!validation.valid) return fail(validation.reason)

      const queueItem = buildingValidation.executeBuildingDemolish(planet, command.buildingType, player.officers)
      planet.buildQueue.push(queueItem)
      return succeed({ queueItem })
    }

    case 'building.cancel': {
      const planet = findOwnPlanet(world, command.planetId)
      if (!planet) return fail()

      const { item, index } = buildingValidation.findQueueItem(planet.buildQueue, command.queueId)
      if (!item || index < 0) return fail()

      if (item.type === 'building') {
        const refund = buildingValidation.cancelBuildingUpgrade(planet, item)
        resourceLogic.addResources(planet.resources, refund)
      }
      planet.buildQueue.splice(index, 1)
      return succeed()
    }

    /* ---------------------------------- 研究 ---------------------------------- */
    case 'research.start': {
      const planet = findOwnPlanet(world, command.planetId)
      if (!planet) return fail()

      const validation = researchValidation.validateTechnologyResearch(
        planet,
        command.techType,
        player.technologies,
        player.researchQueue
      )
      if (!validation.valid) return fail(validation.reason)

      const currentLevel = player.technologies[command.techType] || 0

      // 追踪资源消耗（必须在扣除前计算成本）
      const cost = researchLogic.calculateTechnologyCost(command.techType, currentLevel + 1)
      gameLogic.trackResourceConsumption(player, cost)

      const { queueItem } = researchValidation.executeTechnologyResearch(
        planet,
        command.techType,
        currentLevel,
        player.officers,
        player.technologies,
        player.planets
      )
      player.researchQueue.push(queueItem)
      return succeed({ queueItem })
    }

    case 'research.cancel': {
      const planet = findOwnPlanet(world, command.planetId)
      if (!planet) return fail()

      const { item, index } = buildingValidation.findQueueItem(player.researchQueue, command.queueId)
      if (!item || index < 0) return fail()

      if (item.type === 'technology') {
        const refund = researchValidation.cancelTechnologyResearch(item)
        resourceLogic.addResources(planet.resources, refund)
      }
      player.researchQueue.splice(index, 1)
      return succeed()
    }

    /* ------------------------------- 船厂 / 防御 ------------------------------- */
    case 'ship.build': {
      const planet = findOwnPlanet(world, command.planetId)
      if (!planet) return fail()

      const validation = shipValidation.validateShipBuild(planet, command.shipType, command.quantity, player.technologies)
      if (!validation.valid) return fail(validation.reason)

      const totalCost = shipLogic.calculateShipCost(command.shipType, command.quantity)
      gameLogic.trackResourceConsumption(player, totalCost)

      const queueItem = shipValidation.executeShipBuild(planet, command.shipType, command.quantity, player.officers)
      planet.buildQueue.push(queueItem)
      return succeed({ queueItem })
    }

    case 'ship.scrap': {
      const planet = findOwnPlanet(world, command.planetId)
      if (!planet) return fail()

      const validation = shipValidation.validateShipScrap(planet, command.shipType, command.quantity)
      if (!validation.valid) return fail(validation.reason)

      const queueItem = shipValidation.executeShipScrap(planet, command.shipType, command.quantity, player.officers)
      planet.buildQueue.push(queueItem)
      return succeed({ queueItem })
    }

    case 'defense.build': {
      const planet = findOwnPlanet(world, command.planetId)
      if (!planet) return fail()

      const validation = shipValidation.validateDefenseBuild(planet, command.defenseType, command.quantity, player.technologies)
      if (!validation.valid) return fail(validation.reason)

      const totalCost = shipLogic.calculateDefenseCost(command.defenseType, command.quantity)
      gameLogic.trackResourceConsumption(player, totalCost)

      const queueItem = shipValidation.executeDefenseBuild(planet, command.defenseType, command.quantity, player.officers)
      planet.buildQueue.push(queueItem)
      return succeed({ queueItem })
    }

    /* -------------------------------- 舰队 / 导弹 ------------------------------ */
    case 'fleet.send': {
      const planet = findOwnPlanet(world, command.originPlanetId)
      if (!planet) return fail()

      const cargo: Resources = command.cargo ?? { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 }
      const currentMissions = player.fleetMissions.length

      const validation = shipValidation.validateFleetDispatch(
        planet,
        command.fleet,
        cargo,
        player.officers,
        currentMissions,
        player.technologies
      )
      if (!validation.valid) return fail(validation.reason)

      // 新手保护：保护期内的玩家既不能攻击他人，也不能被攻击
      const hostileMission = command.missionType === MissionType.Attack || command.missionType === MissionType.Spy
      const targetPlanet = findPlanetAt(world, command.targetPosition)
      const targetOwner = targetPlanet ? findPlayerById(world, targetPlanet.ownerId) : undefined

      if (hostileMission && targetOwner && targetOwner.id !== player.id) {
        if (isProtected(targetOwner, now)) return fail('errors.targetProtected')
        if (isProtected(player, now)) return fail('errors.attackerProtected')
      }

      const fuelNeeded = validation.fuelNeeded ?? 0
      if (fuelNeeded > 0) {
        gameLogic.trackResourceConsumption(player, { deuterium: fuelNeeded })
        gameLogic.trackFuelConsumption(player, fuelNeeded)
      }

      const shouldDeductCargo = command.missionType === MissionType.Transport
      shipValidation.executeFleetDispatch(planet, command.fleet, fuelNeeded, shouldDeductCargo, cargo)

      const distance = resolveDistance(world, planet.position, command.targetPosition)
      const bonuses = officerLogic.calculateActiveBonuses(player.officers, now)
      const minSpeed = shipLogic.calculateFleetMinSpeed(command.fleet, bonuses.fleetSpeedBonus)

      // v2：跨恒星系时生成多段航线（逐段经停），否则沿用单段
      const routePlan =
        getRouteMode() === 'v2' && command.missionType !== MissionType.Expedition
          ? planMissionRoute(world, planet.position, command.targetPosition, minSpeed, now)
          : null
      const useRoute = !!routePlan && routePlan.legs.length > 1

      // 用"全程时长"创建任务：这样返程时间 = 去程总时长，不会只按最后一段算
      let flightTime = useRoute
        ? Math.max(10, Math.round((routePlan!.legs[routePlan!.legs.length - 1]!.arriveAt - now) / 1000))
        : fleetLogic.calculateFlightTime(distance, minSpeed)

      // 探险任务应用区域飞行时间倍率
      if (command.missionType === MissionType.Expedition && command.expeditionZone) {
        const zoneConfig = EXPEDITION_ZONES[command.expeditionZone]
        flightTime = Math.floor(flightTime * zoneConfig.flightTimeMultiplier)
      }

      const mission = fleetLogic.createFleetMission(
        player.id,
        planet.id,
        command.targetPosition,
        command.missionType,
        command.fleet,
        cargo,
        flightTime
      )

      if (useRoute && routePlan) {
        mission.route = routePlan.legs
        mission.routeIndex = 0
        mission.arrivalTime = routePlan.legs[0]!.arriveAt

        // 过路费：经过他国星门时收费，收益归所有者（NPC 星门视为系统回收）
        const tolls = computeRouteTolls(world, routePlan.legs, player.id)
        if (tolls.total > 0) {
          planet.resources.deuterium = Math.max(0, planet.resources.deuterium - tolls.total)
          for (const [ownerId, amount] of Object.entries(tolls.credits)) {
            const owner = findPlayerById(world, ownerId)
            const target = owner?.planets[0]
            if (target) target.resources.deuterium += amount
          }
        }
      }

      // 如果目标是月球，设置标记
      if (command.isMoonTarget) {
        mission.targetIsMoon = true
      }

      // 如果是赠送模式，标记任务
      if (command.missionType === MissionType.Transport && command.isGift && command.giftTargetNpcId) {
        mission.isGift = true
        mission.giftTargetNpcId = command.giftTargetNpcId
      }

      // 如果是探险任务，设置探险区域
      if (command.missionType === MissionType.Expedition && command.expeditionZone) {
        mission.expeditionZone = command.expeditionZone
      }

      player.fleetMissions.push(mission)

      // PvP：攻击/侦查其它玩家时，给防守方生成来袭警报
      if (hostileMission && targetOwner && targetPlanet && targetOwner.id !== player.id) {
        if (!targetOwner.incomingFleetAlerts) targetOwner.incomingFleetAlerts = []
        const fleetSize = Object.values(mission.fleet).reduce((sum, count) => sum + (count ?? 0), 0)
        targetOwner.incomingFleetAlerts.push({
          id: mission.id,
          // 复用 NPC 警报结构：把发起者写进 npcId/npcName 字段
          npcId: player.id,
          npcName: player.name,
          missionType: mission.missionType,
          targetPlanetId: targetPlanet.id,
          targetPlanetName: targetPlanet.name,
          arrivalTime: mission.arrivalTime,
          fleetSize,
          read: false
        })
      }

      return succeed({ mission })
    }

    case 'fleet.recall': {
      const mission = player.fleetMissions.find(candidate => candidate.id === command.missionId)
      if (!mission) return fail()

      const recalled = fleetLogic.recallFleetMission(mission, now)
      return recalled ? succeed() : fail()
    }

    case 'missile.launch': {
      const planet = findOwnPlanet(world, command.planetId)
      if (!planet) return fail()

      const validation = missileLogic.validateMissileLaunch(
        planet,
        command.targetPosition,
        command.missileCount,
        player.technologies
      )
      if (!validation.valid) return fail(validation.reason)

      // 新手保护同样适用于导弹：不能打保护期内的玩家
      const missileTarget = findPlanetAt(world, command.targetPosition)
      const missileTargetOwner = missileTarget ? findPlayerById(world, missileTarget.ownerId) : undefined
      if (missileTargetOwner && missileTargetOwner.id !== player.id) {
        if (isProtected(missileTargetOwner, now)) return fail('errors.targetProtected')
        if (isProtected(player, now)) return fail('errors.attackerProtected')
      }

      const missileAttack = missileLogic.createMissileAttack(
        player.id,
        planet,
        command.targetPosition,
        command.targetPlanetId,
        command.missileCount
      )

      // 扣除导弹
      missileLogic.executeMissileLaunch(planet, command.missileCount)

      player.missileAttacks.push(missileAttack)
      return succeed({ missileAttack })
    }

    /* ------------------------------ 传感器阵列扫描 ----------------------------- */
    case 'phalanx.scan': {
      const moon = findOwnPlanet(world, command.moonId)
      if (!moon || !moon.isMoon) return fail()

      // 射程按航道跳数计算：1 级 = 2 跳，每级 +1 跳
      const level = moon.buildings[BuildingType.SensorPhalanx] ?? 0
      if (level <= 0) return fail('errors.requirementsNotMet')
      const maxHops = level + 1
      const hops = hopsBetween(world, moon.position, command.targetPosition, maxHops)
      if (!Number.isFinite(hops)) return fail('galaxyView.phalanxOutOfRange')

      if (moon.resources.deuterium < PHALANX_SCAN_COST) {
        return fail('galaxyView.phalanxInsufficientDeuterium')
      }

      moon.resources.deuterium -= PHALANX_SCAN_COST

      // 扫描结果由服务端计算（客户端看不到 NPC 的舰队任务）
      return succeed({ scan: collectFleetsAt(world, command.targetPosition) })
    }

    /* ---------------------------------- 军官 ---------------------------------- */
    case 'officer.hire': {
      const planet = findOwnPlanet(world, command.planetId)
      if (!planet) return fail()

      const cost = officerLogic.getOfficerCost(command.officerType)
      if (!resourceLogic.checkResourcesAvailable(planet.resources, cost)) {
        return fail('officersView.insufficientResources')
      }

      gameLogic.trackResourceConsumption(player, cost)
      resourceLogic.deductResources(planet.resources, cost)
      player.officers[command.officerType] = officerLogic.createActiveOfficer(command.officerType, command.duration ?? 7)
      return succeed()
    }

    case 'officer.renew': {
      const planet = findOwnPlanet(world, command.planetId)
      if (!planet) return fail()

      const cost = officerLogic.getOfficerCost(command.officerType)
      if (!resourceLogic.checkResourcesAvailable(planet.resources, cost)) {
        return fail('officersView.insufficientResources')
      }

      gameLogic.trackResourceConsumption(player, cost)
      resourceLogic.deductResources(planet.resources, cost)
      player.officers[command.officerType] = officerLogic.renewOfficerExpiration(
        player.officers[command.officerType],
        command.duration ?? 7,
        now
      )
      return succeed()
    }

    case 'officer.dismiss': {
      player.officers[command.officerType] = officerLogic.createInactiveOfficer(command.officerType)
      return succeed()
    }

    /* ---------------------------------- 星球 ---------------------------------- */
    case 'planet.abandon': {
      const check = planetLogic.canAbandonColony(player.planets, command.planetId)
      if (!check.canAbandon) return fail(check.reason)

      // 就地替换，保持数组引用（不能直接赋值，否则会切断与 Pinia 的连接）
      replaceArray(player.planets, planetLogic.abandonColony(player.planets, command.planetId))
      return succeed()
    }

    /* --------------------------------- 等待队列 -------------------------------- */
    case 'queue.removeWaiting': {
      if (command.isResearch) {
        waitingQueueLogic.removeFromResearchWaitingQueue(player, command.itemId)
      } else {
        const planet = command.planetId ? findOwnPlanet(world, command.planetId) : player.planets[0]
        if (!planet) return fail()
        waitingQueueLogic.removeFromBuildWaitingQueue(planet, command.itemId)
      }
      return succeed()
    }

    /* ----------------------------------- 聊天 ---------------------------------- */
    case 'chat.send': {
      const text = command.text.trim().slice(0, MAX_CHAT_LENGTH)
      if (!text) return fail()

      // 防刷屏：同一玩家 1 秒内只能发一条
      const lastOwnMessage = (player.chatMessages ?? [])
        .filter(message => message.fromId === player.id)
        .reduce((latest, message) => Math.max(latest, message.timestamp), 0)
      if (now - lastOwnMessage < CHAT_COOLDOWN_MS) return fail()

      const message: ChatMessage = {
        id: `chat_${now}_${player.id}_${Math.floor(Math.random() * 1000)}`,
        timestamp: now,
        fromId: player.id,
        fromName: player.name,
        toId: command.toPlayerId,
        text,
        read: false
      }

      // 私聊只投递给双方，公共频道投递给所有玩家
      const recipients = command.toPlayerId
        ? [player, findPlayerById(world, command.toPlayerId)].filter((candidate): candidate is Player => !!candidate)
        : allPlayers(world)

      for (const recipient of recipients) {
        if (!recipient.chatMessages) recipient.chatMessages = []
        recipient.chatMessages.push({ ...message })
        // 只保留最近若干条，避免存档无限膨胀
        if (recipient.chatMessages.length > MAX_CHAT_HISTORY) {
          recipient.chatMessages.splice(0, recipient.chatMessages.length - MAX_CHAT_HISTORY)
        }
      }

      return succeed()
    }

    /* ----------------------------------- 星图 ---------------------------------- */
    case 'galaxy.scan': {
      const planet = findOwnPlanet(world, command.planetId)
      if (!planet) return fail('errors.planetNotFound')

      const layout = getWorldLayout(world)
      const target = layout.systemIndex.get(command.targetSystemId)
      if (!target || target.cycle !== (world.cycle ?? 1)) return fail('errors.scanOutOfRange')

      // 射程：基础 2 跳 + 天体物理每 2 级 +1 跳
      const astrophysics = player.technologies[TechnologyType.Astrophysics] ?? 0
      const maxHops = GALAXY_SCAN_RANGE_BASE + Math.floor(astrophysics / 2)
      const fromSystemId = systemIdAt(world, planet.position)
      const hops = laneHops(layout.adjacency, fromSystemId, target.id, maxHops)
      if (!Number.isFinite(hops)) return fail('errors.scanOutOfRange')

      const probes = planet.fleet[ShipType.EspionageProbe] ?? 0
      if (probes < 1) return fail('errors.scanNoProbe')
      const deuteriumCost = GALAXY_SCAN_DEUTERIUM_PER_HOP * Math.max(1, hops)
      if (planet.resources.deuterium < deuteriumCost) return fail('errors.scanInsufficientDeuterium')

      const now = ctx.now ? ctx.now() : Date.now()
      const existing = player.discoveredSystems?.[target.id]
      if (existing && now - existing.at < GALAXY_SCAN_COOLDOWN_MS) return fail('errors.scanCooldown')

      planet.fleet[ShipType.EspionageProbe] = probes - 1
      planet.resources.deuterium -= deuteriumCost
      const scans = (existing?.scans ?? 0) + 1
      player.discoveredSystems = {
        ...(player.discoveredSystems ?? {}),
        [target.id]: { at: now, scans, named: existing?.named }
      }

      return succeed({ galaxyScan: { systemId: target.id, scans, tier: scans >= 2 ? 2 : 1 } })
    }

    case 'queue.addWaiting': {
      if (command.kind === 'building') {
        const target = player.planets.find(planet => planet.id === command.planetId)
        if (!target) return fail('errors.requirementsNotMet')
        const item = waitingQueueLogic.createBuildingWaitingItem(
          command.itemType as BuildingType,
          command.targetLevel,
          target.id
        )
        const check = waitingQueueLogic.canAddToBuildWaitingQueue(target, item, player.officers)
        if (!check.canAdd) return fail(check.reason ?? 'errors.requirementsNotMet')
        waitingQueueLogic.addToBuildWaitingQueue(target, item)
        return succeed()
      }

      const item = waitingQueueLogic.createResearchWaitingItem(
        command.itemType as TechnologyType,
        command.targetLevel
      )
      const check = waitingQueueLogic.canAddToResearchWaitingQueue(player, item)
      if (!check.canAdd) return fail(check.reason ?? 'errors.requirementsNotMet')
      waitingQueueLogic.addToResearchWaitingQueue(player, item)
      return succeed()
    }
    case 'planet.rename': {
      const target = player.planets.find(planet => planet.id === command.planetId)
      if (!target) return { ok: false, reason: 'errors.requirementsNotMet' }
      const name = command.name.trim()
      if (name.length < 2) return { ok: false, reason: 'errors.renameTooShort' }

      // 星球名不可重名（自己 + 其他玩家 + NPC 星球）
      const taken = [
        ...(world.players ?? []).flatMap(other => other.planets),
        ...Object.values(world.planets ?? {})
      ].some(planet => planet.id !== target.id && planet.name.toLowerCase() === name.toLowerCase())
      if (taken) return { ok: false, reason: 'errors.nameTaken' }

      target.name = name.slice(0, 20)
      return { ok: true }
    }
    case 'signal.warp': {
      const record = player.discoveredSystems?.[command.systemId]
      if (!record) return { ok: false, reason: 'errors.requiresDiscovery' }
      if (record.wormholeUsed) return { ok: false, reason: 'errors.alreadyClaimed' }

      const signal = signalOf(world.layoutSeed ?? 20261018, command.systemId, [...getWorldLayout(world).systemIndex.keys()])
      if (!signal || signal.kind !== 'wormhole' || !signal.targetSystemId) {
        return { ok: false, reason: 'errors.noSignal' }
      }

      const planet = player.planets[0]
      const WORMHOLE_COST = 1000
      if (!planet || planet.resources.deuterium < WORMHOLE_COST) {
        return { ok: false, reason: 'errors.insufficientResources' }
      }

      planet.resources.deuterium -= WORMHOLE_COST
      record.wormholeUsed = true
      player.discoveredSystems ??= {}
      player.discoveredSystems[signal.targetSystemId] = { at: now, scans: 1 }
      return { ok: true }
    }
    case 'signal.collect': {
      const record = player.discoveredSystems?.[command.systemId]
      if (!record) return { ok: false, reason: 'errors.requiresDiscovery' }
      if (record.signalClaimed) return { ok: false, reason: 'errors.alreadyClaimed' }

      const signal = signalOf(world.layoutSeed ?? 20261018, command.systemId, [...getWorldLayout(world).systemIndex.keys()])
      if (!signal || signal.kind === 'wormhole') return { ok: false, reason: 'errors.noSignal' }

      const target = player.planets[0]
      if (!target) return { ok: false, reason: 'errors.requirementsNotMet' }
      target.resources.metal += signal.reward.metal
      target.resources.crystal += signal.reward.crystal
      target.resources.deuterium += signal.reward.deuterium
      record.signalClaimed = true
      return { ok: true }
    }
    case 'galaxy.jump': {
      // 24 小时准备期，倒计时结束由 tick 执行
      const plan = scheduleCycleJump(world, player, now)
      if (!plan) return { ok: false, reason: 'errors.requirementsNotMet' }
      return { ok: true }
    }
    case 'galaxy.rename': {
      const record = player.discoveredSystems?.[command.systemId]
      if (!record) return fail('errors.scanOutOfRange')

      const name = command.name.trim().replace(/\s+/g, ' ').slice(0, 24)
      if (name.length < 2) return fail('errors.renameTooShort')

      // 恒星系名不可重名：布局默认名 + 其他玩家的自定义名
      const layout = getWorldLayout(world)
      const takenBySystem = [...layout.systemIndex.values()].some(
        system => system.id !== command.systemId && system.name.toLowerCase() === name.toLowerCase()
      )
      const takenByCustom = allPlayers(world).some(other =>
        Object.entries(other.discoveredSystems ?? {}).some(
          ([id, record]) => id !== command.systemId && record.named && record.name?.toLowerCase() === name.toLowerCase()
        )
      )
      if (takenBySystem || takenByCustom) return fail('errors.nameTaken')

      // 命名权归首个命名者；已命名后其它人不能再改
      const owner = allPlayers(world).find(other => other.discoveredSystems?.[command.systemId]?.namedBy)?.discoveredSystems?.[
        command.systemId
      ]?.namedBy
      if (owner && owner !== player.id) return fail('errors.renameAlreadyNamed')

      // 名字随发现记录同步：所有"已发现该星系"的玩家都会看到新名字
      for (const other of allPlayers(world)) {
        const otherRecord = other.discoveredSystems?.[command.systemId]
        if (!otherRecord) continue
        other.discoveredSystems![command.systemId] = {
          ...otherRecord,
          named: true,
          name,
          namedBy: player.id
        }
      }

      return succeed()
    }

    default: {
      // 穷尽性检查：新增命令时必须在此登记
      const exhaustive: never = command
      return fail(`unknown command: ${JSON.stringify(exhaustive)}`)
    }
  }
}
