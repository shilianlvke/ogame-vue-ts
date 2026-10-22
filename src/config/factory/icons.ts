/**
 * 工厂图标。SVG 位于 public/svg/factory/，来源与协议见同目录 ATTRIBUTION.md。
 * 渲染方式为 CSS mask，颜色由 text-* 类决定，与项目现有线性图标观感一致。
 */
export const TIER_COLOR: Record<string, string> = {
  T0: 'text-muted-foreground',
  T1: 'text-muted-foreground',
  T2: 'text-primary',
  T3: 'text-primary',
  T4: 'text-cyan-600 dark:text-cyan-400',
  T5: 'text-amber-600 dark:text-amber-400',
  T6: 'text-emerald-600 dark:text-emerald-400',
  T7: 'text-violet-600 dark:text-violet-400',
  T8: 'text-rose-600 dark:text-rose-400',
  T9: 'text-sky-600 dark:text-sky-400',
  T10: 'text-orange-600 dark:text-orange-400'
}

/** 已提供的图标 id，其余回退到占位图 */
const ICON_IDS = new Set(['ironOre', 'copperOre', 'coal', 'stone', 'crudeOil', 'water', 'ironPlate', 'copperPlate', 'steel', 'stoneBrick', 'solidFuel', 'ironGear', 'copperCable', 'circuit', 'pipe', 'ironStick', 'petroleumGas', 'heavyOil', 'lightOil', 'plastic', 'sulfur', 'sulfuricAcid', 'advancedCircuit', 'processingUnit', 'engineUnit', 'electricEngine', 'battery', 'explosives', 'lubricant', 'speedModule', 'productivityModule', 'efficiencyModule', 'lowDensityStructure', 'rocketFuel', 'rocketControlUnit', 'rocketPart', 'solarPanel', 'accumulator', 'nuclearFuelCell', 'uraniumOre', 'uranium238', 'uranium235', 'automationPack', 'logisticPack', 'chemicalPack', 'militaryPack', 'productionPack', 'utilityPack', 'magazine', 'piercingMagazine', 'artilleryShell', 'wallSegment', 'hullFrame', 'thrusterAssembly', 'weaponAssembly', 'shieldAssembly', 'rustAlloy', 'neuralCord', 'damagedBlueprint', 'cycleShard', 'rustCore', 'rustWreck', 'mine', 'waterPump', 'oilWell', 'stoneFurnace', 'electricFurnace', 'assembler', 'chemicalPlant', 'oilRefinery', 'centrifuge', 'salvager', 'boiler', 'solarArray', 'accumulatorBank', 'nuclearReactor', 'lab', 'turret', 'wall', 'radar', 'warehouse', 'logisticsTower', 'rocketSilo', 'ventValve'])

const BASE = import.meta.env.BASE_URL

/** 取得图标地址；没有对应图标时返回占位图 */
export function factoryIcon(id: string): string {
  return ICON_IDS.has(id) ? `${BASE}svg/factory/${id}.svg` : `${BASE}svg/factory/placeholder.svg`
}

export const PLACEHOLDER_ICON = `${BASE}svg/factory/placeholder.svg`
