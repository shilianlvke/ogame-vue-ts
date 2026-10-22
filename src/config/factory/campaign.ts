import type { BuildingId, CampaignChapter, CampaignGoal, CampaignQuest, CampaignReward, MaterialId, PayloadId, TechId } from '@/types/factory'

/**
 * 战役任务表，对应规划书 §10.5（7 章 130 条）。
 * 目标记法：`矿井 ×1` 建成建筑、`电炉 ≥8` 建筑等级、`铁板 ≥0.3/s` 配方产能、
 * `煤 ≥300` 持有材料、`电力系统` 完成科技、`第 5 波` 通过波次、`发射` 发射火箭。
 */

// ---------- 目标构造器 ----------
const produce = (target: MaterialId, amount: number): CampaignGoal => ({ type: 'produce', target, amount })
const building = (target: BuildingId, amount = 1): CampaignGoal => ({ type: 'building', target, amount })
const buildingLevel = (target: BuildingId, amount: number): CampaignGoal => ({ type: 'buildingLevel', target, amount })
const buildingTotal = (amount: number): CampaignGoal => ({ type: 'buildingTotal', amount })
const material = (target: MaterialId, amount: number): CampaignGoal => ({ type: 'material', target, amount })
const payload = (target: PayloadId, amount: number): CampaignGoal => ({ type: 'payload', target, amount })
const ship = (target: string, amount: number): CampaignGoal => ({ type: 'ship', target, amount })
const research = (target: TechId): CampaignGoal => ({ type: 'research', target, amount: 1 })
const wave = (n: number): CampaignGoal => ({ type: 'wave', target: n, amount: 1 })
const outpost = (amount: number): CampaignGoal => ({ type: 'outpost', amount })
const routeCapacity = (amount: number): CampaignGoal => ({ type: 'routeCapacity', amount })
const cycle = (amount: number): CampaignGoal => ({ type: 'cycle', amount })
const launch = (amount = 1): CampaignGoal => ({ type: 'launch', amount })

// ---------- 奖励构造器 ----------
const mats = (materials: Partial<Record<MaterialId, number>>): CampaignReward => ({ materials })
const build = (buildings: Partial<Record<BuildingId, number>>): CampaignReward => ({ buildings })
const level = (buildingLevels: Partial<Record<BuildingId, number>>): CampaignReward => ({ buildingLevels })
const shipReward = (ships: Partial<Record<string, number>>): CampaignReward => ({ ships })

function q(id: string, chapter: number, name: string, main: CampaignGoal, sub: CampaignGoal[], reward: CampaignReward): CampaignQuest {
  return { id, chapter, name, main, sub, reward }
}

// ---------- 任务表 ----------
const QUESTS: CampaignQuest[] = [
  // ============ 第 1 章 · 火种（16） ============
  q('1-1', 1, '荒原第一步', building('mine'), [material('ironOre', 50)], build({ stoneFurnace: 1 })),
  q('1-2', 1, '第一炉铁', produce('ironPlate', 0.3), [buildingLevel('stoneFurnace', 2)], mats({ ironPlate: 100 })),
  q('1-3', 1, '煤炭自足', material('coal', 300), [buildingLevel('mine', 2)], level({ mine: 1 })),
  q('1-4', 1, '通电', building('boiler'), [material('coal', 200)], build({ electricFurnace: 1 })),
  q('1-5', 1, '电驱矿井', buildingLevel('mine', 3), [buildingLevel('electricFurnace', 1)], mats({ ironPlate: 200 })),
  q('1-6', 1, '铜的第一次', produce('copperPlate', 0.3), [material('copperOre', 200)], mats({ copperPlate: 500 })),
  q('1-7', 1, '齿轮组', produce('ironGear', 0.5), [building('assembler')], mats({ ironPlate: 300 })),
  q('1-8', 1, '管道', produce('pipe', 0.3), [building('assembler', 2)], mats({ stoneBrick: 100 })),
  q('1-9', 1, '石与砖', produce('stoneBrick', 0.3), [buildingLevel('warehouse', 2)], level({ warehouse: 1 })),
  q('1-10', 1, '仓储网', building('logisticsTower'), [buildingLevel('warehouse', 3)], mats({ ironPlate: 500 })),
  q('1-11', 1, '第一个瓶颈', produce('ironPlate', 1.0), [buildingLevel('electricFurnace', 4)], build({ electricFurnace: 2 })),
  q('1-12', 1, '冶炼扩容', buildingLevel('electricFurnace', 6), [produce('ironPlate', 1.5)], mats({ ironPlate: 2000 })),
  q('1-13', 1, '钢的开始', produce('steel', 0.1), [buildingLevel('electricFurnace', 6)], mats({ steel: 200 })),
  q('1-14', 1, '双线并行', buildingTotal(15), [buildingLevel('assembler', 3)], mats({ ironGear: 300 })),
  q('1-15', 1, '电力跟上', buildingLevel('boiler', 3), [produce('stoneBrick', 0.5)], level({ boiler: 1 })),
  q('1-16', 1, '火种', research('power'), [research('automation')], mats({ automationPack: 200 })),

  // ============ 第 2 章 · 流水线（18） ============
  q('2-1', 2, '铜线洪流', produce('copperCable', 2), [produce('copperPlate', 1.5)], { recipeBonus: { copperCable: 0.1 } }),
  q('2-2', 2, '电路板', produce('circuit', 1), [buildingLevel('assembler', 4)], mats({ circuit: 800 })),
  q('2-3', 2, '实验室', building('lab'), [produce('circuit', 0.8)], build({ lab: 1 })),
  q('2-4', 2, '红瓶产线', produce('automationPack', 0.3), [buildingLevel('lab', 2)], mats({ automationPack: 300 })),
  q('2-5', 2, '机械传动', research('mechanics'), [research('assembly')], level({ assembler: 1 })),
  q('2-6', 2, '钢材量产', produce('steel', 0.3), [buildingLevel('electricFurnace', 8)], build({ electricFurnace: 2 })),
  q('2-7', 2, '钢材冶炼', research('steelSmelting'), [produce('steel', 0.2)], level({ electricFurnace: 1 })),
  q('2-8', 2, '物流塔', buildingLevel('logisticsTower', 2), [research('logisticsTower')], build({ logisticsTower: 1 })),
  q('2-9', 2, '高级物流', research('advancedLogistics'), [buildingLevel('logisticsTower', 3)], level({ logisticsTower: 1 })),
  q('2-10', 2, '绿瓶', produce('logisticPack', 0.3), [produce('automationPack', 0.3)], mats({ logisticPack: 300 })),
  q('2-11', 2, '第二条装配线', buildingLevel('assembler', 6), [produce('circuit', 2)], build({ assembler: 2 })),
  q('2-12', 2, '电力缺口', buildingLevel('boiler', 5), [produce('ironPlate', 2)], level({ boiler: 1 })),
  q('2-13', 2, '弹药', produce('magazine', 10), [buildingLevel('assembler', 6)], mats({ magazine: 5000 })),
  q('2-14', 2, '军事基础', research('basicMilitary'), [research('ballistics')], build({ turret: 1 })),
  q('2-15', 2, '锈群第一波', wave(1), [], mats({ rustAlloy: 10 })),
  q('2-16', 2, '第一道防线', buildingLevel('turret', 2), [wave(3)], mats({ wallSegment: 100 })),
  q('2-17', 2, '仓储扩张', buildingLevel('warehouse', 5), [buildingTotal(20)], level({ warehouse: 1 })),
  q('2-18', 2, '站稳', produce('ironPlate', 3), [produce('copperPlate', 3)], mats({ ironPlate: 2000 })),

  // ============ 第 3 章 · 黑金（20） ============
  q('3-1', 3, '原油', produce('crudeOil', 5), [building('oilWell', 2)], mats({ pipe: 100 })),
  q('3-2', 3, '炼油厂', building('oilRefinery'), [research('refining')], level({ oilRefinery: 1 })),
  q('3-3', 3, '基础炼油', produce('petroleumGas', 8), [buildingLevel('oilRefinery', 2)], { unlockRecipes: ['plastic'] }),
  q('3-4', 3, '塑料', produce('plastic', 1), [building('chemicalPlant')], mats({ plastic: 2000 })),
  q('3-5', 3, '化工厂', buildingLevel('chemicalPlant', 2), [research('chemical')], build({ chemicalPlant: 1 })),
  q('3-6', 3, '硫磺', produce('sulfur', 1), [produce('petroleumGas', 10)], { unlockRecipes: ['sulfuricAcid'] }),
  q('3-7', 3, '硫酸', produce('sulfuricAcid', 10), [buildingLevel('chemicalPlant', 3)], { unlockRecipes: ['battery'] }),
  q('3-8', 3, '高级炼油', research('advancedRefining'), [material('heavyOil', 500)], level({ oilRefinery: 1 })),
  q('3-9', 3, '重油难题', material('heavyOil', 2000), [], { unlockRecipes: ['solidFuel'] }),
  q('3-10', 3, '裂解', produce('lightOil', 5), [produce('petroleumGas', 15)], build({ ventValve: 1 })),
  q('3-11', 3, '排空阀', building('ventValve'), [research('ventValve')], level({ ventValve: 1 })),
  q('3-12', 3, '电池', produce('battery', 0.3), [produce('sulfuricAcid', 10)], build({ accumulatorBank: 2 })),
  q('3-13', 3, '高级电路', produce('advancedCircuit', 0.5), [produce('plastic', 1)], mats({ advancedCircuit: 500 })),
  q('3-14', 3, '蓝瓶', produce('chemicalPack', 0.15), [buildingLevel('lab', 4)], mats({ chemicalPack: 400 })),
  q('3-15', 3, '高级电路研究', research('advancedCircuit'), [research('batteryTech')], level({ chemicalPlant: 1 })),
  q('3-16', 3, '爆炸物', produce('explosives', 1), [material('coal', 1000)], { unlockRecipes: ['artilleryShell'] }),
  q('3-17', 3, '炮弹', produce('artilleryShell', 0.3), [produce('explosives', 1)], mats({ artilleryShell: 200 })),
  q('3-18', 3, '第五波', wave(5), [buildingLevel('turret', 4)], mats({ rustAlloy: 40 })),
  q('3-19', 3, '第一座前哨', outpost(1), [ship('大型货船', 4)], shipReward({ 大型货船: 2 })),
  q('3-20', 3, '运输线', routeCapacity(5000), [outpost(1)], level({ logisticsTower: 1 })),

  // ============ 第 4 章 · 钢铁与锈群（18） ============
  q('4-1', 4, '钢材量产', produce('steel', 0.8), [buildingLevel('electricFurnace', 12)], mats({ steel: 3000 })),
  q('4-2', 4, '穿甲弹', produce('piercingMagazine', 3), [produce('steel', 0.5)], mats({ piercingMagazine: 3000 })),
  q('4-3', 4, '炮塔升级', buildingLevel('turret', 6), [research('turretUpgrade')], level({ turret: 1 })),
  q('4-4', 4, '装甲', research('armour'), [], mats({ wallSegment: 300 })),
  q('4-5', 4, '灰瓶', produce('militaryPack', 0.15), [buildingLevel('lab', 5)], mats({ militaryPack: 400 })),
  q('4-6', 4, '城墙', buildingLevel('wall', 6), [research('wallFortify')], mats({ wallSegment: 500 })),
  q('4-7', 4, '雷达', buildingLevel('radar', 2), [research('radarTech')], build({ radar: 1 })),
  q('4-8', 4, '第十波', wave(10), [buildingLevel('turret', 8)], mats({ rustAlloy: 60 })),
  q('4-9', 4, '第十五波', wave(15), [produce('piercingMagazine', 3)], mats({ neuralCord: 5 })),
  q('4-10', 4, '弹药储备', material('piercingMagazine', 8000), [], mats({ neuralCord: 3 })),
  q('4-11', 4, '第二座前哨', outpost(2), [routeCapacity(8000)], shipReward({ 大型货船: 4 })),
  q('4-12', 4, '引擎', produce('engineUnit', 0.2), [produce('steel', 1)], { unlockRecipes: ['electricEngine'] }),
  q('4-13', 4, '电引擎', produce('electricEngine', 0.1), [produce('lubricant', 2)], mats({ electricEngine: 200 })),
  q('4-14', 4, '处理单元', produce('processingUnit', 0.2), [produce('sulfuricAcid', 15)], mats({ processingUnit: 500 })),
  q('4-15', 4, '精密化', produce('advancedCircuit', 1.5), [buildingLevel('assembler', 8)], mats({ advancedCircuit: 2000 })),
  q('4-16', 4, '电力翻倍', buildingLevel('boiler', 8), [produce('steel', 1.5)], level({ boiler: 2 })),
  q('4-17', 4, '第二十波', wave(20), [buildingLevel('radar', 3)], mats({ rustCore: 2 })),
  q('4-18', 4, '舰体', produce('hullFrame', 0.01), [produce('lowDensityStructure', 0.05)], mats({ hullFrame: 10 })),

  // ============ 第 5 章 · 精密（18） ============
  q('5-1', 5, '速度模块', produce('speedModule', 0.1), [produce('advancedCircuit', 1)], mats({ speedModule: 200 })),
  q('5-2', 5, '产能模块', produce('productivityModule', 0.1), [produce('processingUnit', 0.2)], mats({ productivityModule: 200 })),
  q('5-3', 5, '效率模块', produce('efficiencyModule', 0.1), [], mats({ efficiencyModule: 200 })),
  q('5-4', 5, '模块化', research('modules'), [], { moduleSlotBonus: 1 }),
  q('5-5', 5, '模块精研', research('speedModuleTech'), [research('productivityModule')], mats({ speedModule: 300 })),
  q('5-6', 5, '紫瓶', produce('productionPack', 0.08), [buildingLevel('lab', 6)], mats({ productionPack: 300 })),
  q('5-7', 5, '精密制造', research('precision'), [], level({ assembler: 1 })),
  q('5-8', 5, '低密度结构', produce('lowDensityStructure', 0.1), [produce('copperPlate', 8)], mats({ lowDensityStructure: 500 })),
  q('5-9', 5, '铜的深渊', produce('copperPlate', 10), [buildingLevel('electricFurnace', 16)], build({ electricFurnace: 4 })),
  q('5-10', 5, '铁的天花板', produce('ironPlate', 15), [buildingLevel('electricFurnace', 20)], level({ electricFurnace: 2 })),
  q('5-11', 5, '电力 50MW', buildingLevel('boiler', 10), [produce('ironPlate', 20)], level({ boiler: 2 })),
  q('5-12', 5, '第二十五波', wave(25), [buildingLevel('turret', 10)], mats({ neuralCord: 8 })),
  q('5-13', 5, '第三十波', wave(30), [produce('piercingMagazine', 6)], mats({ rustCore: 2 })),
  q('5-14', 5, '第三座前哨', outpost(3), [routeCapacity(12000)], shipReward({ 大型货船: 6 })),
  q('5-15', 5, '物流网络', buildingLevel('logisticsTower', 10), [buildingLevel('warehouse', 10)], level({ logisticsTower: 2 })),
  q('5-16', 5, '仓储帝国', buildingLevel('warehouse', 14), [material('ironPlate', 50000)], level({ warehouse: 2 })),
  q('5-17', 5, '工程服', material('processingUnit', 3000), [material('steel', 5000)], { suit: 'reinforced' }),
  q('5-18', 5, '装备网格', material('neuralCord', 12), [], { equipment: { exoskeleton: 2 } }),

  // ============ 第 6 章 · 临界（20） ============
  q('6-1', 6, '铀矿', material('uraniumOre', 3000), [buildingLevel('mine', 10)], { unlockRecipes: ['uraniumEnrich'] }),
  q('6-2', 6, '离心机', building('centrifuge'), [material('uraniumOre', 2000)], level({ centrifuge: 1 })),
  q('6-3', 6, '铀-235', material('uranium235', 30), [buildingLevel('centrifuge', 3)], { unlockRecipes: ['nuclearFuelCell'] }),
  q('6-4', 6, '核燃料棒', produce('nuclearFuelCell', 0.08), [material('uranium235', 20)], mats({ nuclearFuelCell: 100 })),
  q('6-5', 6, '核反应堆', building('nuclearReactor'), [produce('nuclearFuelCell', 0.05)], level({ nuclearReactor: 1 })),
  q('6-6', 6, '核能', research('nuclear'), [buildingLevel('nuclearReactor', 1)], level({ nuclearReactor: 1 })),
  q('6-7', 6, '太阳能', buildingLevel('solarArray', 10), [produce('solarPanel', 0.5)], level({ solarArray: 2 })),
  q('6-8', 6, '蓄电', buildingLevel('accumulatorBank', 6), [produce('battery', 1)], level({ accumulatorBank: 2 })),
  q('6-9', 6, '黄瓶', produce('utilityPack', 0.08), [buildingLevel('lab', 8)], mats({ utilityPack: 300 })),
  q('6-10', 6, '效能', research('infiniteResearch'), [], { recipeBonus: { utilityPack: 0.2 } }),
  q('6-11', 6, '第三十五波', wave(35), [buildingLevel('turret', 12)], mats({ neuralCord: 10 })),
  q('6-12', 6, '第四十波', wave(40), [produce('artilleryShell', 1)], mats({ rustCore: 4 })),
  q('6-13', 6, '第五座前哨', outpost(5), [routeCapacity(20000)], shipReward({ 大型货船: 8 })),
  q('6-14', 6, '全自动化', buildingTotal(40), [buildingLevel('assembler', 12)], level({ assembler: 2 })),
  q('6-15', 6, '精密工业', produce('processingUnit', 1), [produce('advancedCircuit', 3)], mats({ processingUnit: 3000 })),
  q('6-16', 6, '电力 200MW', buildingLevel('nuclearReactor', 3), [produce('nuclearFuelCell', 0.1)], level({ nuclearReactor: 2 })),
  q('6-17', 6, '铀储备', material('uraniumOre', 20000), [buildingLevel('centrifuge', 6)], mats({ processingUnit: 2000 })),
  q('6-18', 6, '太阳能矩阵', buildingLevel('solarArray', 20), [produce('solarPanel', 1.5)], mats({ solarPanel: 3000 })),
  q('6-19', 6, '储能网', buildingLevel('accumulatorBank', 12), [produce('battery', 2)], mats({ battery: 2000 })),
  q('6-20', 6, '极限供电', buildingLevel('nuclearReactor', 4), [material('uranium235', 60)], mats({ nuclearFuelCell: 300 })),

  // ============ 第 7 章 · 点火（20） ============
  q('7-1', 7, '固体燃料', produce('solidFuel', 2), [produce('heavyOil', 40)], { unlockRecipes: ['rocketFuel'] }),
  q('7-2', 7, '火箭燃料', produce('rocketFuel', 0.1), [produce('solidFuel', 1)], mats({ rocketFuel: 200 })),
  q('7-3', 7, '控制单元', produce('rocketControlUnit', 0.05), [produce('speedModule', 0.2)], mats({ rocketControlUnit: 200 })),
  q('7-4', 7, '火箭技术', research('rocketTech'), [], build({ rocketSilo: 1 })),
  q('7-5', 7, '发射井', building('rocketSilo'), [research('silo')], level({ rocketSilo: 1 })),
  q('7-6', 7, '部件 ×10', material('rocketPart', 10), [produce('lowDensityStructure', 0.2)], mats({ lowDensityStructure: 1000 })),
  q('7-7', 7, '部件 ×50', material('rocketPart', 50), [produce('rocketControlUnit', 0.05)], mats({ processingUnit: 5000 })),
  q('7-8', 7, '部件 ×100', material('rocketPart', 100), [produce('rocketFuel', 0.1)], mats({ steel: 10000 })),
  q('7-9', 7, '载荷：数据核心', material('processingUnit', 2000), [], { payloads: { dataCore: 1 } }),
  q('7-10', 7, '载荷：工业种子', material('lowDensityStructure', 300), [], { payloads: { industrialSeed: 1 } }),
  q('7-11', 7, '载荷：物资舱', material('steel', 20000), [], { payloads: { cargoPod: 1 } }),
  q('7-12', 7, '载荷：星图阵列', material('solarPanel', 800), [], { payloads: { starChart: 1 } }),
  q('7-13', 7, '点火', launch(), [], { darkMatter: 500 }),
  q('7-14', 7, '第二次循环', cycle(2), [], mats({ cycleShard: 50 })),
  q('7-15', 7, '循环者', cycle(3), [], { darkMatter: 1000 }),
  q('7-16', 7, '三大件齐备', material('lowDensityStructure', 1000), [material('rocketFuel', 1000)], mats({ processingUnit: 10000 })),
  q('7-17', 7, '控制单元储备', material('rocketControlUnit', 1000), [produce('speedModule', 0.5)], mats({ speedModule: 1000 })),
  q('7-18', 7, '发射井扩容', buildingLevel('rocketSilo', 3), [material('steel', 30000)], level({ rocketSilo: 1 })),
  // 原「已发现星系 ≥50」：星系探索尚未接入工厂存档，暂以发射 ≥2 替代
  q('7-19', 7, '星图阵列', launch(2), [], { darkMatter: 300 }),
  q('7-20', 7, '载荷满载', payload('starChart', 1), [payload('dataCore', 1), payload('industrialSeed', 1)], { darkMatter: 1000 })
]

export const CAMPAIGN_CHAPTERS: CampaignChapter[] = [
  { number: 1, name: '火种', quests: QUESTS.filter(x => x.chapter === 1) },
  { number: 2, name: '流水线', quests: QUESTS.filter(x => x.chapter === 2) },
  { number: 3, name: '黑金', quests: QUESTS.filter(x => x.chapter === 3) },
  { number: 4, name: '钢铁与锈群', quests: QUESTS.filter(x => x.chapter === 4) },
  { number: 5, name: '精密', quests: QUESTS.filter(x => x.chapter === 5) },
  { number: 6, name: '临界', quests: QUESTS.filter(x => x.chapter === 6) },
  { number: 7, name: '点火', quests: QUESTS.filter(x => x.chapter === 7) }
]

/** 全部任务，按 id 顺序展开 */
export const CAMPAIGN_QUESTS: CampaignQuest[] = QUESTS

/** 任务 id → 任务映射 */
export const QUEST_MAP: Record<string, CampaignQuest> = Object.fromEntries(QUESTS.map(q => [q.id, q]))
