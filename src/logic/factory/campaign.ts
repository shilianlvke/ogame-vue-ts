import type { BuildingId, CampaignGoal, CampaignQuest, CampaignReward, EquipmentId, MaterialId, PayloadId, PlanetFactory, SuitTier, TechId } from '@/types/factory'
import { instanceCount, totalLevel, grantBuilding, upgradeBuildingFree } from './engine'
import { productionWindow } from './diagnostics'
import { CAMPAIGN_QUESTS } from '@/config/factory/campaign'

/** 工程服等级序 */
const SUIT_ORDER: SuitTier[] = ['basic', 'reinforced', 'modular']

/**
 * 战役任务判定与奖励，对应规划书 §10。
 * 目标实时判定（达到阈值即完成），奖励手动领取，章节内顺序解锁、章节需前一章全部完成。
 */

/** 目标判定所需的全部状态 */
export interface CampaignContext {
  factory: PlanetFactory
  /** 波次首通记录 */
  clearCounts: Record<number, number>
  /** 前哨数量 */
  outposts: number
  /** 全部前哨航线合计运力 */
  routeCapacity: number
  /** 舰船池 */
  ships: Record<string, number>
  /** 当前周目 */
  cycle: number
  /** 累计发射次数 */
  launchCount: number
}

/** 任务奖励发放目标（跨工厂状态的部分） */
export interface CampaignAccount {
  ships: Record<string, number>
  darkMatter: number
}

export type QuestStatus = 'locked' | 'active' | 'ready' | 'claimed'

/** 单目标是否达成 */
export function isGoalMet(goal: CampaignGoal, ctx: CampaignContext): boolean {
  const target = String(goal.target)
  switch (goal.type) {
    case 'produce':
      return productionWindow.materialRate(target as MaterialId) >= goal.amount
    case 'building':
      return instanceCount(ctx.factory, target as BuildingId) >= goal.amount
    case 'buildingLevel':
      return totalLevel(ctx.factory, target as BuildingId) >= goal.amount
    case 'buildingTotal':
      return ctx.factory.buildings.length >= goal.amount
    case 'material':
      return (ctx.factory.stock[target as MaterialId] ?? 0) >= goal.amount
    case 'payload':
      return (ctx.factory.payloads[target as PayloadId] ?? 0) >= goal.amount
    case 'ship':
      return (ctx.ships[target] ?? 0) >= goal.amount
    case 'research':
      return ctx.factory.techs.includes(target as TechId)
    case 'wave':
      return (ctx.clearCounts[Number(target)] ?? 0) >= goal.amount
    case 'outpost':
      return ctx.outposts >= goal.amount
    case 'routeCapacity':
      return ctx.routeCapacity >= goal.amount
    case 'cycle':
      return ctx.cycle >= goal.amount
    case 'launch':
      return ctx.launchCount >= goal.amount
    default:
      return false
  }
}

/** 任务是否完成（主目标 + 全部子目标） */
export function isQuestComplete(quest: CampaignQuest, ctx: CampaignContext): boolean {
  return isGoalMet(quest.main, ctx) && quest.sub.every(g => isGoalMet(g, ctx))
}

/** 目标当前进度与阈值，供进度条显示 */
export function goalProgress(goal: CampaignGoal, ctx: CampaignContext): { current: number; target: number } {
  const target = String(goal.target)
  let current = 0
  switch (goal.type) {
    case 'produce':
      current = productionWindow.materialRate(target as MaterialId)
      break
    case 'building':
      current = instanceCount(ctx.factory, target as BuildingId)
      break
    case 'buildingLevel':
      current = totalLevel(ctx.factory, target as BuildingId)
      break
    case 'buildingTotal':
      current = ctx.factory.buildings.length
      break
    case 'material':
      current = ctx.factory.stock[target as MaterialId] ?? 0
      break
    case 'payload':
      current = ctx.factory.payloads[target as PayloadId] ?? 0
      break
    case 'ship':
      current = ctx.ships[target] ?? 0
      break
    case 'research':
      current = ctx.factory.techs.includes(target as TechId) ? 1 : 0
      break
    case 'wave':
      current = ctx.clearCounts[Number(target)] ?? 0
      break
    case 'outpost':
      current = ctx.outposts
      break
    case 'routeCapacity':
      current = ctx.routeCapacity
      break
    case 'cycle':
      current = ctx.cycle
      break
    case 'launch':
      current = ctx.launchCount
      break
  }
  return { current, target: goal.amount }
}

/** 章节是否解锁：前一章全部任务完成 */
export function isChapterUnlocked(chapter: number, ctx: CampaignContext): boolean {
  if (chapter <= 1) return true
  const prev = CAMPAIGN_QUESTS.filter(q => q.chapter === chapter - 1)
  return prev.length > 0 && prev.every(q => isQuestComplete(q, ctx))
}

/** 任务状态 */
export function questStatus(quest: CampaignQuest, ctx: CampaignContext, claimed: Set<string>): QuestStatus {
  if (claimed.has(quest.id)) return 'claimed'
  if (!isChapterUnlocked(quest.chapter, ctx)) return 'locked'
  const chapterQuests = CAMPAIGN_QUESTS.filter(q => q.chapter === quest.chapter)
  const idx = chapterQuests.findIndex(q => q.id === quest.id)
  if (idx > 0 && !isQuestComplete(chapterQuests[idx - 1]!, ctx)) return 'locked'
  return isQuestComplete(quest, ctx) ? 'ready' : 'active'
}

/** 发放任务奖励：材料/载荷/装备/舰船/暗物质/建筑/等级/配方解锁/加成/工程服 */
export function applyReward(reward: CampaignReward, factory: PlanetFactory, account: CampaignAccount): void {
  if (reward.materials) {
    for (const [k, v] of Object.entries(reward.materials)) {
      const id = k as MaterialId
      factory.stock[id] = (factory.stock[id] ?? 0) + (v as number)
    }
  }
  if (reward.payloads) {
    for (const [k, v] of Object.entries(reward.payloads)) {
      const id = k as PayloadId
      factory.payloads[id] = (factory.payloads[id] ?? 0) + (v as number)
    }
  }
  if (reward.equipment) {
    for (const [k, v] of Object.entries(reward.equipment)) {
      const id = k as EquipmentId
      factory.equipment[id] = (factory.equipment[id] ?? 0) + (v as number)
    }
  }
  if (reward.ships) {
    for (const [k, v] of Object.entries(reward.ships)) account.ships[k] = (account.ships[k] ?? 0) + (v as number)
  }
  if (reward.darkMatter) account.darkMatter += reward.darkMatter
  if (reward.buildings) {
    for (const [k, v] of Object.entries(reward.buildings)) {
      const id = k as BuildingId
      for (let i = 0; i < (v as number); i++) grantBuilding(factory, id)
    }
  }
  if (reward.buildingLevels) {
    for (const [k, v] of Object.entries(reward.buildingLevels)) {
      upgradeBuildingFree(factory, k as BuildingId, v as number)
    }
  }
  if (reward.unlockRecipes) {
    const set = new Set(factory.unlockedRecipes ?? [])
    for (const r of reward.unlockRecipes) set.add(r)
    factory.unlockedRecipes = [...set]
  }
  if (reward.recipeBonus) {
    factory.recipeBonus = { ...(factory.recipeBonus ?? {}) }
    for (const [k, v] of Object.entries(reward.recipeBonus)) {
      factory.recipeBonus[k] = (factory.recipeBonus[k] ?? 0) + (v as number)
    }
  }
  if (reward.moduleSlotBonus) {
    factory.moduleSlotBonus = (factory.moduleSlotBonus ?? 0) + reward.moduleSlotBonus
  }
  if (reward.suit) {
    const cur = factory.suit ? (SUIT_ORDER.indexOf(factory.suit) ?? 0) : -1
    const next = SUIT_ORDER.indexOf(reward.suit) ?? 0
    if (next > cur) factory.suit = reward.suit
  }
}
