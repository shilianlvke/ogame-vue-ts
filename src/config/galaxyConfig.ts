/**
 * 星系 / 周目配置（多周目宇宙）
 *
 * 地址格式保持 `galaxy:system:position` 不变：
 *   galaxy = (cycle - 1) * REGIONS_PER_CYCLE + region     1..192
 *   cycle  = ceil(galaxy / REGIONS_PER_CYCLE)             1..12
 *
 * 这样旧存档的 galaxy 1..9 天然落在第 1 周目的 1..9 区，零迁移。
 *
 * 注意：本文件只定义"目标宇宙"的规模，**不改变现有生成逻辑**。
 * 真正的 16×64 生成要到 P0（生成器）才启用，届时 `generateRandomPosition`
 * 改为读这里的常量。
 */

export const GALAXY_CONFIG = {
  /** 每个周目的星区数（固定，改动会导致全局坐标偏移） */
  REGIONS_PER_CYCLE: 16,
  /** 每个星区的恒星系数 */
  SYSTEMS_PER_REGION: 64,
  /** 每个恒星系的轨道数 */
  ORBITS_PER_SYSTEM: 10,
  /** 周目总数 */
  MAX_CYCLES: 12,
  /** 布局算法版本（写进存档，升级时走迁移） */
  LAYOUT_VERSION: 1
} as const

/** 周目总数 */
export const CYCLE_COUNT = GALAXY_CONFIG.MAX_CYCLES

/** 默认布局种子（P6 之前所有世界共用；P6 改为按世界/周目随机并落盘） */
export const DEFAULT_LAYOUT_SEED = 20261018

/** 全局星区号上限（12 × 16 = 192） */
export const MAX_GALAXY = CYCLE_COUNT * GALAXY_CONFIG.REGIONS_PER_CYCLE

/**
 * 星图布局参数（见 doc/GALAXY_MAP_DESIGN.md）
 *
 * 只影响坐标与航道，不影响玩法数值；改了它等于换一张星图，
 * 所以必须与 `LAYOUT_VERSION` 一起升级。
 */
export const LAYOUT_CONFIG = {
  /** 银河平面边长 */
  SPACE: 65536,
  /** 星区半径 */
  REGION_RADIUS: 5200,
  /** 同星区恒星系最小间距 */
  SYSTEM_MIN_SPACING: 620,
  /** 星区中心距离银河中心的最大半径（占 SPACE 比例） */
  REGION_MAX_RADIUS_FACTOR: 0.48,
  /** 星区之间的最小间隙（× 星区半径） */
  REGION_MIN_GAP_FACTOR: 1.8,
  /** 松弛迭代次数 */
  REGION_RELAX_STEPS: 120,
  /** 区内航道：每个恒星系连最近的 K 个邻居 */
  LOCAL_LANE_K: 3,
  /** 星区相邻关系：每个星区取最近的 K 个星区 */
  REGION_NEIGHBOR_K: 3,
  /** 采样网格边长（64 个恒星系用 10×10，留出拒绝采样的富余） */
  SAMPLE_GRID: 10
} as const

/** 全局星区号 → 周目（1 起） */
export const cycleOfGalaxy = (galaxy: number): number =>
  Math.max(1, Math.ceil(galaxy / GALAXY_CONFIG.REGIONS_PER_CYCLE))

/** 全局星区号 → 该周目内的星区号（1 起） */
export const regionOfGalaxy = (galaxy: number): number =>
  ((Math.max(1, galaxy) - 1) % GALAXY_CONFIG.REGIONS_PER_CYCLE) + 1

/** (周目, 周目内星区号) → 全局星区号 */
export const galaxyOf = (cycle: number, region: number): number =>
  (Math.max(1, cycle) - 1) * GALAXY_CONFIG.REGIONS_PER_CYCLE + Math.max(1, region)

/** 是否是合法的全局星区号 */
export const isValidGalaxy = (galaxy: number): boolean =>
  Number.isInteger(galaxy) && galaxy >= 1 && galaxy <= MAX_GALAXY

/** 是否是合法的周目号 */
export const isValidCycle = (cycle: number): boolean =>
  Number.isInteger(cycle) && cycle >= 1 && cycle <= CYCLE_COUNT
