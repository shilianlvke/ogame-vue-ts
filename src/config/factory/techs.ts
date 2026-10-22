import type { TechDef, TechId } from '@/types/factory'

/**
 * 42 项科技，分 6 层。cost 单位为研究单位。
 * 第 N 层的科技每个研究单位消耗 N 种科技包各 1 个。
 */
export const TECHS: TechDef[] = [
  // 第 1 层
  { id: 'power', name: '电力系统', index: 1, layer: 1, cost: 100, requires: [], unlocks: ['火力发电厂'], unlockBuildings: ['boiler'] },
  { id: 'automation', name: '自动化', index: 2, layer: 1, cost: 120, requires: ['power'], unlocks: ['电炉'], unlockBuildings: ['electricFurnace'] },
  { id: 'logistics', name: '基础物流', index: 3, layer: 1, cost: 120, requires: ['power'], unlocks: ['仓库、物流塔、物流包'], unlockBuildings: ['warehouse', 'logisticsTower'], unlockRecipes: ['logisticPack'] },
  { id: 'mechanics', name: '机械传动', index: 4, layer: 1, cost: 150, requires: ['automation'], unlocks: ['管道、铁棍'], unlockRecipes: ['pipe', 'ironStick'] },
  { id: 'assembly', name: '装配技术', index: 5, layer: 1, cost: 180, requires: ['mechanics'], unlocks: ['电路板、太阳能板（个人）'], unlockRecipes: ['circuit', 'personalSolar'] },
  { id: 'solarPower', name: '太阳能利用', index: 6, layer: 1, cost: 200, requires: ['assembly'], unlocks: ['太阳能板、太阳能阵列'], unlockBuildings: ['solarArray'], unlockRecipes: ['solarPanel'] },
  { id: 'smeltingOptimization', name: '冶炼优化', index: 7, layer: 1, cost: 220, requires: ['automation'], unlocks: ['冶炼速度 +10%'] },
  { id: 'miningEfficiency', name: '采掘效率', index: 8, layer: 1, cost: 240, requires: ['automation'], unlocks: ['矿井电驱速度 +10%'] },

  // 第 2 层
  { id: 'steelSmelting', name: '钢材冶炼', index: 9, layer: 2, cost: 260, requires: ['logistics', 'mechanics'], unlocks: ['钢材'], unlockRecipes: ['steel'] },
  {
    id: 'engineEngineering',
    name: '引擎工程',
    index: 10,
    layer: 2,
    cost: 280,
    requires: ['steelSmelting'],
    unlocks: ['引擎单元、化工包、舰体框架、推进器组件'],
    unlockRecipes: ['engineUnit', 'chemicalPack', 'hullFrame', 'thrusterAssembly']
  },
  {
    id: 'basicMilitary',
    name: '基础军事',
    index: 11,
    layer: 2,
    cost: 260,
    requires: ['logistics'],
    unlocks: ['炮塔、拆解机、机枪弹匣、残骸拆解、军事包'],
    unlockBuildings: ['turret', 'salvager'],
    unlockRecipes: ['magazine', 'salvageWreck', 'militaryPack']
  },
  { id: 'ballistics', name: '弹道学', index: 12, layer: 2, cost: 320, requires: ['basicMilitary'], unlocks: ['穿甲弹匣'], unlockRecipes: ['piercingMagazine'] },
  { id: 'armour', name: '装甲', index: 13, layer: 2, cost: 340, requires: ['basicMilitary'], unlocks: ['城墙、城墙段'], unlockBuildings: ['wall'], unlockRecipes: ['wallSegment'] },
  { id: 'radarTech', name: '雷达', index: 14, layer: 2, cost: 300, requires: ['logistics'], unlocks: ['雷达'], unlockBuildings: ['radar'] },
  { id: 'logisticsTower', name: '物流塔', index: 15, layer: 2, cost: 340, requires: ['logistics'], unlocks: ['物流塔槽位 +1'] },
  { id: 'advancedLogistics', name: '高级物流', index: 16, layer: 2, cost: 380, requires: ['logisticsTower'], unlocks: ['流体吞吐 +25%'] },

  // 第 3 层
  { id: 'chemical', name: '化工', index: 17, layer: 3, cost: 480, requires: ['steelSmelting', 'mechanics'], unlocks: ['化工厂'], unlockBuildings: ['chemicalPlant'] },
  { id: 'refining', name: '炼油工艺', index: 18, layer: 3, cost: 520, requires: ['chemical'], unlocks: ['炼油厂、基础炼油'], unlockBuildings: ['oilRefinery'], unlockRecipes: ['basicRefining'] },
  { id: 'plasticTech', name: '塑料', index: 19, layer: 3, cost: 560, requires: ['refining'], unlocks: ['塑料'], unlockRecipes: ['plastic'] },
  { id: 'sulfurTech', name: '硫磺', index: 20, layer: 3, cost: 560, requires: ['refining'], unlocks: ['硫磺、硫酸'], unlockRecipes: ['sulfur', 'sulfuricAcid'] },
  { id: 'advancedCircuit', name: '高级电路', index: 21, layer: 3, cost: 600, requires: ['plasticTech', 'assembly'], unlocks: ['高级电路、强化工程服'], unlockRecipes: ['advancedCircuit', 'reinforcedSuit'] },
  {
    id: 'advancedRefining',
    name: '高级化工',
    index: 22,
    layer: 3,
    cost: 620,
    requires: ['plasticTech', 'sulfurTech'],
    unlocks: ['高级炼油、重油裂解、轻油裂解、固体燃料、润滑油'],
    unlockRecipes: ['advancedRefining', 'heavyCracking', 'lightCracking', 'solidFuel', 'lubricant']
  },
  { id: 'batteryTech', name: '电池', index: 23, layer: 3, cost: 640, requires: ['sulfurTech'], unlocks: ['电池、蓄电器'], unlockBuildings: ['accumulatorBank'], unlockRecipes: ['battery', 'accumulator', 'personalBattery'] },
  { id: 'ventValve', name: '排空阀', index: 24, layer: 3, cost: 600, requires: ['refining'], unlocks: ['排空阀'], unlockBuildings: ['ventValve'] },
  { id: 'processingUnit', name: '处理单元', index: 25, layer: 3, cost: 700, requires: ['advancedCircuit', 'sulfurTech'], unlocks: ['处理单元'], unlockRecipes: ['processingUnit'] },

  // 第 4 层
  {
    id: 'modules',
    name: '模块',
    index: 26,
    layer: 4,
    cost: 820,
    requires: ['processingUnit'],
    unlocks: ['模块槽位、速度模块、效率模块、效能包'],
    unlockRecipes: ['speedModule', 'efficiencyModule', 'utilityPack']
  },
  { id: 'electricEngine', name: '电引擎', index: 27, layer: 4, cost: 860, requires: ['engineEngineering', 'advancedCircuit'], unlocks: ['电引擎单元、生产包、外骨骼'], unlockRecipes: ['electricEngine', 'productionPack', 'exoskeleton'] },
  { id: 'turretUpgrade', name: '炮塔升级', index: 28, layer: 4, cost: 880, requires: ['ballistics'], unlocks: ['炮塔 DPS +25%'] },
  { id: 'piercingAmmo', name: '穿甲弹', index: 29, layer: 4, cost: 900, requires: ['ballistics'], unlocks: ['穿甲弹匣伤害 +25%'] },
  { id: 'explosionTech', name: '爆炸物', index: 30, layer: 4, cost: 880, requires: ['sulfurTech'], unlocks: ['爆炸物'], unlockRecipes: ['explosives'] },
  { id: 'artillery', name: '炮弹', index: 31, layer: 4, cost: 920, requires: ['explosionTech', 'ballistics'], unlocks: ['炮弹'], unlockRecipes: ['artilleryShell'] },
  { id: 'wallFortify', name: '城墙加固', index: 32, layer: 4, cost: 900, requires: ['armour'], unlocks: ['城墙 +10 秒/级'] },

  // 第 5 层
  { id: 'precision', name: '精密制造', index: 33, layer: 5, cost: 1200, requires: ['processingUnit', 'plasticTech'], unlocks: ['低密度结构、模块化工程服'], unlockRecipes: ['lowDensityStructure', 'modularSuit'] },
  { id: 'productivityModule', name: '产能模块', index: 34, layer: 5, cost: 1300, requires: ['modules'], unlocks: ['产能模块'], unlockRecipes: ['productivityModule'] },
  { id: 'advancedAssembly', name: '高级装配', index: 35, layer: 5, cost: 1400, requires: ['modules'], unlocks: ['装配机速度 +10%'] },
  { id: 'speedModuleTech', name: '速度模块精研', index: 36, layer: 5, cost: 1350, requires: ['modules'], unlocks: ['速度模块 +10%'] },
  { id: 'shipWeapons', name: '舰船武器', index: 37, layer: 5, cost: 1500, requires: ['electricEngine'], unlocks: ['武器组件、护盾组件'], unlockRecipes: ['weaponAssembly', 'shieldAssembly'] },
  { id: 'robotLogistics', name: '机器人物流', index: 38, layer: 5, cost: 1600, requires: ['advancedAssembly'], unlocks: ['全部建筑模块槽位 +1、流体吞吐 +25%'], unlockRecipes: ['personalRobot'] },

  // 第 6 层
  { id: 'nuclear', name: '核能', index: 39, layer: 6, cost: 2400, requires: ['precision'], unlocks: ['离心机、核反应堆、铀浓缩、核燃料棒'], unlockBuildings: ['centrifuge', 'nuclearReactor'], unlockRecipes: ['uraniumEnrich', 'nuclearFuelCell', 'portableReactor'] },
  { id: 'rocketTech', name: '火箭', index: 40, layer: 6, cost: 3200, requires: ['nuclear'], unlocks: ['火箭燃料、火箭控制单元、火箭部件'], unlockRecipes: ['rocketFuel', 'rocketControlUnit', 'rocketPart'] },
  { id: 'silo', name: '发射井', index: 41, layer: 6, cost: 3800, requires: ['rocketTech'], unlocks: ['火箭发射井、五种载荷'], unlockBuildings: ['rocketSilo'], unlockRecipes: ['seedPod', 'dataCore', 'industrialSeed', 'cargoPod', 'starChart'] },
  { id: 'infiniteResearch', name: '无限研究', index: 42, layer: 6, cost: 4500, requires: ['silo'], unlocks: ['无限研究四项'] }
]

export const TECH_MAP: Record<TechId, TechDef> = Object.fromEntries(TECHS.map(t => [t.id, t])) as Record<TechId, TechDef>

/** 每层对应的科技包构成 */
export const LAYER_PACKS: Record<number, string[]> = {
  1: ['automationPack'],
  2: ['automationPack', 'logisticPack'],
  3: ['automationPack', 'logisticPack', 'chemicalPack'],
  4: ['automationPack', 'logisticPack', 'chemicalPack', 'militaryPack'],
  5: ['automationPack', 'logisticPack', 'chemicalPack', 'militaryPack', 'productionPack'],
  6: ['automationPack', 'logisticPack', 'chemicalPack', 'militaryPack', 'productionPack', 'utilityPack']
}

/** 无限研究四项，等级跨周目保留 */
export const INFINITE_RESEARCH = [
  { id: 'mining', name: '采矿产能', effect: '矿脉产出 +2%', baseCost: 2000, growth: 1.5 },
  { id: 'smelting', name: '冶炼速度', effect: '冶炼速度 +5%', baseCost: 2500, growth: 1.5 },
  { id: 'logistics', name: '物流吞吐', effect: '流体吞吐 +5%', baseCost: 2200, growth: 1.4 },
  { id: 'weapon', name: '武器伤害', effect: '炮塔与支援 DPS +10%', baseCost: 3000, growth: 1.6 }
] as const
