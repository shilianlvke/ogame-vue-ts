/**
 * 星图相关类型（多周目宇宙）
 */

/** 平面坐标（银河平面单位，见 GALAXY_CONFIG.SPACE） */
export interface Point {
  x: number
  y: number
}

export type StarClass = 'yellow' | 'red' | 'blue' | 'green' | 'white'

export type EconomyType = 'mining' | 'industrial' | 'tech' | 'trade' | 'agriculture' | 'military'

export type Biome = 'lush' | 'rocky' | 'ocean' | 'desert' | 'frozen' | 'toxic' | 'lava' | 'gas' | 'barren'

export type Hazard = 'none' | 'storm' | 'radiation' | 'extremeCold' | 'extremeHeat'

export type ResourceBias = 'metal' | 'crystal' | 'deuterium' | 'balanced' | 'darkMatter'

/** 恒星系（由种子确定性推导，不落盘） */
export interface StarSystem {
  /** 全局唯一 id：`${cycle}:${region}:${index}` */
  id: string
  cycle: number
  /** 星区号（1..16，周目内） */
  region: number
  /** 星区内的恒星系序号（1..64） */
  index: number
  /** 全局星区号 = (cycle-1)*16 + region */
  galaxy: number
  name: string
  starClass: StarClass
  economy: EconomyType
  /** 繁荣度 1..3 */
  wealth: 1 | 2 | 3
  /** 危险度 1..3 */
  danger: 1 | 2 | 3
  hasStation: boolean
  coords: Point
}

/** 行星档案（由种子推导，不落盘） */
export interface PlanetProfile {
  biome: Biome
  sizeClass: 1 | 2 | 3
  resourceBias: ResourceBias
  hazard: Hazard
  /** 轨道距离（AU），用于星系内飞行时间 */
  orbitDistance: number
}

/** 航道 */
export interface Hyperlane {
  /** 端点系统 id（字典序小者在前，用于去重） */
  a: string
  b: string
  length: number
  kind: 'local' | 'gate'
  /** 危险度：取两端系统的较大值 */
  danger: number
}

/** 一个星区的布局结果 */
export interface RegionLayout {
  region: number
  center: Point
  systems: StarSystem[]
}

/** 一个周目的完整布局（惰性构建 + 缓存） */
export interface CycleLayout {
  cycle: number
  seed: number
  regions: RegionLayout[]
  lanes: Hyperlane[]
  gates: Hyperlane[]
  /** 邻接表：systemId -> 相邻航道 */
  adjacency: Map<string, Hyperlane[]>
  systemIndex: Map<string, StarSystem>
}
