/**
 * 3D 星图相机数学（纯函数，可单测）
 *
 * 设计要点：深度只用于渲染，不参与任何玩法计算。
 * 玩法距离仍然由 `hyperlaneLogic` 按平面坐标计算。
 */
import { mixSeed, mulberry32 } from '@/utils/random'

export interface CameraState {
  /** 偏航（弧度） */
  yaw: number
  /** 俯仰（弧度，限制 ±1.45） */
  pitch: number
  /** 相机到原点距离（归一化单位） */
  distance: number
  /** 焦距：越大越"长焦" */
  focal: number
}

export interface Viewport {
  width: number
  height: number
  /** 银河平面边长（LAYOUT_CONFIG.SPACE） */
  space: number
}

export interface Point3 {
  x: number
  y: number
  z: number
}

export interface ProjectedPoint {
  x: number
  y: number
  depth: number
}

/** 把世界坐标投影到屏幕坐标（中心为屏幕中心） */
export const projectPoint = (point: Point3, camera: CameraState, viewport: Viewport): ProjectedPoint => {
  const half = viewport.space / 2
  const nx = (point.x - half) / half
  const ny = (point.y - half) / half
  const nz = point.z / half

  const cosYaw = Math.cos(camera.yaw)
  const sinYaw = Math.sin(camera.yaw)
  const x1 = nx * cosYaw - nz * sinYaw
  const z1 = nx * sinYaw + nz * cosYaw

  const cosPitch = Math.cos(camera.pitch)
  const sinPitch = Math.sin(camera.pitch)
  const y2 = ny * cosPitch - z1 * sinPitch
  const z2 = ny * sinPitch + z1 * cosPitch

  const depth = Math.max(0.1, camera.distance + z2)
  const scale = camera.focal / depth

  return {
    x: viewport.width / 2 + x1 * scale * viewport.width * 0.5,
    y: viewport.height / 2 + y2 * scale * viewport.height * 0.5,
    depth
  }
}

/**
 * 每个星区的深度（确定性，只用于视觉层次）
 *
 * 用星区中心坐标做种子，保证同一张星图每次渲染的层次一致。
 */
export const regionDepth = (layoutSeed: number, region: number, range: number): number => {
  const rand = mulberry32(mixSeed(layoutSeed, region * 7919))
  return (rand() - 0.5) * 2 * range
}

/** 根据深度算节点半径（近大远小） */
export const nodeRadius = (depth: number, cameraDistance: number, base = 2.6): number =>
  Math.max(0.8, (base * cameraDistance) / depth)

/** 根据深度算透明度（远处更暗） */
export const depthAlpha = (depth: number, cameraDistance: number): number =>
  Math.max(0.22, Math.min(1, 1.25 - (depth - cameraDistance) * 0.45))
