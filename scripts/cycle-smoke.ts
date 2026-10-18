/**
 * 周目作用域冒烟测试
 *
 * 验证 P0 前置改造：全局星区号、周目过滤器、NPC id 规则。
 * 这些改造必须对现有行为零影响（第 1 周目）。
 */
import './node-shims'
import assert from 'node:assert/strict'

import { CYCLE_COUNT, MAX_GALAXY, cycleOfGalaxy, galaxyOf, regionOfGalaxy, isValidGalaxy } from '@/config/galaxyConfig'
import { npcIdOf, npcPlanetIdOf, cycleOfNpcId } from '@/core/ids'
import { allPlayers, collectAllPlanets, createWorld, findMissionTarget, positionKey } from '@/core/world'
import { buildSnapshot } from '@/core/protocol'
import { ensureNpcRegistry, updateNpcGrowth } from '@/core/npc'
import type { EngineContext } from '@/core/types'
import * as gameLogic from '@/logic/gameLogic'
import * as planetLogic from '@/logic/planetLogic'
import { generatePlanetName, generateCommanderName } from '@/logic/nameGenerator'
import { saveStorage } from '@/services/saveStorage'
import type { Planet, Player } from '@/types/game'

const makePlayer = (id: string, cycle: number, planetId: string): Player => {
  const player = gameLogic.initializePlayer(id, id)
  player.cycle = cycle
  player.planets = [
    planetLogic.createInitialPlanet(id, `${id}-home`)
  ]
  player.planets[0]!.id = planetId
  player.planets[0]!.position = { galaxy: galaxyOf(cycle, 1), system: 1, position: 1 }
  return player
}

const main = () => {
  // 1) 坐标换算
  assert.equal(cycleOfGalaxy(1), 1)
  assert.equal(cycleOfGalaxy(16), 1)
  assert.equal(cycleOfGalaxy(17), 2)
  assert.equal(cycleOfGalaxy(MAX_GALAXY), CYCLE_COUNT)
  assert.equal(regionOfGalaxy(17), 1)
  assert.equal(regionOfGalaxy(32), 16)
  assert.equal(galaxyOf(2, 1), 17)
  assert.equal(galaxyOf(12, 16), MAX_GALAXY)
  assert.ok(isValidGalaxy(1) && isValidGalaxy(MAX_GALAXY))
  assert.ok(!isValidGalaxy(0) && !isValidGalaxy(MAX_GALAXY + 1))
  console.log('[cycle] 全局星区号换算正确（1..192，12 周目 × 16 星区）')

  // 2) 旧存档兼容：galaxy 1..9 都属于第 1 周目
  for (let galaxy = 1; galaxy <= 9; galaxy += 1) {
    assert.equal(cycleOfGalaxy(galaxy), 1)
  }
  console.log('[cycle] 旧存档 galaxy 1..9 全部落在第 1 周目')

  // 3) NPC id 规则
  assert.equal(npcIdOf(1, 7), 'npc_7')
  assert.equal(npcIdOf(3, 7), 'npc_c3_7')
  assert.equal(npcPlanetIdOf(1, 7), 'npc_planet_7')
  assert.equal(npcPlanetIdOf(3, 7), 'npc_planet_c3_7')
  assert.equal(cycleOfNpcId('npc_7'), 1)
  assert.equal(cycleOfNpcId('npc_c3_7'), 3)
  assert.equal(cycleOfNpcId('npc_planet_c3_7'), 3)
  const firstCycleIds = new Set(Array.from({ length: 50 }, (_, i) => npcIdOf(1, i)))
  const thirdCycleIds = new Set(Array.from({ length: 50 }, (_, i) => npcIdOf(3, i)))
  assert.equal([...firstCycleIds].filter(id => thirdCycleIds.has(id)).length, 0)
  console.log('[cycle] NPC id 跨周目不冲突，旧格式可反解')

  // 4) 玩家过滤
  const alice = makePlayer('p_a', 1, 'planet_a')
  const bob = makePlayer('p_b', 2, 'planet_b')
  const world = createWorld({
    player: alice,
    players: [alice, bob],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1
  })

  assert.deepEqual(allPlayers(world).map(p => p.id), ['p_a'])
  world.cycle = 2
  world.player = bob
  assert.deepEqual(allPlayers(world).map(p => p.id), ['p_b'])
  console.log('[cycle] allPlayers 按周目过滤')

  // 5) 星球收集与任务目标不跨层
  const npcPlanet: Planet = planetLogic.createNPCPlanet(0, { galaxy: galaxyOf(2, 1), system: 1, position: 2 }, 'NPC', 2)
  world.planets[positionKey(npcPlanet.position)] = npcPlanet

  world.cycle = 1
  world.player = alice
  assert.equal(collectAllPlanets(world).some(p => p.id === npcPlanet.id), false, '第 1 层不应看到第 2 层的 NPC 星球')
  assert.equal(findMissionTarget(world, { targetPosition: npcPlanet.position }), undefined, '任务目标不应跨层解析')

  world.cycle = 2
  world.player = bob
  assert.equal(collectAllPlanets(world).some(p => p.id === npcPlanet.id), true, '第 2 层应看到自己的 NPC 星球')
  assert.equal(findMissionTarget(world, { targetPosition: npcPlanet.position })?.id, npcPlanet.id)
  console.log('[cycle] 星球收集与任务目标按周目隔离')

  // 6) 快照不跨层泄露
  world.cycle = 1
  world.player = alice
  const snapshotForAlice = buildSnapshot(world, alice)
  const leaked = Object.values(snapshotForAlice.planets ?? {}).some(planet => planet.ownerId === 'p_b')
  assert.equal(leaked, false, '快照泄露了其它周目的玩家星球')
  console.log('[cycle] 快照按周目过滤，无跨层泄露')

  // 7) 未设置 cycle 时行为与旧逻辑一致（单机兼容）
  const legacyWorld = createWorld({
    player: alice,
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN'
  })
  delete legacyWorld.cycle
  assert.deepEqual(allPlayers(legacyWorld).map(p => p.id), ['p_a'])
  assert.equal(collectAllPlanets(legacyWorld).length, 1)
  console.log('[cycle] 未设置 cycle 时保持旧行为')

  // 8) NPC 累加器按周目分开：第 1 层推进不会吃掉第 2 层的时间
  const ctx = { t: Date.now(), emit: () => {} } as unknown as EngineContext
  const accumWorld = createWorld({ player: alice, planets: {}, npcs: [], debrisFields: {}, locale: 'zh-CN', cycle: 2 })
  updateNpcGrowth(accumWorld, ctx, 1)
  assert.equal(accumWorld.npcGrowthAccum[2], 1, '第 2 层累加器没有增长')
  assert.equal(accumWorld.npcGrowthAccum[1], undefined, '第 1 层累加器被意外修改')
  accumWorld.cycle = 1
  updateNpcGrowth(accumWorld, ctx, 2)
  assert.equal(accumWorld.npcGrowthAccum[1], 2, '第 1 层累加器没有独立增长')
  assert.equal(accumWorld.npcGrowthAccum[2], 1, '第 2 层累加器被第 1 层覆盖')
  console.log('[cycle] NPC 累加器按周目独立，不会互相清零')

  // 9) NPC 注册表只包含当前周目的 NPC
  const registryWorld = createWorld({
    player: alice,
    players: [alice, bob],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 2
  })
  const cycle1NpcPlanet = planetLogic.createNPCPlanet(0, { galaxy: galaxyOf(1, 1), system: 2, position: 1 }, 'NPC', 1)
  const cycle2NpcPlanet = planetLogic.createNPCPlanet(0, { galaxy: galaxyOf(2, 1), system: 2, position: 1 }, 'NPC', 2)
  registryWorld.planets[positionKey(cycle1NpcPlanet.position)] = cycle1NpcPlanet
  registryWorld.planets[positionKey(cycle2NpcPlanet.position)] = cycle2NpcPlanet

  ensureNpcRegistry(registryWorld, ctx)
  assert.equal(registryWorld.npcs.length, 1, `注册表应只含 1 个 NPC，实际 ${registryWorld.npcs.length}`)
  assert.equal(registryWorld.npcs[0]!.id, cycle2NpcPlanet.ownerId, '注册表包含了其它周目的 NPC')
  console.log('[cycle] NPC 注册表按周目构建')

  // 10) 程序化命名：确定性、英文、不受语言影响
  const planetName = generatePlanetName('home:p_a')
  assert.equal(generatePlanetName('home:p_a'), planetName, '同名种子应得到同名')
  assert.match(planetName, /^[A-Za-z]+(-[0-9])? [A-Za-z]+$/, `行星名格式不正确：${planetName}`)
  const commander = generateCommanderName('npc_1')
  assert.match(commander, /^[A-Z][a-z]+ [A-Z][a-z]+$/, `NPC 名格式不正确：${commander}`)
  const unique = new Set(Array.from({ length: 200 }, (_, i) => generatePlanetName(`p:${i}`)))
  assert.ok(unique.size >= 180, `名字重复率过高：${unique.size}/200`)
  const npcPlanetName = planetLogic.createNPCPlanet(0, { galaxy: 1, system: 2, position: 3 }).name
  assert.match(npcPlanetName, /^[A-Za-z]+(-[0-9])? [A-Za-z]+$/, `NPC 星球名格式不正确：${npcPlanetName}`)
  console.log(`[name] 示例：${planetName} / ${commander} / ${npcPlanetName}（200 个名字里 ${unique.size} 个唯一）`)

  // 11) 存档层：没有 IndexedDB 时自动退回 localStorage（Node 冒烟走这条路径）
  saveStorage.setItem('smoke-key', 'v1')
  assert.equal(saveStorage.getItem('smoke-key'), 'v1', '存档层读写失败')
  saveStorage.removeItem('smoke-key')
  assert.equal(saveStorage.getItem('smoke-key'), null, '存档层删除失败')
  console.log('[save] 无 IndexedDB 环境自动回退 localStorage')

  console.log('✅ 周目作用域冒烟通过：坐标 / id / 过滤 / 隔离 / 兼容 / 累加器 / 命名 / 存档 全部正常')
}

main()
