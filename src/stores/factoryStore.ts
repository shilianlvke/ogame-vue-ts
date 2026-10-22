import { defineStore } from 'pinia'
import pkg from '../../package.json'
import { encryptData, decryptData } from '@/utils/crypto'
import { saveStorage } from '@/services/saveStorage'
import type { BuildingId, InfiniteResearchId, MaterialId, ModuleType, PlanetFactory, TechId } from '@/types/factory'
import {
  addBuilding,
  assignRecipe,
  createFactoryState,
  normalizeFactoryState,
  removeBuilding,
  setModuleCount,
  setOreSlot,
  setSlot,
  tickFactory,
  upgradeBuilding,
  type FactoryContext
} from '@/logic/factory/engine'
import { ORE_PRESETS, WAVE_COOLDOWN_MINUTES } from '@/config/factory/balance'
  import { applyDrops, baseDrops, createBattle, maxWave, rewardFactor, stepBattle, waveHp, type ActiveBattle, type WaveDrops } from '@/logic/factory/waves'
  import { INFINITE_RESEARCH, TECH_MAP } from '@/config/factory/techs'
  import { SHIP_COSTS } from '@/config/factory/balance'
  import { createOutpost, MAX_OUTPOSTS, tickOutpostCapped, type Outpost } from '@/logic/factory/outposts'
import { MARKET_MATCH_INTERVAL, marketFeeRate } from '@/config/factory/market'
import {
  cancelAllOrders as cancelAllMarketOrders,
  cancelOrder as cancelMarketOrder,
  createMarketState,
  expireOrders,
  matchMarket,
  marketPrice,
  placeOrder as placeMarketOrder,
  type MarketState,
  type OrderSide
} from '@/logic/factory/market'
import { productionWindow } from '@/logic/factory/diagnostics'
import { createCycleState, nextCycle, resetFactory, resetMarket, type CycleState } from '@/logic/factory/cycle'
import type { LaunchSelection } from '@/types/factory'
import type { OrePreset } from '@/config/factory/balance'

interface WaveState {
  clearCounts: Record<number, number>
  cooldownUntil: Record<number, number>
  dailyKey: string
  battle: ActiveBattle | null
  lastResult: { wave: number; won: boolean; drops: WaveDrops | null } | null
}

interface FactoryState {
  factory: PlanetFactory
  preset: OrePreset
  /** 上次结算的世界时间，秒 */
  lastTickAt: number
  /** 自动结算开关 */
  running: boolean
  wave: WaveState
  ships: Record<string, number>
  outposts: Outpost[]
  market: MarketState
  /** 周目与发射次数，跨周目累加 */
  cycle: CycleState
}

export const useFactoryStore = defineStore('factory', {
  state: (): FactoryState => ({
    factory: createFactoryState('standard'),
    preset: 'standard',
    lastTickAt: 0,
    running: true,
    wave: { clearCounts: {}, cooldownUntil: {}, dailyKey: '', battle: null, lastResult: null },
    ships: {},
    outposts: [],
    market: createMarketState(0),
    cycle: createCycleState()
  }),
  getters: {
    /** 引擎上下文 */
    context(state): FactoryContext {
      return {
        now: state.lastTickAt,
        preset: state.preset,
        techs: state.factory.techs,
        infinite: state.factory.infiniteResearch
      }
    },
    /** 当前手续费率，随矿业公会声望下降 */
    feeRate(state): number {
      return marketFeeRate(state.market.minersGuildRep)
    },
    /** 材料市场参考价 */
    priceOf(state) {
      return (id: MaterialId): number => marketPrice(state.market, id)
    },
    /** 距下次撮合的秒数 */
    nextMatchIn(state): number {
      return Math.max(0, state.market.nextMatchAt - state.lastTickAt)
    }
  },
  actions: {
    /** 重置到指定矿石方案 */
    reset(preset: OrePreset = 'standard') {
      this.preset = preset
      this.factory = createFactoryState(preset)
      this.lastTickAt = 0
      this.ships = {}
      this.outposts = []
      this.market = createMarketState(0)
      this.cycle = createCycleState()
      productionWindow.reset()
    },

    /** 推进结算，秒 */
    advance(seconds: number) {
      if (seconds <= 0) return
      if (!this.running) return
      const ctx: FactoryContext = {
        now: this.lastTickAt,
        preset: this.preset,
        techs: this.factory.techs,
        infinite: this.factory.infiniteResearch
      }
      const step = Math.min(seconds, 60)
      const report = tickFactory(this.factory, ctx, step)
      productionWindow.add(this.factory, report, step)
      this.lastTickAt += step
      if (this.wave.battle && !this.wave.battle.finished) {
        stepBattle(this.factory, this.wave.battle, step)
        if (this.wave.battle.finished) this.settleWave()
      }
      // 前哨运输结算
      for (const op of this.outposts) {
        const result = tickOutpostCapped(op, step)
        if (result.shipped > 0) {
          const cur = this.factory.stock[op.ore] ?? 0
          const cap = 5000 + this.factory.buildings.filter(b => b.type === 'warehouse' && b.enabled).reduce((a, b) => a + b.level, 0) * 5000
          this.factory.stock[op.ore] = Math.min(cap, cur + result.shipped)
        }
      }
      // 市场撮合：每 60 秒一次，先撤回过期挂单
      if (this.lastTickAt >= this.market.nextMatchAt) {
        expireOrders(this.market, this.factory, this.lastTickAt)
        matchMarket(this.market, this.factory, this.lastTickAt)
        this.market.nextMatchAt = this.lastTickAt + MARKET_MATCH_INTERVAL
      }
    },

    /** 舰船建造：装配机以 craft 类别生产零件后在此消耗 */
    buildShip(name: string): boolean {
      const def = SHIP_COSTS[name]
      if (!def) return false
      const parts: Partial<Record<MaterialId, number>> = {
        hullFrame: def.hull,
        thrusterAssembly: def.thruster,
        weaponAssembly: def.weapon,
        shieldAssembly: def.shield
      }
      for (const [k, v] of Object.entries(parts)) {
        if ((this.factory.stock[k as MaterialId] ?? 0) < (v as number)) return false
      }
      for (const [k, v] of Object.entries(parts)) {
        this.factory.stock[k as MaterialId] = (this.factory.stock[k as MaterialId] ?? 0) - (v as number)
      }
      this.ships[name] = (this.ships[name] ?? 0) + 1
      return true
    },

    /** 建立前哨：消耗一艘殖民船 */
    colonize(name: string, ore: MaterialId): boolean {
      if (this.outposts.length >= MAX_OUTPOSTS) return false
      if ((this.ships['殖民船'] ?? 0) < 1) return false
      this.ships['殖民船'] = (this.ships['殖民船'] ?? 0) - 1
      this.outposts.push(createOutpost(name, ore, this.preset))
      return true
    },

    /** 前哨建筑：矿井 1 级 = 1 槽 */
    buildOutpostMine(id: string, levels = 1): boolean {
      const op = this.outposts.find(o => o.id === id)
      if (!op) return false
      const cost = { ironPlate: 20 * levels, stone: 10 * levels }
      for (const [k, v] of Object.entries(cost)) {
        if ((this.factory.stock[k as MaterialId] ?? 0) < (v as number)) return false
      }
      for (const [k, v] of Object.entries(cost)) {
        this.factory.stock[k as MaterialId] = (this.factory.stock[k as MaterialId] ?? 0) - (v as number)
      }
      op.mineSlots += levels
      return true
    },

    buildOutpostWarehouse(id: string): boolean {
      const op = this.outposts.find(o => o.id === id)
      if (!op) return false
      const cost = { ironPlate: 50, stoneBrick: 20 }
      for (const [k, v] of Object.entries(cost)) {
        if ((this.factory.stock[k as MaterialId] ?? 0) < (v as number)) return false
      }
      for (const [k, v] of Object.entries(cost)) {
        this.factory.stock[k as MaterialId] = (this.factory.stock[k as MaterialId] ?? 0) - (v as number)
      }
      op.warehouseLevel += 1
      return true
    },

    buildOutpostSolar(id: string): boolean {
      const op = this.outposts.find(o => o.id === id)
      if (!op) return false
      if ((this.factory.stock.solarPanel ?? 0) < 10) return false
      this.factory.stock.solarPanel = (this.factory.stock.solarPanel ?? 0) - 10
      op.solarLevel += 1
      return true
    },

    /** 可用货舱容量 */
    totalCargo(): number {
      return (this.ships['小型货船'] ?? 0) * 600 + (this.ships['大型货船'] ?? 0) * 2500
    },

    assignCargo(id: string, cargo: number): boolean {
      const op = this.outposts.find(o => o.id === id)
      if (!op) return false
      const used = this.outposts.filter(o => o.id !== id).reduce((a, o) => a + o.cargo, 0)
      const available = this.totalCargo() - used
      op.cargo = Math.max(0, Math.min(cargo, available))
      return true
    },

    build(type: BuildingId, level = 1) {
      return addBuilding(this.factory, type, level)
    },

    upgrade(instanceId: string) {
      return upgradeBuilding(this.factory, instanceId)
    },

    demolish(instanceId: string) {
      return removeBuilding(this.factory, instanceId)
    },

    assign(instanceId: string, recipeId: string, count: number) {
      assignRecipe(this.factory, instanceId, recipeId, count)
    },

    assignOre(instanceId: string, slotIndex: number, ore: MaterialId | null) {
      return setOreSlot(this.factory, instanceId, slotIndex, ore)
    },

    clearSlot(instanceId: string, slotIndex: number) {
      return setSlot(this.factory, instanceId, slotIndex, null)
    },

    setModule(instanceId: string, type: ModuleType, count: number) {
      return setModuleCount(this.factory, instanceId, type, count)
    },

    bindTech(instanceId: string, slotIndex: number, techId: TechId | null) {
      const inst = this.factory.buildings.find(b => b.id === instanceId)
      const slot = inst?.slots[slotIndex]
      if (!slot) return false
      slot.techId = techId ?? undefined
      slot.status = techId ? 'running' : 'idle'
      return true
    },

    toggleBuilding(instanceId: string) {
      const inst = this.factory.buildings.find(b => b.id === instanceId)
      if (!inst) return
      inst.enabled = !inst.enabled
    },

    toggleCoalMode(instanceId: string) {
      const inst = this.factory.buildings.find(b => b.id === instanceId)
      if (!inst) return
      inst.coalMode = !inst.coalMode
    },

    /** 市场挂单：卖单占用仓库，买单冻结星币 */
    placeOrder(side: OrderSide, material: MaterialId, price: number, amount: number) {
      return placeMarketOrder(this.market, this.factory, side, material, price, amount, this.lastTickAt)
    },

    /** 撤回挂单 */
    cancelOrder(orderId: string) {
      return cancelMarketOrder(this.market, this.factory, orderId)
    },

    /** 撤回全部挂单（周目重置时调用） */
    cancelAllOrders() {
      return cancelAllMarketOrders(this.market, this.factory)
    },

    /**
     * 发射火箭：需火箭 ×1 + 种子舱 ×1，其余载荷可选。
     * 载荷携带判定后按周目重置表处理，周目 +1。
     */
    launchRocket(selection: LaunchSelection): { ok: boolean; reason?: string } {
      const factory = this.factory
      if ((factory.rockets ?? 0) < 1) return { ok: false, reason: '缺少火箭，需在发射井装配' }
      if ((factory.payloads.seedPod ?? 0) < 1) return { ok: false, reason: '缺少种子舱' }
      const carryDataCore = Boolean(selection.tech) && factory.techs.includes(selection.tech!) && (factory.payloads.dataCore ?? 0) >= 1
      const carryIndustrial =
        Boolean(selection.buildingInstanceId) &&
        factory.buildings.some(b => b.id === selection.buildingInstanceId) &&
        (factory.payloads.industrialSeed ?? 0) >= 1
      const carryCargoPod = (factory.payloads.cargoPod ?? 0) >= 1
      // 星图阵列：已发现星系尚未接入工厂存档，暂为占位
      // 市场挂单撤回 + 声望减半
      resetMarket(this.market, factory)
      // 母星工厂重置（载荷全部清空，发射时已消耗）
      const next = nextCycle(this.cycle.cycle)
      this.factory = resetFactory(factory, this.preset, next, carryCargoPod, {
        tech: carryDataCore ? selection.tech : undefined,
        buildingInstanceId: carryIndustrial ? selection.buildingInstanceId : undefined
      })
      // 前哨与航线拆除、波次记录清零
      this.outposts = []
      this.wave = { clearCounts: {}, cooldownUntil: {}, dailyKey: '', battle: null, lastResult: null }
      this.cycle.cycle = next
      this.cycle.launchCount += 1
      productionWindow.reset()
      return { ok: true }
    },

    /** 可挑战的最高波次 */
    waveCap(): number {
      return maxWave(this.factory)
    },

    /** 指定波次的基础 HP（扰动 1、当前周目） */
    previewHp(n: number): number {
      return waveHp(n, 1, this.cycle.cycle)
    },

    waveCooldownLeft(n: number): number {
      return Math.max(0, (this.wave.cooldownUntil[n] ?? 0) - Date.now())
    },

    /** 发起波次，观看模式 */
    startWave(n: number, overload = false): boolean {
      if (this.wave.battle && !this.wave.battle.finished) return false
      if (n > this.waveCap()) return false
      if (this.waveCooldownLeft(n) > 0) return false
      this.wave.battle = createBattle(this.factory, n, this.cycle.cycle, overload)
      this.wave.lastResult = null
      return true
    },

    /** 自动模式：立即结算，奖励 80% */
    autoWave(n: number): boolean {
      if (!this.startWave(n, false)) return false
      const battle = this.wave.battle
      if (!battle) return false
      let guard = 0
      while (!battle.finished && guard < 100000) {
        stepBattle(this.factory, battle, 1)
        guard++
      }
      if (!battle.finished) return false
      this.settleWave(0.8)
      return true
    },

    /** 结算波次：掉落按首通/重复系数，失败与重复进入冷却 */
    settleWave(autoFactor = 1) {
      const battle = this.wave.battle
      if (!battle || !battle.finished) return
      const n = battle.wave
      const won = battle.won
      const clear = this.wave.clearCounts[n] ?? 0
      const today = new Date().toISOString().slice(0, 10)
      const dailyBonus = won && clear === 0 && this.wave.dailyKey !== today
      if (won) {
        const factor = rewardFactor(clear, dailyBonus) * autoFactor
        const drops = baseDrops(n, this.preset)
        const applied = applyDrops(this.factory, drops, factor)
        this.wave.clearCounts[n] = clear + 1
        this.wave.lastResult = { wave: n, won: true, drops: applied }
        if (dailyBonus) this.wave.dailyKey = today
        if (clear >= 1) this.wave.cooldownUntil[n] = Date.now() + WAVE_COOLDOWN_MINUTES * 60 * 1000
      } else {
        this.wave.lastResult = { wave: n, won: false, drops: null }
        this.wave.cooldownUntil[n] = Date.now() + WAVE_COOLDOWN_MINUTES * 60 * 1000
      }
      this.wave.battle = null
    },

    /** 放弃当前战斗，按失败结算 */
    abandonWave() {
      const battle = this.wave.battle
      if (!battle) return
      battle.finished = true
      battle.won = false
      this.settleWave()
    },

    /** 开始研究：绑定到第一个空闲实验室槽位 */
    startResearch(techId: TechId): boolean {
      const tech = TECH_MAP[techId]
      if (!tech || this.factory.techs.includes(techId)) return false
      if (!tech.requires.every(r => this.factory.techs.includes(r))) return false
      for (const inst of this.factory.buildings) {
        if (inst.type !== 'lab' || !inst.enabled) continue
        const index = inst.slots.findIndex(s => !s.techId)
        if (index >= 0) {
          this.bindTech(inst.id, index, techId)
          return true
        }
      }
      return false
    },

    cancelResearch(instanceId: string, slotIndex: number) {
      return this.bindTech(instanceId, slotIndex, null)
    },

    /** 无限研究升级：消耗全部六种科技包 */
    buyInfinite(id: InfiniteResearchId): boolean {
      const meta = INFINITE_RESEARCH.find(x => x.id === id)
      if (!meta) return false
      const level = this.factory.infiniteResearch[id]
      const cost = Math.round(meta.baseCost * Math.pow(meta.growth, level))
      const packs: MaterialId[] = ['automationPack', 'logisticPack', 'chemicalPack', 'militaryPack', 'productionPack', 'utilityPack']
      for (const p of packs) {
        if ((this.factory.stock[p] ?? 0) < cost) return false
      }
      for (const p of packs) this.factory.stock[p] = (this.factory.stock[p] ?? 0) - cost
      this.factory.infiniteResearch[id] = level + 1
      return true
    },

    /** 存档迁移 */
    normalize() {
      this.factory = normalizeFactoryState(this.factory)
      if (!this.market || !Array.isArray(this.market.orders)) {
        this.market = createMarketState(this.lastTickAt)
      }
      if (!Array.isArray(this.market.log)) this.market.log = []
      if (!this.cycle || typeof this.cycle.cycle !== 'number') this.cycle = createCycleState()
    }
  },
  persist: {
    key: `${pkg.name}-factory`,
    storage: saveStorage,
    serializer: {
      serialize: (state: unknown) => encryptData(state),
      deserialize: (value: string) => decryptData(value)
    }
  }
})

/** 当前矿石方案的展示信息 */
export function presetInfo(preset: OrePreset) {
  return ORE_PRESETS[preset]
}
