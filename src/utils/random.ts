/**
 * 确定性随机工具
 *
 * 星图、航道、名字都依赖它：同一个种子在任何环境（浏览器 / Node / 服务端）
 * 必须得到完全相同的结果，所以不能用 `Math.random()`。
 */

/** FNV-1a 字符串哈希（32 位） */
export const hashString = (value: string): number => {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** 由两个整数派生一个种子（用于 周目 + 星区 这类组合） */
export const mixSeed = (a: number, b: number): number => {
  let hash = (a ^ Math.imul(b, 0x9e3779b9)) >>> 0
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b) >>> 0
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35) >>> 0
  return (hash ^ (hash >>> 16)) >>> 0
}

/** mulberry32：小巧的确定性 PRNG */
export const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** [min, max] 闭区间整数 */
export const randInt = (rand: () => number, min: number, max: number): number =>
  min + Math.floor(rand() * (max - min + 1))

/** 从数组里按均匀分布取一个 */
export const pickFrom = <T>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)]!

/** 按权重取一个 key（权重不必归一化） */
export const pickWeighted = <T extends string>(rand: () => number, weights: Record<T, number>): T => {
  const entries = Object.entries(weights) as Array<[T, number]>
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = rand() * total
  for (const [key, weight] of entries) {
    roll -= weight
    if (roll <= 0) return key
  }
  return entries[entries.length - 1]![0]
}
