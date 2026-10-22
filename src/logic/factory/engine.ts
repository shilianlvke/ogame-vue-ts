import type {
  BuildingId,
  BuildingInstance,
  EquipmentId,
  InfiniteResearchId,
  MaterialId,
  ModuleType,
  PayloadId,
  PlanetFactory,
  RecipeDef,
  Slot,
  SuitTier,
  TechId
} from '@/types/factory'
import {
  BUILDINGS,
  FLUID_CAPACITY,
  MAX_LEVEL,
  MAX_INSTANCES,
  MAX_INSTANCES_PER_TYPE,
  MODULE_EFFICIENCY_SAVING,
  MODULE_PRODUCTIVITY_BONUS,
  MODULE_PRODUCTIVITY_POWER,
  MODULE_SPEED_BONUS,
  MODULE_SPEED_POWER,
  OIL_DECAY_FLOOR,
  ORE_PRESETS,
  INITIAL_INFINITE,
  INITIAL_STOCK,
  RESEARCH_UNITS_PER_SLOT,
  DEFAULT_STORAGE,
  NIGHT_SECONDS,
  DAY_SECONDS,
  REACTOR_FUEL_PER_SECOND,
  BOILER_COAL_PER_SECOND,
  BOILER_SOLID_FUEL_PER_SECOND,
  MAX_SLOTS_PER_TYPE,
  UPGRADE_MULTIPLIER,
  UPGRADE_MULTIPLIER_POWER,
  UPGRADE_MULTIPLIER_SILO,
  DEMOLISH_REFUND
} from '@/config/factory'
import { MATERIALS, MINEABLE } from '@/config/factory/materials'
import { RECIPE_MAP, RECIPES } from '@/config/factory/recipes'
import { TECH_MAP } from '@/config/factory/techs'

/** 引擎外部上下文 */
export interface FactoryContext {
  /** 世界时间，秒。用于昼夜判定 */
  now: number
  /** 矿石开采方案 */
  preset: keyof typeof ORE_PRESETS
  /** 已完成科技，用于速度加成 */
  techs: TechId[]
  /** 无限研究等级 */
  infinite: Record<InfiniteResearchId, number>
}

export interface TickReport {
  powerRatio: number
  produced: Partial<Record<MaterialId, number>>
  consumed: Partial<Record<MaterialId, number>>
  researched: TechId[]
}

const emptySlot = (): Slot => ({ recipeId: null, progress: 0, status: 'idle' })

/** 新建一份空的工厂状态 */
export function createFactoryState(preset: keyof typeof ORE_PRESETS = 'standard'): PlanetFactory {
  const oreReserve: Partial<Record<MaterialId, number>> = {}
  const def = ORE_PRESETS[preset]
  for (const ore of MINEABLE) {
    const offset = ore === 'uraniumOre' ? def.rareOffset : 1
    oreReserve[ore] = Math.round(def.homeReserve * offset)
  }
  return {
    stock: { ...INITIAL_STOCK },
    fluids: {},
    payloads: {},
    equipment: {},
    buildings: [],
    techs: [],
    infiniteResearch: { ...INITIAL_INFINITE },
    oreReserve,
    oreReserveMax: { ...oreReserve },
    oilExtracted: 0,
    powerRatio: 1,
    lifetimeProduced: 0,
    researchProgress: {},
    priority: {}
  }
}

/** 存档补全：旧存档缺少的字段填默认值 */
export function normalizeFactoryState(state: PlanetFactory): PlanetFactory {
  return {
    ...createFactoryState('standard'),
    ...state,
    stock: { ...createFactoryState('standard').stock, ...state.stock },
    oreReserveMax: state.oreReserveMax ?? { ...(state.oreReserve ?? {}) },
    researchProgress: state.researchProgress ?? {},
    priority: state.priority ?? {},
    infiniteResearch: { ...INITIAL_INFINITE, ...(state.infiniteResearch ?? {}) }
  }
}

let instanceSeq = 0
function nextId(): string {
  instanceSeq += 1
  return `b${Date.now().toString(36)}${instanceSeq.toString(36)}`
}

export function instanceCount(state: PlanetFactory, type: BuildingId): number {
  return state.buildings.filter(b => b.type === type).length
}

export function totalLevel(state: PlanetFactory, type: BuildingId): number {
  return state.buildings.filter(b => b.type === type && b.enabled).reduce((a, b) => a + b.level, 0)
}

export function slotsOf(level: number): number {
  return Math.max(1, Math.min(MAX_LEVEL, level))
}

export function newCost(type: BuildingId): Partial<Record<MaterialId, number>> {
  return BUILDINGS[type].baseCost
}

function upgradeMultiplier(type: BuildingId): number {
  if (type === 'rocketSilo') return UPGRADE_MULTIPLIER_SILO
  if (BUILDINGS[type].powerPerLevel) return UPGRADE_MULTIPLIER_POWER
  return UPGRADE_MULTIPLIER
}

export function upgradeCost(type: BuildingId, nextLevel: number): Partial<Record<MaterialId, number>> {
  if (nextLevel <= 1) return newCost(type)
  const factor = Math.pow(upgradeMultiplier(type), nextLevel - 1)
  const out: Partial<Record<MaterialId, number>> = {}
  for (const [k, v] of Object.entries(BUILDINGS[type].baseCost)) out[k as MaterialId] = Math.ceil((v as number) * factor)
  return out
}

export function demolishRefund(type: BuildingId, level: number): Partial<Record<MaterialId, number>> {
  const out: Partial<Record<MaterialId, number>> = {}
  for (const [k, v] of Object.entries(BUILDINGS[type].baseCost)) out[k as MaterialId] = Math.floor((v as number) * level * DEMOLISH_REFUND)
  return out
}

function canAfford(state: PlanetFactory, cost: Partial<Record<MaterialId, number>>): boolean {
  return Object.entries(cost).every(([k, v]) => (state.stock[k as MaterialId] ?? 0) >= (v as number))
}

function pay(state: PlanetFactory, cost: Partial<Record<MaterialId, number>>) {
  for (const [k, v] of Object.entries(cost)) {
    const id = k as MaterialId
    state.stock[id] = Math.max(0, (state.stock[id] ?? 0) - (v as number))
  }
}

function gain(state: PlanetFactory, cost: Partial<Record<MaterialId, number>>) {
  for (const [k, v] of Object.entries(cost)) {
    const id = k as MaterialId
    state.stock[id] = (state.stock[id] ?? 0) + (v as number)
  }
}

/** 新建实例 */
export function addBuilding(state: PlanetFactory, type: BuildingId, level = 1): BuildingInstance | null {
  const def = BUILDINGS[type]
  if (!def.defaultUnlocked && (!def.unlockedBy || !state.techs.includes(def.unlockedBy))) return null
  if (instanceCount(state, type) >= MAX_INSTANCES_PER_TYPE) return null
  if (state.buildings.length >= MAX_INSTANCES) return null
  const cost = level <= 1 ? newCost(type) : upgradeCost(type, level)
  if (!canAfford(state, cost)) return null
  pay(state, cost)
  const slots = Array.from({ length: slotsOf(level) }, emptySlot)
  const instance: BuildingInstance = { id: nextId(), type, level, enabled: true, slots, modules: [] }
  state.buildings.push(instance)
  return instance
}

/** 升级实例，成本为增量（目标等级成本 - 当前等级成本） */
export function upgradeBuilding(state: PlanetFactory, instanceId: string): boolean {
  const inst = state.buildings.find(b => b.id === instanceId)
  if (!inst || inst.level >= MAX_LEVEL) return false
  const type = inst.type
  const cur = inst.level <= 1 ? newCost(type) : upgradeCost(type, inst.level)
  const next = upgradeCost(type, inst.level + 1)
  const delta: Partial<Record<MaterialId, number>> = {}
  for (const [k, v] of Object.entries(next)) {
    const already = (cur[k as MaterialId] ?? 0) as number
    delta[k as MaterialId] = Math.max(0, (v as number) - already)
  }
  if (!canAfford(state, delta)) return false
  pay(state, delta)
  inst.level += 1
  while (inst.slots.length < slotsOf(inst.level)) inst.slots.push(emptySlot())
  return true
}

/** 拆除实例，返还一半基础成本 */
export function removeBuilding(state: PlanetFactory, instanceId: string): boolean {
  const idx = state.buildings.findIndex(b => b.id === instanceId)
  if (idx < 0) return false
  const inst = state.buildings[idx]!
  gain(state, demolishRefund(inst.type, inst.level))
  const moduleCount: Record<ModuleType, MaterialId> = {
    speed: 'speedModule',
    productivity: 'productivityModule',
    efficiency: 'efficiencyModule'
  }
  for (const m of inst.modules) state.stock[moduleCount[m]] = (state.stock[moduleCount[m]] ?? 0) + 1
  state.buildings.splice(idx, 1)
  return true
}

/** 分配槽位配方 */
export function setSlot(state: PlanetFactory, instanceId: string, slotIndex: number, recipeId: string | null): boolean {
  const inst = state.buildings.find(b => b.id === instanceId)
  if (!inst || slotIndex < 0 || slotIndex >= inst.slots.length) return false
  const slot = inst.slots[slotIndex]!
  if (slot.recipeId === recipeId) return true
  if (recipeId !== null) {
    const recipe = RECIPE_MAP[recipeId]
    if (!recipe) return false
    const def = BUILDINGS[inst.type]
    if (def.categories.length && !def.categories.includes(recipe.category)) return false
    if (!def.categories.length) return false
    if (recipe.unlockedBy && !state.techs.includes(recipe.unlockedBy)) return false
  }
  slot.recipeId = recipeId
  slot.progress = 0
  slot.status = recipeId ? 'running' : 'idle'
  return true
}

/** 采掘建筑指定矿种 */
export function setOreSlot(state: PlanetFactory, instanceId: string, slotIndex: number, ore: MaterialId | null): boolean {
  const inst = state.buildings.find(b => b.id === instanceId)
  if (!inst) return false
  const def = BUILDINGS[inst.type]
  if (!def.yieldPerSlot) return false
  if (ore !== null && !MINEABLE.includes(ore) && ore !== 'crudeOil') return false
  const slot = inst.slots[slotIndex]
  if (!slot) return false
  slot.recipeId = ore
  slot.progress = 0
  slot.status = ore ? 'running' : 'idle'
  return true
}

/** 批量把某配方的槽位分配到指定数量 */
export function assignRecipe(state: PlanetFactory, instanceId: string, recipeId: string, count: number): void {
  const inst = state.buildings.find(b => b.id === instanceId)
  if (!inst) return
  let placed = 0
  for (let i = 0; i < inst.slots.length; i++) {
    const cur = inst.slots[i]!
    if (placed < count) {
      if (cur.recipeId !== recipeId) setSlot(state, instanceId, i, recipeId)
      placed++
    } else if (cur.recipeId === recipeId) {
      setSlot(state, instanceId, i, null)
    }
  }
}

/** 装配 / 拆除模块 */
export function setModuleCount(state: PlanetFactory, instanceId: string, type: ModuleType, count: number): boolean {
  const inst = state.buildings.find(b => b.id === instanceId)
  if (!inst) return false
  const def = BUILDINGS[inst.type]
  if (!def.moduleSlots) return false
  const capacity = Math.floor(inst.level / 4) + (state.techs.includes('robotLogistics') ? 1 : 0)
  const current = inst.modules.filter(m => m === type).length
  const target = Math.max(0, Math.min(capacity - (inst.modules.length - current), count))
  if (target === current) return true
  const material: MaterialId = type === 'speed' ? 'speedModule' : type === 'productivity' ? 'productivityModule' : 'efficiencyModule'
  if (target > current) {
    const need = target - current
    if ((state.stock[material] ?? 0) < need) return false
    state.stock[material] = (state.stock[material] ?? 0) - need
    for (let i = 0; i < need; i++) inst.modules.push(type)
  } else {
    const drop = current - target
    for (let i = 0; i < drop; i++) inst.modules.splice(inst.modules.indexOf(type), 1)
    state.stock[material] = (state.stock[material] ?? 0) + drop
  }
  return true
}

/** 仓库单种上限 */
export function storageCap(state: PlanetFactory): number {
  return DEFAULT_STORAGE + totalLevel(state, 'warehouse') * 5000
}

/** 流体单种上限 */
export function fluidCap(): number {
  return FLUID_CAPACITY
}

/** 电力：燃料结算后的可用功率 */
function powerCapacity(state: PlanetFactory, ctx: FactoryContext, dt: number): number {
  let cap = 0
  for (const b of state.buildings) {
    if (!b.enabled) continue
    const def = BUILDINGS[b.type]
    if (!def.powerPerLevel) continue
    if (b.type === 'solarArray') {
      const phase = ctx.now % DAY_SECONDS
      if (phase < DAY_SECONDS - NIGHT_SECONDS) cap += def.powerPerLevel * b.level
      continue
    }
    if (b.type === 'boiler') {
      const needCoal = BOILER_COAL_PER_SECOND * b.level * dt
      const needSolid = BOILER_SOLID_FUEL_PER_SECOND * b.level * dt
      if ((state.stock.coal ?? 0) >= needCoal) {
        state.stock.coal = (state.stock.coal ?? 0) - needCoal
        cap += def.powerPerLevel * b.level
      } else if ((state.stock.solidFuel ?? 0) >= needSolid) {
        state.stock.solidFuel = (state.stock.solidFuel ?? 0) - needSolid
        cap += def.powerPerLevel * b.level
      }
      continue
    }
    if (b.type === 'nuclearReactor') {
      const need = REACTOR_FUEL_PER_SECOND * b.level * dt
      if ((state.stock.nuclearFuelCell ?? 0) >= need) {
        state.stock.nuclearFuelCell = (state.stock.nuclearFuelCell ?? 0) - need
        cap += def.powerPerLevel * b.level
      }
    }
  }
  return cap
}

/** 蓄电器容量，MJ */
function accumulatorCapacity(state: PlanetFactory): number {
  let cap = 0
  for (const b of state.buildings) {
    if (!b.enabled || b.type !== 'accumulatorBank') continue
    cap += (BUILDINGS.accumulatorBank.capacityPerLevel ?? 5) * b.level
  }
  return cap
}

/** 槽位能耗（含模块） */
function slotEnergy(inst: BuildingInstance, recipe: RecipeDef): number {
  const def = BUILDINGS[inst.type]
  if (def.coalPerSlot) return 0
  let energy = recipe.energy > 0 ? recipe.energy : def.powerPerSlot ?? 0
  const speedMods = inst.modules.filter(m => m === 'speed').length
  const productivityMods = inst.modules.filter(m => m === 'productivity').length
  const efficiencyMods = inst.modules.filter(m => m === 'efficiency').length
  energy *= 1 + speedMods * MODULE_SPEED_POWER + productivityMods * MODULE_PRODUCTIVITY_POWER
  energy *= Math.pow(1 - MODULE_EFFICIENCY_SAVING, efficiencyMods)
  if (inst.coalMode) energy = 0
  return energy
}

/** 槽位速度倍率（含模块与科技） */
function slotSpeed(inst: BuildingInstance, recipe: RecipeDef, ctx: FactoryContext): number {
  const def = BUILDINGS[inst.type]
  let speed = def.speed ?? 1
  if (inst.coalMode) speed *= def.coalSpeedFactor ?? 0.5
  speed *= 1 + inst.modules.filter(m => m === 'speed').length * MODULE_SPEED_BONUS
  if (recipe.category === 'smelt') speed *= 1 + 0.1 * (ctx.techs.includes('smeltingOptimization') ? 1 : 0) + 0.05 * ctx.infinite.smelting
  if (inst.type === 'assembler') speed *= 1 + 0.1 * (ctx.techs.includes('advancedAssembly') ? 1 : 0)
  return speed
}

/** 采掘速率 */
function miningRate(inst: BuildingInstance, ctx: FactoryContext, state: PlanetFactory, ore: MaterialId): number {
  const def = BUILDINGS[inst.type]
  let rate = def.yieldPerSlot ?? 0
  if (def.canElectrify) {
    if (inst.coalMode) rate *= def.coalSpeedFactor ?? 0.5
    else rate *= 1 + 0.1 * (ctx.techs.includes('miningEfficiency') ? 1 : 0)
  }
  rate *= 1 + 0.02 * ctx.infinite.mining
  if (inst.type === 'oilWell') {
    const max = state.oreReserveMax?.crudeOil ?? 0
    const left = state.oreReserve.crudeOil ?? 0
    const ratio = max > 0 ? left / max : 1
    rate *= Math.max(OIL_DECAY_FLOOR, ratio)
  } else if (ore) {
    const max = state.oreReserveMax?.[ore] ?? 0
    const left = state.oreReserve[ore] ?? 0
    const ratio = max > 0 ? left / max : 1
    rate *= ratio > 0.4 ? 1 : ratio > 0.2 ? 0.5 : 0.2
  }
  return rate
}

/** 产出写入库存，返回是否成功 */
function pushStock(state: PlanetFactory, material: MaterialId, amount: number, cap: number): boolean {
  const def = MATERIALS[material]
  if (def.fluid) {
    const cur = state.fluids[material] ?? 0
    if (cur + amount > FLUID_CAPACITY) return false
    state.fluids[material] = cur + amount
    return true
  }
  const cur = state.stock[material] ?? 0
  if (cur + amount > cap) return false
  state.stock[material] = cur + amount
  return true
}

function hasInput(state: PlanetFactory, material: MaterialId, amount: number): boolean {
  const def = MATERIALS[material]
  const cur = def.fluid ? state.fluids[material] ?? 0 : state.stock[material] ?? 0
  return cur >= amount
}

function takeInput(state: PlanetFactory, material: MaterialId, amount: number) {
  const def = MATERIALS[material]
  if (def.fluid) state.fluids[material] = Math.max(0, (state.fluids[material] ?? 0) - amount)
  else state.stock[material] = Math.max(0, (state.stock[material] ?? 0) - amount)
}

/** 结算一次 tick。dt 为秒，在线为 1，离线批量时可放大 */
export function tickFactory(state: PlanetFactory, ctx: FactoryContext, dt = 1): TickReport {
  const produced: Partial<Record<MaterialId, number>> = {}
  const consumed: Partial<Record<MaterialId, number>> = {}
  const researched: TechId[] = []
  const cap = storageCap(state)

  // 1. 电力：先算需求，再算燃料受限的容量，最后由蓄电器补缺或吸收盈余
  let demand = 0
  for (const inst of state.buildings) {
    if (!inst.enabled) continue
    const def = BUILDINGS[inst.type]
    for (const slot of inst.slots) {
      if (!slot.recipeId) continue
      if (inst.type === 'lab') continue
      const recipe = def.categories.length ? RECIPE_MAP[slot.recipeId] : null
      if (recipe) demand += slotEnergy(inst, recipe)
      else if (def.yieldPerSlot && !inst.coalMode) demand += def.powerPerSlot ?? 0
    }
  }
  let supplied = powerCapacity(state, ctx, dt)
  const accCap = accumulatorCapacity(state)
  if (accCap > 0) {
    if (supplied > demand) {
      const surplus = ((supplied - demand) * dt) / 1000
      state.storedEnergy = Math.min(accCap, (state.storedEnergy ?? 0) + surplus)
    } else if (supplied < demand) {
      const need = ((demand - supplied) * dt) / 1000
      const used = Math.min(need, state.storedEnergy ?? 0)
      state.storedEnergy = (state.storedEnergy ?? 0) - used
      supplied += (used * 1000) / dt
    }
  }
  const ratio = demand > 0 ? Math.min(1, supplied / demand) : 1
  state.powerRatio = ratio

  // 2. 采掘
  for (const inst of state.buildings) {
    if (!inst.enabled) continue
    const def = BUILDINGS[inst.type]
    if (!def.yieldPerSlot) continue
    for (const slot of inst.slots) {
      if (!slot.recipeId) continue
      const ore = slot.recipeId as MaterialId
      if (!MATERIALS[ore]) continue
      if (inst.coalMode) {
        const need = (def.coalPerSlot ?? 0) * dt
        if ((state.stock.coal ?? 0) < need) {
          slot.status = 'starved'
          continue
        }
        state.stock.coal = (state.stock.coal ?? 0) - need
      }
      const rate = miningRate(inst, ctx, state, ore) * (inst.coalMode ? 1 : ratio)
      slot.progress += rate * dt
      while (slot.progress >= 1) {
        const left = state.oreReserve[ore] ?? 0
        if (left < 1) break
        if (!pushStock(state, ore, 1, cap)) {
          slot.status = 'blocked'
          break
        }
        state.oreReserve[ore] = left - 1
        if (inst.type === 'oilWell') state.oilExtracted += 1
        produced[ore] = (produced[ore] ?? 0) + 1
        slot.progress -= 1
        slot.status = 'running'
      }
    }
  }

  // 3~4. 配方槽位推进
  for (const inst of state.buildings) {
    if (!inst.enabled) continue
    const def = BUILDINGS[inst.type]
    if (!def.categories.length) continue
    const speedMult = inst.coalMode ? 1 : ratio
    for (const slot of inst.slots) {
      if (!slot.recipeId) {
        slot.status = 'idle'
        continue
      }
      const recipe = RECIPE_MAP[slot.recipeId]
      if (!recipe) {
        slot.status = 'idle'
        continue
      }
      if (def.coalPerSlot) {
        const need = def.coalPerSlot * dt
        if ((state.stock.coal ?? 0) < need) {
          slot.status = 'starved'
          continue
        }
        state.stock.coal = (state.stock.coal ?? 0) - need
      }
      if (slot.progress >= 1) {
        // 等待产出，先尝试结算
        if (tryProduce(state, inst, slot, recipe, cap, produced, consumed)) {
          slot.progress = 0
          slot.status = 'running'
        }
        continue
      }
      slot.progress += (slotSpeed(inst, recipe, ctx) * speedMult * dt) / recipe.time
      if (slot.progress >= 1) {
        slot.progress = 1
        if (tryProduce(state, inst, slot, recipe, cap, produced, consumed)) {
          slot.progress = 0
          slot.status = 'running'
        }
      } else {
        slot.status = 'running'
      }
    }
  }

  // 5. 研究
  for (const inst of state.buildings) {
    if (!inst.enabled || inst.type !== 'lab') continue
    for (const slot of inst.slots) {
      const techId = slot.techId
      if (!techId) {
        slot.status = 'idle'
        continue
      }
      const tech = TECH_MAP[techId]
      if (!tech || state.techs.includes(techId)) {
        slot.techId = undefined
        slot.status = 'idle'
        continue
      }
      const packs = packsForLayer(tech.layer)
      const units = RESEARCH_UNITS_PER_SLOT * dt
      const affordable = Math.min(...packs.map(p => Math.floor((state.stock[p] ?? 0) / units)))
      if (affordable < 1) {
        slot.status = 'starved'
        continue
      }
      for (const p of packs) state.stock[p] = (state.stock[p] ?? 0) - units
      const next = (state.researchProgress[techId] ?? 0) + units
      if (next >= tech.cost) {
        state.researchProgress[techId] = 0
        state.techs.push(techId)
        researched.push(techId)
        slot.techId = undefined
        slot.status = 'idle'
      } else {
        state.researchProgress[techId] = next
        slot.status = 'running'
      }
    }
  }

  // 累计产量
  let total = 0
  for (const v of Object.values(produced)) total += v ?? 0
  state.lifetimeProduced += total / 10000

  return { powerRatio: ratio, produced, consumed, researched }
}

const LAYER_PACK_IDS: Record<number, MaterialId[]> = {
  1: ['automationPack'],
  2: ['automationPack', 'logisticPack'],
  3: ['automationPack', 'logisticPack', 'chemicalPack'],
  4: ['automationPack', 'logisticPack', 'chemicalPack', 'militaryPack'],
  5: ['automationPack', 'logisticPack', 'chemicalPack', 'militaryPack', 'productionPack'],
  6: ['automationPack', 'logisticPack', 'chemicalPack', 'militaryPack', 'productionPack', 'utilityPack']
}

export function packsForLayer(layer: number): MaterialId[] {
  return LAYER_PACK_IDS[layer] ?? LAYER_PACK_IDS[1]!
}

/** 尝试完成一次产出 */
function tryProduce(
  state: PlanetFactory,
  inst: BuildingInstance,
  slot: Slot,
  recipe: RecipeDef,
  cap: number,
  produced: Partial<Record<MaterialId, number>>,
  consumed: Partial<Record<MaterialId, number>>
): boolean {
  for (const [k, v] of Object.entries(recipe.inputs)) {
    if (!hasInput(state, k as MaterialId, v as number)) {
      slot.status = 'starved'
      return false
    }
  }
  // 先判定产出是否放得下
  const outputs = { ...recipe.outputs } as Partial<Record<MaterialId, number>>
  const productivityMods = inst.modules.filter(m => m === 'productivity').length
  const bonus = 1 + productivityMods * MODULE_PRODUCTIVITY_BONUS
  let randomOre: MaterialId | null = null
  if (recipe.randomOutput) {
    if (!slot.outputItem) slot.outputItem = pickRandom(recipe.randomOutput)
    randomOre = slot.outputItem!
    outputs[randomOre!] = 400 * bonus
  }
  for (const [k, v] of Object.entries(outputs)) {
    const id = k as MaterialId
    const amount = v as number
    if (!MATERIALS[id].fluid && (state.stock[id] ?? 0) + amount > cap) {
      slot.status = 'blocked'
      return false
    }
    if (MATERIALS[id].fluid && (state.fluids[id] ?? 0) + amount > FLUID_CAPACITY) {
      slot.status = 'blocked'
      return false
    }
  }
  for (const [k, v] of Object.entries(recipe.inputs)) takeInput(state, k as MaterialId, v as number)
  for (const [k, v] of Object.entries(outputs)) {
    const id = k as MaterialId
    const amount = v as number
    if (MATERIALS[id].fluid) state.fluids[id] = (state.fluids[id] ?? 0) + amount
    else state.stock[id] = (state.stock[id] ?? 0) + amount
    produced[id] = (produced[id] ?? 0) + amount
    consumed[id] = (consumed[id] ?? 0) + amount
  }
  if (recipe.payloadOutput) {
    const id: PayloadId = recipe.payloadOutput
    state.payloads[id] = (state.payloads[id] ?? 0) + 1
  }
  if (recipe.equipmentOutput) {
    const id: EquipmentId = recipe.equipmentOutput
    state.equipment[id] = (state.equipment[id] ?? 0) + 1
  }
  if (recipe.suitOutput) {
    state.suit = recipe.suitOutput as SuitTier
  }
  if (randomOre) slot.outputItem = undefined
  return true
}

function pickRandom(pool: { pool: MaterialId[]; weights: number[] }): MaterialId {
  const total = pool.weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (let i = 0; i < pool.pool.length; i++) {
    roll -= pool.weights[i]!
    if (roll <= 0) return pool.pool[i]!
  }
  return pool.pool[pool.pool.length - 1]!
}

/** 离线批量结算 */
export function simulateOffline(state: PlanetFactory, ctx: FactoryContext, seconds: number, step = 60): TickReport[] {
  const reports: TickReport[] = []
  let left = seconds
  while (left > 0) {
    const dt = Math.min(step, left)
    reports.push(tickFactory(state, { ...ctx, now: ctx.now + (seconds - left) }, dt))
    left -= dt
  }
  return reports
}

/** 可分配的配方列表，按建筑类别 */
export function availableRecipes(state: PlanetFactory, type: BuildingId): RecipeDef[] {
  const def = BUILDINGS[type]
  if (!def.categories.length) return []
  return RECIPES.filter(r => def.categories.includes(r.category) && (!r.unlockedBy || state.techs.includes(r.unlockedBy)))
}

/** 单类型的槽位总数上限检查 */
export function slotsUsage(state: PlanetFactory, type: BuildingId): number {
  return state.buildings.filter(b => b.type === type).reduce((a, b) => a + b.slots.length, 0)
}

export function exceedsSlotLimit(state: PlanetFactory, type: BuildingId): boolean {
  return slotsUsage(state, type) > MAX_SLOTS_PER_TYPE
}
