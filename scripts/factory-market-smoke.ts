/**
 * 市场基础价推导与撮合引擎校验。
 * 运行：pnpm run smoke:factory-market
 */
import assert from 'node:assert/strict'
import {
  BASE_PRICES,
  basePrice,
  deriveBasePrice,
  tradableMaterials,
  MARKET_FEE_BASE,
  MARKET_FEE_MIN,
  marketFeeRate
} from '@/config/factory/market'
import { MATERIALS, MATERIAL_IDS } from '@/config/factory/materials'
import { createFactoryState } from '@/logic/factory/engine'
import { cancelOrder, createMarketState, expireOrders, matchMarket, marketPrice, placeOrder } from '@/logic/factory/market'

const near = (a: number, b: number, msg: string) => {
  assert.ok(Math.abs(a - b) < 0.02, `${msg}：期望 ${b}，实际 ${a}`)
}

// ---------- 锚点 ----------
near(basePrice('ironOre'), 1.0, '铁矿石锚点')
near(basePrice('copperOre'), 1.2, '铜矿石锚点')
near(basePrice('water'), 0.01, '水锚点')
near(basePrice('crudeOil'), 0.05, '原油锚点')

// ---------- 推导示例（规划书 §9.2） ----------
near(deriveBasePrice('ironPlate'), 1.2, '铁板')
near(deriveBasePrice('copperPlate'), 1.44, '铜板')
near(deriveBasePrice('steel'), 7.2, '钢材')
near(deriveBasePrice('ironGear'), 3.36, '铁齿轮')
near(deriveBasePrice('copperCable'), 1.01, '铜线')
near(deriveBasePrice('circuit'), 5.92, '电路板')
near(deriveBasePrice('plastic'), 1.28, '塑料')
near(deriveBasePrice('advancedCircuit'), 29.5, '高级电路')
near(deriveBasePrice('processingUnit'), 285.0, '处理单元')
near(deriveBasePrice('lowDensityStructure'), 148.0, '低密度结构')

// ---------- 全表闭合 ----------
for (const id of MATERIAL_IDS) {
  const price = BASE_PRICES[id]
  assert.ok(typeof price === 'number' && price > 0, `材料 ${MATERIALS[id].name} 基础价无效：${price}`)
}

// ---------- 可交易集合 ----------
const tradable = tradableMaterials()
assert.ok(tradable.includes('ironPlate'), '铁板应可交易')
assert.ok(tradable.includes('rocketPart'), '火箭部件应可交易')
assert.ok(!tradable.includes('rustAlloy'), '掉落物不可交易')
assert.ok(!tradable.includes('water'), '流体不可交易')
assert.ok(!tradable.includes('hullFrame'), '舰船零件不可交易')
for (const id of tradable) {
  assert.ok(!MATERIALS[id].fluid && !MATERIALS[id].drop, `${id} 不应进入可交易集合`)
}

// ---------- 手续费区间 ----------
assert.ok(MARKET_FEE_MIN < MARKET_FEE_BASE, '手续费下限应低于上限')
near(marketFeeRate(0), 0.03, '声望 0 手续费 3%')
near(marketFeeRate(500), 0.02, '声望 500 手续费 2%')
near(marketFeeRate(1000), 0.01, '声望 1000 手续费 1%')

// ---------- 撮合引擎 ----------
{
  // 挂单与撤回：卖单占用仓库
  {
    const market = createMarketState(0)
    const factory = createFactoryState('standard')
    factory.stock.ironPlate = 100
    const r = placeOrder(market, factory, 'sell', 'ironPlate', 1.2, 50, 10)
    assert.ok(r.ok, '挂卖单应成功')
    assert.equal(factory.stock.ironPlate, 50, '卖单占用仓库')
    assert.equal(market.orders.length, 1)
    assert.ok(cancelOrder(market, factory, market.orders[0]!.id), '撤回卖单应成功')
    assert.equal(factory.stock.ironPlate, 100, '撤回返还物品')
    assert.equal(market.orders.length, 0)
  }
  // 挂单与撤回：买单冻结星币
  {
    const market = createMarketState(0)
    const factory = createFactoryState('standard')
    market.credit = 1000
    const r = placeOrder(market, factory, 'buy', 'ironPlate', 1.2, 100, 10)
    assert.ok(r.ok, '挂买单应成功')
    assert.equal(market.credit, 880, '买单冻结星币')
    assert.ok(cancelOrder(market, factory, market.orders[0]!.id), '撤回买单应成功')
    assert.equal(market.credit, 1000, '撤回退还冻结星币')
  }
  // 校验：价格带与可交易集合
  {
    const market = createMarketState(0)
    const factory = createFactoryState('standard')
    factory.stock.ironPlate = 1000
    assert.ok(!placeOrder(market, factory, 'sell', 'ironPlate', 3.0, 10, 0).ok, '超出 +50% 应拒绝')
    assert.ok(!placeOrder(market, factory, 'sell', 'ironPlate', 0.5, 10, 0).ok, '超出 -50% 应拒绝')
    assert.ok(!placeOrder(market, factory, 'sell', 'water', 0.01, 10, 0).ok, '流体不可交易')
    assert.ok(!placeOrder(market, factory, 'sell', 'rustAlloy', 3.0, 10, 0).ok, '掉落物不可交易')
    assert.ok(!placeOrder(market, factory, 'sell', 'hullFrame', 10, 10, 0).ok, '舰船零件不可交易')
    assert.ok(!placeOrder(market, factory, 'buy', 'ironPlate', 1.2, 100000, 0).ok, '星币不足应拒绝')
  }
  // 卖单与派系常驻盘成交：买价 = 基础价 × 0.95，卖方付手续费
  {
    const market = createMarketState(0)
    const factory = createFactoryState('standard')
    factory.stock.ironPlate = 1000
    assert.ok(placeOrder(market, factory, 'sell', 'ironPlate', 0.9, 500, 10).ok)
    const entries = matchMarket(market, factory, 60)
    assert.equal(entries.length, 1, '应产生一笔成交')
    assert.equal(entries[0]!.counterparty, 'faction', '对手方应为矿业公会')
    assert.equal(entries[0]!.price, 1.14, '成交价为派系买价 0.95 × 1.2')
    near(market.credit, 552.9, '卖单成交额扣 3% 手续费入账')
    near(market.minersGuildRep, 0.05, '成交 500 单位声望 +0.05')
    assert.equal(market.orders.length, 0, '成交后挂单清出')
    assert.equal(factory.stock.ironPlate, 500, '卖出数量已在挂单时占用')
  }
  // 买单与派系常驻盘成交：卖价 = 基础价 × 1.05，退还冻结差额
  {
    const market = createMarketState(0)
    const factory = createFactoryState('standard')
    factory.stock.ironPlate = 0
    market.credit = 1000
    assert.ok(placeOrder(market, factory, 'buy', 'ironPlate', 1.3, 100, 10).ok)
    const entries = matchMarket(market, factory, 60)
    assert.equal(entries.length, 1)
    assert.equal(entries[0]!.counterparty, 'faction', '对手方应为矿业公会')
    assert.equal(entries[0]!.price, 1.26, '成交价为派系卖价 1.05 × 1.2')
    assert.equal(factory.stock.ironPlate, 100, '买入材料入仓')
    assert.equal(market.credit, 874, '冻结 130，按 126 结算退还 4')
    assert.equal(market.orders.length, 0)
  }
  // 玩家单撮合：成交价 = 基础价 × (1 + 需求/供给 × 0.1)
  {
    const market = createMarketState(0)
    const factory = createFactoryState('standard')
    market.credit = 1000
    factory.stock.ironPlate = 200
    assert.ok(placeOrder(market, factory, 'buy', 'ironPlate', 1.4, 10, 10).ok)
    assert.ok(placeOrder(market, factory, 'sell', 'ironPlate', 0.9, 10, 10).ok)
    const entries = matchMarket(market, factory, 60)
    assert.equal(entries.length, 1)
    assert.equal(entries[0]!.counterparty, 'player', '玩家单之间撮合')
    near(entries[0]!.price, 1.32, '成交价 = 1.2 × (1 + 10/10 × 0.1)')
    near(market.credit, 999.6, '买家退差额、卖家扣手续费')
    assert.equal(market.orders.length, 0)
  }
  // 市场参考价：无挂单 = 基础价，只有买单 = 上限 1.5 倍
  {
    const market = createMarketState(0)
    const factory = createFactoryState('standard')
    near(marketPrice(market, 'ironPlate'), 1.2, '无挂单参考价 = 基础价')
    market.credit = 1000
    placeOrder(market, factory, 'buy', 'ironPlate', 1.2, 100, 10)
    near(marketPrice(market, 'ironPlate'), 1.8, '只有买单参考价 = 1.5 × 基础价')
  }
  // 7 天过期自动撤回
  {
    const market = createMarketState(0)
    const factory = createFactoryState('standard')
    factory.stock.ironPlate = 50
    assert.ok(placeOrder(market, factory, 'sell', 'ironPlate', 1.2, 10, 100).ok)
    assert.equal(factory.stock.ironPlate, 40)
    const n = expireOrders(market, factory, 100 + 7 * 86400 + 1)
    assert.equal(n, 1, '过期挂单应撤回')
    assert.equal(factory.stock.ironPlate, 50, '过期卖单返还物品')
    assert.equal(market.orders.length, 0)
  }
  console.log(`market smoke ok · 基础价 ${MATERIAL_IDS.length} 条 · 可交易 ${tradable.length} 种 · 撮合引擎通过`)
}
