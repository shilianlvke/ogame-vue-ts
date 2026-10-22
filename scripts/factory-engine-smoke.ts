/**
 * 工厂引擎冒烟：验证开局链路、电力满足率、燃烧模式与研究推进。
 * 运行：pnpm run smoke:factory-engine
 */
import assert from 'node:assert/strict'
import {
  addBuilding,
  assignRecipe,
  createFactoryState,
  setOreSlot,
  tickFactory
} from '@/logic/factory/engine'
import type { FactoryContext } from '@/logic/factory/engine'
import { TECH_MAP } from '@/config/factory/techs'

function ctx(now = 0): FactoryContext {
  return { now, preset: 'standard', techs: [], infinite: { mining: 0, smelting: 0, logistics: 0, weapon: 0 } }
}

// ---------- 1. 燃煤自举：矿井 → 石炉 → 装配机 ----------
{
  const state = createFactoryState('standard')
  const coal = state.stock.coal ?? 0
  assert.equal(coal, 200, '初始煤应为 200')

  const mine = addBuilding(state, 'mine')!
  assert.ok(mine, '矿井应当可以建造')
  mine.coalMode = true
  assert.ok(setOreSlot(state, mine.id, 0, 'ironOre'), '矿井应能指定铁矿石')

  const furnace = addBuilding(state, 'stoneFurnace', 2)!
  assert.ok(furnace, '石炉应当可以建造')
  assignRecipe(state, furnace.id, 'ironPlate', 2)
  assert.equal(furnace.slots[0]!.recipeId, 'ironPlate', '石炉应能分配铁板')

  // 初始铁板 40 支付矿井后剩 20，需先炼出 20 块才够装配机
  for (let i = 0; i < 300; i++) tickFactory(state, ctx(i))
  assert.ok((state.stock.ironPlate ?? 0) > 40, `300 秒后应有足够铁板，实际 ${state.stock.ironPlate}`)

  const assembler = addBuilding(state, 'assembler')!
  assert.ok(assembler, '攒够铁板后装配机应当可以建造')
  assembler.coalMode = true
  assignRecipe(state, assembler.id, 'ironGear', 1)
  assert.equal(assembler.slots[0]!.recipeId, 'ironGear', '装配机应能分配铁齿轮')

  for (let i = 300; i < 420; i++) tickFactory(state, ctx(i))

  assert.ok((state.stock.ironOre ?? 0) > 0 || (state.stock.ironPlate ?? 0) > 0, '应当产出铁矿石或铁板')
  assert.ok((state.stock.ironGear ?? 0) > 0, '应当产出铁齿轮')
  assert.ok((state.stock.coal ?? 0) < coal, '燃煤模式应当消耗煤')
}

// ---------- 2. 电力：火电供能，矿井电驱更快 ----------
{
  const state = createFactoryState('standard')
  state.stock.stoneBrick = 100
  state.stock.ironPlate = 200
  state.techs.push('power')
  const boiler = addBuilding(state, 'boiler')!
  assert.ok(boiler, '火力发电厂应当可以建造')
  const mine = addBuilding(state, 'mine')!
  setOreSlot(state, mine.id, 0, 'ironOre')
  assert.equal(mine.coalMode, undefined, '矿井默认电驱')
  tickFactory(state, ctx(100))
  assert.ok(state.powerRatio > 0.9, `有火电时满足率应为 1，实际 ${state.powerRatio}`)

  // 拆掉发电厂后满足率归零，电驱矿井停摆
  const before = state.stock.ironOre ?? 0
  boiler.enabled = false
  for (let i = 0; i < 60; i++) tickFactory(state, ctx(200 + i))
  assert.ok(state.powerRatio < 0.1, `断电后满足率应接近 0，实际 ${state.powerRatio}`)
  assert.ok((state.stock.ironOre ?? 0) - before < 2, '断电后电驱矿井不应继续产出')
}

// ---------- 3. 研究：实验室消耗科技包推进科技 ----------
{
  const state = createFactoryState('standard')
  state.stock.ironPlate = 100
  state.stock.copperPlate = 100
  const lab = addBuilding(state, 'lab')!
  assert.ok(lab, '实验室应当可以建造')
  state.stock.automationPack = 500
  lab.slots[0]!.techId = 'power'
  for (let i = 0; i < TECH_MAP.power.cost; i++) tickFactory(state, ctx(i))
  assert.ok(state.techs.includes('power'), '应当完成电力系统')
  assert.ok((state.stock.automationPack ?? 0) < 500, '应当消耗自动化包')
  assert.equal((state.stock.automationPack ?? 0), 500 - TECH_MAP.power.cost, '消耗量应等于科技成本')
}

// ---------- 4. 库存上限：无仓库时封顶 5000 ----------
{
  const state = createFactoryState('standard')
  state.stock.ironPlate = 4999
  const mine = addBuilding(state, 'mine')!
  mine.coalMode = true
  setOreSlot(state, mine.id, 0, 'ironOre')
  const furnace = addBuilding(state, 'stoneFurnace')!
  assignRecipe(state, furnace.id, 'ironPlate', 1)
  for (let i = 0; i < 200; i++) tickFactory(state, ctx(i))
  assert.ok((state.stock.ironPlate ?? 0) <= 5000, '铁板不应超过仓库上限')
  const blocked = state.buildings.some(b => b.slots.some(s => s.status === 'blocked'))
  assert.ok(blocked, '达到上限后应出现堵塞状态')
}

console.log('工厂引擎冒烟通过：自举链路、电力满足率、研究推进、库存上限')
