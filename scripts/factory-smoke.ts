/**
 * 工厂数据层校验：材料、配方、建筑、科技四张表的闭合性。
 * 运行：pnpm run smoke:factory
 */
import assert from 'node:assert/strict'
import { MATERIALS, MATERIAL_IDS, FLUIDS } from '@/config/factory/materials'
import { RECIPES, DEFAULT_RECIPES } from '@/config/factory/recipes'
import { BUILDINGS, BUILDING_IDS, DEFAULT_BUILDINGS } from '@/config/factory/buildings'
import { TECHS, TECH_MAP, LAYER_PACKS } from '@/config/factory/techs'
import { MATERIAL_ICONS } from '@/config/factory/icons'

const fail: string[] = []
const check = (cond: boolean, msg: string) => {
  if (!cond) fail.push(msg)
}

// ---------- 材料 ----------
check(MATERIAL_IDS.length === 62, `材料应为 62 种，实际 ${MATERIAL_IDS.length}`)
for (const id of MATERIAL_IDS) {
  const def = MATERIALS[id]
  check(Boolean(def), `材料 ${id} 缺少定义`)
  check(Boolean(MATERIAL_ICONS[def.icon]), `材料 ${def.name} 的图标 ${def.icon} 未注册`)
}
const fluidCount = FLUIDS.length
check(fluidCount === 7, `流体应为 7 种，实际 ${fluidCount}`)

// ---------- 配方 ----------
const recipeIds = new Set(RECIPES.map(r => r.id))
check(recipeIds.size === RECIPES.length, '配方 id 重复')
for (const r of RECIPES) {
  for (const m of [...Object.keys(r.inputs), ...Object.keys(r.outputs)]) {
    check(Boolean(MATERIALS[m as keyof typeof MATERIALS]), `配方 ${r.name} 引用了不存在的材料 ${m}`)
  }
  check(r.time > 0, `配方 ${r.name} 时间必须大于 0`)
  check(r.energy >= 0, `配方 ${r.name} 能耗不能为负`)
  if (r.unlockedBy) check(Boolean(TECH_MAP[r.unlockedBy]), `配方 ${r.name} 解锁科技 ${r.unlockedBy} 不存在`)
  if (r.randomOutput) {
    const sum = r.randomOutput.weights.reduce((a, b) => a + b, 0)
    check(sum === 100, `配方 ${r.name} 随机权重合计应为 100，实际 ${sum}`)
  }
}

// ---------- 建筑 ----------
check(BUILDING_IDS.length === 22, `建筑应为 22 种，实际 ${BUILDING_IDS.length}`)
for (const id of BUILDING_IDS) {
  const b = BUILDINGS[id]
  for (const m of Object.keys(b.baseCost)) {
    check(Boolean(MATERIALS[m as keyof typeof MATERIALS]), `建筑 ${b.name} 成本引用了不存在的材料 ${m}`)
  }
  if (b.unlockedBy) check(Boolean(TECH_MAP[b.unlockedBy]), `建筑 ${b.name} 解锁科技 ${b.unlockedBy} 不存在`)
  check(b.defaultUnlocked === true || Boolean(b.unlockedBy), `建筑 ${b.name} 没有解锁来源`)
}

// ---------- 科技 ----------
check(TECHS.length === 42, `科技应为 42 项，实际 ${TECHS.length}`)
TECHS.forEach((t, i) => {
  check(t.index === i + 1, `科技编号不连续：${t.name} 期望 ${i + 1}，实际 ${t.index}`)
  for (const r of t.requires) check(Boolean(TECH_MAP[r]), `科技 ${t.name} 前置 ${r} 不存在`)
  for (const r of t.requires) {
    check(TECH_MAP[r].layer <= t.layer, `科技 ${t.name}（第 ${t.layer} 层）前置 ${TECH_MAP[r].name} 在第 ${TECH_MAP[r].layer} 层`)
  }
  for (const id of t.unlockRecipes ?? []) check(recipeIds.has(id), `科技 ${t.name} 解锁的配方 ${id} 不存在`)
  for (const id of t.unlockBuildings ?? []) check(Boolean(BUILDINGS[id]), `科技 ${t.name} 解锁的建筑 ${id} 不存在`)
})
const byLayer: Record<number, number> = {}
for (const t of TECHS) byLayer[t.layer] = (byLayer[t.layer] ?? 0) + 1
assert.deepEqual(byLayer, { 1: 8, 2: 8, 3: 9, 4: 7, 5: 6, 6: 4 }, '分层数量应为 8/8/9/7/6/4')

// ---------- 解锁覆盖 ----------
const techOfRecipe = new Map<string, number>()
for (const t of TECHS) for (const id of t.unlockRecipes ?? []) techOfRecipe.set(id, t.layer)
for (const id of DEFAULT_RECIPES) techOfRecipe.set(id, 0)
for (const r of RECIPES) check(techOfRecipe.has(r.id), `配方 ${r.name} 没有解锁来源`)

const techOfBuilding = new Map<string, number>()
for (const t of TECHS) for (const id of t.unlockBuildings ?? []) techOfBuilding.set(id, t.layer)
for (const id of DEFAULT_BUILDINGS) techOfBuilding.set(id, 0)
for (const id of BUILDING_IDS) check(techOfBuilding.has(id), `建筑 ${BUILDINGS[id].name} 没有解锁来源`)

// ---------- 科技包闭合 ----------
const PACK_RECIPE: Record<string, string> = {
  automationPack: 'automationPack',
  logisticPack: 'logisticPack',
  chemicalPack: 'chemicalPack',
  militaryPack: 'militaryPack',
  productionPack: 'productionPack',
  utilityPack: 'utilityPack'
}
for (const [layerStr, packs] of Object.entries(LAYER_PACKS)) {
  const layer = Number(layerStr)
  for (const pack of packs) {
    const rid = PACK_RECIPE[pack]
    const r = RECIPES.find(x => x.id === rid)
    check(Boolean(r), `科技包 ${pack} 缺少配方`)
    if (!r) continue
    for (const input of Object.keys(r.inputs)) {
      // 该输入的生产配方必须在本层之前解锁
      const producers = RECIPES.filter(x => Object.keys(x.outputs).includes(input))
      const existRaw = ['ironOre', 'copperOre', 'coal', 'stone', 'crudeOil', 'water', 'uraniumOre'].includes(input)
      if (existRaw) continue
      let earliest = Infinity
      for (const p of producers) {
        const l = techOfRecipe.get(p.id)
        if (l !== undefined) earliest = Math.min(earliest, l)
      }
      check(earliest < layer, `第 ${layer} 层科技包 ${pack} 需要的 ${MATERIALS[input as keyof typeof MATERIALS].name} 最早在第 ${earliest} 层解锁`)
    }
  }
}

// ---------- 材料图闭合 ----------
const produced = new Set<string>()
for (const r of RECIPES) for (const m of Object.keys(r.outputs)) produced.add(m)
if (RECIPES.some(r => r.randomOutput)) for (const m of RECIPES.find(r => r.randomOutput)!.randomOutput!.pool) produced.add(m)
const orphan = MATERIAL_IDS.filter(id => {
  const def = MATERIALS[id]
  return !def.raw && !def.drop && !produced.has(id)
})
check(orphan.length === 0, `无产出材料：${orphan.map(id => MATERIALS[id].name).join('、')}`)

if (fail.length) {
  console.error('工厂数据校验失败：')
  for (const f of fail) console.error('  -', f)
  process.exit(1)
}
console.log(`工厂数据校验通过：材料 ${MATERIAL_IDS.length}、配方 ${RECIPES.length}、建筑 ${BUILDING_IDS.length}、科技 ${TECHS.length}`)
