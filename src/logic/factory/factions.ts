import type { MaterialId } from '@/types/factory'

/**
 * 派系声望、深核议会蓝图与自由舰队事件，对应规划书 §9.3、§9.4。
 * 矿业公会声望存于市场状态，其余三条存于 store.factionRep。
 */

export type FactionId = 'minersGuild' | 'deepCouncil' | 'freeFleet' | 'rustSwarm'

/** 除矿业公会外的三条线（矿业公会声望存于 market.minersGuildRep） */
export const FACTION_OTHERS: FactionId[] = ['deepCouncil', 'freeFleet', 'rustSwarm']

export const FACTION_MAX = 1000

export function addRep(rep: number, delta: number): number {
  return Math.max(0, Math.min(FACTION_MAX, rep + delta))
}

export function halfRep(rep: number): number {
  return Math.floor(rep / 2)
}

/** 声望加成分母：满声望（1000）时加成 50% */
export const REP_BONUS_DIVISOR = 2000

// ---------- 深核议会蓝图 ----------
export const BLUEPRINT_BASE_PRICE = 2000
export const BLUEPRINT_TOTAL = 14
/** 暗物质消费每 500 点 +1 深核议会声望 */
export const COUNCIL_REP_PER_DARK_MATTER = 500

/** 破损蓝图单价：2000 暗物质 × (1 − 声望 / 2000) */
export function blueprintPrice(rep: number): number {
  return Math.max(1, Math.round(BLUEPRINT_BASE_PRICE * (1 - rep / 2000)))
}

// ---------- 自由舰队事件 ----------
export type FreeFleetEventType = 'caravan' | 'raid' | 'escort'

/** 活跃事件（挂机型，doneAt 后领取） */
export interface FreeFleetEvent {
  id: string
  type: FreeFleetEventType
  /** 完成世界时间（秒） */
  doneAt: number
  reward: Partial<Record<MaterialId, number>>
  repDelta: number
}

export const EVENT_MAX_ACTIVE = 3
/** 领取冷却（秒） */
export const EVENT_COOLDOWN_SECONDS = 30 * 60
/** 商队往返 40 分钟 */
export const CARAVAN_SECONDS = 40 * 60
/** 护航持续 2 小时 */
export const ESCORT_SECONDS = 2 * 3600

/** 事件报酬材料池（T1~T2） */
export const EVENT_MATERIALS: MaterialId[] = [
  'ironPlate',
  'copperPlate',
  'steel',
  'stoneBrick',
  'ironGear',
  'copperCable',
  'circuit',
  'pipe',
  'ironStick'
]

const EVENT_META: Record<FreeFleetEventType, { name: string; desc: string; duration: number; rep: number }> = {
  caravan: { name: '商队护送', desc: '护送商队往返，单程 20 分钟', duration: CARAVAN_SECONDS, rep: 5 },
  raid: { name: '劫掠', desc: '拦截敌对商队', duration: 0, rep: -20 },
  escort: { name: '护航委托', desc: '保护指定航线 2 小时', duration: ESCORT_SECONDS, rep: 10 }
}

export function eventMeta(type: FreeFleetEventType) {
  return EVENT_META[type]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** 生成事件报酬材料 */
function eventReward(type: FreeFleetEventType): Partial<Record<MaterialId, number>> {
  const mat = EVENT_MATERIALS[randInt(0, EVENT_MATERIALS.length - 1)]!
  if (type === 'caravan') return { [mat]: 5000 }
  if (type === 'raid') return { [mat]: randInt(3000, 8000) }
  return { [mat]: 2000 }
}

let eventSeq = 0
/** 创建活跃事件（raid 为即时，doneAt = 当前） */
export function createEvent(type: FreeFleetEventType, now: number): FreeFleetEvent {
  eventSeq += 1
  const meta = EVENT_META[type]
  return {
    id: `ev${now.toString(36)}${eventSeq.toString(36)}`,
    type,
    doneAt: now + meta.duration,
    reward: eventReward(type),
    repDelta: meta.rep
  }
}

/** 战斗舰集合（领取劫掠/商队需有舰队） */
export const COMBAT_SHIPS = ['轻型战斗机', '重型战斗机', '巡洋舰', '战列舰', '战列巡洋舰', '轰炸机', '驱逐舰']

/** 是否有战斗舰 */
export function hasCombatShip(ships: Record<string, number>): boolean {
  return COMBAT_SHIPS.some(name => (ships[name] ?? 0) >= 1)
}
