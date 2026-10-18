/**
 * NPC 世界推进：注册表初始化、成长、行为决策、关系统计
 * 从 App.vue 抽取，去掉 Pinia 依赖，提示条改为抛出事件。
 */
import type { DiplomaticRelation, NPC } from '@/types/game'
import type { TechnologyType } from '@/types/game'
import type { EngineContext, World } from './types'
import { allPlayers, collectAllPlanets, inCurrentCycle, replaceArray, syncNpcPlanetToUniverse } from './world'
import { getSystemAt } from './galaxyContext'

/** 恒星系危险度带来的难度加成（danger 1/2/3 → +0/+1/+2） */
const dangerBonusOf = (world: World, npc: NPC): number => {
  const planet = npc.planets[0]
  if (!planet) return 0
  const system = getSystemAt(world, planet.position)
  return system ? system.danger - 1 : 0
}

import * as npcBehaviorLogic from '@/logic/npcBehaviorLogic'
import * as npcGrowthLogic from '@/logic/npcGrowthLogic'
import * as gameLogic from '@/logic/gameLogic'
import * as diplomaticLogic from '@/logic/diplomaticLogic'
import { generateNPCName } from '@/logic/npcNameGenerator'

/** NPC 成长更新间隔（秒） */
export const NPC_GROWTH_INTERVAL = 5
/** NPC 行为更新间隔（秒） */
export const NPC_BEHAVIOR_INTERVAL = 5

/**
 * 首次进入时从宇宙地图反推 NPC 注册表
 * （兼容旧存档：NPC 数据缺失但星球还在）
 *
 * 服务端在第一个玩家加入时会显式调用它，保证 NPC 立即出现。
 */
export const ensureNpcRegistry = (world: World, ctx: EngineContext): void => {
  const cycle = world.cycle ?? 1
  // 注册表按周目构建：切换周目时必须重建，否则会拿到上一层的 NPC。
  // 注意：存档恢复时 npcRegistryCycle 尚未设置，此时直接认领现有注册表，
  // 不能重建——否则会把已保存的外交关系 / 难度 / 冷却全部冲掉。
  if (world.npcs.length > 0) {
    if (world.npcRegistryCycle === undefined) {
      world.npcRegistryCycle = cycle
      return
    }
    if (world.npcRegistryCycle === cycle) return
  }

  const random = ctx.random ?? Math.random
  const now = Date.now()
  const npcMap = new Map<string, NPC>()

  Object.values(world.planets).forEach(planet => {
    // 只处理当前周目的星球
    if (!inCurrentCycle(world, planet)) return
    // 跳过玩家的星球
    if (planet.ownerId === world.player.id || !planet.ownerId) return

    // 这是NPC的星球
    if (!npcMap.has(planet.ownerId)) {
      // 为每个NPC设置随机的初始冷却时间，避免所有NPC同时行动
      const randomSpyOffset = random() * 240 * 1000 // 0-4分钟的随机延迟
      const randomAttackOffset = random() * 480 * 1000 // 0-8分钟的随机延迟

      // 初始化NPC与玩家的中立关系
      const initialRelations: Record<string, DiplomaticRelation> = {}
      initialRelations[world.player.id] = {
        fromId: planet.ownerId,
        toId: world.player.id,
        reputation: 0,
        status: 'neutral',
        lastUpdated: now,
        history: []
      }

      npcMap.set(planet.ownerId, {
        id: planet.ownerId,
        name: generateNPCName(planet.ownerId),
        planets: [],
        technologies: {} as Record<TechnologyType, number>,
        difficulty: 'medium',
        relations: initialRelations, // 外交关系（默认与玩家中立）
        allies: [], // 盟友列表
        enemies: [], // 敌人列表
        lastSpyTime: now - randomSpyOffset, // 设置随机的上次侦查时间
        lastAttackTime: now - randomAttackOffset, // 设置随机的上次攻击时间
        fleetMissions: [], // 舰队任务
        playerSpyReports: {} // 对玩家的侦查报告
      })
    }

    npcMap.get(planet.ownerId)!.planets.push(planet)
  })

  // 就地写入，保持数组引用
  replaceArray(world.npcs, Array.from(npcMap.values()))
  world.npcRegistryCycle = cycle

  // 如果有NPC，基于距离初始化NPC实力
  if (world.npcs.length > 0) {
    // 获取玩家母星（第一个非月球星球）
    const homeworld = world.player.planets.find(planet => !planet.isMoon)

    if (homeworld) {
      world.npcs.forEach(npc => {
        // 基于距离初始化NPC实力
        npcGrowthLogic.initializeNPCByDistance(npc, homeworld.position, dangerBonusOf(world, npc))
        // 同步NPC星球数据到宇宙地图
        syncNpcPlanetToUniverse(world, npc)
      })
    }

    // 初始化NPC之间的外交关系（盟友/敌人）
    npcGrowthLogic.initializeNPCDiplomacy(world.npcs)
  }
}

/**
 * 修复旧存档缺失的 NPC 字段（间谍探测器 / AI 类型 / 与玩家的关系 / 距离难度）
 */
const migrateNpcData = (world: World): void => {
  if (world.npcs.length === 0) return

  npcGrowthLogic.ensureNPCSpyProbes(world.npcs)
  npcGrowthLogic.ensureAllNPCsAIType(world.npcs)

  const now = Date.now()
  // 获取玩家母星（用于计算距离）
  const homeworld = world.player.planets.find(planet => !planet.isMoon)

  world.npcs.forEach(npc => {
    if (!npc.relations) {
      npc.relations = {}
    }
    // 如果NPC没有与玩家的关系，建立中立关系
    if (!npc.relations[world.player.id]) {
      npc.relations[world.player.id] = {
        fromId: npc.id,
        toId: world.player.id,
        reputation: 0,
        status: 'neutral',
        lastUpdated: now,
        history: []
      }
    }

    // 迁移旧存档：如果NPC没有距离数据，计算并设置
    if (homeworld && npc.distanceToHomeworld === undefined) {
      const npcPlanet = npc.planets[0]
      if (npcPlanet) {
        npc.distanceToHomeworld = npcGrowthLogic.calculateDistanceToHomeworld(npcPlanet.position, homeworld.position)
        npc.difficultyLevel = npcGrowthLogic.calculateDifficultyLevel(npc.distanceToHomeworld)
        // 重新初始化NPC实力以匹配新的距离难度系统
        npcGrowthLogic.initializeNPCByDistance(npc, homeworld.position, dangerBonusOf(world, npc))
        // 同步NPC星球数据到宇宙地图
        syncNpcPlanetToUniverse(world, npc)
      }
    }
  })
}

/**
 * NPC 成长推进
 */
export const updateNpcGrowth = (world: World, ctx: EngineContext, deltaSeconds: number): void => {
  const cycle = world.cycle ?? 1
  // 累加器按周目分开，避免「第 1 层跑完清零，第 2 层永远轮不到」
  const accum = (world.npcGrowthAccum[cycle] = (world.npcGrowthAccum[cycle] ?? 0) + deltaSeconds)

  // 只在达到更新间隔时才执行
  if (accum < NPC_GROWTH_INTERVAL) {
    return
  }

  ensureNpcRegistry(world, ctx)
  migrateNpcData(world)

  // 如果没有NPC，直接返回
  if (world.npcs.length === 0) {
    world.npcGrowthAccum[cycle] = 0
    return
  }

  // 获取玩家母星用于距离计算
  const homeworld = world.player.planets.find(planet => !planet.isMoon)

  // 使用累积的时间更新每个NPC（基于距离的成长系统）
  world.npcs.forEach(npc => {
    if (homeworld) {
      npcGrowthLogic.updateNPCGrowthByDistance(npc, homeworld.position, accum, world.gameSpeed)
      // 同步NPC星球数据到宇宙地图（确保侦查报告显示正确数据）
      syncNpcPlanetToUniverse(world, npc)
    }
  })

  // 重置计数器
  world.npcGrowthAccum[cycle] = 0
}

/**
 * NPC 行为推进（侦查 / 攻击 / 交易 / 情报 / 援助等）
 */
export const updateNpcBehavior = (world: World, ctx: EngineContext, deltaSeconds: number): void => {
  const random = ctx.random ?? Math.random
  const cycle = world.cycle ?? 1

  // 与成长一致：行为累加器也按周目分开
  const accum = (world.npcBehaviorAccum[cycle] = (world.npcBehaviorAccum[cycle] ?? 0) + deltaSeconds)

  // 只在达到更新间隔时才执行
  if (accum < NPC_BEHAVIOR_INTERVAL) {
    return
  }

  // 如果没有NPC，直接返回
  if (world.npcs.length === 0) {
    world.npcBehaviorAccum[cycle] = 0
    return
  }

  const now = Date.now()
  // 合并玩家星球和NPC星球（NPC需要能够侦查和攻击玩家星球）
  const allPlanets = collectAllPlanets(world)

  // 计算当前所有正在进行的侦查和攻击任务数量
  let activeSpyMissions = 0
  let activeAttackMissions = 0
  world.npcs.forEach(npc => {
    if (npc.fleetMissions) {
      npc.fleetMissions.forEach(mission => {
        if (mission.status === 'outbound') {
          if (mission.missionType === 'spy') {
            activeSpyMissions++
          } else if (mission.missionType === 'attack') {
            activeAttackMissions++
          }
        }
      })
    }
  })

  // 获取并发限制配置
  const config = npcBehaviorLogic.calculateDynamicBehavior(world.player.points)

  // 多人服务器：每个 NPC 自己选择本次行动的目标玩家
  const players = allPlayers(world)

  // 更新每个NPC的行为（随机顺序，避免总是优先处理同一批NPC）
  const shuffledNpcs = [...world.npcs].sort(() => random() - 0.5)
  shuffledNpcs.forEach(npc => {
    const target = npcBehaviorLogic.selectNPCBehaviorTarget(npc, players)
    if (!target) return

    // 在更新前检查当前并发数，如果已达上限则跳过该NPC
    npcBehaviorLogic.updateNPCBehaviorWithLimit(
      npc,
      target,
      allPlanets,
      world.debrisFields,
      now,
      {
        activeSpyMissions,
        activeAttackMissions,
        config
      },
      players
    )

    // 重新计算当前并发数（因为可能新增了任务）
    activeSpyMissions = 0
    activeAttackMissions = 0
    world.npcs.forEach(candidate => {
      if (candidate.fleetMissions) {
        candidate.fleetMissions.forEach(mission => {
          if (mission.status === 'outbound') {
            if (mission.missionType === 'spy') activeSpyMissions++
            else if (mission.missionType === 'attack') activeAttackMissions++
          }
        })
      }
    })

    // 处理增强NPC行为（中立和友好NPC的特殊行为）
    const relation = npc.relations?.[target.id]
    if (relation?.status === 'neutral') {
      const neutralResult = npcBehaviorLogic.updateNeutralNPCBehavior(npc, world.npcs, target, now)

      // 处理贸易提议
      if (neutralResult.tradeOffer) {
        if (!target.tradeOffers) {
          target.tradeOffers = []
        }
        target.tradeOffers.push(neutralResult.tradeOffer)
        ctx.emit(
          {
            kind: 'toast',
            variant: 'info',
            messageKey: 'npcBehavior.tradeOfferReceived',
            descriptionKey: 'npcBehavior.tradeOfferDesc',
            descriptionParams: { npcName: neutralResult.tradeOffer.npcName }
          },
          target.id
        )
      }

      // 处理态度摇摆
      if (neutralResult.swingDirection) {
        if (!target.attitudeChangeNotifications) {
          target.attitudeChangeNotifications = []
        }
        target.attitudeChangeNotifications.push({
          id: `attitude_${Date.now()}_${npc.id}`,
          timestamp: now,
          npcId: npc.id,
          npcName: npc.name,
          previousStatus: 'neutral',
          newStatus: neutralResult.swingDirection,
          reason: 'attitude_swing',
          read: false
        })
        const statusKey = neutralResult.swingDirection === 'friendly' ? 'npcBehavior.becameFriendly' : 'npcBehavior.becameHostile'
        ctx.emit(
          {
            kind: 'toast',
            variant: 'info',
            messageKey: 'npcBehavior.attitudeChanged',
            descriptionKey: statusKey,
            descriptionParams: { npcName: npc.name }
          },
          target.id
        )
      }
    } else if (relation?.status === 'friendly') {
      const friendlyResult = npcBehaviorLogic.updateFriendlyNPCBehavior(npc, world.npcs, target, now)

      // 处理情报报告
      if (friendlyResult.intelReport) {
        if (!target.intelReports) {
          target.intelReports = []
        }
        target.intelReports.push(friendlyResult.intelReport)
        ctx.emit(
          {
            kind: 'toast',
            variant: 'info',
            messageKey: 'npcBehavior.intelReceived',
            descriptionKey: 'npcBehavior.intelReceivedDesc',
            descriptionParams: { npcName: friendlyResult.intelReport.fromNpcName }
          },
          target.id
        )
      }

      // 处理联合攻击邀请
      if (friendlyResult.jointAttackInvite) {
        if (!target.jointAttackInvites) {
          target.jointAttackInvites = []
        }
        target.jointAttackInvites.push(friendlyResult.jointAttackInvite)
        ctx.emit(
          {
            kind: 'toast',
            variant: 'info',
            messageKey: 'npcBehavior.jointAttackInvite',
            descriptionKey: 'npcBehavior.jointAttackInviteDesc',
            descriptionParams: { npcName: friendlyResult.jointAttackInvite.fromNpcName }
          },
          target.id
        )
      }

      // 处理资源援助
      if (friendlyResult.aidProvided) {
        if (!target.aidNotifications) {
          target.aidNotifications = []
        }
        target.aidNotifications.push({
          id: `aid_${Date.now()}_${npc.id}`,
          timestamp: now,
          npcId: npc.id,
          npcName: npc.name,
          aidResources: friendlyResult.aidProvided,
          read: false
        })
        const totalAid = friendlyResult.aidProvided.metal + friendlyResult.aidProvided.crystal + friendlyResult.aidProvided.deuterium
        ctx.emit(
          {
            kind: 'toast',
            variant: 'success',
            messageKey: 'npcBehavior.aidReceived',
            descriptionKey: 'npcBehavior.aidReceivedDesc',
            descriptionParams: { npcName: npc.name, amount: totalAid.toLocaleString() }
          },
          target.id
        )
      }
    }
  })

  world.npcBehaviorAccum[world.cycle ?? 1] = 0
}

/**
 * 更新NPC关系统计（友好/敌对数量）
 */
export const updateNpcRelationStats = (world: World): void => {
  let friendlyCount = 0
  let hostileCount = 0
  const playerId = world.player.id
  world.npcs.forEach(npc => {
    const relation = npc.relations?.[playerId]
    if (relation) {
      const status = diplomaticLogic.calculateRelationStatus(relation.reputation)
      if (status === 'friendly') {
        friendlyCount++
      } else if (status === 'hostile') {
        hostileCount++
      }
    }
  })
  gameLogic.trackDiplomacyStats(world.player, 'updateRelations', { friendlyCount, hostileCount })
}
