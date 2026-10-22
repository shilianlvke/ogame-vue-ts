import { defineStore } from 'pinia'
import pkg from '../../package.json'
import { encryptData, decryptData } from '@/utils/crypto'
import { saveStorage } from '@/services/saveStorage'
import type { BuildingId, MaterialId, ModuleType, PlanetFactory, TechId } from '@/types/factory'
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
import { ORE_PRESETS } from '@/config/factory/balance'
import type { OrePreset } from '@/config/factory/balance'

interface FactoryState {
  factory: PlanetFactory
  preset: OrePreset
  /** 上次结算的世界时间，秒 */
  lastTickAt: number
  /** 自动结算开关 */
  running: boolean
}

export const useFactoryStore = defineStore('factory', {
  state: (): FactoryState => ({
    factory: createFactoryState('standard'),
    preset: 'standard',
    lastTickAt: 0,
    running: true
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
    }
  },
  actions: {
    /** 重置到指定矿石方案 */
    reset(preset: OrePreset = 'standard') {
      this.preset = preset
      this.factory = createFactoryState(preset)
      this.lastTickAt = 0
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
      tickFactory(this.factory, ctx, Math.min(seconds, 60))
      this.lastTickAt += Math.min(seconds, 60)
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

    /** 存档迁移 */
    normalize() {
      this.factory = normalizeFactoryState(this.factory)
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
