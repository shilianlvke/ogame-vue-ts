/**
 * 3D 飞行视图的数学（纯函数，可单测）
 *
 * 与 `starMapCamera.ts` 的区别：
 * - 那边是"外部俯视"相机（绕原点旋转）；
 * - 这边是"第一人称飞行"相机（位于宇宙内部，有视距上限与雾化）。
 *
 * 深度/旋臂扭曲**只影响视觉**，玩法距离仍按平面坐标计算。
 */
import { hashString, mulberry32 } from '@/utils/random'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface FlightCamera extends Vec3 {
  /** 朝向角（绕 Z 轴，弧度） */
  yaw: number
  /** 俯仰（弧度，正值抬头） */
  pitch: number
}

export interface Viewport {
  width: number
  height: number
}

export interface ProjectedPoint {
  x: number
  y: number
  /** 相机坐标系下的前向距离（用于排序与透视） */
  depth: number
  /** 到相机的三维距离（用于雾化） */
  distance: number
}

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z

/** 相机基向量：前 / 右 / 上 */
export const viewBasis = (yaw: number, pitch: number): { forward: Vec3; right: Vec3; up: Vec3 } => {
  const cosPitch = Math.cos(pitch)
  const sinPitch = Math.sin(pitch)
  const forward: Vec3 = {
    x: cosPitch * Math.cos(yaw),
    y: cosPitch * Math.sin(yaw),
    z: sinPitch
  }
  const right: Vec3 = { x: -Math.sin(yaw), y: Math.cos(yaw), z: 0 }
  const up: Vec3 = {
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x
  }
  return { forward, right, up }
}

/** 缓存最近一次相机基向量：同一帧内几百次投影只算一次三角函数 */
let cachedBasisKey = ''
let cachedBasis = viewBasis(0, 0)

const basisFor = (yaw: number, pitch: number): { forward: Vec3; right: Vec3; up: Vec3 } => {
  const key = `${yaw}|${pitch}`
  if (key !== cachedBasisKey) {
    cachedBasisKey = key
    cachedBasis = viewBasis(yaw, pitch)
  }
  return cachedBasis
}

/**
 * 把世界坐标投影到屏幕；在相机后方返回 null
 *
 * @param tanHalfFov 视野半角的正切（0.7 ≈ 70° FOV）
 */
export const projectInView = (
  point: Vec3,
  camera: FlightCamera,
  viewport: Viewport,
  tanHalfFov = 0.7
): ProjectedPoint | null => {
  const { forward, right, up } = basisFor(camera.yaw, camera.pitch)
  const delta: Vec3 = { x: point.x - camera.x, y: point.y - camera.y, z: point.z - camera.z }

  const depth = dot(delta, forward)
  if (depth <= 1) return null

  const vx = dot(delta, right)
  const vy = dot(delta, up)

  return {
    x: viewport.width / 2 + (vx / depth / tanHalfFov) * (viewport.width / 2),
    y: viewport.height / 2 - (vy / depth / tanHalfFov) * (viewport.height / 2),
    depth,
    distance: Math.hypot(delta.x, delta.y, delta.z)
  }
}

/**
 * 视距雾化：超出 viewRadius 完全不可见，近处清晰
 *
 * 用 1.2 次幂让"渐隐"更自然（不是线性变暗）。
 */
export const fogAlpha = (distance: number, viewRadius: number): number => {
  if (distance >= viewRadius) return 0
  const t = distance / viewRadius
  return Math.max(0, 1 - Math.pow(t, 1.2))
}

/** 背景星点（世界坐标，飞行时有视差） */
export const buildBackdropStars = (count: number, radius: number, seed = 1): Array<Vec3 & { size: number }> => {
  const rand = mulberry32(seed)
  const stars: Array<Vec3 & { size: number }> = []
  for (let i = 0; i < count; i += 1) {
    // 球壳采样，避免全挤在中心
    const theta = rand() * Math.PI * 2
    const phi = Math.acos(2 * rand() - 1)
    const r = radius * (0.6 + rand() * 0.4)
    stars.push({
      x: Math.cos(theta) * Math.sin(phi) * r,
      y: Math.sin(theta) * Math.sin(phi) * r,
      z: Math.cos(phi) * r,
      size: 0.6 + rand() * 1.4
    })
  }
  return stars
}

/**
 * 旋臂扭曲：把"散落的星区"拧成旋臂
 *
 * 对每个点绕银河中心旋转，旋转角与半径成正比 —— 这是把盘星系
 * 变成旋臂最省事的做法，且保持相对结构（不会打乱远近关系）。
 *
 * @param twist 半径从 0 到 space/2 时累计的旋转角（弧度），建议 5~8
 */
export const spiralWarp = (x: number, y: number, space: number, twist: number): { x: number; y: number } => {
  const center = space / 2
  const dx = x - center
  const dy = y - center
  const radius = Math.hypot(dx, dy)
  const angle = Math.atan2(dy, dx) + (radius / (space / 2)) * twist
  return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius }
}

/**
 * 盘面厚度：靠近银心更厚（核球），外围更薄
 *
 * @returns z 偏移（世界单位）
 */
export const diskDepth = (seed: number, key: string, radiusFromCenter: number, maxRadius = 26000): number => {
  const rand = mulberry32(hashString(`${seed}:${key}`))
  // 近似高斯：4 个均匀分布求和 - 2，范围约 [-2, 2]
  const gauss = (rand() + rand() + rand() + rand() - 2) / 2
  const bulge = Math.max(0, 1 - radiusFromCenter / maxRadius)
  const thickness = 420 + 1800 * bulge * bulge
  return gauss * thickness
}

/** 相机移动：按朝向（以及可选垂直方向）前进 */
export const movedCamera = (
  camera: FlightCamera,
  forwardAmount: number,
  strafeAmount: number,
  verticalAmount: number
): FlightCamera => {
  const { forward, right } = viewBasis(camera.yaw, camera.pitch)
  return {
    ...camera,
    x: camera.x + forward.x * forwardAmount + right.x * strafeAmount,
    y: camera.y + forward.y * forwardAmount + right.y * strafeAmount,
    z: camera.z + forward.z * forwardAmount + verticalAmount
  }
}
