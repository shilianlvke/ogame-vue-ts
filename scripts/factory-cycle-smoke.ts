/**
 * 火箭发射与周目重置校验。
 * 运行：pnpm run smoke:factory-cycle
 */
import assert from 'node:assert/strict'
import { ROCKET_ASSEMBLY_SECONDS, ROCKET_PARTS } from '@/config/factory/balance'
import { addBuilding, createFactoryState, tickFactory, type FactoryContext } from '@/logic/factory/engine'
import { createMarketState, placeOrder } from '@/logic/factory/market'
import { createCycleState, cycleHpFactor, cycleRareOreFactor, nextCycle, resetFactory, resetMarket } from '@/logic/factory/cycle'

const near = (a: number, b: number, msg: string) => {
  assert.ok(Math.abs(a - b) < 1e-9, `${msg}：期望 ${b}，实际 ${a}`)
}

function ctx(now = 0): FactoryContext {
  return { now, preset: 'standard', techs: [], infinite: { mining: 0, smelting: 0, logistics: 0, weapon: 0 } }
}

// ---------- 周目状态与难度 ----------
{
  const c = createCycleState()
  assert.equal(c.cycle, 1, '初始周目应为 1')
  assert.equal(c.launchCount, 0, '初始发射次数应为 0')
  near(cycleHpFactor(1), 1.0, '第 1 周目 HP 系数 1')
  near(cycleHpFactor(2), 1.15, '第 2 周目 HP 系数 1.15')
  near(cycleRareOreFactor(2), 1.1, '第 2 周目稀有矿脉系数 1.1')
  assert.equal(nextCycle(1), 2, '第 1 周目后进入第 2 周目')
  assert.equal(nextCycle(12), 1, '第 12 周目后回到第 1 周目')
}

// ---------- 周目重置表 ----------
{
  const factory = createFactoryState('standard')
  factory.equipment.personalSolar = 2
  factory.suit = 'modular'
  factory.infiniteResearch.mining = 5
  factory.stock.cycleShard = 7
  factory.techs = ['power', 'automation']
  const mine = addBuilding(factory, 'mine', 3)!
  assert.ok(mine)
  factory.payloads.dataCore = 1
  factory.payloads.industrialSeed = 1
  factory.payloads.cargoPod = 1

  const fresh = resetFactory(factory, 'standard', 2, true, { tech: 'power', buildingInstanceId: mine.id })
  // 保留项
  assert.equal(fresh.equipment.personalSolar, 2, '装备保留')
  assert.equal(fresh.suit, 'modular', '工程服保留')
  assert.equal(fresh.infiniteResearch.mining, 5, '无限研究保留')
  assert.equal(fresh.stock.cycleShard, 7, '循环残片保留')
  // 科技清零，仅数据核心指定 1 项
  assert.deepEqual(fresh.techs, ['power'], '科技仅保留数据核心指定项')
  // 建筑清空，仅工业种子指定 1 座
  assert.equal(fresh.buildings.length, 1, '建筑仅保留工业种子指定 1 座')
  assert.equal(fresh.buildings[0]!.type, 'mine', '保留的建筑类型正确')
  assert.equal(fresh.buildings[0]!.level, 3, '保留的建筑等级不变')
  assert.ok(fresh.buildings[0]!.slots.every(s => s.recipeId === null), '保留建筑的槽位清空')
  // 物资舱初始材料均分
  assert.equal(fresh.stock.ironOre, 2500, '物资舱折算铁矿石 2500')
  assert.equal(fresh.stock.copperOre, 2500, '物资舱折算铜矿石 2500')
  assert.equal(fresh.stock.coal, 2500, '物资舱折算煤 2500')
  assert.equal(fresh.stock.stone, 2500, '物资舱折算石矿 2500')
  // 载荷清空
  assert.deepEqual(fresh.payloads, {}, '载荷全部清空')
  // 稀有矿脉储量随周目放大
  assert.ok((fresh.oreReserve.uraniumOre ?? 0) > 1200000, '铀矿储量应随周目放大')
}

// ---------- 市场重置：挂单撤回 + 声望减半 ----------
{
  const market = createMarketState(0)
  market.minersGuildRep = 100
  const factory = createFactoryState('standard')
  factory.stock.ironPlate = 100
  assert.ok(placeOrder(market, factory, 'sell', 'ironPlate', 1.2, 10, 0).ok)
  assert.equal(factory.stock.ironPlate, 90, '卖单占用仓库')
  resetMarket(market, factory)
  assert.equal(market.orders.length, 0, '挂单全部撤回')
  assert.equal(factory.stock.ironPlate, 100, '卖单物品退回仓库')
  assert.equal(market.minersGuildRep, 50, '声望减半')
}

// ---------- 发射井装配火箭 ----------
{
  const state = createFactoryState('standard')
  state.techs.push('silo')
  state.stock.steel = 2000
  state.stock.lowDensityStructure = 200
  state.stock.processingUnit = 200
  const silo = addBuilding(state, 'rocketSilo', 1)!
  assert.ok(silo, '发射井应当可以建造')
  assert.equal(silo.slots.length, 1, '发射井 Lv1 = 1 槽')
  state.stock.rocketPart = ROCKET_PARTS
  for (let i = 0; i < ROCKET_ASSEMBLY_SECONDS; i++) tickFactory(state, ctx(i), 1)
  assert.equal(state.rockets, 1, `${ROCKET_ASSEMBLY_SECONDS} 秒后应装配 1 枚火箭`)
  assert.equal(state.stock.rocketPart, 0, '火箭部件被消耗')
  // 缺料时槽位断料
  state.rockets = 0
  tickFactory(state, ctx(120), 1)
  assert.equal(silo.slots[0]!.status, 'starved', '缺火箭部件时应为断料')
}

console.log('周目冒烟通过：难度系数、重置表、市场撤回、火箭装配')
