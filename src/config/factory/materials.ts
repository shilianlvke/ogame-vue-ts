import type { MaterialDef, MaterialId, MaterialTier } from '@/types/factory'

/**
 * 材料清单，共 62 种。
 * icon 取值见 config/factory/icons.ts 的 MATERIAL_ICONS。
 */

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  // T0 原料
  ironOre: { id: 'ironOre', name: '铁矿石', tier: 'T0', raw: true, icon: 'gem' },
  copperOre: { id: 'copperOre', name: '铜矿石', tier: 'T0', raw: true, icon: 'gem' },
  coal: { id: 'coal', name: '煤', tier: 'T0', raw: true, icon: 'gem' },
  stone: { id: 'stone', name: '石矿', tier: 'T0', raw: true, icon: 'gem' },
  crudeOil: { id: 'crudeOil', name: '原油', tier: 'T0', raw: true, fluid: true, icon: 'droplet' },
  water: { id: 'water', name: '水', tier: 'T0', raw: true, fluid: true, icon: 'droplet' },

  // T1 冶炼
  ironPlate: { id: 'ironPlate', name: '铁板', tier: 'T1', icon: 'plate' },
  copperPlate: { id: 'copperPlate', name: '铜板', tier: 'T1', icon: 'plate' },
  steel: { id: 'steel', name: '钢材', tier: 'T1', icon: 'plate' },
  stoneBrick: { id: 'stoneBrick', name: '石砖', tier: 'T1', icon: 'brick' },
  solidFuel: { id: 'solidFuel', name: '固体燃料', tier: 'T1', icon: 'flame' },

  // T2 基础零件
  ironGear: { id: 'ironGear', name: '铁齿轮', tier: 'T2', icon: 'gear' },
  copperCable: { id: 'copperCable', name: '铜线', tier: 'T2', icon: 'cable' },
  circuit: { id: 'circuit', name: '电路板', tier: 'T2', icon: 'cpu' },
  pipe: { id: 'pipe', name: '管道', tier: 'T2', icon: 'pipe' },
  ironStick: { id: 'ironStick', name: '铁棍', tier: 'T2', icon: 'stick' },

  // T3 中级
  petroleumGas: { id: 'petroleumGas', name: '石油气', tier: 'T3', fluid: true, icon: 'wind' },
  heavyOil: { id: 'heavyOil', name: '重油', tier: 'T3', fluid: true, icon: 'droplet' },
  lightOil: { id: 'lightOil', name: '轻油', tier: 'T3', fluid: true, icon: 'droplet' },
  plastic: { id: 'plastic', name: '塑料', tier: 'T3', icon: 'box' },
  sulfur: { id: 'sulfur', name: '硫磺', tier: 'T3', icon: 'box' },
  sulfuricAcid: { id: 'sulfuricAcid', name: '硫酸', tier: 'T3', fluid: true, icon: 'droplet' },
  advancedCircuit: { id: 'advancedCircuit', name: '高级电路', tier: 'T3', icon: 'cpu' },
  processingUnit: { id: 'processingUnit', name: '处理单元', tier: 'T3', icon: 'cpu' },
  engineUnit: { id: 'engineUnit', name: '引擎单元', tier: 'T3', icon: 'engine' },
  electricEngine: { id: 'electricEngine', name: '电引擎单元', tier: 'T3', icon: 'engine' },
  battery: { id: 'battery', name: '电池', tier: 'T3', icon: 'battery' },
  explosives: { id: 'explosives', name: '爆炸物', tier: 'T3', icon: 'flame' },
  lubricant: { id: 'lubricant', name: '润滑油', tier: 'T3', fluid: true, icon: 'droplet' },

  // T4 模块
  speedModule: { id: 'speedModule', name: '速度模块', tier: 'T4', icon: 'module' },
  productivityModule: { id: 'productivityModule', name: '产能模块', tier: 'T4', icon: 'module' },
  efficiencyModule: { id: 'efficiencyModule', name: '效率模块', tier: 'T4', icon: 'module' },

  // T5 高级
  lowDensityStructure: { id: 'lowDensityStructure', name: '低密度结构', tier: 'T5', icon: 'frame' },
  rocketFuel: { id: 'rocketFuel', name: '火箭燃料', tier: 'T5', icon: 'flame' },
  rocketControlUnit: { id: 'rocketControlUnit', name: '火箭控制单元', tier: 'T5', icon: 'cpu' },
  rocketPart: { id: 'rocketPart', name: '火箭部件', tier: 'T5', icon: 'rocket' },
  solarPanel: { id: 'solarPanel', name: '太阳能板', tier: 'T5', icon: 'sun' },
  accumulator: { id: 'accumulator', name: '蓄电器', tier: 'T5', icon: 'battery' },
  nuclearFuelCell: { id: 'nuclearFuelCell', name: '核燃料棒', tier: 'T5', icon: 'radiation' },

  // T6 铀
  uraniumOre: { id: 'uraniumOre', name: '铀矿石', tier: 'T6', raw: true, icon: 'gem' },
  uranium238: { id: 'uranium238', name: '铀-238', tier: 'T6', icon: 'radiation' },
  uranium235: { id: 'uranium235', name: '铀-235', tier: 'T6', icon: 'radiation' },

  // T7 科技包
  automationPack: { id: 'automationPack', name: '自动化包', tier: 'T7', icon: 'flask' },
  logisticPack: { id: 'logisticPack', name: '物流包', tier: 'T7', icon: 'flask' },
  chemicalPack: { id: 'chemicalPack', name: '化工包', tier: 'T7', icon: 'flask' },
  militaryPack: { id: 'militaryPack', name: '军事包', tier: 'T7', icon: 'flask' },
  productionPack: { id: 'productionPack', name: '生产包', tier: 'T7', icon: 'flask' },
  utilityPack: { id: 'utilityPack', name: '效能包', tier: 'T7', icon: 'flask' },

  // T8 军事
  magazine: { id: 'magazine', name: '机枪弹匣', tier: 'T8', icon: 'ammo' },
  piercingMagazine: { id: 'piercingMagazine', name: '穿甲弹匣', tier: 'T8', icon: 'ammo' },
  artilleryShell: { id: 'artilleryShell', name: '炮弹', tier: 'T8', icon: 'ammo' },
  wallSegment: { id: 'wallSegment', name: '城墙段', tier: 'T8', icon: 'wall' },

  // T9 舰船零件
  hullFrame: { id: 'hullFrame', name: '舰体框架', tier: 'T9', icon: 'frame' },
  thrusterAssembly: { id: 'thrusterAssembly', name: '推进器组件', tier: 'T9', icon: 'engine' },
  weaponAssembly: { id: 'weaponAssembly', name: '武器组件', tier: 'T9', icon: 'crosshair' },
  shieldAssembly: { id: 'shieldAssembly', name: '护盾组件', tier: 'T9', icon: 'shield' },

  // T10 锈群掉落
  rustAlloy: { id: 'rustAlloy', name: '锈蚀合金', tier: 'T10', drop: true, icon: 'bug' },
  neuralCord: { id: 'neuralCord', name: '神经索', tier: 'T10', drop: true, icon: 'bug' },
  damagedBlueprint: { id: 'damagedBlueprint', name: '破损蓝图', tier: 'T10', drop: true, icon: 'scroll' },
  cycleShard: { id: 'cycleShard', name: '循环残片', tier: 'T10', drop: true, icon: 'shard' },
  rustCore: { id: 'rustCore', name: '锈群核心', tier: 'T10', drop: true, icon: 'core' },
  rustWreck: { id: 'rustWreck', name: '锈群残骸', tier: 'T10', drop: true, icon: 'wreck' }
}

/** 全部材料 id，按 T0→T10 顺序 */
export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[]

/** 采掘类原料，矿井可开采 */
export const MINEABLE: MaterialId[] = ['ironOre', 'copperOre', 'coal', 'stone', 'uraniumOre']

/** 流体材料，走管道，不进仓库 */
export const FLUIDS: MaterialId[] = MATERIAL_IDS.filter(id => MATERIALS[id].fluid)

/** 掉落材料，不可生产 */
export const DROPS: MaterialId[] = MATERIAL_IDS.filter(id => MATERIALS[id].drop)

export const TIER_LABEL: Record<MaterialTier, string> = {
  T0: '原料',
  T1: '冶炼',
  T2: '基础零件',
  T3: '中级',
  T4: '模块',
  T5: '高级',
  T6: '铀',
  T7: '科技包',
  T8: '军事',
  T9: '舰船零件',
  T10: '锈群掉落'
}
