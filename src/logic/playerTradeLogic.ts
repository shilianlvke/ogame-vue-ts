/**
 * 玩家间资源交易
 *
 * 规则：
 * - 发起方放置 offer，接受方支付 request；
 * - 双方都必须解锁「星球航空港 1 级 + 超时空转移技术 1 级」；
 * - 交易损耗按双方各自的基础设施分别计算，最终取较高值；
 * - 创建时只校验数量格式，不锁资源；
 * - 接受时由服务端重新校验双方资源并原子结算；
 * - 交易双方各自保存一份相同 id 的提议，靠 reports.playerTrades 同步。
 */
import type { Player, PlayerTradeOffer, PlayerTradeResources } from '@/types/game'
import { BuildingType, TechnologyType } from '@/types/game'
import { PLAYER_TRADE_CONFIG } from '@/config/gameConfig'

export const PLAYER_TRADE_EXPIRY_MS = PLAYER_TRADE_CONFIG.EXPIRY_MS
const MAX_TRADE_AMOUNT = 1_000_000_000_000

const RESOURCE_KEYS = ['metal', 'crystal', 'deuterium'] as const

export interface PlayerTradeStatus {
  unlocked: boolean
  spaceportLevel: number
  techLevel: number
  lossPercent: number
}

export const emptyTradeResources = (): PlayerTradeResources => ({ metal: 0, crystal: 0, deuterium: 0 })

/** 把前端/存档传入的资源数量收敛为非负整数 */
export const normalizeTradeResources = (input?: Partial<PlayerTradeResources> | null): PlayerTradeResources => ({
  metal: Math.max(0, Math.floor(Number(input?.metal) || 0)),
  crystal: Math.max(0, Math.floor(Number(input?.crystal) || 0)),
  deuterium: Math.max(0, Math.floor(Number(input?.deuterium) || 0))
})

/** 校验交易数量；返回 i18n reason，null 表示合法 */
export const validateTradeResources = (offer: PlayerTradeResources, request: PlayerTradeResources): string | null => {
  for (const key of RESOURCE_KEYS) {
    const values = [offer[key], request[key]]
    if (values.some(value => !Number.isFinite(value) || value < 0 || value > MAX_TRADE_AMOUNT)) {
      return 'errors.invalidQuantity'
    }
  }
  const total =
    offer.metal +
    offer.crystal +
    offer.deuterium +
    request.metal +
    request.crystal +
    request.deuterium
  return total > 0 ? null : 'errors.invalidQuantity'
}

const mainPlanetOf = (player: Player) =>
  player.planets.find(planet => !planet.isMoon) ?? player.planets[0]

/** 玩家当前贸易基础设施与损耗；航空港取所有行星上的最高等级 */
export const getPlayerTradeStatus = (player: Player): PlayerTradeStatus => {
  const spaceportLevel = player.planets.reduce(
    (max, planet) => Math.max(max, planet.buildings[BuildingType.Spaceport] || 0),
    0
  )
  const techLevel = player.technologies?.[TechnologyType.HyperspaceTransfer] || 0
  const lossPercent = Math.max(
    PLAYER_TRADE_CONFIG.MIN_LOSS_PERCENT,
    PLAYER_TRADE_CONFIG.BASE_LOSS_PERCENT -
      spaceportLevel * PLAYER_TRADE_CONFIG.LOSS_REDUCTION_PER_SPACEPORT_LEVEL -
      techLevel * PLAYER_TRADE_CONFIG.LOSS_REDUCTION_PER_TECH_LEVEL
  )
  return {
    unlocked:
      PLAYER_TRADE_CONFIG.ENABLED &&
      spaceportLevel >= PLAYER_TRADE_CONFIG.REQUIRED_SPACEPORT_LEVEL &&
      techLevel >= PLAYER_TRADE_CONFIG.REQUIRED_TECH_LEVEL,
    spaceportLevel,
    techLevel,
    lossPercent
  }
}

/** 双方交易损耗取较高值，避免一方用低等级设施拉低整体成本 */
export const getCombinedTradeLossPercent = (a: PlayerTradeStatus, b: PlayerTradeStatus): number =>
  Math.max(a.lossPercent, b.lossPercent)

/** 创建交易提议对象（不负责写入双方数组） */
export const createPlayerTradeOffer = (
  from: Player,
  to: Player,
  offer: PlayerTradeResources,
  request: PlayerTradeResources,
  now: number
): PlayerTradeOffer => {
  const lossPercent = getCombinedTradeLossPercent(getPlayerTradeStatus(from), getPlayerTradeStatus(to))
  return {
    id: `trade_${now}_${Math.random().toString(36).slice(2, 10)}`,
    fromId: from.id,
    fromName: from.name,
    toId: to.id,
    toName: to.name,
    offer: { ...offer },
    request: { ...request },
    status: 'pending',
    createdAt: now,
    expiresAt: now + PLAYER_TRADE_EXPIRY_MS,
    lossPercent
  }
}

/** 控制交易历史长度，优先保留未处理的交易 */
export const trimPlayerTradeHistory = (player: Player, max: number = PLAYER_TRADE_CONFIG.MAX_HISTORY): void => {
  if (!player.playerTrades || player.playerTrades.length <= max) return
  for (let i = 0; i < player.playerTrades.length && player.playerTrades.length > max; ) {
    if (player.playerTrades[i]!.status === 'pending') {
      i += 1
      continue
    }
    player.playerTrades.splice(i, 1)
  }
}

export const addPlayerTradeOffer = (from: Player, to: Player, trade: PlayerTradeOffer): void => {
  if (!from.playerTrades) from.playerTrades = []
  if (!to.playerTrades) to.playerTrades = []
  from.playerTrades.push({ ...trade })
  to.playerTrades.push({ ...trade })
  trimPlayerTradeHistory(from)
  trimPlayerTradeHistory(to)
}

/** 更新双方交易状态；已结束的交易保留在数组中，作为聊天卡片的历史记录 */
export const setPlayerTradeStatus = (
  from: Player | undefined,
  to: Player | undefined,
  tradeId: string,
  status: PlayerTradeOffer['status'],
  lossPercent?: number
): void => {
  for (const player of [from, to]) {
    if (!player) continue
    const trade = player.playerTrades?.find(candidate => candidate.id === tradeId)
    if (trade) {
      trade.status = status
      if (lossPercent !== undefined) trade.lossPercent = lossPercent
    }
    trimPlayerTradeHistory(player)
  }
}

/** 接受交易：校验并转移双方主星资源，按交易损耗扣除运输途中损失 */
export const settlePlayerTrade = (
  from: Player,
  to: Player,
  trade: PlayerTradeOffer,
  lossPercent: number = 0
): { ok: boolean; reason?: string } => {
  const fromPlanet = mainPlanetOf(from)
  const toPlanet = mainPlanetOf(to)
  if (!fromPlanet || !toPlanet) return { ok: false, reason: 'errors.planetNotFound' }

  for (const key of RESOURCE_KEYS) {
    if (fromPlanet.resources[key] < trade.offer[key]) {
      return { ok: false, reason: 'errors.insufficientResources' }
    }
    if (toPlanet.resources[key] < trade.request[key]) {
      return { ok: false, reason: 'errors.insufficientResources' }
    }
  }

  const safeLoss = Math.max(0, Math.min(100, lossPercent))
  for (const key of RESOURCE_KEYS) {
    const sentByFrom = trade.offer[key]
    const sentByTo = trade.request[key]
    const lostByFrom = Math.floor((sentByFrom * safeLoss) / 100)
    const lostByTo = Math.floor((sentByTo * safeLoss) / 100)

    fromPlanet.resources[key] -= sentByFrom
    toPlanet.resources[key] += sentByFrom - lostByFrom
    toPlanet.resources[key] -= sentByTo
    fromPlanet.resources[key] += sentByTo - lostByTo
  }

  return { ok: true }
}

/** 标记过期的 pending 交易；保留卡片历史 */
export const cleanupExpiredPlayerTrades = (player: Player, now: number): void => {
  if (!player.playerTrades?.length) return
  for (const trade of player.playerTrades) {
    if (trade.status === 'pending' && now >= trade.expiresAt) {
      trade.status = 'expired'
    }
  }
  trimPlayerTradeHistory(player)
}
