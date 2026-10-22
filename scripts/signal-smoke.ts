/**
 * 星图 POI（信号）冒烟测试
 *
 * 验证 §9.5 的静态地点：遗迹 / 残骸 / 贸易站 / 巢穴 / 虫洞。
 * 运行：pnpm run smoke:signal
 */
import assert from 'node:assert/strict'
import { createWorld } from '@/core/world'
import { createEngineContext } from '@/core/types'
import { applyCommand } from '@/core/commands'
import { getWorldLayout } from '@/core/galaxyContext'
import { signalOf, tradeBucketOf, TRADE_REFRESH_MS, type SignalKind } from '@/logic/signalLogic'
import * as gameLogic from '@/logic/gameLogic'
import * as planetLogic from '@/logic/planetLogic'
import { ShipType } from '@/types/game'
import type { EngineEvent } from '@/core/types'

const SEED = 20261018
const NOW = 1_700_000_000_000

const player = gameLogic.initializePlayer('poi-player', 'POI Tester')
const home = planetLogic.createInitialPlanet(player.id, 'Home')
player.planets = [home]

const world = createWorld({
  player,
  planets: {},
  debrisFields: {},
  locale: 'zh-CN',
  gameSpeed: 1,
  battleToFinish: true,
  layoutSeed: SEED
})

const events: EngineEvent[] = []
const ctx = createEngineContext({ t: (key: string) => key, emit: event => events.push(event), now: () => NOW })

const layout = getWorldLayout(world)
const allSystemIds = [...layout.systemIndex.keys()]

// ---------- 确定性 ----------
const first = signalOf(SEED, allSystemIds[0]!, allSystemIds, NOW, 1)
assert.deepEqual(signalOf(SEED, allSystemIds[0]!, allSystemIds, NOW, 1), first, '同一输入必须得到同一地点')
assert.equal(tradeBucketOf(NOW), tradeBucketOf(NOW + 1000), '6 小时批次内不变')
assert.equal(tradeBucketOf(NOW + TRADE_REFRESH_MS), tradeBucketOf(NOW) + 1, '跨过 6 小时后批次 +1')

// ---------- 收集各类型地点 ----------
const byKind = new Map<SignalKind, { systemId: string; signal: NonNullable<ReturnType<typeof signalOf>> }>()
for (const systemId of allSystemIds) {
  const signal = signalOf(SEED, systemId, allSystemIds, NOW, 1)
  if (signal && !byKind.has(signal.kind)) byKind.set(signal.kind, { systemId, signal })
}
for (const kind of ['derelict', 'ruin', 'tradingPost', 'lair', 'wormhole'] as SignalKind[]) {
  assert.ok(byKind.has(kind), `星图中应能生成 ${kind} 类型地点`)
}
console.log(`地点覆盖：${[...byKind.keys()].join(' / ')}`)

// 所有地点都标记为已发现，命令才能执行
for (const systemId of allSystemIds) {
  player.discoveredSystems ??= {}
  player.discoveredSystems[systemId] = { at: 0, scans: 2 }
}

// ---------- 遗迹：一次性回收 + 工厂材料事件 ----------
{
  const { systemId, signal } = byKind.get('ruin')!
  assert.equal(signal.kind, 'ruin')
  home.resources.metal = 0
  home.resources.crystal = 0
  home.resources.deuterium = 0
  events.length = 0

  const result = applyCommand(world, ctx, { type: 'signal.collect', systemId })
  assert.equal(result.ok, true, `遗迹回收应成功：${'reason' in result ? result.reason : ''}`)
  assert.ok(home.resources.metal > 0 && home.resources.crystal > 0, '遗迹应产出旧资源')
  const factoryEvent = events.find(event => event.kind === 'factoryMaterials')
  assert.ok(factoryEvent, '遗迹应产出工厂材料事件')
  if (factoryEvent?.kind === 'factoryMaterials') {
    assert.ok((factoryEvent.materials.rustAlloy ?? 0) >= 3, '遗迹应至少产出 3 个锈蚀合金')
  }

  const again = applyCommand(world, ctx, { type: 'signal.collect', systemId })
  assert.equal(again.ok, false, '遗迹只能回收一次')
}

// ---------- 贸易站：暗物质购买、同批次不能重复买同一商品位 ----------
{
  const { systemId, signal } = byKind.get('tradingPost')!
  assert.equal(signal.kind, 'tradingPost')
  assert.equal(signal.goods?.length, 3, '贸易站应有 3 个商品位')

  const good = signal.goods![0]!
  home.resources.darkMatter = good.price + 1000
  const before = home.resources[good.material]
  const result = applyCommand(world, ctx, { type: 'signal.trade', systemId, goodIndex: 0 })
  assert.equal(result.ok, true, '贸易站购买应成功')
  assert.equal(home.resources.darkMatter, 1000, '应按标价扣暗物质')
  assert.equal(home.resources[good.material], before + good.amount, '应获得商品')

  const again = applyCommand(world, ctx, { type: 'signal.trade', systemId, goodIndex: 0 })
  assert.equal(again.ok, false, '同批次同一商品位不能重复购买')

  const other = applyCommand(world, ctx, { type: 'signal.trade', systemId, goodIndex: 1 })
  assert.equal(other.ok, true, '同批次其他商品位仍可购买')
}

// ---------- 巢穴：战力不足失败，战力足够一次性通关 ----------
{
  const { systemId, signal } = byKind.get('lair')!
  assert.equal(signal.kind, 'lair')
  home.fleet = {} as typeof home.fleet
  home.defense = {} as typeof home.defense

  const weak = applyCommand(world, ctx, { type: 'signal.lair', systemId })
  assert.equal(weak.ok, false, '战力不足时巢穴挑战应失败')

  home.fleet[ShipType.LightFighter] = 1_000_000
  events.length = 0
  const strong = applyCommand(world, ctx, { type: 'signal.lair', systemId })
  assert.equal(strong.ok, true, `战力足够时巢穴挑战应成功：${'reason' in strong ? strong.reason : ''}`)
  assert.ok(home.resources.metal > 0, '巢穴应产出旧资源')
  assert.ok(events.some(event => event.kind === 'factoryMaterials'), '巢穴应产出工厂材料事件')
  assert.ok((home.fleet[ShipType.LightFighter] ?? 0) < 1_000_000, '巢穴战损应扣除舰船')

  const again = applyCommand(world, ctx, { type: 'signal.lair', systemId })
  assert.equal(again.ok, false, '巢穴只能通关一次')
}

// ---------- 虫洞：消耗重氢并发现目标星系 ----------
{
  const { systemId, signal } = byKind.get('wormhole')!
  assert.equal(signal.kind, 'wormhole')
  home.resources.deuterium = 5000
  const result = applyCommand(world, ctx, { type: 'signal.warp', systemId })
  assert.equal(result.ok, true, '虫洞跃迁应成功')
  assert.ok(signal.targetSystemId && player.discoveredSystems?.[signal.targetSystemId], '应发现虫洞目标星系')
  const again = applyCommand(world, ctx, { type: 'signal.warp', systemId })
  assert.equal(again.ok, false, '虫洞只能使用一次')
}

// ---------- 采集类命令不能误用在地点上 ----------
{
  const { systemId } = byKind.get('tradingPost')!
  const result = applyCommand(world, ctx, { type: 'signal.collect', systemId })
  assert.equal(result.ok, false, '贸易站不能被 signal.collect 回收')
}

console.log('✅ 星图 POI 冒烟测试通过')
