/**
 * 满级账号集成测试
 *
 * 用 `applyMaxAccount` 拉满一个账号，然后跑一遍玩家最常走的链路：
 * 发现 → 命名 → 信号领取 → 星门占领 → 周目跃迁。
 */
import assert from 'node:assert/strict'
import { createWorld } from '@/core/world'
import { applyCommand } from '@/core/commands'
import { tickGatePhase } from '@/core/gatePhase'
import { tickPlayerPhase } from '@/core/engine'
import { applyMaxAccount } from '@/logic/devAccount'
import { buildCycleLayout } from '@/logic/galaxyGen'
import { signalOf } from '@/logic/signalLogic'
import { DEFAULT_LAYOUT_SEED, regionOfGalaxy } from '@/config/galaxyConfig'
import * as gameLogic from '@/logic/gameLogic'
import * as planetLogic from '@/logic/planetLogic'
import { BuildingType, MissionType, ObjectiveType, TechnologyType } from '@/types/game'
import { checkObjectiveProgress } from '@/logic/campaignLogic'
import type { Player } from '@/types/game'

const main = async () => {
  const player = gameLogic.initializePlayer('p_max', 'MaxTester')
  const planet = planetLogic.createInitialPlanet('p_max', 'Max Home')
  planet.position = { galaxy: 1, system: 1, position: 1 }
  player.planets = [planet]

  const world = createWorld({
    player,
    players: [player],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: DEFAULT_LAYOUT_SEED
  })
  const ctx = { now: () => Date.now(), t: (key: string) => key, emit: () => {} } as never

  // 1) 满级
  applyMaxAccount(player)
  assert.equal(planet.buildings?.[BuildingType.MetalMine], 40, '建筑应拉满')
  assert.equal(player.technologies[TechnologyType.Astrophysics], 25, '科技应拉满')
  assert.ok(planet.resources.metal >= 1_000_000_000, '资源应拉满')
  console.log('[max] 满级：建筑 40 / 科技 25 / 资源 10 亿')

  // 2) 发现 → 命名
  const layout = buildCycleLayout(DEFAULT_LAYOUT_SEED, 1)
  const target = layout.regions[3]!.systems[7]!
  player.discoveredSystems = { [target.id]: { at: Date.now(), scans: 2 } } as NonNullable<Player['discoveredSystems']>
  const renamed = applyCommand(world, ctx, { type: 'galaxy.rename', systemId: target.id, name: 'Test Haven' })
  assert.equal(renamed.ok, true, '命名应成功')
  assert.equal(player.discoveredSystems?.[target.id]?.name, 'Test Haven', '自定义名应写入发现记录')

  // 3) 2D 查找 id 与 3D 一致
  const twoDId = `${player.cycle}:${regionOfGalaxy(target.galaxy)}:${target.index}`
  assert.equal(twoDId, target.id, '2D 查表 id 应与 3D 一致')
  console.log(`[max] 命名同步：${twoDId} → Test Haven`)

  // 4) 信号领取
  const allIds = layout.regions.flatMap(region => region.systems.map(system => system.id))
  const signal = allIds
    .map(id => signalOf(layout.seed, id, allIds))
    .find(item => item && item.kind !== 'wormhole')
  assert.ok(signal, '应存在可领取信号')
  player.discoveredSystems![signal!.systemId] = { at: Date.now(), scans: 1 }
  const metalBefore = planet.resources.metal
  const collected = applyCommand(world, ctx, { type: 'signal.collect', systemId: signal!.systemId })
  assert.equal(collected.ok, true, '领取信号应成功')
  assert.ok(planet.resources.metal > metalBefore, '奖励应到账')
  console.log('[max] 信号：奖励到账')

  // 5) 星门占领
  const gateId = layout.gates[0]!.a < layout.gates[0]!.b ? layout.gates[0]!.a : layout.gates[0]!.b
  const [, gateRegion, gateIndex] = gateId.split(':').map(Number)
  player.fleetMissions.push({
    id: 'm_garrison',
    playerId: player.id,
    originPlanetId: planet.id,
    targetPosition: { galaxy: gateRegion!, system: gateIndex!, position: 1 },
    targetPlanetId: 'gate_target',
    missionType: MissionType.Station,
    fleet: { cruiser: 200000 } as never,
    cargo: { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, energy: 0 },
    departureTime: Date.now(),
    arrivalTime: Date.now(),
    status: 'outbound'
  } as never)

  let captured: { systemId: string; capturedBy: string } | undefined
  for (let minute = 0; minute < 25 && !captured; minute += 1) {
    captured = tickGatePhase(world, 60).find(item => item.systemId === gateId)
  }
  assert.ok(captured, '驻守应完成占领')
  assert.equal(world.gates?.[gateId]?.owner, player.id, '星门归属应切换')
  console.log(`[max] 星门：${gateId} 已占领`)

  // 6) 周目跃迁
  const cycleBefore = player.cycle ?? 1
  const jump = applyCommand(world, ctx, { type: 'galaxy.jump' })
  assert.equal(jump.ok, true, '跃迁应排定')
  assert.ok((player.cycleJumpAt ?? 0) > 0, '应进入倒计时')

  await tickPlayerPhase(world, ctx, (player.cycleJumpAt ?? 0) + 1000)
  assert.equal(player.cycle, cycleBefore + 1, '倒计时结束应换周目')
  assert.equal(player.planets.length, 1, '旧帝国拆除，保留新家园')
  console.log(`[max] 跃迁：第 ${cycleBefore} → ${player.cycle} 周目，新家园 ${player.planets[0]!.position.galaxy}:${player.planets[0]!.position.system}`)

  // 7) 战役新目标类型：星图相关进度可被正确统计
  const objective = (type: string, required = 1) => ({ id: `obj_${type}`, type, required }) as never
  assert.ok(checkObjectiveProgress(player, objective(ObjectiveType.ScanSystem, 1), []) >= 1, '扫描目标应完成')
  assert.ok(checkObjectiveProgress(player, objective(ObjectiveType.NameSystem, 1), []) >= 1, '命名目标应完成')
  assert.ok(checkObjectiveProgress(player, objective(ObjectiveType.CollectSignal, 1), []) >= 1, '信号目标应完成')
  assert.ok(
    checkObjectiveProgress(player, objective(ObjectiveType.CaptureGate, 1), [], { gates: world.gates }) >= 1,
    '星门目标应完成'
  )
  assert.ok(checkObjectiveProgress(player, objective(ObjectiveType.CycleJump, 1), []) >= 1, '跃迁目标应完成')
  console.log('[max] 战役目标：扫描 / 命名 / 信号 / 星门 / 跃迁 五种进度均可统计')

  console.log('✅ 满级账号集成测试通过：满级 / 命名 / 信号 / 星门 / 跃迁 全部正常')
}

void main()
