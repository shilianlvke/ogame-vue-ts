/**
 * 舰队任务 / 导弹任务结算
 *
 * 从 App.vue 的编排代码中抽取而来，保持与原有行为完全一致，
 * 但不再依赖 Pinia（改为操作 World）与 Vue（改为通过 ctx 抛出事件）。
 */
import type { FleetMission, MissileAttack, MissionReport, NPC } from '@/types/game'
import { DiplomaticEventType, MissionType, ShipType } from '@/types/game'
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
import * as diplomaticLogic from '@/logic/diplomaticLogic'
import * as npcBehaviorLogic from '@/logic/npcBehaviorLogic'
import { DIPLOMATIC_CONFIG } from '@/config/gameConfig'

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
    const isGiftMission = mission.isGift && mission.giftTargetNpcId
    const result = fleetLogic.processTransportArrival(mission, targetPlanet, world.player, world.npcs)

    // 更新成就统计（仅在成功时追踪）
    if (result.success) {
      const totalTransported =
        transportedResources.metal + transportedResources.crystal + transportedResources.deuterium + transportedResources.darkMatter
      if (isGiftMission) {
        gameLogic.trackDiplomacyStats(world.player, 'gift', { resourcesAmount: totalTransported })
      } else {
        gameLogic.trackMissionStats(world.player, 'transport', { resourcesAmount: totalTransported })
      }
    }

    // 生成失败原因消息
    let transportFailMessage = t('missionReports.transportFailed')
    if (!result.success && result.failReason) {
      if (result.failReason === 'targetNotFound') {
        transportFailMessage = t('missionReports.transportFailedTargetNotFound')
      } else if (result.failReason === 'giftRejected') {
        transportFailMessage = t('missionReports.transportFailedGiftRejected')
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

      // 检查是否攻击了NPC星球，更新外交关系
      if (targetPlanet) {
        const targetNpc = world.npcs.find(npc => npc.planets.some(planet => planet.id === targetPlanet.id))
        if (targetNpc) {
          diplomaticLogic.handleAttackReputation(world.player, targetNpc, attackResult.battleResult, world.npcs, world.locale)

          // 同步战斗损失到NPC的实际星球数据
          const npcPlanet = targetNpc.planets.find(planet => planet.id === targetPlanet.id)
          if (npcPlanet) {
            // 同步舰队损失
            Object.entries(attackResult.battleResult.defenderLosses.fleet).forEach(([shipType, lost]) => {
              npcPlanet.fleet[shipType as ShipType] = Math.max(0, (npcPlanet.fleet[shipType as ShipType] || 0) - lost)
            })
            // 同步防御损失（修复后的数据已在 targetPlanet 中）
            npcPlanet.defense = { ...targetPlanet.defense }
            // 同步资源（被掠夺后的）
            npcPlanet.resources = { ...targetPlanet.resources }
          }
        }
      }

      // 月球属于防守方（目标星球的主人），而不是攻击方
      if (attackResult.moon) {
        const moon = attackResult.moon
        const moonOwner = findPlayerById(world, moon.ownerId)
        if (moonOwner) {
          moonOwner.planets.push(moon)
        } else {
          const moonNpc = world.npcs.find(npc => npc.id === moon.ownerId)
          if (moonNpc) {
            moonNpc.planets.push(moon)
          }
          // NPC/未知归属的月球需要同步到宇宙地图，才能被其它玩家看到
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

    const spyResult = fleetLogic.processSpyArrival(mission, targetPlanet, world.player, spyDefender, world.npcs)
    if (spyResult.success && spyResult.report) {
      world.player.spyReports.push(spyResult.report)
      // 更新成就统计 - 侦查
      gameLogic.trackMissionStats(world.player, 'spy')
    }

    // PvP：被侦查的一方收到通知
    if (spyDefender && targetPlanet) {
      if (!spyDefender.spiedNotifications) spyDefender.spiedNotifications = []
      spyDefender.spiedNotifications.push({
        id: `spied_${mission.id}`,
        timestamp: now,
        npcId: world.player.id,
        npcName: world.player.name,
        targetPlanetId: targetPlanet.id,
        targetPlanetName: targetPlanet.name,
        detectionSuccess: true,
        read: false
      })
      removeIncomingFleetAlert(world, mission.id, spyDefender)
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

      // 处理战斗对NPC的影响
      if (targetPlanet) {
        const targetNpc = world.npcs.find(npc => npc.planets.some(planet => planet.id === targetPlanet.id))
        if (targetNpc) {
          diplomaticLogic.handleAttackReputation(world.player, targetNpc, destroyResult.battleResult, world.npcs, world.locale)

          // 同步战斗损失到NPC的实际星球数据
          const npcPlanet = targetNpc.planets.find(planet => planet.id === targetPlanet.id)
          if (npcPlanet) {
            Object.entries(destroyResult.battleResult.defenderLosses.fleet).forEach(([shipType, lost]) => {
              npcPlanet.fleet[shipType as ShipType] = Math.max(0, (npcPlanet.fleet[shipType as ShipType] || 0) - lost)
            })
            npcPlanet.defense = { ...targetPlanet.defense }
            npcPlanet.resources = { ...targetPlanet.resources }
          }
        }
      }
    }

    // 处理新生成的月球（归属同攻击结算：属于目标星球的主人）
    if (destroyResult.moon) {
      const moon = destroyResult.moon
      const moonOwner = findPlayerById(world, moon.ownerId)
      if (moonOwner) {
        moonOwner.planets.push(moon)
      } else {
        const moonNpc = world.npcs.find(npc => npc.id === moon.ownerId)
        if (moonNpc) moonNpc.planets.push(moon)
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

      // 处理外交关系（如果目标是NPC星球）
      if (targetPlanet && targetPlanet.ownerId) {
        const planetOwner = world.npcs.find(npc => npc.id === targetPlanet.ownerId)
        if (planetOwner) {
          diplomaticLogic.handlePlanetDestructionReputation(world.player, targetPlanet, planetOwner, world.npcs, world.locale)

          // 从NPC的星球列表中移除被摧毁的星球
          const npcPlanetIndex = planetOwner.planets.findIndex(planet => planet.id === destroyResult.planetId)
          if (npcPlanetIndex > -1) {
            planetOwner.planets.splice(npcPlanetIndex, 1)
          }

          // 检查并处理被消灭的NPC（所有星球都被摧毁的NPC）
          const eliminatedNpcIds = diplomaticLogic.checkAndHandleEliminatedNPCs(world.npcs, world.player, world.locale)

          // 从 NPC 列表中移除被消灭的NPC（就地修改，保持引用）
          if (eliminatedNpcIds.length > 0) {
            const remaining = world.npcs.filter(npc => !eliminatedNpcIds.includes(npc.id))
            world.npcs.splice(0, world.npcs.length, ...remaining)
          }
        }
      }

      // 从拥有者名下移除被摧毁的星球（玩家或 NPC 都适用）
      let removedFromOwner = false
      for (const owner of allPlayers(world)) {
        const index = owner.planets.findIndex(planet => planet.id === destroyResult.planetId)
        if (index > -1) {
          owner.planets.splice(index, 1)
          removedFromOwner = true
          break
        }
      }
      if (!removedFromOwner) {
        for (const npc of world.npcs) {
          const index = npc.planets.findIndex(planet => planet.id === destroyResult.planetId)
          if (index > -1) {
            npc.planets.splice(index, 1)
            removedFromOwner = true
            break
          }
        }
      }

      // 宇宙地图上的副本一并清理（NPC 星球 / 已被摧毁位置的公开记录）
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

      // 取消所有前往该位置的NPC任务（回收、攻击、侦查等）
      const destroyedDebrisId = `debris_${mission.targetPosition.galaxy}_${mission.targetPosition.system}_${mission.targetPosition.position}`
      world.npcs.forEach(npc => {
        if (npc.fleetMissions) {
          // 找到需要取消的任务（前往已摧毁星球位置的 outbound 任务）
          const missionsToCancel = npc.fleetMissions.filter(candidate => {
            if (candidate.status !== 'outbound') return false
            // 检查回收任务的残骸场ID
            if (candidate.missionType === MissionType.Recycle && candidate.debrisFieldId === destroyedDebrisId) {
              return true
            }
            // 检查其他任务的目标星球ID
            if (candidate.targetPlanetId === destroyResult.planetId) {
              return true
            }
            return false
          })

          // 将这些任务的舰队返回给NPC
          missionsToCancel.forEach(cancelled => {
            const npcOriginPlanet = npc.planets.find(planet => planet.id === cancelled.originPlanetId)
            if (npcOriginPlanet) {
              shipLogic.addFleet(npcOriginPlanet.fleet, cancelled.fleet)
            }
          })

          // 从任务列表中移除这些任务
          npc.fleetMissions = npc.fleetMissions.filter(candidate => !missionsToCancel.includes(candidate))
        }

        // 清理关于被摧毁星球的侦查报告
        if (npc.playerSpyReports && destroyResult.planetId && destroyResult.planetId in npc.playerSpyReports) {
          delete npc.playerSpyReports[destroyResult.planetId]
        }
      })

      // 同时删除该位置的残骸场（星球被摧毁后残骸场也消失）
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
 * NPC 舰队任务到达
 */
export const processNpcMissionArrival = async (world: World, npc: NPC, mission: FleetMission, now: number): Promise<void> => {
  if (mission.missionType === MissionType.Recycle) {
    // NPC回收任务到达
    const debrisId = mission.debrisFieldId
    if (!debrisId) {
      console.warn('[NPC Mission] Recycle mission missing debrisFieldId')
      mission.status = 'returning'
      mission.returnTime = now + (mission.arrivalTime - mission.departureTime)
      return
    }

    const debrisField = world.debrisFields[debrisId]
    const recycleResult = fleetLogic.processRecycleArrival(mission, debrisField)

    if (recycleResult && debrisField && recycleResult.collectedResources) {
      // 更新成就统计 - 被NPC回收残骸（如果残骸是玩家战斗产生的）
      const totalRecycled = recycleResult.collectedResources.metal + recycleResult.collectedResources.crystal
      if (totalRecycled > 0) {
        gameLogic.trackDiplomacyStats(world.player, 'debrisRecycledByNPC', { resourcesAmount: totalRecycled })
      }

      if (recycleResult.remainingDebris && (recycleResult.remainingDebris.metal > 0 || recycleResult.remainingDebris.crystal > 0)) {
        // 更新残骸场
        world.debrisFields[debrisId] = {
          id: debrisField.id,
          position: debrisField.position,
          resources: recycleResult.remainingDebris,
          createdAt: debrisField.createdAt
        }
      } else {
        // 残骸已被完全回收，从宇宙中删除
        delete world.debrisFields[debrisId]
      }
    }

    // 移除即将到来的警告（回收任务已到达）
    removeIncomingFleetAlert(world, mission.id)

    // 设置返回时间
    mission.returnTime = now + (mission.arrivalTime - mission.departureTime)
    return
  }

  // 找到目标星球
  const targetPlanet = findPlanetAt(world, mission.targetPosition)

  if (!targetPlanet) {
    console.warn('[NPC Mission] Target planet not found')
    return
  }

  // 目标星球的真正主人（联机时可能不是当前 world.player）
  const defender = findPlayerById(world, targetPlanet.ownerId) ?? world.player

  if (mission.missionType === MissionType.Spy) {
    // NPC侦查到达
    const { spiedNotification, spyReport } = npcBehaviorLogic.processNPCSpyArrival(npc, mission, targetPlanet, defender)

    // 更新成就统计 - 被NPC侦查
    gameLogic.trackDiplomacyStats(defender, 'spiedByNPC')

    // 保存侦查报告到NPC（用于后续攻击决策）
    if (!npc.playerSpyReports) {
      npc.playerSpyReports = {}
    }
    npc.playerSpyReports[targetPlanet.id] = spyReport

    // 添加被侦查通知给玩家
    if (!defender.spiedNotifications) {
      defender.spiedNotifications = []
    }
    defender.spiedNotifications.push(spiedNotification)

    // 移除即将到来的警告（侦查已到达）
    removeIncomingFleetAlert(world, mission.id, defender)
  } else if (mission.missionType === MissionType.Attack) {
    // NPC攻击到达 - 使用专门的NPC攻击处理逻辑
    const attackResult = await fleetLogic.processNPCAttackArrival(
      npc,
      mission,
      targetPlanet,
      defender,
      defender.planets,
      world.battleToFinish
    )

    if (attackResult) {
      // 更新成就统计 - 被NPC攻击 + 防御统计
      gameLogic.trackDiplomacyStats(defender, 'attackedByNPC')
      const debrisValue = attackResult.debrisField
        ? attackResult.debrisField.resources.metal + attackResult.debrisField.resources.crystal
        : 0
      const won = attackResult.battleResult.winner === 'defender'
      gameLogic.trackDefenseStats(defender, attackResult.battleResult, won, debrisValue)

      // 添加战斗报告给防守方
      defender.battleReports.push(attackResult.battleResult)

      // 如果生成月球，添加到防守方星球列表
      if (attackResult.moon) {
        defender.planets.push(attackResult.moon)
      }

      // 如果生成残骸场，添加到宇宙残骸场列表
      if (attackResult.debrisField) {
        const existingDebris = world.debrisFields[attackResult.debrisField.id]
        if (existingDebris) {
          // 累加残骸资源
          world.debrisFields[attackResult.debrisField.id] = {
            ...existingDebris,
            resources: {
              metal: existingDebris.resources.metal + attackResult.debrisField.resources.metal,
              crystal: existingDebris.resources.crystal + attackResult.debrisField.resources.crystal
            }
          }
        } else {
          // 新残骸场
          world.debrisFields[attackResult.debrisField.id] = attackResult.debrisField
        }
      }
    }

    // 移除即将到来的警告（攻击已到达）
    removeIncomingFleetAlert(world, mission.id, defender)
  }
}

/**
 * NPC 舰队任务返回
 */
export const processNpcMissionReturn = (npc: NPC, mission: FleetMission): void => {
  // 找到NPC的起始星球
  const originPlanet = npc.planets.find(planet => planet.id === mission.originPlanetId)
  if (!originPlanet) return

  // 返还舰队
  shipLogic.addFleet(originPlanet.fleet, mission.fleet)

  // 如果携带掠夺资源，给NPC添加资源
  if (mission.cargo) {
    originPlanet.resources.metal += mission.cargo.metal
    originPlanet.resources.crystal += mission.cargo.crystal
    originPlanet.resources.deuterium += mission.cargo.deuterium
  }

  // 从NPC任务列表中移除
  if (npc.fleetMissions) {
    const missionIndex = npc.fleetMissions.indexOf(mission)
    if (missionIndex > -1) {
      npc.fleetMissions.splice(missionIndex, 1)
    }
  }
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

  // 如果目标是NPC的星球，同步损失到NPC实际数据并扣除外交好感度
  if (targetPlanet.ownerId && targetPlanet.ownerId !== world.player.id) {
    const targetNpc = world.npcs.find(npc => npc.id === targetPlanet.ownerId)
    if (targetNpc) {
      // 同步防御损失到NPC的实际星球数据
      const npcPlanet = targetNpc.planets.find(planet => planet.id === targetPlanet.id)
      if (npcPlanet) {
        missileLogic.applyMissileAttackResult(npcPlanet, impactResult.defenseLosses)
      }

      // 导弹攻击扣除好感度
      const { REPUTATION_CHANGES } = DIPLOMATIC_CONFIG
      const reputationLoss = REPUTATION_CHANGES.ATTACK / 2 // 导弹攻击的好感度惩罚是普通攻击的一半

      // 更新NPC对玩家的关系（统一使用 npc.relations 作为唯一数据源）
      if (!targetNpc.relations) {
        targetNpc.relations = {}
      }
      const npcRelation = diplomaticLogic.getOrCreateRelation(targetNpc.relations, targetNpc.id, world.player.id)
      targetNpc.relations[world.player.id] = diplomaticLogic.updateReputation(
        npcRelation,
        reputationLoss,
        DiplomaticEventType.Attack,
        t('diplomacy.reports.wasAttackedByMissile')
      )
    }
  }

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
