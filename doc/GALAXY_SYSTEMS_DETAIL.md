# 星系系统细节设计稿（玩法与结算）

> 本文承接 [GALAXY_REDESIGN.md](./GALAXY_REDESIGN.md)（总体方案）与
> [GALAXY_MAP_DESIGN.md](./GALAXY_MAP_DESIGN.md)（星图与航道几何），
> 聚焦**玩法结算**：多段航行、自由曲速、星门争夺、扫描发现、派系经济、世界事件。
> 界面与交互见 [GALAXY_UI_SPEC.md](./GALAXY_UI_SPEC.md)，
> 具体数值与 config 见 [GALAXY_BALANCE.md](./GALAXY_BALANCE.md)。

## 已定方向

| 决策 | 结论 |
|---|---|
| 多段航行 | **单任务多段**：一个 `FleetMission` 携带完整路径，逐段自动续飞 |
| 自由曲速 | **允许，但更贵**（时间 ×1.6、燃料 ×1.5、危险 +1） |
| 星门 | **可占领、可争夺**，可收过路费、可封锁 |
| 迁移 | 飞行中舰队**按新距离重算到达时间**（见 §9） |

---

## 1. 多段航行任务

### 1.1 数据结构

```ts
export interface RouteLeg {
  /** 到达的恒星系 id："3:27" */
  systemId: string
  /** 该段预计到达时间（绝对时间戳） */
  arriveAt: number
  /** 该段消耗的燃料（已在下单时预扣） */
  fuel: number
  /** local = 航道 / gate = 星门航道 / direct = 自由曲速 */
  lane: 'local' | 'gate' | 'direct'
}

export interface FleetMission {
  // …现有字段保持不变…
  /** 多段航行的完整去程路径；缺省或长度 ≤1 时按旧逻辑处理 */
  route?: RouteLeg[]
  /** 当前处在第几段（0-based，指向 route 中"下一站"） */
  routeIndex?: number
  /** 下单时预扣的总燃料（召回时按未走完的段退还） */
  fuelPrepaid?: number
}
```

**兼容原则**：没有 `route` 的任务 = 单段任务，`processMissionArrival` 与
`processMissionReturn` 的老分支完全不变。所有新逻辑都是「有 route 才走」。

### 1.2 状态机

```
outbound(第 i 段)
   │ now >= arrivalTime
   ▼
┌──────────────────────────────┐
│ i < route.length - 1 ?        │
│   是 → 停靠结算（见 1.3）      │
│        i++ ; arrivalTime = route[i].arriveAt
│        status 仍为 outbound    │
│   否 → 执行原任务逻辑（攻击/侦查/运输/殖民…）
│        status → returning
│        returnTime = now + 回程耗时(逆向路径)
└──────────────────────────────┘
```

- `arrivalTime` 语义：**当前段的到达时间**（对 UI 和现有倒计时完全兼容）
- `departureTime`：整体出发时间（不变）
- 每段之间**不再重新计算**，所有 `arriveAt` 在下单时一次算完并写入——避免服务端
  每段重算导致时间漂移，也让客户端可以本地倒计时

### 1.3 停靠点发生什么

| 行为 | 是否触发 |
|---|---|
| 补给（自动加满燃料？） | ❌ 不做，燃料已预扣 |
| 战斗拦截 | ⭕ 可选（P4 后），默认**不拦截**，只记录"经过" |
| 星系发现 | ✅ 经过的恒星系自动标记为「已发现（未扫描）」 |
| 任务报告 | ❌ 不生成（否则一次远航会刷 5 条报告） |
| 状态推送 | ✅ `patch.fleetMissions` 里的 `routeIndex` 变化 |

> 为什么默认不拦截：现有战斗结算假设"一次到达 = 一次战斗"，
> 中途拦截会让任务可能"半路死掉"，需要新的报告类型与 UI。
> 建议 P4 先做「不拦截」，把拦截作为 P5 的可选扩展。

### 1.4 燃料与召回

- **下单时一次性预扣**总燃料（`sum(route[].fuel)`），避免中途没油卡住
- 召回（`fleet.recall`）：
  - 只有当 `routeIndex === 0`（还没离开起点）时**全额退燃料**；
  - 否则按「未走完的段」比例退还，回程时间 = 已飞段的时间之和
  - `status → returning`，`returnTime = now + 已飞时长`
- 与现有 `recallFleetMission` 的兼容：无 `route` 时行为不变

### 1.5 回程

- 回程沿**逆向路径**逐段返回，不再重新规划（避免中途星门易主导致卡死）
- 每段时长按去程同段时长（对称），总 `returnTime` 一次算好
- 回程同样可在任一停靠点被"召回"吗？不——回程不可召回（与现有逻辑一致）

### 1.6 UI 表现

- 舰队列表：`第 2/4 段 → 抵达 3:27（预计 12:35）`，进度条按段划分
- 星图：选中舰队时高亮其剩余路径（虚线）
- 下达命令时：先显示规划结果（段数、总时间、总燃料、是否经过他国星门及过路费），
  玩家确认后才真正派遣

---

## 2. 自由曲速（直飞）

### 2.1 何时可用

- 目标距离 ≤ `maxJumpDistance`（曲速等级决定）
- 目标不在任何航道可达范围内，或玩家主动选择「直飞」

### 2.2 代价

| 项 | 系数 |
|---|---|
| 时间 | ×1.6 |
| 燃料 | ×1.5 |
| 危险度 | +1（遭遇事件概率提升） |

### 2.3 路线规划的两种模式

```ts
type RouteMode = 'auto' | 'direct'

// auto：沿航道 + 必要时自由段，目标是最小化「时间 + 危险」
// direct：能直飞就直飞，多段直飞时按最大跳跃距离切分
```

- `auto` 的图搜索边集 = 派生航道 + 按需生成的「自由边」（只在 `maxJumpDistance` 内）
- 自由边**不预先构建**（1024² 太贵），在 Dijkstra 松弛时按坐标距离动态判断
- 服务端在 `fleet.sendRoute` 中**重新计算路径**并要求与客户端提交的路径一致
  （允许"等价路径"，只校验每段长度 ≤ 上限、燃料总数对得上）

### 2.4 直飞的风险设计

- 直飞不经过任何恒星系 → **不触发"经过即发现"**
- 直飞的舰队在星图上显示为「深空航行」，不可被传感器阵列扫描（无星系可扫）
- 遭遇海盗/风暴事件的概率提高（与 `danger` 无关，固定 +1）

---

## 3. 星门与争夺

### 3.1 星门是什么

- 星门是**跨区航道的端点设施**，挂在某个恒星系上：

```ts
export interface GateState {
  systemId: string          // 所在恒星系
  ownerId?: string          // 归属：'neutral' | npc id | 玩家 id
  level: 1 | 2 | 3          // 等级：影响通行费、耐久、控制点产出
  control: number           // 0..100，控制进度
  blockaded: boolean        // 是否封锁
  toll: number              // 过路费（每人每次的固定重氢）
  durability: number        // 耐久，可被摧毁
  lastBattleAt?: number
}
```

- 世界创建时，部分星门默认由 NPC 派系控制，其余中立

### 3.2 控制权机制

```
每分钟结算（服务端 tick）：
  驻守方战力 P_hold  → control += f(P_hold)
  对方驻守战力 P_enemy → control -= f(P_enemy)
  control >= 100  → 归驻守方所有，control 重置为 0，广播事件
  control <= 0    → 变为中立（或归对方）
```

- **驻守**复用现有 `MissionType.Station`（驻守协防）任务：舰队停在星门所在的恒星系
- 星门本身有防御（复用 `DefenseType`），可被攻击掉耐久
- 耐久归零 → 星门失效（航道不可用），需要重建（消耗资源 + 时间）

### 3.3 所有权收益与代价

| 行为 | 效果 |
|---|---|
| 本方舰队通过 | 过路费减免 100%，时间 -10% |
| 他方舰队通过（未封锁） | 自动缴纳 `toll`（重氢），归星门所有者 |
| 封锁 | 该航道对他方不可用（自动规划绕行自由曲速） |
| 被占领 | 原所有者失去收益；控制权清空 |

> 封锁**不能完全锁死地图**：`auto` 规划会自动改用自由曲速绕行，
> 只是更慢更贵。这保证新玩家不会被堵死。

### 3.4 与现有系统的衔接

| 现有系统 | 用法 |
|---|---|
| `MissionType.Station` | 驻守星门 |
| 战斗结算 | 星门耐久归零/换手时的攻防战 |
| 传感器阵列 | 可扫描星门所在恒星系，看到驻守舰队 |
| 聊天/事件 | 星门易主时全服广播（`EngineEvent` + toast） |

---

## 4. 扫描与发现（细化）

### 4.1 扫描条件

```ts
interface ScanConfig {
  COST_PROBE: 1              // 每次消耗 1 个探测卫星
  COST_DEUTERIUM_PER_HOP: 25 // 按航道跳数计费
  RANGE_HOPS: 2 + Math.floor(astrophysics / 2)  // 以已发现恒星系为起点
  COOLDOWN_MS: 10 * 60 * 1000
  SECOND_SCAN_DISCOUNT: 0.5
}
```

- 扫描起点：玩家任意一颗星球所在的恒星系（作为"扫描基地"）
- 范围：从已发现恒星系出发的**航道跳数**，而不是直线距离（鼓励先探索近邻）
- 同一恒星系 10 分钟冷却；第二次扫描半价，解锁行星级细节

### 4.2 两级信息

| 级别 | 内容 |
|---|---|
| **L1 恒星系档案** | 名字、恒星类型、经济、繁荣度、危险度、派系、有无空间站、行星数量 |
| **L2 行星明细** | 每轨道的行星是否可殖民、地貌、所有者、矿脉概览（±20% 模糊） |

- L2 的矿脉数值是**模糊值**（真实值需间谍卫星侦查），避免扫描替代侦查
- 已殖民/已占领的行星信息以「公开信息」为准（名称、归属、防御等级粗估）

### 4.3 命名

- 首个完成 L1 扫描的玩家获得命名权
- 名称规则：2~16 字符，过滤控制字符与空白；不强制唯一（重名时 UI 标注发现者）
- 命名后可被管理员重置（GM 命令）

### 4.4 发现状态与联机

- `Player.discoveredSystems[systemId] = { at, scans, named? }`
- 服务端在 `patch.galaxy` 中只下发**已发现**的恒星系
- 未发现恒星系：只下发布局坐标（用于画迷雾），**零属性**
- 星门航道：一端发现即可见（作为探索目标）

---

## 5. 派系与星系控制

### 5.1 派系

```ts
export interface Faction {
  id: string
  name: string
  color: string
  kind: 'npc' | 'player'
  traits: { aggression: number; expansion: number; economy: number }
}
```

- 初始 4 个 NPC 派系（例：矿业联合会 / 深空议会 / 自由舰队 / 虫群）
- 每个派系控制若干恒星系与星门，形成动态边界
- NPC 派系的扩张由服务端低频模拟（每小时一次），不占用 tick

### 5.2 星系控制权

- `StarSystem.factionId` 决定：矿脉产出修正、NPC 守军强度、星门归属
- 控制权变更条件：该星系**所有有人星球 + 星门**都归同一方
- 失去全部星球 → 星系变中立（矿脉产出 -10%）

### 5.3 派系与现有 NPC 系统的关系

- 现有 `npc_*` 玩家（200 个）保留，作为**独立小势力**
- 新派系是它们的"上级"：同派系的 NPC 共享关系值（外交系统扩展）
- 为控制改动量，P0~P4 先只做「派系色 + 归属 + 少量加成」，P5 再做派系战争

---

## 6. 经济类型与行星差异

### 6.1 经济类型（作用于恒星系内所有行星）

| 经济 | 效果 |
|---|---|
| `mining` | 金属/晶体矿脉 +20% |
| `industrial` | 建筑与舰船造价 -8% |
| `tech` | 研究速度 +15% |
| `trade` | 燃料消耗 -10%、货舱容量 +10% |
| `agriculture` | 重氢产量 +15% |
| `military` | 舰船建造速度 +15%，危险度 +1 |

> 所有乘区默认上限 +20%，避免经济类型压过科技发展。

### 6.2 行星地貌（P5 生效）

| 地貌 | 限制 |
|---|---|
| `gas` | 不可殖民（只能采集） |
| `barren` | 可殖民，最大空间 -20% |
| `ocean` | 重氢 +10%，防御建筑造价 -5% |
| `lava` | 太阳能 +20%，建筑耐久 -10% |
| `frozen` | 重氢 -10%，研究 +5% |
| `toxic` | 人口/产能 -10%（若引入人口系统） |

P0~P3 只做地貌**展示**（图标 + 描述），不接加成。

### 6.3 繁荣度

- `wealth` 1/2/3 → 空间站贸易价格、NPC 舰队规模、星门过路费上限
- 与现有 `npcGrowthLogic` 的距离难度叠加，权重 0.2

---

## 7. 世界事件

```ts
export interface GalaxyEvent {
  id: string
  kind: 'pirateRaid' | 'ionStorm' | 'resourceRush' | 'gateLockdown'
  scope: { type: 'system' | 'region'; id: string }
  startsAt: number
  endsAt: number
  effects: Record<string, number>
}
```

| 事件 | 范围 | 效果 | 持续 |
|---|---|---|---|
| 海盗突袭 | 恒星系 | 危险度 +1，NPC 攻击频率 ×2 | 30 分钟 |
| 离子风暴 | 星区 | 曲速距离 -30%，扫描费用 ×2 | 20 分钟 |
| 资源热潮 | 恒星系 | 矿脉产出 +30% | 60 分钟 |
| 星门封锁 | 航道 | 该航道暂时不可用 | 60 分钟 |

- 事件由服务端定时器生成（每小时 1~2 个），随 `patch.galaxy` 下发
- 客户端在星图上用图标 + 光晕表现
- 事件不影响单机模式（单机可由本地定时器生成，或直接关闭）

---

## 8. 配置草案

```ts
export const GALAXY_CONFIG = {
  LAYOUT_VERSION: 1,
  SPACE: 65536,
  REGION_COUNT: 16,
  SYSTEMS_PER_REGION: 64,
  ORBITS_PER_SYSTEM: 10,
  REGION_RADIUS: 5200,
  SYSTEM_MIN_SPACING: 620,
  UNIT_PER_LY: 1024
} as const

export const WARP_CONFIG = {
  BASE_RANGE: 4000,
  RANGE_PER_LEVEL: 3000,
  DIRECT_TIME_MULTIPLIER: 1.6,
  DIRECT_FUEL_MULTIPLIER: 1.5,
  DIRECT_DANGER_BONUS: 1,
  LEG_OVERHEAD_SECONDS: 60,      // 每段固定充能时间
  FUEL_PER_UNIT: 0.00025,        // 每坐标单位燃料
  DISTANCE_SCALE: 0.35           // 接入现有 calculateDistance
} as const

export const GATE_CONFIG = {
  CONTROL_PER_MINUTE: 4,         // 满编驻守每分钟 +4 控制点
  MAX_CONTROL: 100,
  TOLL_PER_LEVEL: 200,           // 过路费（重氢）
  MAX_DURABILITY: 10000,
  REBUILD_COST: { metal: 200000, crystal: 200000, deuterium: 50000 }
} as const

export const SCAN_CONFIG = {
  COST_PROBE: 1,
  COST_DEUTERIUM_PER_HOP: 25,
  COOLDOWN_MS: 600_000,
  SECOND_SCAN_DISCOUNT: 0.5
} as const
```

---

## 9. 存档迁移补充

针对"飞行中的舰队"：

1. 迁移时遍历所有 `fleetMissions`，若 `route` 不存在 → 按新旧坐标计算距离
2. 用新公式重算 `arrivalTime = now + 剩余距离对应时间`
3. `route` 为空则视为单段任务（自由曲速）
4. 回程任务（`status === 'returning'`）同样重算 `returnTime`
5. 迁移完成后打一条日志：`[migration] 重算了 N 个飞行中任务`

---

## 10. 验收标准（可直接写进 smoke 测试）

| 功能 | 断言 |
|---|---|
| 多段航行 | 3 段任务在每段 `arriveAt` 触发一次状态推进，最终执行任务逻辑；段数与报告数 = 1 |
| 燃料 | 下单后燃料一次性扣除 = `sum(legs.fuel)`；召回退还未走段燃料 |
| 自由曲速 | 直飞时间 > 航道时间；距离超过单跳上限时拒绝派遣 |
| 路线校验 | 伪造路径长度（少报距离）被服务端拒绝 |
| 星门占领 | 驻守 N 分钟后控制点满，所有权切换并广播 |
| 星门收费 | 他国舰队通过后，所有者重氢增加、通行者减少 |
| 封锁绕行 | 封锁后 `auto` 规划产出不含该航道的路径 |
| 扫描 | 未发现恒星系属性不下发；扫描后 L1 可见，二次扫描 L2 可见 |
| 命名 | 非发现者改名被拒绝；发现者改名后全服可见 |
| 事件 | 海盗事件期间该星系 NPC 攻击频率提升（统计 ≥ 2 次） |

---

## 11. 已确认的边界

| 问题 | 结论 |
|---|---|
| 回程是否受星门封锁影响 | **不受**：沿原路返回，避免"回不了家" |
| 星门耐久归零 | **失效但可重建**，期间自动走自由曲速（不永久消失） |
| 自由曲速是否算"经过即发现" | **不算**：深空直飞不经过恒星系 |
| 派系是否参与星门争夺 | P5 再做；P0~P4 只做玩家 / NPC 小势力 |
| 星门封锁是否完全锁死地图 | **不会**：`auto` 规划自动改走自由曲速绕行 |
