/**
 * 航线距离口径（灰度开关）
 *
 * legacy：沿用旧的坐标公式（默认，行为不变）
 * v2    ：按航道计算距离 + 星门惩罚（方案 C）
 *
 * 服务端通过 ROUTE_DISTANCE_MODE 环境变量设置；
 * 客户端通过 VITE_ROUTE_DISTANCE_MODE 构建变量设置。
 */
export type RouteDistanceMode = 'legacy' | 'v2'

let mode: RouteDistanceMode = 'legacy'

export const getRouteMode = (): RouteDistanceMode => mode

export const setRouteMode = (next: string | undefined): void => {
  mode = next === 'v2' ? 'v2' : 'legacy'
}

/** 客户端：从构建变量初始化（未设置则保持 legacy） */
export const initRouteModeFromEnv = (): void => {
  try {
    const raw = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ROUTE_DISTANCE_MODE
    if (raw) setRouteMode(raw)
  } catch {
    // 非 Vite 环境忽略
  }
}
