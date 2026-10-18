/**
 * 星图生成器（确定性、纯函数）
 *
 * 同一个 `layoutSeed` + `cycle` 在任何环境（浏览器 / Node / 服务端）都会得到
 * 完全相同的星区位置、恒星系坐标与属性——这是"服务端权威、客户端本地推演"的前提。
 *
 * 算法见 doc/GALAXY_MAP_DESIGN.md §3：
 *   黄金角螺旋铺星区 → 松弛去重叠 → 每区 8×8 网格拒绝采样铺恒星系。
 */
import { GALAXY_CONFIG, LAYOUT_CONFIG, galaxyOf } from '@/config/galaxyConfig'
import { generateSystemName } from '@/logic/nameGenerator'
import {
  buildAdjacency,
  buildGateLanes,
  buildLocalLanes,
  buildRegionAdjacency,
  distance as pointDistance
} from '@/logic/hyperlaneLogic'
import { mixSeed, mulberry32, pickWeighted, randInt } from '@/utils/random'
import type {
  Biome,
  CycleLayout,
  EconomyType,
  Hazard,
  PlanetProfile,
  Point,
  RegionLayout,
  ResourceBias,
  StarClass,
  StarSystem
} from '@/types/galaxy'

const GOLDEN_ANGLE = 2.399963229728653

const ECONOMY_WEIGHTS: Record<EconomyType, number> = {
  mining: 20,
  industrial: 18,
  tech: 16,
  trade: 16,
  agriculture: 15,
  military: 15
}

const STAR_WEIGHTS: Record<StarClass, number> = {
  yellow: 35,
  red: 25,
  white: 15,
  blue: 15,
  green: 10
}

/** 不同恒星类型下的地貌偏好（权重） */
const BIOME_WEIGHTS: Record<StarClass, Record<Biome, number>> = {
  yellow: { lush: 6, rocky: 26, ocean: 16, desert: 14, frozen: 10, toxic: 8, lava: 8, gas: 8, barren: 4 },
  red: { lush: 2, rocky: 27, desert: 21, frozen: 20, barren: 12, lava: 10, gas: 4, toxic: 2, ocean: 2 },
  blue: { lush: 8, ocean: 22, toxic: 18, rocky: 16, gas: 12, frozen: 10, desert: 6, lava: 4, barren: 4 },
  green: { lush: 10, ocean: 22, toxic: 16, rocky: 16, desert: 12, frozen: 10, gas: 8, lava: 4, barren: 2 },
  white: { lush: 2, frozen: 27, rocky: 24, barren: 16, gas: 12, desert: 8, ocean: 6, lava: 4, toxic: 1 }
}

const RESOURCE_BIASES: Array<{ bias: ResourceBias; weight: number }> = [
  { bias: 'balanced', weight: 40 },
  { bias: 'metal', weight: 20 },
  { bias: 'crystal', weight: 18 },
  { bias: 'deuterium', weight: 14 },
  { bias: 'darkMatter', weight: 8 }
]

const HAZARDS: Array<{ hazard: Hazard; weight: number }> = [
  { hazard: 'none', weight: 50 },
  { hazard: 'storm', weight: 16 },
  { hazard: 'radiation', weight: 12 },
  { hazard: 'extremeCold', weight: 12 },
  { hazard: 'extremeHeat', weight: 10 }
]

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

const weighted = <T extends string>(list: Array<{ value: T; weight: number }>, rand: () => number): T => {
  const total = list.reduce((sum, item) => sum + item.weight, 0)
  let roll = rand() * total
  for (const item of list) {
    roll -= item.weight
    if (roll <= 0) return item.value
  }
  return list[list.length - 1]!.value
}

/**
 * 星区中心：黄金角螺旋 + 松弛（避免云团大面积重叠）
 */
const buildRegionCenters = (seed: number): Point[] => {
  const rand = mulberry32(seed)
  const half = LAYOUT_CONFIG.SPACE / 2
  const maxRadius = LAYOUT_CONFIG.SPACE * LAYOUT_CONFIG.REGION_MAX_RADIUS_FACTOR
  const count = GALAXY_CONFIG.REGIONS_PER_CYCLE

  const centers: Point[] = []
  for (let i = 0; i < count; i += 1) {
    const angle = i * GOLDEN_ANGLE + (rand() - 0.5) * 0.24
    const radius = maxRadius * Math.sqrt((i + 0.5) / count) * (0.92 + rand() * 0.16)
    centers.push({ x: half + Math.cos(angle) * radius, y: half + Math.sin(angle) * radius })
  }

  const minGap = LAYOUT_CONFIG.REGION_RADIUS * LAYOUT_CONFIG.REGION_MIN_GAP_FACTOR
  const low = LAYOUT_CONFIG.SPACE * 0.05
  const high = LAYOUT_CONFIG.SPACE * 0.95

  for (let step = 0; step < LAYOUT_CONFIG.REGION_RELAX_STEPS; step += 1) {
    let moved = false
    for (let a = 0; a < centers.length; a += 1) {
      for (let b = a + 1; b < centers.length; b += 1) {
        const ca = centers[a]!
        const cb = centers[b]!
        const dist = pointDistance(ca, cb)
        if (dist >= minGap || dist < 1e-6) continue
        const push = (minGap - dist) / 2
        const ux = (cb.x - ca.x) / dist
        const uy = (cb.y - ca.y) / dist
        centers[a] = { x: clamp(ca.x - ux * push, low, high), y: clamp(ca.y - uy * push, low, high) }
        centers[b] = { x: clamp(cb.x + ux * push, low, high), y: clamp(cb.y + uy * push, low, high) }
        moved = true
      }
    }
    if (!moved) break
  }

  return centers
}

/**
 * 星区内恒星系坐标：8×8 网格拒绝采样
 */
const sampleSystemCoords = (rand: () => number, center: Point): Point[] => {
  const { REGION_RADIUS, SYSTEM_MIN_SPACING, SAMPLE_GRID } = LAYOUT_CONFIG
  const target = GALAXY_CONFIG.SYSTEMS_PER_REGION
  const cell = (REGION_RADIUS * 2) / SAMPLE_GRID

  const cells: Array<[number, number]> = []
  for (let gx = 0; gx < SAMPLE_GRID; gx += 1) {
    for (let gy = 0; gy < SAMPLE_GRID; gy += 1) cells.push([gx, gy])
  }
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = cells[i]!
    cells[i] = cells[j]!
    cells[j] = tmp
  }

  const points: Point[] = []
  for (const [gx, gy] of cells) {
    if (points.length >= target) break
    const baseX = center.x - REGION_RADIUS + (gx + 0.5) * cell
    const baseY = center.y - REGION_RADIUS + (gy + 0.5) * cell
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const point = {
        x: baseX + (rand() - 0.5) * 0.9 * cell,
        y: baseY + (rand() - 0.5) * 0.9 * cell
      }
      if (pointDistance(point, center) > REGION_RADIUS * 0.96) continue
      if (points.some(existing => pointDistance(point, existing) < SYSTEM_MIN_SPACING)) continue
      points.push(point)
      break
    }
  }

  // 兜底：采样不足时用螺旋补位（保证每区恰好 64 个）
  // 先尽量保持正常间距，实在放不下才逐步放宽，避免出现"贴在一起"的恒星系
  const relaxations = [1, 0.9, 0.8]
  for (const factor of relaxations) {
    let guard = 0
    while (points.length < target && guard < 20000) {
      guard += 1
      const angle = rand() * Math.PI * 2
      const radius = REGION_RADIUS * Math.sqrt(rand()) * 0.9
      const point = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }
      if (points.every(existing => pointDistance(point, existing) > SYSTEM_MIN_SPACING * factor)) {
        points.push(point)
      }
    }
    if (points.length >= target) break
  }

  return points
}

const buildSystem = (seed: number, cycle: number, region: number, index: number, coords: Point): StarSystem => {
  const rand = mulberry32(mixSeed(mixSeed(seed, cycle), region * 100 + index))
  const starClass = pickWeighted(rand, STAR_WEIGHTS)
  const economy = pickWeighted(rand, ECONOMY_WEIGHTS)
  const wealth = randInt(rand, 1, 3) as 1 | 2 | 3
  const dangerRoll = rand()
  const danger = (dangerRoll < 0.45 ? 1 : dangerRoll < 0.85 ? 2 : 3) as 1 | 2 | 3
  return {
    id: `${cycle}:${region}:${index}`,
    cycle,
    region,
    index,
    galaxy: galaxyOf(cycle, region),
    name: generateSystemName(`${cycle}:${region}:${index}`),
    starClass,
    economy,
    wealth,
    danger,
    hasStation: rand() < 0.35,
    coords
  }
}

/** 行星档案（不落盘，实时推导） */
export const getPlanetProfile = (
  layoutSeed: number,
  cycle: number,
  region: number,
  index: number,
  orbit: number
): PlanetProfile => {
  const systemRand = mulberry32(mixSeed(mixSeed(layoutSeed, cycle), region * 100 + index))
  const starClass = pickWeighted(systemRand, STAR_WEIGHTS)
  const rand = mulberry32(mixSeed(mixSeed(layoutSeed, orbit), region * 1000 + index))
  const biome = weighted(
    (Object.keys(BIOME_WEIGHTS[starClass]) as Biome[]).map(value => ({
      value,
      weight: BIOME_WEIGHTS[starClass][value]
    })),
    rand
  )
  return {
    biome,
    sizeClass: randInt(rand, 1, 3) as 1 | 2 | 3,
    resourceBias: weighted(RESOURCE_BIASES.map(item => ({ value: item.bias, weight: item.weight })), rand),
    hazard: weighted(HAZARDS.map(item => ({ value: item.hazard, weight: item.weight })), rand),
    orbitDistance: orbit * 40 + Math.floor(rand() * 20)
  }
}

const layoutCache = new Map<string, CycleLayout>()

/** 清空缓存（测试用） */
export const clearLayoutCache = (): void => {
  layoutCache.clear()
}

/**
 * 构建一个周目的完整星图
 *
 * @param layoutSeed 该周目的布局种子（由 worldSeed 派生，见 doc/GALAXY_CYCLES.md）
 * @param cycle 周目号（1..12）
 */
export const buildCycleLayout = (
  layoutSeed: number,
  cycle: number,
  options: { noCache?: boolean } = {}
): CycleLayout => {
  const cacheKey = `${layoutSeed}:${cycle}`
  if (!options.noCache) {
    const cached = layoutCache.get(cacheKey)
    if (cached) return cached
  }

  const centers = buildRegionCenters(layoutSeed)
  const regions: RegionLayout[] = centers.map((center, offset) => {
    const region = offset + 1
    const regionRand = mulberry32(mixSeed(layoutSeed, region))
    const coords = sampleSystemCoords(regionRand, center)
    const systems = coords.map((point, i) => buildSystem(layoutSeed, cycle, region, i + 1, point))
    return { region, center, systems }
  })

  const lanes = regions.flatMap(item => buildLocalLanes(item.systems))
  const gates = buildGateLanes(regions, buildRegionAdjacency(centers))
  const adjacency = buildAdjacency([...lanes, ...gates])
  const systemIndex = new Map<string, StarSystem>()
  for (const region of regions) {
    for (const system of region.systems) systemIndex.set(system.id, system)
  }

  const layout: CycleLayout = { cycle, seed: layoutSeed, regions, lanes, gates, adjacency, systemIndex }
  if (!options.noCache) layoutCache.set(cacheKey, layout)
  return layout
}

/** 由 worldSeed 派生某一周目的布局种子 */
export const cycleLayoutSeed = (worldSeed: number, cycle: number): number => mixSeed(worldSeed, cycle * 0x9e3779b1)

/** 按 id 取恒星系 */
export const getSystemById = (layout: CycleLayout, systemId: string): StarSystem | undefined =>
  layout.systemIndex.get(systemId)
