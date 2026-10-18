/**
 * 航道网络：区内 kNN 连边 + 跨区星门 + 路径规划
 *
 * 设计见 doc/GALAXY_MAP_DESIGN.md §4：
 * - 区内航道：每个恒星系连最近的 K 个邻居，再用并查集补连通；
 * - 跨区星门：星区相邻关系（kNN）里，每对取最近的一对恒星系连一条星门航道；
 * - 航道是**派生**的，不落盘，因此不需要存档、客户端也能本地算出来。
 */
import { LAYOUT_CONFIG } from '@/config/galaxyConfig'
import type { Hyperlane, Point, RegionLayout, StarSystem } from '@/types/galaxy'

/** 并查集（连通性修复用） */
class UnionFind {
  private readonly parent: number[]

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i)
  }

  find(value: number): number {
    let current = value
    while (this.parent[current] !== current) {
      this.parent[current] = this.parent[this.parent[current]!]!
      current = this.parent[current]!
    }
    return current
  }

  union(a: number, b: number): boolean {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA === rootB) return false
    this.parent[rootA] = rootB
    return true
  }
}

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)

const laneKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

const makeLane = (a: StarSystem, b: StarSystem, kind: Hyperlane['kind']): Hyperlane => ({
  a: a.id < b.id ? a.id : b.id,
  b: a.id < b.id ? b.id : a.id,
  length: distance(a.coords, b.coords),
  kind,
  danger: Math.max(a.danger, b.danger)
})

/**
 * 区内航道：kNN(K) + 并查集补连通
 */
export const buildLocalLanes = (systems: StarSystem[], k = LAYOUT_CONFIG.LOCAL_LANE_K): Hyperlane[] => {
  const lanes = new Map<string, Hyperlane>()

  const add = (a: StarSystem, b: StarSystem) => {
    const key = laneKey(a.id, b.id)
    if (!lanes.has(key)) lanes.set(key, makeLane(a, b, 'local'))
  }

  for (const system of systems) {
    const nearest = [...systems]
      .filter(other => other.id !== system.id)
      .sort((x, y) => distance(system.coords, x.coords) - distance(system.coords, y.coords))
      .slice(0, k)
    nearest.forEach(other => add(system, other))
  }

  // 连通性修复：找跨分量的最短边连起来
  const indexOf = new Map(systems.map((system, index) => [system.id, index]))
  const uf = new UnionFind(systems.length)
  for (const lane of lanes.values()) {
    const ia = indexOf.get(lane.a)
    const ib = indexOf.get(lane.b)
    if (ia !== undefined && ib !== undefined) uf.union(ia, ib)
  }

  const candidates: Array<{ length: number; a: StarSystem; b: StarSystem }> = []
  for (let i = 0; i < systems.length; i += 1) {
    for (let j = i + 1; j < systems.length; j += 1) {
      const a = systems[i]!
      const b = systems[j]!
      if (uf.find(i) === uf.find(j)) continue
      candidates.push({ length: distance(a.coords, b.coords), a, b })
    }
  }
  candidates.sort((x, y) => x.length - y.length)
  for (const candidate of candidates) {
    if (uf.union(indexOf.get(candidate.a.id)!, indexOf.get(candidate.b.id)!)) {
      add(candidate.a, candidate.b)
    }
  }

  return [...lanes.values()]
}

/**
 * 星区相邻关系：每个星区取最近的 K 个，再补连通
 */
export const buildRegionAdjacency = (centers: Point[], k = LAYOUT_CONFIG.REGION_NEIGHBOR_K): Array<[number, number]> => {
  const pairs = new Set<string>()
  const uf = new UnionFind(centers.length)

  const addPair = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (pairs.has(key)) return
    pairs.add(key)
    uf.union(a, b)
  }

  for (let i = 0; i < centers.length; i += 1) {
    const nearest = centers
      .map((point, index) => ({ index, dist: distance(centers[i]!, point) }))
      .filter(item => item.index !== i)
      .sort((x, y) => x.dist - y.dist)
      .slice(0, k)
    nearest.forEach(item => addPair(i, item.index))
  }

  // 连通性修复：按距离从小到大把还分开的星区连起来
  const candidates: Array<{ dist: number; a: number; b: number }> = []
  for (let i = 0; i < centers.length; i += 1) {
    for (let j = i + 1; j < centers.length; j += 1) {
      if (uf.find(i) === uf.find(j)) continue
      candidates.push({ dist: distance(centers[i]!, centers[j]!), a: i, b: j })
    }
  }
  candidates.sort((x, y) => x.dist - y.dist)
  for (const candidate of candidates) addPair(candidate.a, candidate.b)

  return [...pairs].map(key => {
    const [a, b] = key.split('-').map(Number)
    return [a!, b!] as [number, number]
  })
}

/**
 * 跨区星门：每对相邻星区取「最近的一对恒星系」连一条
 */
export const buildGateLanes = (
  regions: RegionLayout[],
  adjacency: Array<[number, number]>
): Hyperlane[] => {
  const gates: Hyperlane[] = []
  for (const [ai, bi] of adjacency) {
    const regionA = regions[ai]
    const regionB = regions[bi]
    if (!regionA || !regionB) continue

    let best: { length: number; a: StarSystem; b: StarSystem } | null = null
    for (const a of regionA.systems) {
      for (const b of regionB.systems) {
        const length = distance(a.coords, b.coords)
        if (!best || length < best.length) best = { length, a, b }
      }
    }
    if (best) gates.push(makeLane(best.a, best.b, 'gate'))
  }
  return gates
}

/** 构建邻接表 */
export const buildAdjacency = (lanes: Hyperlane[]): Map<string, Hyperlane[]> => {
  const adjacency = new Map<string, Hyperlane[]>()
  for (const lane of lanes) {
    if (!adjacency.has(lane.a)) adjacency.set(lane.a, [])
    if (!adjacency.has(lane.b)) adjacency.set(lane.b, [])
    adjacency.get(lane.a)!.push(lane)
    adjacency.get(lane.b)!.push(lane)
  }
  return adjacency
}

/**
 * 路径规划（Dijkstra，按长度）
 *
 * @param maxJump 单跳上限（曲速射程）；`Infinity` 表示不限制
 * @returns 依次经过的航道；不可达返回 null
 */
export const planRoute = (
  adjacency: Map<string, Hyperlane[]>,
  fromId: string,
  toId: string,
  maxJump = Number.POSITIVE_INFINITY,
  isBlocked?: (lane: Hyperlane) => boolean
): Hyperlane[] | null => {
  if (fromId === toId) return []
  const dist = new Map<string, number>([[fromId, 0]])
  const prev = new Map<string, { from: string; lane: Hyperlane }>()
  const visited = new Set<string>()
  const queue: Array<{ id: string; dist: number }> = [{ id: fromId, dist: 0 }]

  while (queue.length > 0) {
    queue.sort((a, b) => a.dist - b.dist)
    const current = queue.shift()!
    if (visited.has(current.id)) continue
    visited.add(current.id)
    if (current.id === toId) break

    for (const lane of adjacency.get(current.id) ?? []) {
      if (lane.length > maxJump) continue
      if (isBlocked?.(lane)) continue
      const next = lane.a === current.id ? lane.b : lane.a
      const nextDist = current.dist + lane.length
      if (nextDist < (dist.get(next) ?? Number.POSITIVE_INFINITY)) {
        dist.set(next, nextDist)
        prev.set(next, { from: current.id, lane })
        queue.push({ id: next, dist: nextDist })
      }
    }
  }

  if (!dist.has(toId)) return null

  const route: Hyperlane[] = []
  let cursor = toId
  while (cursor !== fromId) {
    const step = prev.get(cursor)
    if (!step) return null
    route.unshift(step.lane)
    cursor = step.from
  }
  return route
}

/**
 * 两恒星系之间的航道跳数（BFS，最多 maxHops 跳）
 * 用于传感器阵列射程等"按跳数"判定的场景；不可达返回 Infinity。
 */
export const laneHops = (
  adjacency: Map<string, Hyperlane[]>,
  fromId: string,
  toId: string,
  maxHops: number
): number => {
  if (fromId === toId) return 0
  const visited = new Set<string>([fromId])
  let frontier: string[] = [fromId]

  for (let hop = 1; hop <= maxHops; hop += 1) {
    const next: string[] = []
    for (const id of frontier) {
      for (const lane of adjacency.get(id) ?? []) {
        const other = lane.a === id ? lane.b : lane.a
        if (visited.has(other)) continue
        if (other === toId) return hop
        visited.add(other)
        next.push(other)
      }
    }
    frontier = next
    if (frontier.length === 0) break
  }
  return Number.POSITIVE_INFINITY
}
