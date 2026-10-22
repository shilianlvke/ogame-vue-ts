import type { MaterialId, PlanetFactory } from '@/types/factory'
import {
  MARKET_FACTION_DEPTH,
  MARKET_MATCH_INTERVAL,
  MARKET_ORDER_TTL_DAYS,
  MARKET_PRICE_DEVIATION,
  MARKET_REP_MAX,
  MARKET_REP_PER_TRADE_VOLUME,
  basePrice,
  factionBuyPrice,
  factionSellPrice,
  marketFeeRate,
  tradableMaterials,
  withinPriceBand
} from '@/config/factory/market'

/**
 * 异步市场撮合引擎，对应规划书 §9.2。
 * 卖单占用仓库、买单冻结星币；每 60 秒撮合一次，7 天过期自动撤回。
 * 撮合顺序：价格优先，同价按挂单时间，玩家单优先于派系单。
 * 派系常驻盘每种材料 5000 单位深度，买价 = 基础价 × 0.95，卖价 = 基础价 × 1.05。
 */

/** 挂单方向：买入（冻结星币）/ 卖出（占用仓库） */
export type OrderSide = 'buy' | 'sell'

/** 玩家挂单 */
export interface MarketOrder {
  id: string
  side: OrderSide
  material: MaterialId
  /** 挂单单价 */
  price: number
  /** 剩余数量 */
  amount: number
  /** 挂单世界时间（秒） */
  createdAt: number
  /** 过期时间：7 天未成交自动撤回 */
  expiresAt: number
}

/** 成交记录 */
export interface MarketLogEntry {
  time: number
  material: MaterialId
  /** 玩家所处方向 */
  side: OrderSide
  units: number
  price: number
  /** 玩家支付的手续费 */
  fee: number
  /** 对手方：矿业公会常驻盘或玩家挂单 */
  counterparty: 'faction' | 'player'
}

/** 市场账户状态，随工厂存档持久化 */
export interface MarketState {
  /** 星币，不占仓库，跨周目保留 */
  credit: number
  /** 矿业公会声望 0~1000，成交额每 10,000 单位 +1 */
  minersGuildRep: number
  /** 玩家挂单 */
  orders: MarketOrder[]
  /** 下次撮合的世界时间（秒） */
  nextMatchAt: number
  /** 最近成交记录 */
  log: MarketLogEntry[]
}

const ORDER_TTL_SECONDS = MARKET_ORDER_TTL_DAYS * 86400
const LOG_LIMIT = 30

let orderSeq = 0
function nextOrderId(now: number): string {
  orderSeq += 1
  return `mo${now.toString(36)}${orderSeq.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

export function createMarketState(now = 0): MarketState {
  return { credit: 0, minersGuildRep: 0, orders: [], nextMatchAt: now + MARKET_MATCH_INTERVAL, log: [] }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export type PlaceResult = { ok: true } | { ok: false; reason: string }

/** 挂单：卖单占用仓库，买单冻结星币。价格须在基础价 ±50% 内 */
export function placeOrder(
  market: MarketState,
  factory: PlanetFactory,
  side: OrderSide,
  material: MaterialId,
  price: number,
  amount: number,
  now: number
): PlaceResult {
  const p = round2(price)
  const n = Math.floor(amount)
  if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(n) || n <= 0) return { ok: false, reason: '挂单参数无效' }
  if (!tradableMaterials().includes(material)) return { ok: false, reason: '该材料不可交易' }
  if (!withinPriceBand(material, p)) return { ok: false, reason: '价格超出基础价 ±50%' }
  if (side === 'sell') {
    if ((factory.stock[material] ?? 0) < n) return { ok: false, reason: '仓库库存不足' }
    factory.stock[material] = (factory.stock[material] ?? 0) - n
  } else {
    const cost = round2(p * n)
    if (market.credit < cost) return { ok: false, reason: '星币不足' }
    market.credit = round2(market.credit - cost)
  }
  market.orders.push({ id: nextOrderId(now), side, material, price: p, amount: n, createdAt: now, expiresAt: now + ORDER_TTL_SECONDS })
  return { ok: true }
}

function refundOrder(market: MarketState, factory: PlanetFactory, order: MarketOrder) {
  if (order.side === 'sell') factory.stock[order.material] = (factory.stock[order.material] ?? 0) + order.amount
  else market.credit = round2(market.credit + order.price * order.amount)
}

/** 撤回挂单：卖单物品退回仓库，买单冻结星币退回账户 */
export function cancelOrder(market: MarketState, factory: PlanetFactory, orderId: string): boolean {
  const idx = market.orders.findIndex(o => o.id === orderId)
  if (idx < 0) return false
  const order = market.orders[idx]!
  refundOrder(market, factory, order)
  market.orders.splice(idx, 1)
  return true
}

/** 撤回全部挂单（周目重置时调用），返回撤回数量 */
export function cancelAllOrders(market: MarketState, factory: PlanetFactory): number {
  const count = market.orders.length
  for (const o of market.orders) refundOrder(market, factory, o)
  market.orders = []
  return count
}

/** 过期挂单自动撤回，返回撤回数量 */
export function expireOrders(market: MarketState, factory: PlanetFactory, now: number): number {
  const expired = market.orders.filter(o => o.expiresAt <= now)
  for (const o of expired) refundOrder(market, factory, o)
  market.orders = market.orders.filter(o => o.expiresAt > now)
  return expired.length
}

/**
 * 市场参考价：基础价 × (1 + 需求/供给 × 0.1)，钳制在 ±50% 带内。
 * 需求/供给取玩家挂单数量（派系常驻盘不计入，否则恒为 1）。
 */
export function marketPrice(market: MarketState, material: MaterialId): number {
  const base = basePrice(material)
  let demand = 0
  let supply = 0
  for (const o of market.orders) {
    if (o.material !== material) continue
    if (o.side === 'buy') demand += o.amount
    else supply += o.amount
  }
  let price = base
  if (demand > 0 && supply === 0) price = base * 1.5
  else if (supply > 0) price = base * (1 + (demand / supply) * 0.1)
  const lo = base * (1 - MARKET_PRICE_DEVIATION)
  const hi = base * (1 + MARKET_PRICE_DEVIATION)
  return round2(Math.max(lo, Math.min(hi, price)))
}

function addRep(market: MarketState, units: number) {
  market.minersGuildRep = Math.min(MARKET_REP_MAX, market.minersGuildRep + units / MARKET_REP_PER_TRADE_VOLUME)
}

/** 记录成交并裁剪长度 */
function pushLog(market: MarketState, entry: MarketLogEntry) {
  market.log.push(entry)
  if (market.log.length > LOG_LIMIT) market.log.splice(0, market.log.length - LOG_LIMIT)
}

/**
 * 撮合一次（每 60 秒）：
 * 1. 玩家单之间按市场参考价成交，限价须包住参考价；
 * 2. 剩余玩家单与派系常驻盘按固定买价/卖价成交；
 * 3. 全部成交的挂单移出订单簿。
 * 返回本次新增的成交记录。
 */
export function matchMarket(market: MarketState, factory: PlanetFactory, now: number): MarketLogEntry[] {
  const entries: MarketLogEntry[] = []
  const feeRate = marketFeeRate(market.minersGuildRep)

  for (const material of tradableMaterials()) {
    const price = marketPrice(market, material)
    const mine = market.orders.filter(o => o.material === material)
    const buys = mine.filter(o => o.side === 'buy').sort((a, b) => b.price - a.price || a.createdAt - b.createdAt)
    const sells = mine.filter(o => o.side === 'sell').sort((a, b) => a.price - b.price || a.createdAt - b.createdAt)

    // 1. 玩家单撮合：价格优先、同价先到先得
    let di = 0
    let si = 0
    while (di < buys.length && si < sells.length) {
      const buy = buys[di]!
      const sell = sells[si]!
      if (buy.price < sell.price) break
      if (buy.amount <= 0) {
        di += 1
        continue
      }
      if (sell.amount <= 0) {
        si += 1
        continue
      }
      if (buy.price < price) {
        di += 1
        continue
      }
      if (sell.price > price) {
        si += 1
        continue
      }
      const units = Math.min(buy.amount, sell.amount)
      buy.amount -= units
      sell.amount -= units
      const gross = round2(price * units)
      const fee = round2(gross * feeRate)
      // 买家按挂单价冻结，成交价结算后退还差额；卖家成交额扣手续费入账
      market.credit = round2(market.credit + (buy.price - price) * units + gross - fee)
      addRep(market, units)
      const entry: MarketLogEntry = { time: now, material, side: 'sell', units, price, fee, counterparty: 'player' }
      entries.push(entry)
      pushLog(market, entry)
      if (buy.amount <= 0) di += 1
      if (sell.amount <= 0) si += 1
    }

    // 2. 派系补足：剩余玩家单与常驻盘按固定价成交
    const fBuy = factionBuyPrice(material)
    const fSell = factionSellPrice(material)
    let buyDepth = MARKET_FACTION_DEPTH
    for (const buy of buys) {
      if (buy.amount <= 0 || buyDepth <= 0) continue
      if (buy.price < fSell) continue
      const units = Math.min(buy.amount, buyDepth)
      buy.amount -= units
      buyDepth -= units
      market.credit = round2(market.credit + (buy.price - fSell) * units)
      factory.stock[material] = (factory.stock[material] ?? 0) + units
      addRep(market, units)
      const entry: MarketLogEntry = { time: now, material, side: 'buy', units, price: fSell, fee: 0, counterparty: 'faction' }
      entries.push(entry)
      pushLog(market, entry)
    }
    let sellDepth = MARKET_FACTION_DEPTH
    for (const sell of sells) {
      if (sell.amount <= 0 || sellDepth <= 0) continue
      if (sell.price > fBuy) continue
      const units = Math.min(sell.amount, sellDepth)
      sell.amount -= units
      sellDepth -= units
      const gross = round2(fBuy * units)
      const fee = round2(gross * feeRate)
      market.credit = round2(market.credit + gross - fee)
      addRep(market, units)
      const entry: MarketLogEntry = { time: now, material, side: 'sell', units, price: fBuy, fee, counterparty: 'faction' }
      entries.push(entry)
      pushLog(market, entry)
    }
  }

  // 3. 清出已全部成交的挂单
  market.orders = market.orders.filter(o => o.amount > 0)
  return entries
}
