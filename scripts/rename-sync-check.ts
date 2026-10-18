/**
 * 复现：联机模式下星球改名是否进入其他玩家的快照
 */
import assert from 'node:assert/strict'
import { createWorld } from '@/core/world'
import { applyCommand } from '@/core/commands'
import { buildSnapshot } from '@/core/protocol'
import * as gameLogic from '@/logic/gameLogic'
import * as planetLogic from '@/logic/planetLogic'
import { DEFAULT_LAYOUT_SEED } from '@/config/galaxyConfig'

const main = async () => {
  const a = gameLogic.initializePlayer('a', 'Alice')
  const pa = planetLogic.createInitialPlanet('a', 'Alice Home')
  pa.id = 'planet_a_1'
  pa.position = { galaxy: 1, system: 1, position: 1 }
  a.planets = [pa]

  const b = gameLogic.initializePlayer('b', 'Bob')
  const pb = planetLogic.createInitialPlanet('b', 'Bob Home')
  pb.id = 'planet_b_1'
  pb.position = { galaxy: 1, system: 2, position: 1 }
  b.planets = [pb]

  const world = createWorld({
    player: a,
    players: [a, b],
    planets: {},
    npcs: [],
    debrisFields: {},
    locale: 'zh-CN',
    cycle: 1,
    layoutSeed: DEFAULT_LAYOUT_SEED
  })
  const ctx = { now: () => Date.now(), t: (key: string) => key, emit: () => {} } as never

  const result = applyCommand(world, ctx, { type: 'planet.rename', planetId: 'planet_a_1', name: 'Renamed World' })
  console.log('命令结果:', JSON.stringify(result))
  console.log('A 的星球名:', a.planets[0]!.name)

  const snapA = buildSnapshot(world, a)
  console.log('A 自己快照里的名字:', snapA.self.planets[0]!.name)

  const snapB = buildSnapshot(world, b)
  const visible = Object.values(snapB.planets).map(p => `${p.id}=${p.name}`)
  console.log('B 看到的星球:', visible.join(', '))

  assert.equal(a.planets[0]!.name, 'Renamed World', '命令应改名')
  const seenByB = Object.values(snapB.planets).find(p => p.id === 'planet_a_1')
  assert.ok(seenByB, 'B 应能看到 A 的星球')
  assert.equal(seenByB!.name, 'Renamed World', 'B 应看到新名字')
  console.log('✅ 快照链路正常：改名对其他玩家可见')
}

void main()
