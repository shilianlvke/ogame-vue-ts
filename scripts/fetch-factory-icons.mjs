/**
 * 从 game-icons.net 拉取工厂系统所需的矢量图标。
 * 图标协议：CC BY 3.0，作者见 public/svg/factory/ATTRIBUTION.md
 * 运行：node scripts/fetch-factory-icons.mjs
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const list = readFileSync('.icon-tmp/list.txt', 'utf8').split('\n').filter(Boolean)
const byName = new Map()
for (const p of list) {
  const name = p.replace(/\.svg$/, '').split('/').pop()
  if (!byName.has(name)) byName.set(name, p)
}

/** 材料与建筑的图标映射，值为候选图标名，按顺序取第一个存在的 */
const MAP = {
  // 材料 T0~T10
  ironOre: ['minerals', 'mineral-heart'],
  copperOre: ['mineral-heart', 'minerals'],
  coal: ['coal-pile'],
  stone: ['stone-pile'],
  crudeOil: ['oil-rig', 'oil-pump'],
  water: ['water'],
  ironPlate: ['metal-plate'],
  copperPlate: ['melting-metal', 'metal-plate'],
  steel: ['anvil'],
  stoneBrick: ['clay-brick'],
  solidFuel: ['coal-wagon', 'fuel-tank'],
  ironGear: ['cog', 'gears'],
  copperCable: ['wire-coil'],
  circuit: ['circuitry', 'microchip'],
  pipe: ['pipes'],
  ironStick: ['wood-stick', 'stick-frame'],
  petroleumGas: ['poison-gas', 'bubbling-flask'],
  heavyOil: ['barrel'],
  lightOil: ['barrel-leak'],
  plastic: ['chemical-drop'],
  sulfur: ['powder'],
  sulfuricAcid: ['acid'],
  advancedCircuit: ['microchip'],
  processingUnit: ['processor'],
  engineUnit: ['boat-engine'],
  electricEngine: ['turbine'],
  battery: ['car-battery'],
  explosives: ['smoke-bomb', 'inferno-bomb'],
  lubricant: ['oil-can'],
  speedModule: ['upgrade'],
  productivityModule: ['team-upgrade'],
  efficiencyModule: ['green-power'],
  lowDensityStructure: ['wood-frame', 'stick-frame'],
  rocketFuel: ['fuel-tank'],
  rocketControlUnit: ['cpu'],
  rocketPart: ['rocket'],
  solarPanel: ['solar-power'],
  accumulator: ['energy-tank'],
  nuclearFuelCell: ['radioactive'],
  uraniumOre: ['radioactive'],
  uranium238: ['nuclear-waste'],
  uranium235: ['nuclear'],
  automationPack: ['flask'],
  logisticPack: ['round-bottom-flask'],
  chemicalPack: ['bubbling-flask'],
  militaryPack: ['fizzing-flask'],
  productionPack: ['test-tubes'],
  utilityPack: ['vial'],
  magazine: ['bullets'],
  piercingMagazine: ['heavy-bullets'],
  artilleryShell: ['cannon-ball'],
  wallSegment: ['brick-wall'],
  hullFrame: ['iron-hulled-warship'],
  thrusterAssembly: ['rocket-thruster'],
  weaponAssembly: ['cannon'],
  shieldAssembly: ['shield'],
  rustAlloy: ['rusty-sword', 'anvil-impact'],
  neuralCord: ['spinal-coil'],
  damagedBlueprint: ['armor-blueprint'],
  cycleShard: ['crystal-cluster'],
  rustCore: ['atom-core'],
  rustWreck: ['ship-wreck'],

  // 建筑
  mine: ['miner', 'mine-wagon'],
  waterPump: ['manual-water-pump'],
  oilWell: ['oil-rig'],
  stoneFurnace: ['furnace'],
  electricFurnace: ['melting-metal', 'furnace'],
  assembler: ['factory-arm'],
  chemicalPlant: ['chemical-tank'],
  oilRefinery: ['refinery'],
  centrifuge: ['vortex'],
  salvager: ['circular-sawblade'],
  boiler: ['steam'],
  solarArray: ['solar-time', 'solar-power'],
  accumulatorBank: ['battery-100'],
  nuclearReactor: ['reactor'],
  lab: ['microscope'],
  turret: ['turret'],
  wall: ['stone-wall'],
  radar: ['radar-dish'],
  warehouse: ['warehouse'],
  logisticsTower: ['cargo-crane'],
  rocketSilo: ['round-silo'],
  ventValve: ['valve']
}

const OUT_DIR = 'public/svg/factory'
mkdirSync(OUT_DIR, { recursive: true })

const missing = []
const used = []
let downloaded = 0
let cached = 0

for (const [id, candidates] of Object.entries(MAP)) {
  const target = join(OUT_DIR, `${id}.svg`)
  const pick = candidates.find(n => byName.has(n))
  if (!pick) {
    missing.push(`${id} (${candidates.join('/')})`)
    continue
  }
  const path = byName.get(pick)
  used.push(`${id} <- ${path}`)
  if (existsSync(target)) {
    cached++
    continue
  }
  const url = `https://raw.githubusercontent.com/game-icons/icons/master/${path}`
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    let svg = await res.text()
    // 统一为 currentColor，便于用 mask 或 fill 着色
    svg = svg.replace(/fill="#[0-9a-fA-F]{3,6}"/g, 'fill="currentColor"')
    writeFileSync(target, svg, 'utf8')
    downloaded++
  } catch (e) {
    missing.push(`${id} 下载失败 ${String(e)}`)
  }
}

writeFileSync(join(OUT_DIR, '..', 'factory-icon-map.txt'), used.join('\n') + '\n', 'utf8')
console.log(`下载 ${downloaded}，已存在 ${cached}，缺失 ${missing.length}`)
if (missing.length) console.log('缺失：\n  ' + missing.join('\n  '))
