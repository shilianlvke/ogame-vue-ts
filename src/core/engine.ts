/**
 * 游戏主循环（无头引擎）
 *
 * 原本写在 App.vue 里的 1 秒 tick 编排，现在是一个只依赖 World + EngineContext 的纯函数式入口。
 *
 * 为了同时服务「单机」和「服务端多人」，主循环被拆成三个阶段：
 *
 * 1. `tickPlayerPhase`  —— 玩家自己的建造/研究队列、舰队任务、导弹
 * 2. `tickNpcPhase`     —— NPC 世界的舰队任务、成长、行为（**每 tick 只跑一次**）
 * 3. `tickPlayerPostPhase` —— 成就、战役进度、被消灭 NPC 清理
 *
 * 单机模式用 `tick()` 按 1→2→3 顺序执行，行为与改造前完全一致；
 * 服务端则对每个玩家执行 1，再执行一次 2，最后对每个玩家执行 3。
 */
import type { EngineContext, World } from './types'
import { processMissionArrival, processMissionReturn, processMissileAttackArrival, processNpcMissionArrival, processNpcMissionReturn } from './missions'
import { updateNpcBehavior, updateNpcGrowth, updateNpcRelationStats } from './npc'
import { removeNpcPlanetsFromUniverse, replaceArray } from './world'
import { tickGatePhase } from './gatePhase'
import { applyCycleJump } from '@/logic/cycleLogic'
import * as gameLogic from '@/logic/gameLogic'
import * as campaignLogic from '@/logic/campaignLogic'
import * as diplomaticLogic from '@/logic/diplomaticLogic'
import * as publicLogic from '@/logic/publicLogic'

/** 成就检查间隔（秒） */
export const ACHIEVEMENT_CHECK_INTERVAL = 5

/**
 * 检查成就解锁（原 checkAchievementUnlocks）
 */
const checkAchievements = (world: World, ctx: EngineContext, deltaSeconds: number): void => {
  world.achievementAccum += deltaSeconds

  if (world.achievementAccum < ACHIEVEMENT_CHECK_INTERVAL) {
    return
  }

  // 更新NPC关系统计
  updateNpcRelationStats(world)

  // 检查并解锁成就
  const unlocks = gameLogic.checkAndUnlockAchievements(world.player)

  // 通知（奖励已在 checkAndUnlockAchievements 中应用）
  unlocks.forEach(unlock => {
    ctx.emit({ kind: 'achievement', id: unlock.id, tier: String(unlock.tier) })
  })

  // 重算积分（排行榜与 NPC 难度都依赖它；单机原本在 App.vue 里每 10 秒算一次）
  world.player.points = publicLogic.calculatePlayerPoints(world.player)

  world.achievementAccum = 0
}

/**
 * 清理已被消灭的 NPC（所有星球都被摧毁）
 */
const cleanupEliminatedNpcs = (world: World): void => {
  const eliminatedNpcIds = diplomaticLogic.checkAndHandleEliminatedNPCs(world.npcs, world.player, world.locale)
  if (eliminatedNpcIds.length === 0) return

  // 从宇宙地图中移除被消灭NPC的星球数据，并收集需要清理的任务ID
  const missionIdsToRemove: string[] = []
  eliminatedNpcIds.forEach(npcId => {
    const npc = world.npcs.find(candidate => candidate.id === npcId)
    if (!npc) return
    removeNpcPlanetsFromUniverse(world, npc)
    if (npc.fleetMissions) {
      npc.fleetMissions.forEach(mission => missionIdsToRemove.push(mission.id))
    }
  })

  // 清理玩家的即将到来舰队警报（移除已消灭NPC的任务警报）
  if (world.player.incomingFleetAlerts && missionIdsToRemove.length > 0) {
    const remainingAlerts = world.player.incomingFleetAlerts.filter(alert => !missionIdsToRemove.includes(alert.id))
    replaceArray(world.player.incomingFleetAlerts, remainingAlerts)
  }

  // 从NPC列表中移除被消灭的NPC（就地修改）
  const remainingNpcs = world.npcs.filter(npc => !eliminatedNpcIds.includes(npc.id))
  replaceArray(world.npcs, remainingNpcs)
}

/**
 * 阶段 1：玩家自身的推进（每个玩家执行一次）
 *
 * 处理顺序：军官过期 → 建造/研究队列 → 舰队任务到达/返回 → 导弹攻击
 */
export const tickPlayerPhase = async (world: World, ctx: EngineContext, now: number): Promise<void> => {
  // 周目跃迁倒计时结束：执行跃迁
  if (world.player.cycleJumpAt && now >= world.player.cycleJumpAt) {
    world.player.cycleJumpAt = undefined
    applyCycleJump(world, world.player)
  }
  // 1. 检查军官过期
  gameLogic.checkOfficersExpiration(world.player.officers, now)

  // 2. 处理建造队列、研究队列、资源产出等
  const result = gameLogic.processGameUpdate(
    world.player,
    now,
    world.gameSpeed,
    (type, itemType, level) => {
      ctx.emit({
        kind: 'queueComplete',
        category: type as 'building' | 'technology' | 'ship' | 'defense',
        itemType,
        level
      })
    },
    items => ctx.emit({ kind: 'unlocks', items })
  )
  world.player.researchQueue = result.updatedResearchQueue

  // 3. 玩家舰队任务
  for (const mission of [...world.player.fleetMissions]) {
    if (mission.status === 'outbound' && now >= mission.arrivalTime) {
      await processMissionArrival(world, ctx, mission, now)
    } else if (mission.status === 'returning' && mission.returnTime && now >= mission.returnTime) {
      processMissionReturn(world, mission)
    }
  }

  // 4. 导弹攻击任务（反向循环以便安全删除）
  for (let i = world.player.missileAttacks.length - 1; i >= 0; i--) {
    const missileAttack = world.player.missileAttacks[i]
    if (missileAttack && missileAttack.status === 'flying' && now >= missileAttack.arrivalTime) {
      processMissileAttackArrival(world, ctx, missileAttack, now)
      // 导弹攻击是单程的，到达后直接从数组中移除
      world.player.missileAttacks.splice(i, 1)
    }
  }
}

/**
 * 阶段 2：NPC 世界推进（每 tick 只执行一次，与玩家数量无关）
 *
 * 处理顺序：NPC 舰队任务 → NPC 成长 → NPC 行为决策
 */
export const tickNpcPhase = async (world: World, ctx: EngineContext, now: number, deltaSeconds: number = 1): Promise<void> => {
  // 1. NPC 舰队任务（快照遍历，避免结算过程中修改数组导致漏处理）
  for (const npc of [...world.npcs]) {
    if (!npc.fleetMissions) continue
    for (const mission of [...npc.fleetMissions]) {
      if (mission.status === 'outbound' && now >= mission.arrivalTime) {
        await processNpcMissionArrival(world, npc, mission, now)
      } else if (mission.status === 'returning' && mission.returnTime && now >= mission.returnTime) {
        processNpcMissionReturn(npc, mission)
      }
    }
  }

  // 2. NPC 成长
  updateNpcGrowth(world, ctx, deltaSeconds)

  // 3. NPC 行为（侦查和攻击决策）
  updateNpcBehavior(world, ctx, deltaSeconds)
}

/**
 * 阶段 3：玩家相关的收尾（每个玩家执行一次）
 *
 * 处理顺序：成就 → 战役进度 → 被消灭 NPC 清理
 *
 * @param options.cleanupEliminated 是否执行全局清理（服务端只让最后一个玩家触发一次）
 */
export const tickPlayerPostPhase = (
  world: World,
  ctx: EngineContext,
  deltaSeconds: number = 1,
  options: { cleanupEliminated?: boolean } = {}
): void => {
  // 1. 成就
  checkAchievements(world, ctx, deltaSeconds)

  // 2. 战役任务进度
  if (world.player.campaignProgress) {
    campaignLogic.checkAllActiveQuestsProgress(world.player, world.npcs, world)
  }

  // 3. 清理被消灭的 NPC
  if (options.cleanupEliminated) {
    cleanupEliminatedNpcs(world)
  }
}

/**
 * 推进一个 tick（单机模式：完整的三阶段）
 *
 * @param world 世界状态（就地修改）
 * @param ctx 引擎上下文（翻译 / 事件出口 / 随机源）
 * @param now 当前时间戳（毫秒）
 * @param deltaSeconds 距离上次 tick 的秒数（默认 1）
 */
export const tick = async (world: World, ctx: EngineContext, now: number, deltaSeconds: number = 1): Promise<void> => {
  await tickPlayerPhase(world, ctx, now)
  await tickNpcPhase(world, ctx, now, deltaSeconds)
  tickGatePhase(world, deltaSeconds)
  tickPlayerPostPhase(world, ctx, deltaSeconds, { cleanupEliminated: true })
}

/** 重新导出常用工具，方便调用方从单一入口引入 */
export { positionKey } from './world'
