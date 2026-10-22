/**
 * 舰队任务 / 导弹任务结算
 *
 * 从 App.vue 的编排代码中抽取而来，保持与原有行为完全一致，
 * 但不再依赖 Pinia（改为操作 World）与 Vue（改为通过 ctx 抛出事件）。
 */
import type { FleetMission, MissileAttack, MissionReport } from '@/types/game'
import { MissionType } from '@/types/game'
import type { EngineContext, World } from './types'
import {
  allPlayers,
  collectAllPlanets,
  findMissionTarget,
  findPlanetAt,
  findPlayerById,
  positionKey,
  removeIncomingFleetAlert
} from './world'
import * as fleetLogic from '@/logic/fleetLogic'
import { advanceMissionLeg } from '@/logic/fleetRouteLogic'
import * as gameLogic from '@/logic/gameLogic'
import * as shipLogic from '@/logic/shipLogic'
import * as resourceLogic from '@/logic/resourceLogic'
import * as missileLogic from '@/logic/missileLogic'

/** 追加任务报告（保持原有「字段不存在则初始化」的兼容行为） */
const pushMissionReport = (world: World, report: MissionReport): void => {
  if (!world.player.missionReports) {
    world.player.missionReports = []
  }
  world.player.missionReports.push(report)
}

/** 把坐标格式化为兜底名称 */
const formatPosition = (position: { galaxy: number; system: number; position: number }): string =>
  `[${position.galaxy}:${position.system}:${position.position}]`

/**
 * 玩家舰队任务到达
 */
export const processMissionArrival = async (world: World, ctx: EngineContext, mission: FleetMission, now: number): Promise<void> => {
  // 多段航行：还没到最终目的地，先推进到下一段（不做任何任务结算）
  if (advanceMissionLeg(mission)) return

  const t = ctx.t
  const targetPlanet = findMissionTarget(world, mission)
  const targetKey = positionKey(mission.targetPosition)

  // 获取起始星球名称（用于报告）
  const originPlanet = world.player.planets.find(planet => planet.id === mission.originPlanetId)
  const originPlanetName = originPlanet?.name || t('fleetView.unknownPlanet')

  if (mission.missionType === MissionType.Transport) {
    // 在处理任务之前保存货物信息（因为 processTransportArrival 会清空 cargo）
    const transportedResources = { ...mission.cargo }
    const result = fleetLogic.processTransportArrival(mission, targetPlanet, world.player)

    // 更新成就统计（仅在成功时追踪）
    if (result.success) {
      const totalTransported =
        transportedResources.metal + transportedResources.crystal + transportedResources.deuterium + transportedResources.darkMatter
      gameLogic.trackMissionStats(world.player, 'transport', { resourcesAmount: totalTransported })
    }

    // 生成失败原因消息
    let transportFailMessage = t('missionReports.transportFailed')
    if (!result.success && result.failReason) {
      if (result.failReason === 'targetNotFound') {
        transportFailMessage = t('missionReports.transportFailedTargetNotFound')
      }
    }

    pushMissionReport(world, {
      id: `mission-report-${mission.id}`,
      timestamp: now,
      missionType: MissionType.Transport,
      originPlanetId: mission.originPlanetId,
      originPlanetName,
      targetPosition: mission.targetPosition,
      targetPlanetId: targetPlanet?.id,
      targetPlanetName: targetPlanet?.name || formatPosition(mission.targetPosition),
      success: result.success,
      message: result.success ? t('missionReports.transportSuccess') : transportFailMessage,
      details: {
        transportedResources,
        failReason: result.failReason
      },
      read: false
    })
  } else if (mission.missionType === MissionType.Attack) {
    // 联机 PvP：如果目标是另一位玩家，把防守方传进去（影响科技/军官加成）
    const pvpDefender = targetPlanet ? findPlayerById(world, targetPlanet.ownerId) : undefined
    const defenderPlayer = pvpDefender && pvpDefender.id !== world.player.id ? pvpDefender : null

    const attackResult = await fleetLogic.processAttackArrival(
      mission,
      targetPlanet,
      world.player,
      defenderPlayer,
      collectAllPlanets(world),
      world.battleToFinish
    )
    if (attackResult) {
      world.player.battleReports.push(attackResult.battleResult)

      // PvP：防守方也收到同一份战报（独立副本，已读状态互不影响）
      if (defenderPlayer) {
        if (!defenderPlayer.battleReports) defenderPlayer.battleReports = []
        defenderPlayer.battleReports.push({ ...attackResult.battleResult, read: false })
        // 来袭警报在结算后移除
        removeIncomingFleetAlert(world, mission.id, defenderPlayer)
      }

      // 更新成就统计 - 攻击
      const debrisValue = attackResult.debrisField
        ? attackResult.debrisField.resources.metal + attackResult.debrisField.resources.crystal
        : 0
      const won = attackResult.battleResult.winner === 'attacker'
      gameLogic.trackAttackStats(world.player, attackResult.battleResult, won, debrisValue)

      // 月球属于防守方（目标星球的主人），而不是攻击方
      if (attackResult.moon) {
        const moon = attackResult.moon
        const moonOwner = findPlayerById(world, moon.ownerId)
        if (moonOwner) {
          moonOwner.planets.push(moon)
        } else {
          // 无主/未知归属的月球同步到宇宙地图，才能被其它玩家看到
          world.planets[positionKey(moon.position)] = moon
        }
      }
      if (attackResult.debrisField) {
        world.debrisFields[attackResult.debrisField.id] = attackResult.debrisField
      }
    }
  } else if (mission.missionType === MissionType.Colonize) {
    const colonizeResult = fleetLogic.processColonizeArrival(mission, targetPlanet, world.player, t('planet.colonyPrefix'))
    const newPlanet = colonizeResult.planet

    // 更新成就统计 - 殖民
    if (colonizeResult.success && newPlanet) {
      gameLogic.trackMissionStats(world.player, 'colonize')
    }

    // 生成失败原因消息
    let failMessage = t('missionReports.colonizeFailed')
    if (!colonizeResult.success && colonizeResult.failReason) {
      if (colonizeResult.failReason === 'positionOccupied') {
        failMessage = t('missionReports.colonizeFailedOccupied')
      } else if (colonizeResult.failReason === 'maxColoniesReached') {
        failMessage = t('missionReports.colonizeFailedMaxColonies')
      }
    }

    pushMissionReport(world, {
      id: `mission-report-${mission.id}`,
      timestamp: now,
      missionType: MissionType.Colonize,
      originPlanetId: mission.originPlanetId,
      originPlanetName,
      targetPosition: mission.targetPosition,
      targetPlanetId: newPlanet?.id,
      targetPlanetName: newPlanet?.name,
      success: colonizeResult.success,
      message: colonizeResult.success ? t('missionReports.colonizeSuccess') : failMessage,
      details: newPlanet
        ? {
            newPlanetId: newPlanet.id,
            newPlanetName: newPlanet.name
          }
        : { failReason: colonizeResult.failReason },
      read: false
    })
    if (newPlanet) {
      world.player.planets.push(newPlanet)
    }
  } else if (mission.missionType === MissionType.Spy) {
    // PvP 侦查：把防守方传入，visibility 才会按双方间谍技术计算
    const spyDefenderCandidate = targetPlanet ? findPlayerById(world, targetPlanet.ownerId) : undefined
    const spyDefender = spyDefenderCandidate && spyDefenderCandidate.id !== world.player.id ? spyDefenderCandidate : null

    const spyResult = fleetLogic.processSpyArrival(mission, targetPlanet, world.player, spyDefender)
    if (spyResult.success && spyResult.report) {
      world.player.spyReports.push(spyResult.report)
      // 更新成就统计 - 侦查
      gameLogic.trackMissionStats(world.player, 'spy')
    }

    let spyFailMessage = t('missionReports.spyFailed')
    if (!spyResult.success && spyResult.failReason) {
      if (spyResult.failReason === 'targetNotFound') {
        spyFailMessage = t('missionReports.spyFailedTargetNotFound')
      }
    }

    pushMissionReport(world, {
      id: `mission-report-${mission.id}`,
      timestamp: now,
      missionType: MissionType.Spy,
      originPlanetId: mission.originPlanetId,
      originPlanetName,
      targetPosition: mission.targetPosition,
      targetPlanetId: targetPlanet?.id,
      targetPlanetName: targetPlanet?.name || formatPosition(mission.targetPosition),
      success: spyResult.success,
      message: spyResult.success ? t('missionReports.spySuccess') : spyFailMessage,
      details: spyResult.success ? { spyReportId: spyResult.report?.id } : { failReason: spyResult.failReason },
      read: false
    })
  } else if (mission.missionType === MissionType.Deploy) {
    const deployed = fleetLogic.processDeployArrival(mission, targetPlanet, world.player.id, world.player.technologies)

    // 更新成就统计 - 部署
    if (deployed.success) {
      gameLogic.trackMissionStats(world.player, 'deploy')
    }

    // 生成失败原因消息
    let deployFailMessage = t('missionReports.deployFailed')
    if (!deployed.success && deployed.failReason) {
      if (deployed.failReason === 'targetNotFound') {
        deployFailMessage = t('missionReports.deployFailedTargetNotFound')
      } else if (deployed.failReason === 'notOwnPlanet') {
        deployFailMessage = t('missionReports.deployFailedNotOwnPlanet')
      }
    }

    pushMissionReport(world, {
      id: `mission-report-${mission.id}`,
      timestamp: now,
      missionType: MissionType.Deploy,
      originPlanetId: mission.originPlanetId,
      originPlanetName,
      targetPosition: mission.targetPosition,
      targetPlanetId: targetPlanet?.id,
      targetPlanetName: targetPlanet?.name || formatPosition(mission.targetPosition),
      success: deployed.success,
      message: deployed.success ? t('missionReports.deploySuccess') : deployFailMessage,
      details: {
        deployedFleet: mission.fleet,
        failReason: deployed.failReason
      },
      read: false
    })
    if (deployed.success && !deployed.overflow) {
      const missionIndex = world.player.fleetMissions.indexOf(mission)
      if (missionIndex > -1) world.player.fleetMissions.splice(missionIndex, 1)
      return
    }
  } else if (mission.missionType === MissionType.Recycle) {
    // 处理回收任务
    const debrisId = `debris_${mission.targetPosition.galaxy}_${mission.targetPosition.system}_${mission.targetPosition.position}`
    const debrisField = world.debrisFields[debrisId]
    const recycleResult = fleetLogic.processRecycleArrival(mission, debrisField)

    // 更新成就统计 - 回收（无论是否有残骸都算飞行任务，但只有成功回收才计入回收资源量）
    const totalRecycled =
      recycleResult.success && recycleResult.collectedResources
        ? recycleResult.collectedResources.metal + recycleResult.collectedResources.crystal
        : 0
    gameLogic.trackMissionStats(world.player, 'recycle', { resourcesAmount: totalRecycled })

    // 生成失败原因消息
    let recycleFailMessage = t('missionReports.recycleFailed')
    if (!recycleResult.success && recycleResult.failReason) {
      if (recycleResult.failReason === 'noDebrisField') {
        recycleFailMessage = t('missionReports.recycleFailedNoDebris')
      } else if (recycleResult.failReason === 'debrisEmpty') {
        recycleFailMessage = t('missionReports.recycleFailedDebrisEmpty')
      }
    }

    pushMissionReport(world, {
      id: `mission-report-${mission.id}`,
      timestamp: now,
      missionType: MissionType.Recycle,
      originPlanetId: mission.originPlanetId,
      originPlanetName,
      targetPosition: mission.targetPosition,
      success: recycleResult.success,
      message: recycleResult.success ? t('missionReports.recycleSuccess') : recycleFailMessage,
      details: recycleResult.success
        ? {
            recycledResources: recycleResult.collectedResources,
            remainingDebris: recycleResult.remainingDebris || undefined
          }
        : { failReason: recycleResult.failReason },
      read: false
    })

    if (recycleResult.success && recycleResult.collectedResources && debrisField) {
      if (recycleResult.remainingDebris && (recycleResult.remainingDebris.metal > 0 || recycleResult.remainingDebris.crystal > 0)) {
        // 更新残骸场
        world.debrisFields[debrisId] = {
          id: debrisField.id,
          position: debrisField.position,
          resources: recycleResult.remainingDebris,
          createdAt: debrisField.createdAt,
          expiresAt: debrisField.expiresAt
        }
      } else {
        // 残骸场已被完全收集，删除
        delete world.debrisFields[debrisId]
      }
    }
  } else if (mission.missionType === MissionType.Destroy) {
    // 处理行星毁灭任务（需要先战斗，再计算毁灭概率）
    const pvpCandidate = targetPlanet ? findPlayerById(world, targetPlanet.ownerId) : undefined
    const destroyDefender = pvpCandidate && pvpCandidate.id !== world.player.id ? pvpCandidate : null

    const destroyResult = await fleetLogic.processDestroyArrival(
      mission,
      targetPlanet,
      world.player,
      destroyDefender,
      collectAllPlanets(world),
      world.battleToFinish
    )

    // 处理战斗报告（如果发生了战斗）
    if (destroyResult.battleResult) {
      world.player.battleReports.push(destroyResult.battleResult)

      // PvP：防守方也收到战报
      if (destroyDefender) {
        if (!destroyDefender.battleReports) destroyDefender.battleReports = []
        destroyDefender.battleReports.push({ ...destroyResult.battleResult, read: false })
      }

    }

    // 处理新生成的月球（归属同攻击结算：属于目标星球的主人）
    if (destroyResult.moon) {
      const moon = destroyResult.moon
      const moonOwner = findPlayerById(world, moon.ownerId)
      if (moonOwner) {
        moonOwner.planets.push(moon)
      } else {
        world.planets[positionKey(moon.position)] = moon
      }
    }

    // 处理残骸场
    if (destroyResult.debrisField) {
      world.debrisFields[destroyResult.debrisField.id] = destroyResult.debrisField
    }

    // 更新成就统计 - 行星毁灭
    if (destroyResult.success) {
      gameLogic.trackMissionStats(world.player, 'destroy')
    }

    // 生成失败原因消息
    let destroyFailMessage = t('missionReports.destroyFailed')
    if (!destroyResult.success && destroyResult.failReason) {
      if (destroyResult.failReason === 'targetNotFound') {
        destroyFailMessage = t('missionReports.destroyFailedTargetNotFound')
      } else if (destroyResult.failReason === 'ownPlanet') {
        destroyFailMessage = t('missionReports.destroyFailedOwnPlanet')
      } else if (destroyResult.failReason === 'noDeathstar') {
        destroyFailMessage = t('missionReports.destroyFailedNoDeathstar')
      } else if (destroyResult.failReason === 'chanceFailed') {
        destroyFailMessage = t('missionReports.destroyFailedChance', { chance: destroyResult.destructionChance.toFixed(1) })
      }
    }

    pushMissionReport(world, {
      id: `mission-report-${mission.id}`,
      timestamp: now,
      missionType: MissionType.Destroy,
      originPlanetId: mission.originPlanetId,
      originPlanetName,
      targetPosition: mission.targetPosition,
      targetPlanetId: targetPlanet?.id,
      targetPlanetName: targetPlanet?.name,
      success: destroyResult.success,
      message: destroyResult.success ? t('missionReports.destroySuccess') : destroyFailMessage,
      details: destroyResult.success
        ? {
            destroyedPlanetName: targetPlanet?.name || formatPosition(mission.targetPosition),
            hadBattle: !!destroyResult.battleResult
          }
        : {
            failReason: destroyResult.failReason,
            destructionChance: destroyResult.destructionChance,
            deathstarsLost: destroyResult.deathstarsLost,
            hadBattle: !!destroyResult.battleResult
          },
      read: false
    })

    if (destroyResult.success && destroyResult.planetId) {
      // 星球被摧毁

      // 从拥有者名下移除被摧毁的星球（玩家或宇宙地图上的无主星球）
      for (const owner of allPlayers(world)) {
        const index = owner.planets.findIndex(planet => planet.id === destroyResult.planetId)
        if (index > -1) {
          owner.planets.splice(index, 1)
          break
        }
      }

      // 宇宙地图上的副本一并清理（无主星球 / 已被摧毁位置的公开记录）
      for (const key of Object.keys(world.planets)) {
        if (world.planets[key]?.id === destroyResult.planetId) {
          delete world.planets[key]
        }
      }
      delete world.planets[targetKey]

      // PvP：防守方失去星球后清理其舰队任务与警报
      if (destroyDefender) {
        removeIncomingFleetAlert(world, mission.id, destroyDefender)
      }

      // 同时删除该位置的残骸场（星球被摧毁后残骸场也消失）
      const destroyedDebrisId = `debris_${mission.targetPosition.galaxy}_${mission.targetPosition.system}_${mission.targetPosition.position}`
      delete world.debrisFields[destroyedDebrisId]
    }
  } else if (mission.missionType === MissionType.Expedition) {
    // 处理探险任务
    const expeditionResult = fleetLogic.processExpeditionArrival(mission)

    // 确保返回时间正确设置（兼容旧版本任务数据）
    // 如果 returnTime 不存在或已过期，重新计算
    if (!mission.returnTime || mission.returnTime <= now) {
      // 返回时间应该等于当前时间加上单程飞行时间
      const flightDuration = mission.arrivalTime - mission.departureTime
      mission.returnTime = now + flightDuration
    }

    // 更新成就统计 - 探险
    const isSuccessful =
      expeditionResult.eventType === 'resources' || expeditionResult.eventType === 'darkMatter' || expeditionResult.eventType === 'fleet'
    gameLogic.trackMissionStats(world.player, 'expedition', { successful: isSuccessful })

    // 根据事件类型生成不同的报告消息
    let reportMessage = ''
    const reportDetails: MissionReport['details'] = {
      // 保存探险区域信息
      expeditionZone: mission.expeditionZone
    }

    switch (expeditionResult.eventType) {
      case 'resources':
        reportMessage = t('missionReports.expeditionResources')
        reportDetails.foundResources = expeditionResult.resources
        break
      case 'darkMatter':
        reportMessage = t('missionReports.expeditionDarkMatter')
        reportDetails.foundResources = expeditionResult.resources
        break
      case 'fleet':
        reportMessage = t('missionReports.expeditionFleet')
        reportDetails.foundFleet = expeditionResult.fleet
        break
      case 'pirates':
        reportMessage = expeditionResult.fleetLost
          ? t('missionReports.expeditionPiratesAttack')
          : t('missionReports.expeditionPiratesEscaped')
        if (expeditionResult.fleetLost) reportDetails.fleetLost = expeditionResult.fleetLost
        break
      case 'aliens':
        reportMessage = expeditionResult.fleetLost
          ? t('missionReports.expeditionAliensAttack')
          : t('missionReports.expeditionAliensEscaped')
        if (expeditionResult.fleetLost) reportDetails.fleetLost = expeditionResult.fleetLost
        break
      default:
        reportMessage = t('missionReports.expeditionNothing')
    }

    pushMissionReport(world, {
      id: `mission-report-${mission.id}`,
      timestamp: now,
      missionType: MissionType.Expedition,
      originPlanetId: mission.originPlanetId,
      originPlanetName,
      targetPosition: mission.targetPosition,
      success: expeditionResult.eventType !== 'nothing',
      message: reportMessage,
      details: reportDetails,
      read: false
    })
  }

  // 更新任务状态为返回中
  // Deploy任务不需要返回（舰队已经留在目标星球）
  if (mission.missionType !== MissionType.Deploy) {
    mission.status = 'returning'
    // 确保 returnTime 已设置（如果还没设置的话）
    if (!mission.returnTime) {
      const flightTime = mission.arrivalTime - mission.departureTime
      mission.returnTime = now + flightTime
    }
  }
}

/**
 * 玩家舰队任务返回
 */
export const processMissionReturn = (world: World, mission: FleetMission): void => {
  const originPlanet = world.player.planets.find(planet => planet.id === mission.originPlanetId)
  if (!originPlanet) return
  shipLogic.addFleet(originPlanet.fleet, mission.fleet)
  resourceLogic.addResources(originPlanet.resources, mission.cargo)
  const missionIndex = world.player.fleetMissions.indexOf(mission)
  if (missionIndex > -1) world.player.fleetMissions.splice(missionIndex, 1)
}

/**
 * 导弹攻击到达
 */
export const processMissileAttackArrival = (world: World, ctx: EngineContext, missileAttack: MissileAttack, now: number): void => {
  const t = ctx.t
  const targetPlanet = findPlanetAt(world, missileAttack.targetPosition)

  // 如果目标星球不存在，导弹失败
  if (!targetPlanet) {
    missileAttack.status = 'arrived'
    // 生成失败报告
    pushMissionReport(world, {
      id: `missile-report-${missileAttack.id}`,
      timestamp: now,
      missionType: MissionType.MissileAttack,
      originPlanetId: missileAttack.originPlanetId,
      originPlanetName:
        world.player.planets.find(planet => planet.id === missileAttack.originPlanetId)?.name || t('fleetView.unknownPlanet'),
      targetPosition: missileAttack.targetPosition,
      targetPlanetId: undefined,
      targetPlanetName: formatPosition(missileAttack.targetPosition),
      success: false,
      message: t('missionReports.missileAttackFailed'),
      details: {
        missileCount: missileAttack.missileCount,
        missileHits: 0,
        missileIntercepted: 0,
        defenseLosses: {}
      },
      read: false
    })
    return
  }

  // 计算导弹攻击结果
  const impactResult = missileLogic.calculateMissileImpact(missileAttack.missileCount, targetPlanet)

  // 应用损失到目标星球
  missileLogic.applyMissileAttackResult(targetPlanet, impactResult.defenseLosses)

  // 标记导弹攻击为已到达
  missileAttack.status = 'arrived'

  // 生成导弹攻击报告
  const reportMessage =
    impactResult.missileHits > 0
      ? `${t('missionReports.missileAttackSuccess')}: ${impactResult.missileHits} ${t('missionReports.hits')}`
      : t('missionReports.missileAttackIntercepted')

  pushMissionReport(world, {
    id: `missile-report-${missileAttack.id}`,
    timestamp: now,
    missionType: MissionType.MissileAttack,
    originPlanetId: missileAttack.originPlanetId,
    originPlanetName:
      world.player.planets.find(planet => planet.id === missileAttack.originPlanetId)?.name || t('fleetView.unknownPlanet'),
    targetPosition: missileAttack.targetPosition,
    targetPlanetId: targetPlanet.id,
    targetPlanetName: targetPlanet.name,
    success: true,
    message: reportMessage,
    details: {
      missileCount: missileAttack.missileCount,
      missileHits: impactResult.missileHits,
      missileIntercepted: impactResult.missileIntercepted,
      defenseLosses: impactResult.defenseLosses
    },
    read: false
  })
}
