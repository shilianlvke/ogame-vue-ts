/**
 * 玩家间资源交易
 *
 * 规则：
 * - 发起方放置 offer，接受方支付 request；
 * - 创建时只校验数量格式，不锁资源；
 * - 接受时由服务端重新校验双方资源并原子结算；
 * - 交易双方各自保存一份相同 id 的提议，靠 reports.playerTrades 同步。
 */
import type { Player, PlayerTradeOffer, PlayerTradeResources } from '@/types/game'

export const PLAYER_TRADE_EXPIRY_MS = 30 * 60 * 1000
const MAX_TRADE_AMOUNT = 1_000_000_000_000
const MAX_TRADE_HISTORY = 50

const RESOURCE_KEYS = ['metal', 'crystal', 'deuterium'] as const

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

/** 创建交易提议对象（不负责写入双方数组） */
export const createPlayerTradeOffer = (
  from: Player,
  to: Player,
  offer: PlayerTradeResources,
  request: PlayerTradeResources,
  now: number
): PlayerTradeOffer => ({
  id: `trade_${now}_${Math.random().toString(36).slice(2, 10)}`,
  fromId: from.id,
  fromName: from.name,
  toId: to.id,
  toName: to.name,
  offer: { ...offer },
  request: { ...request },
  status: 'pending',
  createdAt: now,
  expiresAt: now + PLAYER_TRADE_EXPIRY_MS
})

/** 控制交易历史长度，优先保留未处理的交易 */
export const trimPlayerTradeHistory = (player: Player, max: number = MAX_TRADE_HISTORY): void => {
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
  status: PlayerTradeOffer['status']
): void => {
  for (const player of [from, to]) {
    if (!player) continue
    const trade = player.playerTrades?.find(candidate => candidate.id === tradeId)
    if (trade) trade.status = status
    trimPlayerTradeHistory(player)
  }
}

/** 接受交易：校验并转移双方主星资源 */
export const settlePlayerTrade = (
  from: Player,
  to: Player,
  trade: PlayerTradeOffer
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

  for (const key of RESOURCE_KEYS) {
    fromPlanet.resources[key] -= trade.offer[key]
    toPlanet.resources[key] += trade.offer[key]
    toPlanet.resources[key] -= trade.request[key]
    fromPlanet.resources[key] += trade.request[key]
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
