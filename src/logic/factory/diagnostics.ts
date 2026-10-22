import type { MaterialId, PlanetFactory, SlotStatus } from '@/types/factory'
import { MATERIALS } from '@/config/factory/materials'
import { RECIPES, RECIPE_MAP } from '@/config/factory/recipes'
import { fluidCap, storageCap, type TickReport } from './engine'

/**
 * 诊断面板，对应规划书 §6.7。
 * 每行一个配方：理论产能 = 槽位数 / 配方时间，实际产能 = 最近 60 秒产出总量 / 60。
 * 数值每 2 秒刷新（界面补间），状态枚举立即刷新。
 */

/** 配方主产出材料（随机产出类配方不参与诊断） */
export const MAIN_OUTPUT: Record<string, MaterialId> = (() => {
  const out: Record<string, MaterialId> = {}
  for (const r of RECIPES) {
    if (r.randomOutput) continue
    const key = Object.keys(r.outputs)[0]
    if (key) out[r.id] = key as MaterialId
  }
  return out
})()

/** 某配方当前分配的启用槽位数 */
export function activeSlotsOfRecipe(state: PlanetFactory, recipeId: string): number {
  let n = 0
  for (const inst of state.buildings) {
    if (!inst.enabled) continue
    for (const slot of inst.slots) if (slot.recipeId === recipeId) n += 1
  }
  return n
}

/** 最近 60 秒产出滚动窗口，按主产出材料归因到配方，同时保留材料级总量 */
export class ProductionWindow {
  private entries: { seconds: number; perRecipe: Record<string, number>; perMaterial: Record<string, number> }[] = []
  private totalSeconds = 0
  readonly span = 60

  add(state: PlanetFactory, report: TickReport, dt: number) {
    const perRecipe: Record<string, number> = {}
    const perMaterial: Record<string, number> = {}
    for (const [material, amount] of Object.entries(report.produced)) {
      const id = material as MaterialId
      const amountN = amount ?? 0
      if (amountN <= 0) continue
      perMaterial[id] = amountN
      // 以该材料为主产出的配方，按活跃槽位数分摊产量
      const producers = RECIPES.filter(r => MAIN_OUTPUT[r.id] === id && activeSlotsOfRecipe(state, r.id) > 0)
      if (!producers.length) continue
      const total = producers.reduce((a, r) => a + activeSlotsOfRecipe(state, r.id), 0)
      if (total <= 0) continue
      for (const r of producers) {
        perRecipe[r.id] = (perRecipe[r.id] ?? 0) + (activeSlotsOfRecipe(state, r.id) * amountN) / total
      }
    }
    this.entries.push({ seconds: dt, perRecipe, perMaterial })
    this.totalSeconds += dt
    while (this.totalSeconds > this.span && this.entries.length) {
      const head = this.entries.shift()!
      this.totalSeconds -= head.seconds
    }
  }

  /** 最近 60 秒配方主产出平均秒产 */
  rateOf(recipeId: string): number {
    let total = 0
    for (const e of this.entries) total += e.perRecipe[recipeId] ?? 0
    return total / this.span
  }

  /** 最近 60 秒材料平均秒产（含流体与采掘矿，供任务产能目标使用） */
  materialRate(material: MaterialId): number {
    let total = 0
    for (const e of this.entries) total += e.perMaterial[material] ?? 0
    return total / this.span
  }

  /** 清空窗口（重置存档时调用） */
  reset() {
    this.entries = []
    this.totalSeconds = 0
  }
}

/** 全局生产窗口，随引擎结算持续累积 */
export const productionWindow = new ProductionWindow()

/** 配方状态 = 其槽位的最差状态 */
export function recipeStatus(statuses: SlotStatus[]): SlotStatus {
  if (!statuses.length) return 'idle'
  if (statuses.every(s => s === 'running')) return 'running'
  if (statuses.some(s => s === 'blocked')) return 'blocked'
  if (statuses.some(s => s === 'starved')) return 'starved'
  if (statuses.some(s => s === 'undervolt')) return 'undervolt'
  if (statuses.some(s => s === 'throttled')) return 'throttled'
  return 'idle'
}

/** 导致当前状态的缺失项 */
export function recipeMissing(state: PlanetFactory, recipeId: string, status: SlotStatus): string[] {
  const recipe = RECIPE_MAP[recipeId]
  if (!recipe) return []
  if (status === 'starved') {
    const lack: string[] = []
    for (const [k, v] of Object.entries(recipe.inputs)) {
      const id = k as MaterialId
      const cur = MATERIALS[id].fluid ? (state.fluids[id] ?? 0) : (state.stock[id] ?? 0)
      if (cur < (v as number)) lack.push(MATERIALS[id].name)
    }
    return lack
  }
  if (status === 'blocked') {
    const full: string[] = []
    for (const k of Object.keys(recipe.outputs)) {
      const id = k as MaterialId
      const cap = MATERIALS[id].fluid ? fluidCap() : storageCap(state)
      const cur = MATERIALS[id].fluid ? (state.fluids[id] ?? 0) : (state.stock[id] ?? 0)
      if (cur >= cap) full.push(MATERIALS[id].name)
    }
    return full.length ? full : ['仓库']
  }
  if (status === 'undervolt' || status === 'throttled') return ['电力']
  if (status === 'idle') return ['未分配槽位']
  return []
}

export interface RecipeDiagRow {
  recipeId: string
  name: string
  icon: MaterialId | null
  slots: number
  /** 理论产能：槽位数 / 配方时间 × 单次主产出量 */
  theoretical: number
  /** 实际产能：最近 60 秒主产出 / 60 */
  actual: number
  status: SlotStatus
  missing: string[]
}

/** 全部配方诊断行 */
export function recipeDiagnostics(state: PlanetFactory): RecipeDiagRow[] {
  const rows: RecipeDiagRow[] = []
  for (const r of RECIPES) {
    if (r.randomOutput) continue
    const statuses: SlotStatus[] = []
    for (const inst of state.buildings) {
      if (!inst.enabled) continue
      for (const slot of inst.slots) if (slot.recipeId === r.id) statuses.push(slot.status)
    }
    const status = recipeStatus(statuses)
    const main = MAIN_OUTPUT[r.id] ?? null
    const mainQty = main ? (r.outputs[main] ?? 1) : 1
    rows.push({
      recipeId: r.id,
      name: r.name,
      icon: main,
      slots: statuses.length,
      theoretical: (statuses.length / r.time) * mainQty,
      actual: productionWindow.rateOf(r.id),
      status,
      missing: recipeMissing(state, r.id, status)
    })
  }
  return rows
}
