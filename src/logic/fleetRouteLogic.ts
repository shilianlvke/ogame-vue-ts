/**
 * 航线距离（P4 影子模式）
 *
 * 目的：在**不改变现有飞行时间**的前提下，先把"按航道算距离"跑起来，
 * 与旧的坐标公式并行对比，确认偏差可控后再切换。
 *
 * 旧公式（fleetLogic.calculateDistance）：
 *   同位置 5 / 同恒星系 1000+ / 同星区 2700+|Δsystem|*95 / 跨星区 20000+|Δgalaxy|*20000
 *
 * 新公式（本文件）：
 *   同恒星系沿用旧公式；跨恒星系 = 2700 + 航线长度 * 20 + 星门数 * 120000（方案 C）
 */
import { getWorldLayout, systemIdAt } from '@/core/galaxyContext'
import { planRoute } from '@/logic/hyperlaneLogic'
import * as fleetLogic from '@/logic/fleetLogic'
import { getRouteMode } from '@/config/routeMode'
import { blockedGateSystems, gatewaySystemOf } from '@/logic/gateLogic'
import type { World } from '@/core/types'
import type { Position } from '@/types/game'

/** 跨恒星系基础距离（与旧公式对齐） */
export const CROSS_SYSTEM_BASE = 2700
/** 航线长度换算系数（标定用，见 doc/GALAXY_BALANCE.md） */
export const ROUTE_DISTANCE_SCALE = 20
/** 同恒星系基础距离 */
export const INTRA_SYSTEM_BASE = 1000
/** 每穿过一座星门的附加距离（跨区惩罚，避免"跨半张图只要 1 分钟"） */
export const CROSS_GATE_PENALTY = 120000

export interface RoutePreview {
  sameSystem: boolean
  reachable: boolean
  /** 经过几段航道 */
  hops: number
  /** 航线总长度（世界单位） */
  routeLength: number
  /** 新公式算出的距离（线性版，不可达为 Infinity） */
  distance: number
  /** 新公式 + 星门惩罚（推荐方案） */
  distanceWithGatePenalty: number
  /** 航线里穿过了几座星门 */
  gates: number
  /** 旧公式算出的距离 */
  legacyDistance: number
}

/**
 * 计算两个坐标之间的航线距离（影子模式，不影响实际任务）
 */
export const previewRoute = (world: World, from: Position, to: Position): RoutePreview => {
  const legacyDistance = fleetLogic.calculateDistance(from, to)
  const sameSystem = from.galaxy === to.galaxy && from.system === to.system

  if (sameSystem) {
    const distance =
      from.position === to.position ? 5 : INTRA_SYSTEM_BASE + Math.abs(to.position - from.position) * 5
    return {
      sameSystem: true,
      reachable: true,
      hops: 0,
      routeLength: 0,
      gates: 0,
      distance,
      distanceWithGatePenalty: distance,
      legacyDistance
    }
  }

  const layout = getWorldLayout(world)
  const blocked = blockedGateSystems(world.gates)
  const route = planRoute(
    layout.adjacency,
    systemIdAt(world, from),
    systemIdAt(world, to),
    Number.POSITIVE_INFINITY,
    lane => lane.kind === 'gate' && blocked.has(gatewaySystemOf(lane))
  )
  if (!route) {
    return {
      sameSystem: false,
      reachable: false,
      hops: 0,
      routeLength: 0,
      distance: Number.POSITIVE_INFINITY,
      distanceWithGatePenalty: Number.POSITIVE_INFINITY,
      gates: 0,
      legacyDistance
    }
  }

  const routeLength = route.reduce((sum, lane) => sum + lane.length, 0)
  const gates = route.filter(lane => lane.kind === 'gate').length
  const base = CROSS_SYSTEM_BASE + routeLength * ROUTE_DISTANCE_SCALE
  return {
    sameSystem: false,
    reachable: true,
    hops: route.length,
    routeLength,
    gates,
    distance: base,
    distanceWithGatePenalty: base + gates * CROSS_GATE_PENALTY,
    legacyDistance
  }
}

/**
 * 影子对比：返回新旧距离的比值（用于日志/冒烟断言）
 */
export const shadowRatio = (preview: RoutePreview): number | null => {
  if (!preview.reachable || preview.legacyDistance <= 0) return null
  return preview.distance / preview.legacyDistance
}


/**
 * 按当前口径解析两个坐标之间的距离。
 *
 * - legacy：旧坐标公式，行为与改动前完全一致；
 * - v2：按航道算（方案 C），不可达时回退旧公式。
 */
export const resolveDistance = (world: World, from: Position, to: Position): number => {
  if (getRouteMode() !== 'v2') return fleetLogic.calculateDistance(from, to)
  const preview = previewRoute(world, from, to)
  return preview.reachable ? preview.distanceWithGatePenalty : fleetLogic.calculateDistance(from, to)
}


export interface PlannedLeg {
  systemId: string
  arriveAt: number
  distance: number
  /** 这一段是否走的是跨区星门 */
  gate: boolean
}

/**
 * 为一次任务规划多段航线（仅 v2 模式使用）
 *
 * 每段距离 = 航道长度 × SCALE + 星门惩罚；最后一段补上跨系基础距离。
 */
export const planMissionRoute = (
  world: World,
  from: Position,
  to: Position,
  minSpeed: number,
  now: number
): { legs: PlannedLeg[]; totalDistance: number } | null => {
  const layout = getWorldLayout(world)
  const blocked = blockedGateSystems(world.gates)
  const isBlocked = (lane: { kind: string; a: string; b: string }) =>
    lane.kind === 'gate' && blocked.has(gatewaySystemOf(lane))
  const route = planRoute(layout.adjacency, systemIdAt(world, from), systemIdAt(world, to), Number.POSITIVE_INFINITY, isBlocked)
  if (!route || route.length === 0) return null

  const legs: PlannedLeg[] = []
  let elapsed = 0
  let totalDistance = 0
  route.forEach((lane, index) => {
    const legDistance =
      lane.length * ROUTE_DISTANCE_SCALE +
      (lane.kind === 'gate' ? CROSS_GATE_PENALTY : 0) +
      (index === route.length - 1 ? CROSS_SYSTEM_BASE : 0)
    totalDistance += legDistance
    // 用现有公式换算时间，保证与单段任务口径一致
    elapsed += fleetLogic.calculateFlightTime(legDistance, minSpeed)
    legs.push({
      systemId: lane.a === systemIdAt(world, from) ? lane.b : lane.a,
      arriveAt: now + elapsed * 1000,
      distance: legDistance,
      gate: lane.kind === 'gate'
    })
  })

  return { legs, totalDistance }
}

/**
 * 到达某一段的终点：若还有后续段，推进并返回 true（本次不做任务结算）
 */
export const advanceMissionLeg = (mission: { route?: { arriveAt: number }[]; routeIndex?: number; arrivalTime: number }): boolean => {
  if (!mission.route || mission.routeIndex === undefined) return false
  if (mission.routeIndex >= mission.route.length - 1) return false
  mission.routeIndex += 1
  mission.arrivalTime = mission.route[mission.routeIndex]!.arriveAt
  return true
}
