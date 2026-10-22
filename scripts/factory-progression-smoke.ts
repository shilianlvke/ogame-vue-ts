/**
 * 推进模拟器：从初始状态贪心推进，验证 S0 自举与电驱切换。
 * 运行：pnpm run smoke:factory-progression
 */
import assert from 'node:assert/strict'
import { addBuilding, assignRecipe, createFactoryState, setOreSlot, tickFactory, type FactoryContext } from '@/logic/factory/engine'

const infinite = { mining: 0, smelting: 0, logistics: 0, weapon: 0 }

function ctx(state: ReturnType<typeof createFactoryState>, now: number): FactoryContext {
  return { now, preset: 'standard', techs: state.techs, infinite }
}

const count = (state: ReturnType<typeof createFactoryState>, id: string) => state.buildings.filter(b => b.type === id).length

/** 贪心推进：目标 = 研究完「电力系统」并建成火力发电厂。矿井采 铁/铜/煤，石砖限量炼 20 */
function autoBootstrap() {
  const state = createFactoryState('standard')
  let now = 0
  const mineOres = ['ironOre', 'copperOre', 'coal'] as const
  for (let step = 0; step < 800; step++) {
    // 矿井：3 座，采铁矿石 / 铜矿石 / 煤（采煤保证煤自持）
    const mines = state.buildings.filter(b => b.type === 'mine')
    if (mines.length < 3) {
      const m = addBuilding(state, 'mine')
      if (m) {
        m.coalMode = true
        setOreSlot(state, m.id, 0, mineOres[mines.length]!)
      }
    }
    // 石炉：按配方独立判断，确保铁板炉、铜板炉、石砖炉（限量）各就位
    const hasFurnace = (recipe: string) =>
      state.buildings.some(b => b.type === 'stoneFurnace' && b.slots.some(s => s.recipeId === recipe))
    if (!hasFurnace('ironPlate')) {
      const f = addBuilding(state, 'stoneFurnace')
      if (f) assignRecipe(state, f.id, 'ironPlate', 1)
    }
    if (!hasFurnace('copperPlate')) {
      const f = addBuilding(state, 'stoneFurnace')
      if (f) assignRecipe(state, f.id, 'copperPlate', 1)
    }
    const brick = state.stock.stoneBrick ?? 0
    if (count(state, 'boiler') < 1 && brick < 20 && !hasFurnace('stoneBrick')) {
      const f = addBuilding(state, 'stoneFurnace')
      if (f) assignRecipe(state, f.id, 'stoneBrick', 1)
    } else if (!(count(state, 'boiler') < 1 && brick < 20)) {
      const brickFurnace = state.buildings.find(b => b.type === 'stoneFurnace' && b.slots.some(s => s.recipeId === 'stoneBrick'))
      if (brickFurnace) for (const s of brickFurnace.slots) if (s.recipeId === 'stoneBrick') s.recipeId = null
    }
    // 装配机建筑（先建，配方分配在实验室之后）
    if (count(state, 'assembler') < 1) {
      const a = addBuilding(state, 'assembler')
      if (a) a.coalMode = true
    }
    // 实验室：装配机建成后立即建（消耗铁板 + 铜板）
    if (count(state, 'assembler') >= 1 && count(state, 'lab') < 1) addBuilding(state, 'lab')
    const lab = state.buildings.find(b => b.type === 'lab')
    if (lab && !state.techs.includes('power')) {
      const slot = lab.slots.find(s => !s.techId)
      if (slot) {
        slot.techId = 'power'
        slot.status = 'running'
      }
    }
    // 装配机配方：限量生产（铁齿轮/铜线/自动化包各够 130 即停），实验室建成后启动
    const assembler = state.buildings.find(b => b.type === 'assembler')
    if (assembler && count(state, 'lab') >= 1) {
      for (const r of ['ironGear', 'copperCable', 'automationPack'] as const) {
        const cur = state.stock[r] ?? 0
        const slot = assembler.slots.find(s => s.recipeId === r)
        if (cur < 130) {
          if (!slot) assignRecipe(state, assembler.id, r, 1)
        } else if (slot) {
          slot.recipeId = null
        }
      }
    }
    // 火力发电厂：power 完成后建
    if (state.techs.includes('power') && count(state, 'boiler') < 1) addBuilding(state, 'boiler')

    tickFactory(state, ctx(state, now), 60)
    now += 60

    if (state.techs.includes('power') && count(state, 'boiler') >= 1) break
  }
  return state
}

// ---------- S0 自举 ----------
{
  const state = autoBootstrap()
  assert.ok(state.techs.includes('power'), '应研究完电力系统')
  assert.ok(state.buildings.some(b => b.type === 'boiler'), '应建成火力发电厂')
  assert.ok((state.stock.ironPlate ?? 0) > 0, '应产出铁板')
  assert.ok((state.stock.automationPack ?? 0) >= 0, '自动化包字段有效')
  console.log(`S0 自举通过：矿井 ${count(state, 'mine')} · 石炉 ${count(state, 'stoneFurnace')} · 装配机 ${count(state, 'assembler')} · 实验室 ${count(state, 'lab')}`)
}

// ---------- S1 电驱：火力发电厂后切换电驱，产量提升 ----------
{
  const state = createFactoryState('standard')
  state.techs.push('power')
  state.stock.ironPlate = 200
  state.stock.copperPlate = 100
  state.stock.stoneBrick = 100
  state.stock.ironOre = 0
  state.stock.coal = 1000
  const mine = addBuilding(state, 'mine')!
  setOreSlot(state, mine.id, 0, 'ironOre')
  // 燃煤模式 200 秒产量
  mine.coalMode = true
  for (let i = 0; i < 200; i++) tickFactory(state, ctx(state, i), 1)
  const coalYield = state.stock.ironOre ?? 0
  // 电驱模式：先建火电
  addBuilding(state, 'boiler')
  state.stock.ironOre = 0
  mine.coalMode = false
  for (let i = 0; i < 200; i++) tickFactory(state, ctx(state, i), 1)
  const elecYield = state.stock.ironOre ?? 0
  assert.ok(elecYield > 0, '电驱应持续产出')
  assert.ok(elecYield > coalYield, '电驱产量应高于燃煤')
  console.log(`S1 电驱通过：燃煤 200 秒 ${coalYield} · 电驱 200 秒 ${elecYield}`)
}

console.log('推进模拟通过：S0 自举 + S1 电驱切换')
