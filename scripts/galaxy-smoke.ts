/**
 * 星图生成器冒烟测试（P0）
 *
 * 验证：确定性、布局质量、连通性、路径规划、性能。
 */
import './node-shims'
import assert from 'node:assert/strict'

import { GALAXY_CONFIG, LAYOUT_CONFIG } from '@/config/galaxyConfig'
import { buildCycleLayout, clearLayoutCache, cycleLayoutSeed, getPlanetProfile } from '@/logic/galaxyGen'
import { distance, laneHops, planRoute } from '@/logic/hyperlaneLogic'
import { oreModifiers } from '@/logic/galaxyEconomyLogic'
import { generateOreDeposits } from '@/logic/oreDepositLogic'
import { depthAlpha, nodeRadius, projectPoint, regionDepth } from '@/logic/starMapCamera'
import { advanceMissionLeg, planMissionRoute, previewRoute, resolveDistance, shadowRatio } from '@/logic/fleetRouteLogic'
import { buildGateInfos, gatewaySystemOf } from '@/logic/gateLogic'
import { advanceGateControl, controlRateOf, createGateState } from '@/logic/gateCaptureLogic'
import { tickGatePhase } from '@/core/gatePhase'
import { computeRouteTolls } from '@/logic/tollLogic'
import { tickCaravans } from '@/logic/caravanLogic'
import { SIGNAL_CHANCE, signalOf } from '@/logic/signalLogic'
import { buildCycleRankings } from '@/logic/cycleRankingLogic'
import { buildSnapshot } from '@/core/protocol'
import { applyCycleJump, planCycleJump } from '@/logic/cycleLogic'
import { tickPlayerPhase as tickPlayerPhaseForTest } from '@/core/engine'
import { MissionType } from '@/types/game'
import { setRouteMode } from '@/config/routeMode'
import { diskDepth, fogAlpha, movedCamera, projectInView, spiralWarp } from '@/logic/galaxyFlight'
import { applyCommand, GALAXY_SCAN_COOLDOWN_MS } from '@/core/commands'
import { createWorld } from '@/core/world'
import * as gameLogic from '@/logic/gameLogic'
import * as planetLogic from '@/logic/planetLogic'
import { ShipType } from '@/types/game'
import type { EngineContext } from '@/core/types'
import type { CycleLayout } from '@/types/galaxy'

const SEED = 20261018

const allSystems = (layout: CycleLayout) => layout.regions.flatMap(region => region.systems)

const connectivity = (layout: CycleLayout): number => {
  const ids = allSystems(layout).map(system => system.id)
  const parent = new Map(ids.map(id => [id, id]))
  const find = (id: string): string => {
    let current = id
    while (parent.get(current) !== current) {
      parent.set(current, parent.get(parent.get(current)!)!)
      current = parent.get(current)!
    }
    return current
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const lane of [...layout.lanes, ...layout.gates]) union(lane.a, lane.b)
  return new Set(ids.map(find)).size
}

const main = async () => {
  clearLayoutCache()
  const layout = buildCycleLayout(cycleLayoutSeed(SEED, 1), 1)

  // 1) 规模
  assert.equal(layout.regions.length, GALAXY_CONFIG.REGIONS_PER_CYCLE, '星区数量不正确')
  for (const region of layout.regions) {
    assert.equal(region.systems.length, GALAXY_CONFIG.SYSTEMS_PER_REGION, `星区 ${region.region} 恒星系数量不正确`)
  }
  assert.equal(allSystems(layout).length, 1024)
  console.log(`[galaxy] 16 星区 × 64 恒星系 = 1024`)

  // 2) 确定性：同一 seed 两次构建完全一致
  const again = buildCycleLayout(cycleLayoutSeed(SEED, 1), 1, { noCache: true })
  const fingerprint = (value: CycleLayout) =>
    value.regions
      .map(region => region.systems.map(system => `${system.id}|${system.name}|${Math.round(system.coords.x)}|${Math.round(system.coords.y)}`).join(','))
      .join(';')
  assert.equal(fingerprint(layout), fingerprint(again), '同一 seed 两次构建结果不一致')
  const layout2 = buildCycleLayout(cycleLayoutSeed(SEED, 2), 2)
  assert.notEqual(fingerprint(layout), fingerprint(layout2), '不同周目应得到不同星图')
  console.log('[galaxy] 确定性：同 seed 一致，不同周目不同图')

  // 3) 布局质量：最小间距、区域边界、星区互不重叠
  let minSpacing = Infinity
  for (const region of layout.regions) {
    for (const system of region.systems) {
      assert.ok(distance(system.coords, region.center) <= LAYOUT_CONFIG.REGION_RADIUS, '恒星系越出星区边界')
      for (const other of region.systems) {
        if (other.id === system.id) continue
        minSpacing = Math.min(minSpacing, distance(system.coords, other.coords))
      }
    }
  }
  assert.ok(
    minSpacing >= LAYOUT_CONFIG.SYSTEM_MIN_SPACING * 0.85,
    `恒星系最小间距过小：${minSpacing.toFixed(1)}`
  )
  let minCenterGap = Infinity
  for (let i = 0; i < layout.regions.length; i += 1) {
    for (let j = i + 1; j < layout.regions.length; j += 1) {
      minCenterGap = Math.min(minCenterGap, distance(layout.regions[i]!.center, layout.regions[j]!.center))
    }
  }
  assert.ok(minCenterGap >= LAYOUT_CONFIG.REGION_RADIUS * 1.6, `星区中心过近：${minCenterGap.toFixed(0)}`)
  console.log(
    `[galaxy] 布局：最小间距 ${minSpacing.toFixed(0)}（下限 ${LAYOUT_CONFIG.SYSTEM_MIN_SPACING}）/ 星区最小中心距 ${minCenterGap.toFixed(0)}`
  )

  // 4) 连通性：全图一个连通分量
  assert.equal(connectivity(layout), 1, '星图存在不连通的孤岛')
  assert.ok(layout.lanes.length > 1024, `区内航道过少：${layout.lanes.length}`)
  assert.ok(layout.gates.length >= 15, `跨区星门过少：${layout.gates.length}`)
  console.log(`[galaxy] 连通：区内航道 ${layout.lanes.length} 条 / 星门 ${layout.gates.length} 座，连通分量 1`)

  // 5) 属性分布：经济与恒星类型都要覆盖全
  const economies = new Set(allSystems(layout).map(system => system.economy))
  const starClasses = new Set(allSystems(layout).map(system => system.starClass))
  assert.equal(economies.size, 6, '经济类型没有覆盖全')
  assert.equal(starClasses.size, 5, '恒星类型没有覆盖全')
  const withStation = allSystems(layout).filter(system => system.hasStation).length
  console.log(
    `[galaxy] 属性：经济 ${economies.size}/6 · 恒星 ${starClasses.size}/5 · 有空间站 ${withStation}/1024`
  )

  // 6) 路径规划：跨图可达 + 射程限制生效
  const start = layout.regions[0]!.systems[0]!
  const goal = layout.regions[15]!.systems[0]!
  const route = planRoute(layout.adjacency, start.id, goal.id)
  assert.ok(route && route.length > 0, '跨图路径规划失败')
  const totalLength = route!.reduce((sum, lane) => sum + lane.length, 0)
  const constrained = planRoute(layout.adjacency, start.id, goal.id, 1500)
  assert.ok(
    constrained === null || constrained.length >= route!.length,
    '射程限制没有生效'
  )
  console.log(
    `[galaxy] 路径：${start.id} → ${goal.id} 共 ${route!.length} 段 / ${(totalLength / 1024).toFixed(1)} 光年` +
      (constrained ? `，限射程后 ${constrained.length} 段` : '，限射程后不可达')
  )

  // 7) 行星档案：确定性 + 取值合法
  const profile = getPlanetProfile(layout.seed, 1, 3, 7, 2)
  const profileAgain = getPlanetProfile(layout.seed, 1, 3, 7, 2)
  assert.deepEqual(profile, profileAgain, '行星档案不确定')
  assert.ok(profile.orbitDistance > 0, '轨道距离不合法')
  console.log(`[galaxy] 行星档案示例：${profile.biome} / ${profile.resourceBias} / ${profile.hazard}`)

  // 8) 性能：4 个周目全量构建
  clearLayoutCache()
  const startedAt = performance.now()
  for (let cycle = 1; cycle <= 4; cycle += 1) {
    buildCycleLayout(cycleLayoutSeed(SEED, cycle), cycle, { noCache: true })
  }
  const elapsed = performance.now() - startedAt
  assert.ok(elapsed < 400, `构建 4 个周目耗时过长：${elapsed.toFixed(1)}ms`)
  console.log(`[galaxy] 性能：4 个周目 × 1024 恒星系 = ${elapsed.toFixed(1)}ms`)

  // 9) 经济修正：矿业星系的矿脉更高，且生成时生效
  const miningSystem = allSystems(layout).find(system => system.economy === 'mining')!
  const miningModifiers = oreModifiers(miningSystem, undefined)
  assert.ok(miningModifiers.metal > 1 && miningModifiers.crystal > 1, '矿业星系应提升金属/晶体矿脉')
  const biased = generateOreDeposits({ galaxy: 1, system: 1, position: 1 }, { metal: 1.2, crystal: 1, deuterium: 1 })
  const plain = generateOreDeposits({ galaxy: 1, system: 1, position: 1 })
  assert.ok(biased.metal > plain.metal, '矿脉修正没有生效')
  assert.deepEqual(biased.modifiers, { metal: 1.2, crystal: 1, deuterium: 1 })
  console.log(`[galaxy] 经济：矿业修正 metal×${miningModifiers.metal.toFixed(2)}，矿脉 ${plain.metal} → ${biased.metal}`)

  // 10) 航道跳数（传感器阵列射程）
  const sampleLane = layout.lanes[0]!
  assert.equal(laneHops(layout.adjacency, sampleLane.a, sampleLane.b, 1), 1, '相邻恒星系跳数应为 1')
  assert.equal(laneHops(layout.adjacency, sampleLane.a, sampleLane.a, 0), 0)
  const farHops = laneHops(layout.adjacency, sampleLane.a, goal.id, 2)
  assert.ok(farHops === Infinity || farHops <= 2, '跳数上限没有生效')
  console.log(`[galaxy] 跳数：相邻=1，跨图限 2 跳 → ${farHops === Infinity ? '不可达' : `${farHops} 跳`}`)

  // 11) 扫描 / 发现 / 命名
  const ctx = { t: Date.now(), emit: () => {} } as unknown as EngineContext
  const player = gameLogic.initializePlayer('p_scan', 'Scanner')
  const home = planetLogic.createInitialPlanet('p_scan', 'Test Home')
  home.position = { galaxy: 1, system: 1, position: 1 }
  home.fleet[ShipType.EspionageProbe] = 5
  home.resources.deuterium = 10_000
  player.planets = [home]

  const scanWorld = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: layout.seed
  })

  const homeSystemId = '1:1:1'
  const firstScan = applyCommand(scanWorld, ctx, { type: 'galaxy.scan', planetId: home.id, targetSystemId: homeSystemId })
  assert.equal(firstScan.ok, true, '扫描自己的恒星系应该成功')
  assert.equal(home.fleet[ShipType.EspionageProbe], 4, '扫描应消耗 1 个探测卫星')
  assert.ok(player.discoveredSystems?.[homeSystemId], '扫描后应记录发现')
  assert.equal(player.discoveredSystems![homeSystemId]!.scans, 1)

  const cooldownScan = applyCommand(scanWorld, ctx, { type: 'galaxy.scan', planetId: home.id, targetSystemId: homeSystemId })
  assert.equal(cooldownScan.ok === false && cooldownScan.reason === 'errors.scanCooldown', true, '冷却没有生效')

  // 跳过冷却后二次扫描 → 解锁行星明细
  player.discoveredSystems![homeSystemId]!.at = Date.now() - GALAXY_SCAN_COOLDOWN_MS - 1
  const secondScan = applyCommand(scanWorld, ctx, { type: 'galaxy.scan', planetId: home.id, targetSystemId: homeSystemId })
  assert.equal(secondScan.ok, true)
  assert.equal(secondScan.ok && secondScan.galaxyScan?.tier, 2, '二次扫描应解锁 tier 2')

  // 超出射程
  const farSystem = layout.regions[15]!.systems[0]!
  const farScan = applyCommand(scanWorld, ctx, { type: 'galaxy.scan', planetId: home.id, targetSystemId: farSystem.id })
  assert.equal(farScan.ok === false && farScan.reason === 'errors.scanOutOfRange', true, '超射程没有被拒绝')

  // 命名：首个发现者可命名
  const rename = applyCommand(scanWorld, ctx, { type: 'galaxy.rename', systemId: homeSystemId, name: 'My Haven' })
  assert.equal(rename.ok, true, '命名失败')
  assert.equal(player.discoveredSystems?.[homeSystemId]?.name, 'My Haven')
  assert.equal(player.discoveredSystems?.[homeSystemId]?.namedBy, 'p_scan')

  const tooShort = applyCommand(scanWorld, ctx, { type: 'galaxy.rename', systemId: homeSystemId, name: 'A' })
  assert.equal(tooShort.ok === false && tooShort.reason === 'errors.renameTooShort', true, '过短名称没有被拒绝')

  // 别人不能改这个名字
  const intruder = gameLogic.initializePlayer('p_other', 'Intruder')
  intruder.planets = [planetLogic.createInitialPlanet('p_other', 'Other Home')]
  intruder.discoveredSystems = { [homeSystemId]: { at: Date.now(), scans: 1 } }
  scanWorld.players = [player, intruder]
  scanWorld.player = intruder
  const stolen = applyCommand(scanWorld, ctx, { type: 'galaxy.rename', systemId: homeSystemId, name: 'Stolen' })
  assert.equal(stolen.ok === false && stolen.reason === 'errors.renameAlreadyNamed', true, '他人改名没有被拒绝')
  scanWorld.player = player

  console.log(`[galaxy] 扫描/命名：tier ${secondScan.ok ? secondScan.galaxyScan?.tier : '?'}，命名「${player.discoveredSystems?.[homeSystemId]?.name}」`)

  // 12) 3D 相机数学（V1 星图）
  const viewport = { width: 1000, height: 800, space: LAYOUT_CONFIG.SPACE }
  const camera = { yaw: 0.62, pitch: 0.34, distance: 3, focal: 2.6 }
  const screenCenter = projectPoint({ x: LAYOUT_CONFIG.SPACE / 2, y: LAYOUT_CONFIG.SPACE / 2, z: 0 }, camera, viewport)
  assert.ok(Math.abs(screenCenter.x - 500) < 1 && Math.abs(screenCenter.y - 400) < 1, '中心点没有投影到屏幕中心')

  const samplePoint = { x: LAYOUT_CONFIG.SPACE / 2 + 18000, y: LAYOUT_CONFIG.SPACE / 2 - 9000, z: 3000 }
  const viewA = projectPoint(samplePoint, camera, viewport)
  const viewB = projectPoint(samplePoint, { ...camera, yaw: 2.2 }, viewport)
  assert.ok(Number.isFinite(viewA.x) && Number.isFinite(viewA.y), '投影出现 NaN')
  assert.notEqual(viewA.x, viewB.x, '旋转后屏幕位置应改变（说明是真 3D）')
  assert.ok(nodeRadius(4, 3) < nodeRadius(3, 3), '远处节点应更小')
  assert.ok(depthAlpha(4, 3) < depthAlpha(3, 3), '远处节点应更暗')
  assert.equal(regionDepth(layout.seed, 3, 6000), regionDepth(layout.seed, 3, 6000), '区域深度不确定')
  console.log(`[galaxy] 3D：中心投影 (${screenCenter.x.toFixed(0)}, ${screenCenter.y.toFixed(0)})，旋转视差 Δx=${Math.abs(viewA.x - viewB.x).toFixed(0)}px`)

  // 13) 飞行相机（第一人称视图）
  const flightCam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }
  const flightView = { width: 1000, height: 800 }
  const frontPoint = projectInView({ x: 1000, y: 0, z: 0 }, flightCam, flightView)
  assert.ok(frontPoint && Math.abs(frontPoint.x - 500) < 1 && Math.abs(frontPoint.y - 400) < 1, '正前方应投影到屏幕中心')
  assert.equal(projectInView({ x: -1000, y: 0, z: 0 }, flightCam, flightView), null, '相机后方的点应被剔除')
  assert.ok(fogAlpha(0, 1000) > fogAlpha(500, 1000), '雾化应随距离递减')
  assert.equal(fogAlpha(1000, 1000), 0, '超出视距应完全不可见')

  const warped = spiralWarp(100, 0, 1000, 6)
  const before = Math.hypot(100 - 500, 0 - 500)
  const after = Math.hypot(warped.x - 500, warped.y - 500)
  assert.ok(Math.abs(before - after) < 1e-6, '旋臂扭曲不应改变半径')
  assert.equal(diskDepth(1, 'x', 5000), diskDepth(1, 'x', 5000), '盘面厚度不确定')
  const moved = movedCamera(flightCam, 100, 0, 0)
  assert.ok(moved.x > flightCam.x, '前进应改变位置')
  console.log(`[galaxy] 飞行：前方投影 (${frontPoint!.x.toFixed(0)}, ${frontPoint!.y.toFixed(0)})，雾化与剔除正常`)

  // 14) P4 影子模式：按航道算距离 vs 旧坐标公式
  const routeWorld = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: layout.seed
  })
  const routePairs = [
    [layout.regions[0]!.systems[0]!, layout.regions[0]!.systems[1]!],
    [layout.regions[0]!.systems[0]!, layout.regions[0]!.systems[30]!],
    [layout.regions[0]!.systems[0]!, layout.regions[7]!.systems[10]!],
    [layout.regions[0]!.systems[0]!, layout.regions[15]!.systems[0]!]
  ]
  const ratios: number[] = []
  for (const [a, b] of routePairs) {
    const preview = previewRoute(
      routeWorld,
      { galaxy: a.galaxy, system: a.index, position: 1 },
      { galaxy: b.galaxy, system: b.index, position: 1 }
    )
    assert.ok(preview.reachable, `航线不可达：${a.id} → ${b.id}`)
    const ratio = shadowRatio(preview)
    // 跨区会比旧公式短很多：旧公式把 galaxy 当"独立银河"（+20000/个），新模型是连续星图
    // 方案 C 下跨区比旧公式长 3~27 倍，这里只做"数量级合理"的兜底
    assert.ok(ratio !== null && ratio > 0.5 && ratio < 60, `比值异常：${ratio}`)
    ratios.push(ratio!)
    console.log(
      `[route] ${a.id}→${b.id} ${preview.hops} 段/${preview.gates} 星门 · 旧 ${Math.round(preview.legacyDistance)} · 线性 ${Math.round(preview.distance)} (×${ratio!.toFixed(2)}) · 含星门 ${Math.round(preview.distanceWithGatePenalty)} (×${(preview.distanceWithGatePenalty / preview.legacyDistance).toFixed(2)})`
    )
  }
  // 灰度开关：v2 生效 / legacy 回退
  const nearA = layout.regions[0]!.systems[0]!
  const nearB = layout.regions[0]!.systems[1]!
  const nearFrom = { galaxy: nearA.galaxy, system: nearA.index, position: 1 }
  const nearTo = { galaxy: nearB.galaxy, system: nearB.index, position: 1 }
  const legacyDistance = previewRoute(routeWorld, nearFrom, nearTo).legacyDistance

  setRouteMode('v2')
  const v2Distance = resolveDistance(routeWorld, nearFrom, nearTo)
  assert.ok(v2Distance > legacyDistance * 5, `v2 距离没有明显变长：${v2Distance} vs ${legacyDistance}`)

  setRouteMode('legacy')
  assert.equal(resolveDistance(routeWorld, nearFrom, nearTo), legacyDistance, '切回 legacy 后距离应还原')

  console.log(
    `[route] 灰度：相邻系 legacy ${Math.round(legacyDistance)} → v2 ${Math.round(v2Distance)}（约 ${Math.round((v2Distance * 50) / 12500 / 60)} 分钟）`
  )

  // 多段航线：跨区任务会被切成多段，逐段到达
  setRouteMode('v2')
  const farFrom = { galaxy: layout.regions[0]!.systems[0]!.galaxy, system: layout.regions[0]!.systems[0]!.index, position: 1 }
  const farTo = { galaxy: layout.regions[15]!.systems[0]!.galaxy, system: layout.regions[15]!.systems[0]!.index, position: 1 }
  const planned = planMissionRoute(routeWorld, farFrom, farTo, 12500, Date.now())
  assert.ok(planned && planned.legs.length > 1, '跨区任务应被切成多段')
  for (let i = 1; i < planned!.legs.length; i += 1) {
    assert.ok(planned!.legs[i]!.arriveAt > planned!.legs[i - 1]!.arriveAt, '航段到达时间应递增')
  }

  const fakeMission = {
    route: planned!.legs.map(leg => ({ arriveAt: leg.arriveAt })),
    routeIndex: 0,
    arrivalTime: planned!.legs[0]!.arriveAt
  }
  const firstArrive = fakeMission.arrivalTime
  assert.equal(advanceMissionLeg(fakeMission), true, '应推进到下一段')
  assert.ok(fakeMission.arrivalTime > firstArrive, '推进后到达时间应变晚')
  while (advanceMissionLeg(fakeMission)) {
    // 推进到最后一段
  }
  assert.equal(advanceMissionLeg(fakeMission), false, '最后一段不应再推进')

  const totalMinutes = Math.round((planned!.legs[planned!.legs.length - 1]!.arriveAt - Date.now()) / 60000)
  console.log(`[route] 多段：${planned!.legs.length} 段，总时长约 ${totalMinutes} 分钟`)
  setRouteMode('legacy')

  console.log(`[route] 影子对比：${ratios.length} 组样本，比值 ${Math.min(...ratios).toFixed(2)} ~ ${Math.max(...ratios).toFixed(2)}`)

  // 15) 星门归属（P5 只读模型）
  const gateInfos = buildGateInfos(layout)
  const gatewayIds = new Set(layout.gates.map(lane => gatewaySystemOf(lane)))
  assert.equal(Object.keys(gateInfos).length, gatewayIds.size, '星门归属表数量应等于星门恒星系数')
  for (const info of Object.values(gateInfos)) {
    assert.ok(gatewayIds.has(info.systemId), '星门归属表包含非星门恒星系')
    assert.ok(['neutral', 'miners_guild', 'deep_council', 'free_fleet', 'swarm'].includes(info.owner), '归属非法')
  }
  const neutral = Object.values(gateInfos).filter(info => info.owner === 'neutral').length
  const owned = Object.values(gateInfos).length - neutral
  assert.ok(neutral > 0 && owned > 0, '星门归属应有中立也有派系')
  assert.deepEqual(buildGateInfos(layout), gateInfos, '星门归属应确定性')
  console.log(`[gate] ${Object.keys(gateInfos).length} 座星门：中立 ${neutral} / 派系 ${owned}`)

  // 16) 星门占领：控制点推进与换手
  assert.equal(controlRateOf(10000), 1, '1 万战力应为 1 点/分钟')
  assert.equal(controlRateOf(0), 0)
  assert.equal(controlRateOf(999999), 6, '速率应封顶 6')

  const contested = createGateState('1:1:1')
  const attacker = [{ ownerId: 'p_attacker', power: 60000 }]
  let capturedBy: string | undefined
  for (let minute = 0; minute < 20 && !capturedBy; minute += 1) {
    capturedBy = advanceGateControl(contested, attacker, 60).capturedBy
  }
  assert.equal(capturedBy, 'p_attacker', '持续驻守应完成占领')
  assert.equal(contested.owner, 'p_attacker')
  assert.equal(contested.control, 0, '占领后控制点应清零')

  // 防守方更强时不会被推进
  const defended = createGateState('1:1:2', 'p_defender')
  const weak = [{ ownerId: 'p_weak', power: 5000 }, { ownerId: 'p_defender', power: 80000 }]
  for (let i = 0; i < 10; i += 1) advanceGateControl(defended, weak, 60)
  assert.equal(defended.owner, 'p_defender', '防守方优势时不应丢门')

  // 无人驻守衰减
  const idle = createGateState('1:1:3')
  idle.control = 20
  advanceGateControl(idle, [], 600)
  assert.ok(idle.control < 20, '无人驻守应衰减')
  console.log('[gate] 占领：6 点/分钟 → 约 17 分钟拿下；防守方优势时不丢门；闲置衰减正常')

  // 17) 星门相位：驻守舰队推进控制点并换手（接入 tick）
  const gateWorld = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: layout.seed
  })
  const gateLane = layout.gates[0]!
  const gateSystemId = gatewaySystemOf(gateLane)
  const [gateCycle, gateRegion, gateIndex] = gateSystemId.split(':').map(Number)

  player.fleetMissions.push({
    id: 'mission_garrison',
    playerId: player.id,
    originPlanetId: home.id,
    targetPosition: { galaxy: gateRegion!, system: gateIndex!, position: 1 },
    targetPlanetId: 'gate_target',
    missionType: MissionType.Station,
    fleet: { [ShipType.Cruiser]: 80000 } as never,
    cargo: { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 },
    departureTime: Date.now(),
    arrivalTime: Date.now(),
    status: 'outbound'
  } as never)

  let captured: { systemId: string; capturedBy: string } | undefined
  for (let minute = 0; minute < 25 && !captured; minute += 1) {
    captured = tickGatePhase(gateWorld, 60).find(item => item.systemId === gateSystemId)
  }
  assert.ok(captured, '驻守 25 分钟应完成占领')
  assert.equal(captured!.capturedBy, player.id)
  assert.equal(gateWorld.gates![gateSystemId]!.owner, player.id, '星门归属应切换给玩家')
  assert.equal((gateCycle ?? 1) >= 1, true)
  console.log(`[gate] 相位：驻守 ${gateSystemId} 约 25 分钟内完成占领`)

  // 18) 过路费：他国星门收费，自家/中立免费
  const tollWorld = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: layout.seed
  })
  tollWorld.gates = {
    [gateSystemId]: { systemId: gateSystemId, owner: 'p_other', control: 0, blockaded: false },
    '1:1:1': { systemId: '1:1:1', owner: 'neutral', control: 0, blockaded: false },
    '1:1:2': { systemId: '1:1:2', owner: player.id, control: 0, blockaded: false }
  }
  const tollLegs = [
    { systemId: gateSystemId, arriveAt: 0, distance: 1, gate: true },
    { systemId: '1:1:1', arriveAt: 0, distance: 1, gate: true },
    { systemId: '1:1:2', arriveAt: 0, distance: 1, gate: true }
  ]
  const tolls = computeRouteTolls(tollWorld, tollLegs, player.id)
  assert.ok(tolls.total > 0, '经过他国星门应收过路费')
  assert.equal(tolls.credits['p_other'], tolls.total, '过路费应归星门所有者')
  assert.equal(tolls.details.length, 1, '中立与自家星门不应收费')
  console.log(`[toll] 过路费：经过他国星门收 ${tolls.total} 重氢，中立/自家免费`)

  // 19) 封锁：所有星门封锁后跨区不可达，解封后恢复
  const blockadeWorld = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: layout.seed
  })
  const farA = { galaxy: layout.regions[0]!.systems[0]!.galaxy, system: layout.regions[0]!.systems[0]!.index, position: 1 }
  const farB = { galaxy: layout.regions[15]!.systems[0]!.galaxy, system: layout.regions[15]!.systems[0]!.index, position: 1 }

  assert.ok(planMissionRoute(blockadeWorld, farA, farB, 12500, Date.now()), '未封锁时应可达')

  blockadeWorld.gates = {}
  for (const systemId of gatewayIds) {
    blockadeWorld.gates[systemId] = { systemId, owner: 'neutral', control: 0, blockaded: true }
  }
  assert.equal(planMissionRoute(blockadeWorld, farA, farB, 12500, Date.now()), null, '全部星门封锁后跨区应不可达')
  assert.equal(previewRoute(blockadeWorld, farA, farB).reachable, false, 'previewRoute 也应尊重封锁')

  blockadeWorld.gates = {}
  assert.ok(planMissionRoute(blockadeWorld, farA, farB, 12500, Date.now()), '解封后应恢复')
  console.log('[gate] 封锁：全封后跨区不可达，解封后恢复')

  // 20) NPC 商队：到达后向星门所有者缴费
  const caravanWorld = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: layout.seed
  })
  const gateOwnerPlayer = gameLogic.initializePlayer('p_gate_owner', 'GateOwner')
  const ownerPlanet = planetLogic.createInitialPlanet('p_gate_owner', 'Owner Home')
  ownerPlanet.position = { galaxy: 2, system: 2, position: 2 }
  gateOwnerPlayer.planets = [ownerPlanet]
  caravanWorld.players = [player, gateOwnerPlayer]
  caravanWorld.gates = {
    [gateSystemId]: { systemId: gateSystemId, owner: 'p_gate_owner', control: 0, blockaded: false }
  }
  caravanWorld.caravans = [
    { id: 'c1', laneA: '1:1:1', laneB: gateSystemId, departAt: Date.now() - 5000, arriveAt: Date.now() - 1 }
  ]
  const caravanResult = tickCaravans(caravanWorld, Date.now())
  assert.equal(caravanResult.arrived, 1, '到期商队应结算')
  assert.ok((caravanResult.credits['p_gate_owner'] ?? 0) > 0, '商队应向星门所有者缴费')
  assert.equal(caravanWorld.caravans!.length, 0, '结算后的商队应移除')
  console.log(`[gate] 商队：1 支商队到达，星门所有者收到 ${caravanResult.credits['p_gate_owner']} 重氢`)

  // 21) 多周目跃迁：换周目、保科技、发补给
  const jumpWorld = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: layout.seed
  })
  player.technologies.astrophysics = 3
  jumpWorld.gates = { '1:1:1': { systemId: '1:1:1', owner: player.id, control: 50, blockaded: false } }
  const techBefore = { ...player.technologies }
  const jumpPlan = planCycleJump(jumpWorld, player)
  assert.ok(jumpPlan, '满足前置时应可跃迁')
  assert.equal(jumpPlan!.targetCycle, 2)

  const applied = applyCycleJump(jumpWorld, player)
  assert.ok(applied, '跃迁应执行')
  assert.equal(player.cycle, 2, '玩家周目应 +1')
  assert.equal(jumpWorld.cycle, 2, '世界周目应跟随')
  assert.equal(player.planets.length, 1, '旧帝国应拆掉，只留新家园')
  assert.equal(player.technologies.astrophysics, techBefore.astrophysics, '科技应保留')
  assert.ok(player.planets[0]!.resources.metal >= 50000, '应发放补给')

  const newGalaxy = player.planets[0]!.position.galaxy
  assert.ok(newGalaxy > 16, '第 2 周目的坐标应落在 17..32')
  console.log(`[cycle] 跃迁：第 1 周目 → 第 2 周目，新家园 ${player.planets[0]!.position.galaxy}:${player.planets[0]!.position.system}:${player.planets[0]!.position.position}`)

  // 22) galaxy.jump 命令：走命令层也能跃迁
  const cmdWorld = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 2,
    layoutSeed: layout.seed
  })
  player.technologies.astrophysics = 2
  cmdWorld.gates = { '1:1:1': { systemId: '1:1:1', owner: player.id, control: 50, blockaded: false } }
  const cycleBefore = player.cycle ?? 2
  const cmdCtx = { now: () => Date.now(), t: (key: string) => key, emit: () => {} } as never
  const cmdResult = applyCommand(cmdWorld, cmdCtx, { type: 'galaxy.jump' })
  assert.equal(cmdResult.ok, true, '命令应排定跃迁')
  assert.ok((player.cycleJumpAt ?? 0) > Date.now(), '应进入 24 小时倒计时')
  assert.equal(player.cycle, cycleBefore, '倒计时期间不换周目')

  // 倒计时结束：tick 执行
  const jumpTick = (player.cycleJumpAt ?? Date.now()) + 1000
  await tickPlayerPhaseForTest(cmdWorld, cmdCtx, jumpTick)
  assert.equal(player.cycleJumpAt, undefined, '执行后倒计时应清空')
  assert.equal(player.cycle, cycleBefore + 1, 'tick 应完成跃迁')
  console.log(`[cycle] 命令：倒计时结束，第 ${cycleBefore} → ${player.cycle} 周目`)

  // 23) 未知信号：确定性、稀有度、奖励与虫洞目标
  const allSystemIds = layout.regions.flatMap(region => region.systems.map(system => system.id))
  const signals = allSystemIds
    .map(systemId => signalOf(layout.seed, systemId, allSystemIds))
    .filter((signal): signal is NonNullable<typeof signal> => Boolean(signal))

  assert.ok(signals.length > 20, '信号数量过少')
  assert.ok(signals.length < allSystemIds.length * (SIGNAL_CHANCE + 0.05), '信号数量过多')
  assert.equal(
    signalOf(layout.seed, allSystemIds[0]!, allSystemIds)?.kind,
    signalOf(layout.seed, allSystemIds[0]!, allSystemIds)?.kind,
    '信号应确定性'
  )
  for (const signal of signals) {
    if (signal.kind === 'wormhole') {
      assert.ok(signal.targetSystemId && signal.targetSystemId !== signal.systemId, '虫洞目标非法')
    } else {
      assert.ok(signal.reward.metal + signal.reward.crystal + signal.reward.deuterium > 0, '奖励应为正')
    }
  }
  console.log(`[signal] ${signals.length}/${allSystemIds.length} 个恒星系存在未知信号`)

  // 24) signal.collect：发现后领取奖励、不可重复
  const collectible = signals.find(signal => signal.kind !== 'wormhole')
  assert.ok(collectible, '应存在可领取的残骸/遗迹信号')

  const signalWorld = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: layout.seed
  })
  player.discoveredSystems = { [collectible!.systemId]: { at: Date.now(), scans: 1 } } as never
  const metalBefore = player.planets[0]!.resources.metal
  const signalCtx = { now: () => Date.now(), t: (key: string) => key, emit: () => {} } as never

  const collectResult = applyCommand(signalWorld, signalCtx, { type: 'signal.collect', systemId: collectible!.systemId })
  assert.equal(collectResult.ok, true, '领取信号应成功')
  assert.ok(player.planets[0]!.resources.metal > metalBefore, '奖励应到账')

  const againResult = applyCommand(signalWorld, signalCtx, { type: 'signal.collect', systemId: collectible!.systemId })
  assert.equal(againResult.ok, false, '信号不可重复领取')

  const unknown = applyCommand(signalWorld, signalCtx, { type: 'signal.collect', systemId: '1:1:999' })
  assert.equal(unknown.ok, false, '未发现的恒星系不可领取')
  console.log(`[signal] 领取：${collectible!.systemId} 奖励到账，重复领取被拒绝`)

  // 25) 周目排行榜：按周目分组、按积分排序
  const rankPlayers = [
    { ...player, id: 'r1', name: 'A', cycle: 1, points: 100 },
    { ...player, id: 'r2', name: 'B', cycle: 1, points: 300 },
    { ...player, id: 'r3', name: 'C', cycle: 2, points: 50 }
  ] as never[]
  const rankings = buildCycleRankings(rankPlayers)
  assert.deepEqual(Object.keys(rankings).sort(), ['1', '2'])
  assert.equal(rankings[1]![0]!.playerId, 'r2', '第 1 周目榜首应为 B')
  assert.equal(rankings[1]![1]!.rank, 2)
  assert.equal(rankings[2]![0]!.playerId, 'r3', '第 2 周目应独立排名')
  console.log(`[cycle] 排行榜：第 1 周目 ${rankings[1]!.length} 人、第 2 周目 ${rankings[2]!.length} 人，互不影响`)

  // 26) signal.warp：虫洞侦察，发现目标星系并扣重氢
  const wormhole = signals.find(signal => signal.kind === 'wormhole' && signal.targetSystemId)
  assert.ok(wormhole, '应存在虫洞信号')

  const warpWorld = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: layout.seed
  })
  player.discoveredSystems = { [wormhole!.systemId]: { at: Date.now(), scans: 1 } } as never
  player.planets[0]!.resources.deuterium = 5000
  const duetBefore = player.planets[0]!.resources.deuterium
  const warpCtx = { now: () => Date.now(), t: (key: string) => key, emit: () => {} } as never

  const warpResult = applyCommand(warpWorld, warpCtx, { type: 'signal.warp', systemId: wormhole!.systemId })
  assert.equal(warpResult.ok, true, '虫洞穿越应成功')
  assert.ok(player.planets[0]!.resources.deuterium < duetBefore, '应扣除重氢')
  assert.ok(player.discoveredSystems?.[wormhole!.targetSystemId!], '应发现虫洞目标星系')

  const warpAgain = applyCommand(warpWorld, warpCtx, { type: 'signal.warp', systemId: wormhole!.systemId })
  assert.equal(warpAgain.ok, false, '虫洞不可重复使用')
  console.log(`[signal] 虫洞：穿越消耗重氢，发现目标 ${wormhole!.targetSystemId}`)

  // 27) 商队快照：协议层暴露给客户端
  const snapWorld = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: layout.seed
  })
  snapWorld.caravans = [{ id: 'c_snap', laneA: '1:1:1', laneB: '1:1:2', departAt: 1, arriveAt: 2 }]
  const snapshot = buildSnapshot(snapWorld, player)
  assert.equal(snapshot.caravans?.[0]?.fromSystemId, '1:1:1', '快照应包含商队起点')
  assert.equal(snapshot.caravans?.[0]?.toSystemId, '1:1:2', '快照应包含商队终点')
  console.log('[gate] 快照：商队已暴露给客户端')

  // 28) NPC 排行榜积分：公开视图下也必须非 0
  const fakeNpc = {
    id: 'npc_test_1',
    name: 'Test NPC',
    planets: [
      {
        id: 'npc_planet_1',
        name: 'N',
        ownerId: 'npc_test_1',
        position: { galaxy: 1, system: 2, position: 1 },
        buildings: { metalMine: 20, crystalMine: 20, solarPlant: 20 },
        fleet: { cruiser: 100 },
        defense: { rocketLauncher: 50 },
        technologies: {}
      }
    ],
    technologies: { energyTechnology: 5, combustionDrive: 5 },
    difficulty: 'easy'
  } as never

  const npcWorld = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [fakeNpc],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: layout.seed
  })
  const npcSnap = buildSnapshot(npcWorld, player)
  const npcEntry = npcSnap.npcs[0] as { scores?: { total: number }; planets: Array<{ buildings?: Record<string, number> }> }
  assert.ok((npcEntry.scores?.total ?? 0) > 0, 'NPC 排行榜积分应大于 0')
  assert.equal(npcEntry.planets[0]?.buildings?.metalMine ?? 0, 0, '公开视图仍应清空建筑')
  console.log(`[ranking] NPC 积分：${npcEntry.scores?.total}（公开视图建筑已清空）`)

  console.log('✅ 星图冒烟通过：规模 / 确定性 / 布局 / 连通 / 属性 / 路径 / 性能 / 经济 / 跳数 / 扫描命名 / 3D / 飞行 全部正常')
}

void main()
