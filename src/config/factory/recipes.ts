import type { RecipeDef } from '@/types/factory'

/**
 * 配方表。time 单位秒，energy 单位 kW（0 表示燃煤驱动）。
 * 与规划书 §5.2 / §5.3 一一对应。
 */
export const RECIPES: RecipeDef[] = [
  // 冶炼，石炉与电炉共用
  { id: 'ironPlate', name: '铁板', category: 'smelt', inputs: { ironOre: 1 }, outputs: { ironPlate: 1 }, time: 3.2, energy: 90 },
  { id: 'copperPlate', name: '铜板', category: 'smelt', inputs: { copperOre: 1 }, outputs: { copperPlate: 1 }, time: 3.2, energy: 90 },
  { id: 'steel', name: '钢材', category: 'smelt', inputs: { ironPlate: 5 }, outputs: { steel: 1 }, time: 16, energy: 180, unlockedBy: 'steelSmelting' },
  { id: 'stoneBrick', name: '石砖', category: 'smelt', inputs: { stone: 2 }, outputs: { stoneBrick: 1 }, time: 3.2, energy: 90 },

  // 基础制造
  { id: 'ironGear', name: '铁齿轮', category: 'craft', inputs: { ironPlate: 2 }, outputs: { ironGear: 1 }, time: 0.5, energy: 75 },
  { id: 'copperCable', name: '铜线', category: 'craft', inputs: { copperPlate: 1 }, outputs: { copperCable: 2 }, time: 0.5, energy: 75 },
  { id: 'circuit', name: '电路板', category: 'craft', inputs: { ironPlate: 1, copperCable: 3 }, outputs: { circuit: 1 }, time: 0.5, energy: 75, unlockedBy: 'assembly' },
  { id: 'pipe', name: '管道', category: 'craft', inputs: { ironPlate: 1 }, outputs: { pipe: 1 }, time: 0.5, energy: 75, unlockedBy: 'mechanics' },
  { id: 'ironStick', name: '铁棍', category: 'craft', inputs: { ironPlate: 1 }, outputs: { ironStick: 2 }, time: 0.5, energy: 75, unlockedBy: 'mechanics' },

  // 中级制造
  { id: 'advancedCircuit', name: '高级电路', category: 'craft', inputs: { circuit: 2, plastic: 2, copperCable: 4 }, outputs: { advancedCircuit: 1 }, time: 6, energy: 150, unlockedBy: 'advancedCircuit' },
  { id: 'processingUnit', name: '处理单元', category: 'craft', inputs: { circuit: 20, advancedCircuit: 2, sulfuricAcid: 5 }, outputs: { processingUnit: 1 }, time: 10, energy: 210, unlockedBy: 'processingUnit' },
  { id: 'engineUnit', name: '引擎单元', category: 'craft', inputs: { steel: 1, ironGear: 1, pipe: 2 }, outputs: { engineUnit: 1 }, time: 10, energy: 150, unlockedBy: 'engineEngineering' },
  { id: 'electricEngine', name: '电引擎单元', category: 'craft', inputs: { engineUnit: 1, advancedCircuit: 2, lubricant: 15 }, outputs: { electricEngine: 1 }, time: 10, energy: 150, unlockedBy: 'electricEngine' },
  { id: 'lowDensityStructure', name: '低密度结构', category: 'craft', inputs: { copperPlate: 20, steel: 5, plastic: 2 }, outputs: { lowDensityStructure: 1 }, time: 15, energy: 210, unlockedBy: 'precision' },
  { id: 'solarPanel', name: '太阳能板', category: 'craft', inputs: { copperPlate: 5, circuit: 3 }, outputs: { solarPanel: 1 }, time: 10, energy: 150, unlockedBy: 'solarPower' },
  { id: 'accumulator', name: '蓄电器', category: 'craft', inputs: { battery: 5, ironPlate: 2 }, outputs: { accumulator: 1 }, time: 10, energy: 150, unlockedBy: 'batteryTech' },
  { id: 'rocketFuel', name: '火箭燃料', category: 'craft', inputs: { solidFuel: 10 }, outputs: { rocketFuel: 1 }, time: 15, energy: 210, unlockedBy: 'rocketTech' },
  { id: 'rocketControlUnit', name: '火箭控制单元', category: 'craft', inputs: { processingUnit: 1, speedModule: 1 }, outputs: { rocketControlUnit: 1 }, time: 30, energy: 210, unlockedBy: 'rocketTech' },
  { id: 'rocketPart', name: '火箭部件', category: 'craft', inputs: { lowDensityStructure: 10, rocketFuel: 10, rocketControlUnit: 10 }, outputs: { rocketPart: 1 }, time: 3, energy: 420, unlockedBy: 'rocketTech' },

  // 化工
  { id: 'plastic', name: '塑料', category: 'chem', inputs: { petroleumGas: 20 }, outputs: { plastic: 2 }, time: 1, energy: 90, unlockedBy: 'plasticTech' },
  { id: 'sulfur', name: '硫磺', category: 'chem', inputs: { water: 30, petroleumGas: 30 }, outputs: { sulfur: 2 }, time: 1, energy: 90, unlockedBy: 'sulfurTech' },
  { id: 'sulfuricAcid', name: '硫酸', category: 'chem', inputs: { ironPlate: 1, sulfur: 1, water: 100 }, outputs: { sulfuricAcid: 50 }, time: 1, energy: 210, unlockedBy: 'sulfurTech' },
  { id: 'battery', name: '电池', category: 'chem', inputs: { sulfur: 1, ironPlate: 1, copperPlate: 1, sulfuricAcid: 20 }, outputs: { battery: 1 }, time: 4, energy: 210, unlockedBy: 'batteryTech' },
  { id: 'explosives', name: '爆炸物', category: 'chem', inputs: { sulfur: 1, coal: 1, water: 1 }, outputs: { explosives: 2 }, time: 4, energy: 210, unlockedBy: 'explosionTech' },

  // 铀浓缩
  { id: 'uraniumEnrich', name: '铀浓缩', category: 'chem', inputs: { uraniumOre: 1000 }, outputs: { uranium238: 993, uranium235: 7 }, time: 120, energy: 350, unlockedBy: 'nuclear' },
  { id: 'nuclearFuelCell', name: '核燃料棒', category: 'chem', inputs: { uranium235: 1, uranium238: 19, ironPlate: 10 }, outputs: { nuclearFuelCell: 10 }, time: 10, energy: 210, unlockedBy: 'nuclear' },

  // 炼油
  { id: 'basicRefining', name: '基础炼油', category: 'oil', inputs: { crudeOil: 100 }, outputs: { petroleumGas: 45 }, time: 5, energy: 180, unlockedBy: 'refining' },
  {
    id: 'advancedRefining',
    name: '高级炼油',
    category: 'oil',
    inputs: { crudeOil: 100, water: 50 },
    outputs: { heavyOil: 25, lightOil: 45, petroleumGas: 55 },
    time: 5,
    energy: 240,
    unlockedBy: 'advancedRefining',
    byproduct: true
  },
  { id: 'heavyCracking', name: '重油裂解', category: 'oil', inputs: { heavyOil: 40, water: 30 }, outputs: { lightOil: 30 }, time: 4, energy: 210, unlockedBy: 'advancedRefining', byproduct: true },
  { id: 'lightCracking', name: '轻油裂解', category: 'oil', inputs: { lightOil: 30, water: 30 }, outputs: { petroleumGas: 20 }, time: 4, energy: 210, unlockedBy: 'advancedRefining', byproduct: true },
  { id: 'solidFuel', name: '固体燃料', category: 'oil', inputs: { heavyOil: 5 }, outputs: { solidFuel: 1 }, time: 3, energy: 150, unlockedBy: 'advancedRefining' },
  { id: 'lubricant', name: '润滑油', category: 'oil', inputs: { heavyOil: 10 }, outputs: { lubricant: 10 }, time: 1, energy: 150, unlockedBy: 'advancedRefining' },

  // 模块
  { id: 'speedModule', name: '速度模块', category: 'craft', inputs: { circuit: 2, advancedCircuit: 1 }, outputs: { speedModule: 1 }, time: 15, energy: 210, unlockedBy: 'modules' },
  { id: 'efficiencyModule', name: '效率模块', category: 'craft', inputs: { circuit: 2, advancedCircuit: 1 }, outputs: { efficiencyModule: 1 }, time: 15, energy: 210, unlockedBy: 'modules' },
  { id: 'productivityModule', name: '产能模块', category: 'craft', inputs: { circuit: 2, advancedCircuit: 1, processingUnit: 1 }, outputs: { productivityModule: 1 }, time: 20, energy: 210, unlockedBy: 'productivityModule' },

  // 拆解
  {
    id: 'salvageWreck',
    name: '残骸拆解',
    category: 'salvage',
    inputs: { rustWreck: 10 },
    outputs: {},
    time: 5,
    energy: 120,
    unlockedBy: 'basicMilitary',
    randomOutput: { pool: ['ironOre', 'copperOre', 'coal', 'stone'], weights: [40, 30, 20, 10] }
  },

  // 载荷
  { id: 'seedPod', name: '种子舱', category: 'payload', inputs: { steel: 100 }, outputs: {}, payloadOutput: 'seedPod', time: 30, energy: 210, unlockedBy: 'silo' },
  { id: 'dataCore', name: '数据核心', category: 'payload', inputs: { processingUnit: 50 }, outputs: {}, payloadOutput: 'dataCore', time: 20, energy: 210, unlockedBy: 'silo' },
  { id: 'industrialSeed', name: '工业种子', category: 'payload', inputs: { lowDensityStructure: 50 }, outputs: {}, payloadOutput: 'industrialSeed', time: 20, energy: 210, unlockedBy: 'silo' },
  { id: 'cargoPod', name: '物资舱', category: 'payload', inputs: { steel: 500 }, outputs: {}, payloadOutput: 'cargoPod', time: 30, energy: 210, unlockedBy: 'silo' },
  { id: 'starChart', name: '星图阵列', category: 'payload', inputs: { processingUnit: 200, solarPanel: 50 }, outputs: {}, payloadOutput: 'starChart', time: 60, energy: 420, unlockedBy: 'silo' },

  // 装备
  { id: 'personalSolar', name: '太阳能板（个人）', category: 'equipment', inputs: { solarPanel: 5 }, outputs: {}, equipmentOutput: 'personalSolar', time: 5, energy: 150, unlockedBy: 'assembly' },
  { id: 'personalBattery', name: '电池（个人）', category: 'equipment', inputs: { battery: 5 }, outputs: {}, equipmentOutput: 'personalBattery', time: 5, energy: 150, unlockedBy: 'batteryTech' },
  { id: 'exoskeleton', name: '外骨骼', category: 'equipment', inputs: { steel: 100, electricEngine: 5 }, outputs: {}, equipmentOutput: 'exoskeleton', time: 20, energy: 210, unlockedBy: 'electricEngine' },
  { id: 'personalRobot', name: '个人机器人', category: 'equipment', inputs: { processingUnit: 20, circuit: 50 }, outputs: {}, equipmentOutput: 'personalRobot', time: 30, energy: 210, unlockedBy: 'robotLogistics' },
  { id: 'portableReactor', name: '便携核反应堆', category: 'equipment', inputs: { nuclearFuelCell: 5, processingUnit: 50 }, outputs: {}, equipmentOutput: 'portableReactor', time: 40, energy: 420, unlockedBy: 'nuclear' },
  { id: 'reinforcedSuit', name: '强化工程服', category: 'equipment', inputs: { steel: 50, advancedCircuit: 20 }, outputs: {}, suitOutput: 'reinforced', time: 20, energy: 210, unlockedBy: 'advancedCircuit' },
  { id: 'modularSuit', name: '模块化工程服', category: 'equipment', inputs: { lowDensityStructure: 20, processingUnit: 20 }, outputs: {}, suitOutput: 'modular', time: 30, energy: 420, unlockedBy: 'precision' },

  // 军事
  { id: 'magazine', name: '机枪弹匣', category: 'military', inputs: { ironPlate: 1 }, outputs: { magazine: 10 }, time: 1, energy: 75, unlockedBy: 'basicMilitary' },
  { id: 'piercingMagazine', name: '穿甲弹匣', category: 'military', inputs: { steel: 1, copperPlate: 5, magazine: 1 }, outputs: { piercingMagazine: 1 }, time: 6, energy: 150, unlockedBy: 'ballistics' },
  { id: 'artilleryShell', name: '炮弹', category: 'military', inputs: { steel: 2, plastic: 2, explosives: 1 }, outputs: { artilleryShell: 1 }, time: 8, energy: 150, unlockedBy: 'artillery' },
  { id: 'wallSegment', name: '城墙段', category: 'military', inputs: { stoneBrick: 5 }, outputs: { wallSegment: 1 }, time: 0.5, energy: 75, unlockedBy: 'armour' },

  // 科技包
  { id: 'automationPack', name: '自动化包', category: 'science', inputs: { copperPlate: 1, ironGear: 1 }, outputs: { automationPack: 1 }, time: 5, energy: 75 },
  { id: 'logisticPack', name: '物流包', category: 'science', inputs: { ironPlate: 1, ironGear: 1 }, outputs: { logisticPack: 1 }, time: 6, energy: 75, unlockedBy: 'logistics' },
  { id: 'militaryPack', name: '军事包', category: 'science', inputs: { copperPlate: 1, stoneBrick: 1 }, outputs: { militaryPack: 1 }, time: 6, energy: 75, unlockedBy: 'basicMilitary' },
  { id: 'chemicalPack', name: '化工包', category: 'science', inputs: { circuit: 2, engineUnit: 1 }, outputs: { chemicalPack: 1 }, time: 24, energy: 150, unlockedBy: 'engineEngineering' },
  { id: 'productionPack', name: '生产包', category: 'science', inputs: { electricEngine: 1, processingUnit: 1, steel: 2 }, outputs: { productionPack: 1 }, time: 24, energy: 210, unlockedBy: 'electricEngine' },
  { id: 'utilityPack', name: '效能包', category: 'science', inputs: { processingUnit: 1, speedModule: 1 }, outputs: { utilityPack: 1 }, time: 21, energy: 210, unlockedBy: 'modules' },

  // 舰船零件
  { id: 'hullFrame', name: '舰体框架', category: 'craft', inputs: { steel: 50, copperPlate: 20 }, outputs: { hullFrame: 1 }, time: 60, energy: 420, unlockedBy: 'engineEngineering' },
  { id: 'thrusterAssembly', name: '推进器组件', category: 'craft', inputs: { engineUnit: 2, pipe: 20, steel: 10 }, outputs: { thrusterAssembly: 1 }, time: 45, energy: 420, unlockedBy: 'engineEngineering' },
  { id: 'weaponAssembly', name: '武器组件', category: 'craft', inputs: { processingUnit: 5, steel: 30 }, outputs: { weaponAssembly: 1 }, time: 45, energy: 420, unlockedBy: 'shipWeapons' },
  { id: 'shieldAssembly', name: '护盾组件', category: 'craft', inputs: { advancedCircuit: 20, battery: 10 }, outputs: { shieldAssembly: 1 }, time: 40, energy: 420, unlockedBy: 'shipWeapons' }
]

export const RECIPE_MAP: Record<string, RecipeDef> = Object.fromEntries(RECIPES.map(r => [r.id, r]))

/** 默认解锁的配方，无需科技 */
export const DEFAULT_RECIPES = ['ironPlate', 'copperPlate', 'ironGear', 'copperCable', 'stoneBrick', 'automationPack']

/** 按建筑类别筛选可跑的配方 */
export function recipesFor(categories: string[]): RecipeDef[] {
  return RECIPES.filter(r => categories.includes(r.category))
}
