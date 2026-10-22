/**
 * 工厂系统的数据结构定义。
 * 对应规划书 doc/DESIGN_FACTORY.md 的 §3 材料、§4 建筑、§5 配方、§7 研究。
 */

/** 材料分级，T0 为原料，T10 为锈群掉落 */
export type MaterialTier = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9' | 'T10'

export type MaterialId =
  // T0 原料
  | 'ironOre'
  | 'copperOre'
  | 'coal'
  | 'stone'
  | 'crudeOil'
  | 'water'
  // T1 冶炼
  | 'ironPlate'
  | 'copperPlate'
  | 'steel'
  | 'stoneBrick'
  | 'solidFuel'
  // T2 基础零件
  | 'ironGear'
  | 'copperCable'
  | 'circuit'
  | 'pipe'
  | 'ironStick'
  // T3 中级
  | 'petroleumGas'
  | 'heavyOil'
  | 'lightOil'
  | 'plastic'
  | 'sulfur'
  | 'sulfuricAcid'
  | 'advancedCircuit'
  | 'processingUnit'
  | 'engineUnit'
  | 'electricEngine'
  | 'battery'
  | 'explosives'
  | 'lubricant'
  // T4 模块
  | 'speedModule'
  | 'productivityModule'
  | 'efficiencyModule'
  // T5 高级
  | 'lowDensityStructure'
  | 'rocketFuel'
  | 'rocketControlUnit'
  | 'rocketPart'
  | 'solarPanel'
  | 'accumulator'
  | 'nuclearFuelCell'
  // T6 铀
  | 'uraniumOre'
  | 'uranium238'
  | 'uranium235'
  // T7 科技包
  | 'automationPack'
  | 'logisticPack'
  | 'chemicalPack'
  | 'militaryPack'
  | 'productionPack'
  | 'utilityPack'
  // T8 军事
  | 'magazine'
  | 'piercingMagazine'
  | 'artilleryShell'
  | 'wallSegment'
  // T9 舰船零件
  | 'hullFrame'
  | 'thrusterAssembly'
  | 'weaponAssembly'
  | 'shieldAssembly'
  // T10 锈群掉落
  | 'rustAlloy'
  | 'neuralCord'
  | 'damagedBlueprint'
  | 'cycleShard'
  | 'rustCore'
  | 'rustWreck'

/** 载荷是独立物品，不进材料表 */
export type PayloadId = 'seedPod' | 'dataCore' | 'industrialSeed' | 'cargoPod' | 'starChart'

/** 装备是独立物品，存于仓库独立计数区 */
export type EquipmentId = 'personalSolar' | 'personalBattery' | 'exoskeleton' | 'personalRobot' | 'portableReactor'

/** 工程服等级 */
export type SuitTier = 'basic' | 'reinforced' | 'modular'

export type BuildingId =
  | 'mine'
  | 'waterPump'
  | 'oilWell'
  | 'stoneFurnace'
  | 'electricFurnace'
  | 'assembler'
  | 'chemicalPlant'
  | 'oilRefinery'
  | 'centrifuge'
  | 'salvager'
  | 'boiler'
  | 'solarArray'
  | 'accumulatorBank'
  | 'nuclearReactor'
  | 'lab'
  | 'turret'
  | 'wall'
  | 'radar'
  | 'warehouse'
  | 'logisticsTower'
  | 'rocketSilo'
  | 'ventValve'

export type RecipeCategory = 'smelt' | 'craft' | 'chem' | 'oil' | 'science' | 'military' | 'salvage' | 'payload' | 'equipment'

export type TechId =
  | 'power'
  | 'automation'
  | 'logistics'
  | 'mechanics'
  | 'assembly'
  | 'solarPower'
  | 'smeltingOptimization'
  | 'miningEfficiency'
  | 'steelSmelting'
  | 'engineEngineering'
  | 'basicMilitary'
  | 'ballistics'
  | 'armour'
  | 'radarTech'
  | 'logisticsTower'
  | 'advancedLogistics'
  | 'chemical'
  | 'refining'
  | 'plasticTech'
  | 'sulfurTech'
  | 'advancedCircuit'
  | 'advancedRefining'
  | 'batteryTech'
  | 'ventValve'
  | 'processingUnit'
  | 'modules'
  | 'electricEngine'
  | 'turretUpgrade'
  | 'piercingAmmo'
  | 'explosionTech'
  | 'artillery'
  | 'wallFortify'
  | 'precision'
  | 'productivityModule'
  | 'advancedAssembly'
  | 'speedModuleTech'
  | 'shipWeapons'
  | 'robotLogistics'
  | 'nuclear'
  | 'rocketTech'
  | 'silo'
  | 'infiniteResearch'

/** 无限研究四条支线 */
export type InfiniteResearchId = 'mining' | 'smelting' | 'logistics' | 'weapon'

export interface MaterialDef {
  id: MaterialId
  name: string
  tier: MaterialTier
  /** 流体不进仓库，走管道 */
  fluid?: boolean
  /** 采掘获得，无生产配方 */
  raw?: boolean
  /** 锈群掉落，不可生产 */
  drop?: boolean
  /** 图标名，取值见 config/factory/icons.ts */
  icon: string
}

export interface RecipeDef {
  id: string
  name: string
  category: RecipeCategory
  inputs: Partial<Record<MaterialId, number>>
  outputs: Partial<Record<MaterialId, number>>
  /** 秒 */
  time: number
  /** kW，0 表示燃煤驱动 */
  energy: number
  /** 燃煤驱动时的煤耗，单位/秒/槽 */
  coal?: number
  /** 仅燃煤模式可用（石炉） */
  coalOnly?: boolean
  unlockedBy?: TechId
  /** 副产物，满仓时暂停槽位 */
  byproduct?: boolean
  /** 拆解类配方的随机产出池 */
  randomOutput?: { pool: MaterialId[]; weights: number[] }
  /** 载荷 / 装备产出 */
  payloadOutput?: PayloadId
  equipmentOutput?: EquipmentId
  /** 工程服产出 */
  suitOutput?: SuitTier
}

export interface BuildingDef {
  id: BuildingId
  name: string
  description: string
  baseCost: Partial<Record<MaterialId, number>>
  /** 可运行的配方类别 */
  categories: RecipeCategory[]
  /** 采掘类建筑的产出速率，单位/秒/槽 */
  yieldPerSlot?: number
  /** 燃煤模式下的速率倍率 */
  coalSpeedFactor?: number
  /** 燃煤模式煤耗，单位/秒/槽 */
  coalPerSlot?: number
  /** 可否切换电驱 */
  canElectrify?: boolean
  /** 电驱能耗，kW/槽 */
  powerPerSlot?: number
  /** 发电建筑：kW/级 */
  powerPerLevel?: number
  /** 储能建筑：MJ/级 */
  capacityPerLevel?: number
  /** 仓储建筑：每种物品上限/级 */
  storagePerLevel?: number
  /** 流体吞吐：每种流体 单位/秒/级 */
  fluidThroughputPerLevel?: number
  /** 炮塔：DPS/级 */
  dpsPerLevel?: number
  /** 城墙：防线秒数/级 */
  wallSecondsPerLevel?: number
  /** 生产建筑的速度倍率，默认 1 */
  speed?: number
  /** 是否可插模块 */
  moduleSlots?: boolean
  /** 默认解锁，无需科技 */
  defaultUnlocked?: boolean
  unlockedBy?: TechId
}

export interface TechDef {
  id: TechId
  name: string
  index: number
  layer: number
  cost: number
  requires: TechId[]
  /** 解锁的配方、建筑或效果说明 */
  unlocks: string[]
  /** 结构化解锁，便于引擎直接使用 */
  unlockRecipes?: string[]
  unlockBuildings?: BuildingId[]
}

export interface Slot {
  recipeId: string | null
  progress: number
  status: SlotStatus
  /** 拆解类配方的随机产出结果 */
  outputItem?: MaterialId
  /** 实验室槽位绑定的科技 */
  techId?: TechId
  /** 产能模块累计余数 0~1 */
  productivityCarry?: number
}

export type SlotStatus = 'running' | 'starved' | 'blocked' | 'undervolt' | 'throttled' | 'idle'

export interface BuildingInstance {
  id: string
  type: BuildingId
  level: number
  enabled: boolean
  slots: Slot[]
  modules: ModuleType[]
  /** 燃煤驱动标记，仅矿井与装配机可切换 */
  coalMode?: boolean
}

export type ModuleType = 'speed' | 'productivity' | 'efficiency'

export interface PlanetFactory {
  /** 母星仓库，固体材料 */
  stock: Partial<Record<MaterialId, number>>
  /** 流体库存 */
  fluids: Partial<Record<MaterialId, number>>
  /** 载荷独立计数 */
  payloads: Partial<Record<PayloadId, number>>
  /** 装备独立计数 */
  equipment: Partial<Record<EquipmentId, number>>
  buildings: BuildingInstance[]
  /** 已完成科技 */
  techs: TechId[]
  /** 无限研究等级 */
  infiniteResearch: Record<InfiniteResearchId, number>
  /** 矿脉剩余储量，按矿种 */
  oreReserve: Partial<Record<MaterialId, number>>
  /** 油井累计开采量，用于产量衰减 */
  oilExtracted: number
  /** 每 tick 的电力满足率快照，供界面显示 */
  powerRatio: number
  /** 累计产量，单位万，用于扰动值 */
  lifetimeProduced: number
}
