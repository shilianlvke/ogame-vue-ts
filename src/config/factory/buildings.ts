import type { BuildingDef, BuildingId } from '@/types/factory'

/**
 * 22 座建筑。baseCost 见规划书 §13.5，等级作用见 §4.3。
 * baseCost 为 Lv1 新建成本；升到 Lv N 的成本为 baseCost × 1.35^(N-1)。
 */
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  mine: {
    id: 'mine',
    name: '矿井',
    description: '在矿脉上开采矿石，可切换燃煤或电驱',
    baseCost: { ironPlate: 20, stone: 10 },
    categories: [],
    yieldPerSlot: 0.5,
    coalSpeedFactor: 0.5,
    coalPerSlot: 0.025,
    canElectrify: true,
    powerPerSlot: 90,
    defaultUnlocked: true
  },
  waterPump: {
    id: 'waterPump',
    name: '抽水站',
    description: '无限产出水',
    baseCost: { ironPlate: 15, pipe: 5 },
    categories: [],
    yieldPerSlot: 500,
    powerPerSlot: 0,
    defaultUnlocked: true
  },
  oilWell: {
    id: 'oilWell',
    name: '油井',
    description: '开采原油，产量随累计开采衰减至 20%',
    baseCost: { steel: 20, pipe: 10 },
    categories: [],
    yieldPerSlot: 0.4,
    powerPerSlot: 0,
    defaultUnlocked: true
  },
  stoneFurnace: {
    id: 'stoneFurnace',
    name: '石炉',
    description: '燃煤冶炼，速度 50%',
    baseCost: { stone: 5 },
    categories: ['smelt'],
    speed: 0.5,
    coalPerSlot: 0.025,
    powerPerSlot: 0,
    defaultUnlocked: true
  },
  electricFurnace: {
    id: 'electricFurnace',
    name: '电炉',
    description: '电力冶炼，速度 100%，可插模块',
    baseCost: { ironPlate: 100, stoneBrick: 25 },
    categories: ['smelt'],
    speed: 1,
    powerPerSlot: 180,
    moduleSlots: true,
    unlockedBy: 'automation'
  },
  assembler: {
    id: 'assembler',
    name: '装配机',
    description: '制造、科技包、弹药、载荷与装备，可切换燃煤或电驱',
    baseCost: { ironPlate: 40, stone: 20 },
    categories: ['craft', 'science', 'military', 'payload', 'equipment'],
    speed: 1,
    coalSpeedFactor: 0.5,
    coalPerSlot: 0.02,
    canElectrify: true,
    moduleSlots: true,
    defaultUnlocked: true
  },
  chemicalPlant: {
    id: 'chemicalPlant',
    name: '化工厂',
    description: '固体与流体配方',
    baseCost: { steel: 30, pipe: 20, ironStick: 20 },
    categories: ['chem'],
    speed: 1,
    moduleSlots: true,
    unlockedBy: 'chemical'
  },
  oilRefinery: {
    id: 'oilRefinery',
    name: '炼油厂',
    description: '多产物炼油配方',
    baseCost: { steel: 50, pipe: 30, ironStick: 30 },
    categories: ['oil'],
    speed: 1,
    moduleSlots: true,
    unlockedBy: 'refining'
  },
  centrifuge: {
    id: 'centrifuge',
    name: '离心机',
    description: '铀浓缩',
    baseCost: { steel: 100, processingUnit: 50 },
    categories: ['chem'],
    speed: 1,
    unlockedBy: 'nuclear'
  },
  salvager: {
    id: 'salvager',
    name: '拆解机',
    description: '分解锈群残骸为随机矿石，可插模块',
    baseCost: { ironPlate: 150, ironGear: 60 },
    categories: ['salvage'],
    speed: 1,
    powerPerSlot: 120,
    moduleSlots: true,
    unlockedBy: 'basicMilitary'
  },
  boiler: {
    id: 'boiler',
    name: '火力发电厂',
    description: '烧煤或固体燃料发电',
    baseCost: { ironPlate: 30, stoneBrick: 20 },
    categories: [],
    powerPerLevel: 900,
    unlockedBy: 'power'
  },
  solarArray: {
    id: 'solarArray',
    name: '太阳能阵列',
    description: '白天发电，夜间停摆',
    baseCost: { solarPanel: 10 },
    categories: [],
    powerPerLevel: 60,
    unlockedBy: 'solarPower'
  },
  accumulatorBank: {
    id: 'accumulatorBank',
    name: '蓄电器',
    description: '跨昼夜储能',
    baseCost: { battery: 10, ironPlate: 10 },
    categories: [],
    capacityPerLevel: 5,
    unlockedBy: 'batteryTech'
  },
  nuclearReactor: {
    id: 'nuclearReactor',
    name: '核反应堆',
    description: '烧核燃料棒发电',
    baseCost: { steel: 300, processingUnit: 200 },
    categories: [],
    powerPerLevel: 40000,
    unlockedBy: 'nuclear'
  },
  lab: {
    id: 'lab',
    name: '实验室',
    description: '消耗科技包推进研究，每槽绑定 1 项科技',
    baseCost: { ironPlate: 30, copperPlate: 30 },
    categories: [],
    powerPerSlot: 0,
    defaultUnlocked: true
  },
  turret: {
    id: 'turret',
    name: '炮塔',
    description: '消耗弹药输出伤害，等级决定可用弹种',
    baseCost: { ironPlate: 20, copperPlate: 10 },
    categories: [],
    dpsPerLevel: 30,
    powerPerSlot: 50,
    unlockedBy: 'basicMilitary'
  },
  wall: {
    id: 'wall',
    name: '城墙',
    description: '每级延长防线 20 秒',
    baseCost: { wallSegment: 10 },
    categories: [],
    wallSecondsPerLevel: 20,
    unlockedBy: 'armour'
  },
  radar: {
    id: 'radar',
    name: '雷达',
    description: '波次预演，情报层级 1~3',
    baseCost: { ironPlate: 20, circuit: 10 },
    categories: [],
    unlockedBy: 'radarTech'
  },
  warehouse: {
    id: 'warehouse',
    name: '仓库',
    description: '每种物品库存上限 5000/级',
    baseCost: { ironPlate: 50, stoneBrick: 20 },
    categories: [],
    storagePerLevel: 5000,
    unlockedBy: 'logistics'
  },
  logisticsTower: {
    id: 'logisticsTower',
    name: '物流塔',
    description: '每种流体吞吐 40/秒/级，槽位为可接入的流体种类',
    baseCost: { ironPlate: 120, copperPlate: 60 },
    categories: [],
    fluidThroughputPerLevel: 40,
    unlockedBy: 'logistics'
  },
  rocketSilo: {
    id: 'rocketSilo',
    name: '火箭发射井',
    description: '装配并发射火箭，槽位数决定并行装配数',
    baseCost: { steel: 2000, lowDensityStructure: 200, processingUnit: 200 },
    categories: [],
    speed: 1,
    unlockedBy: 'silo'
  },
  ventValve: {
    id: 'ventValve',
    name: '排空阀',
    description: '销毁指定流体，每槽 5 单位/秒',
    baseCost: { steel: 20, pipe: 10 },
    categories: [],
    speed: 1,
    unlockedBy: 'ventValve'
  }
}

export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[]

/** 默认解锁的建筑 */
export const DEFAULT_BUILDINGS: BuildingId[] = BUILDING_IDS.filter(id => BUILDINGS[id].defaultUnlocked)

/** 可插模块的建筑 */
export const MODULE_BUILDINGS: BuildingId[] = BUILDING_IDS.filter(id => BUILDINGS[id].moduleSlots)

/** 建筑类别，用于界面分组 */
export const BUILDING_GROUP: Record<BuildingId, string> = {
  mine: '采掘',
  waterPump: '采掘',
  oilWell: '采掘',
  stoneFurnace: '冶炼',
  electricFurnace: '冶炼',
  assembler: '制造',
  chemicalPlant: '制造',
  oilRefinery: '制造',
  centrifuge: '制造',
  salvager: '制造',
  boiler: '电力',
  solarArray: '电力',
  accumulatorBank: '电力',
  nuclearReactor: '电力',
  lab: '科研',
  turret: '军事',
  wall: '军事',
  radar: '军事',
  warehouse: '物流',
  logisticsTower: '物流',
  rocketSilo: '特殊',
  ventValve: '特殊'
}
