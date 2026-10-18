# 星图与航线系统设计稿（空间化版本）

> 本文是 [GALAXY_REDESIGN.md](./GALAXY_REDESIGN.md) 的深化：把「网格坐标」升级为
> **自由布局的空间星图 + 跨区航道网络**，更接近《无人深空》的星图体验。
>
> 核心约束（不可破坏）：
> 1. 地址仍是 `galaxy:system:position`（30 个文件、约 480 处引用）；
> 2. 生成必须是确定性的纯函数（服务端权威、客户端可本地推演）；
> 3. 旧存档的每颗星球坐标继续有效。

---

## 1. 三层视图与两套坐标

```
银河平面（Galactic Plane，全局 float/int 坐标）
 ├─ Region 星区 × 16          ← 对应现有 galaxy 字段
 │   └─ Star System 恒星系 × 64   ← 对应现有 system 字段
 │       └─ Orbit 轨道 × 10       ← 对应现有 position 字段
 └─ Hyperlane 航道（图）：连接恒星系，可跨区
```

| 坐标 | 用途 | 是否落盘 |
|---|---|---|
| 地址 `galaxy:system:position` | 所有业务逻辑（星球、舰队、建筑） | ✅ 现有存档格式 |
| 星图坐标 `{x, y}` | 布局、距离、航线、渲染 | ❌ 由 `(layoutSeed, galaxy, system)` 推导 |
| 航线图 `edges` | 路径规划 | ❌ 由坐标 + 规则推导 |

**一句话**：地址是逻辑主键，坐标是视觉/距离投影。两者由确定性函数互相绑定，
换布局 = 换一个 `layoutVersion`，地址不变。

---

## 2. 坐标系与尺度

```ts
// src/config/galaxyConfig.ts
export const GALAXY_SPACE = 65536          // 银河平面边长（整数单位，避免浮点漂移）
export const REGION_COUNT = 16
export const SYSTEMS_PER_REGION = 64
export const ORBITS_PER_SYSTEM = 10
export const REGION_RADIUS = 5200          // 星区半径
export const SYSTEM_MIN_SPACING = 620      // 同区恒星系最小间距
export const UNIT_PER_LY = 1024            // 1 光年 ≈ 1024 坐标单位（仅用于 UI 换算）
```

尺度直觉：

| 距离 | 坐标单位 | ≈ 光年 | 曲速耗时（曲速 1 级，基准） |
|---|---|---|---|
| 同恒星系相邻轨道 | 5 × 轨道差 | — | 分钟级（沿用现有公式） |
| 同区相邻恒星系 | ~620 | 0.6 | ~8 分钟 |
| 同区对穿 | ~9000 | 8.8 | ~45 分钟 |
| 相邻星区 | ~12000~20000 | 12~20 | ~2 小时 |
| 星图两端 | ~60000 | 60 | ~8 小时 |

> UI 上再除以缩放系数显示为「光年」，玩家不需要看到内部单位。

---

## 3. 确定性布局算法

### 3.1 随机源

```ts
// 32 位确定性哈希 + xorshift，跨平台一致（不用 Math.random）
export const hash32 = (a: number, b: number, salt = 0x9e3779b9): number => {
  let h = (a * 374761393 + b * 668265263 + salt) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return (h ^ (h >>> 16)) >>> 0
}
export const rngFrom = (seed: number) => { /* mulberry32 */ }
```

### 3.2 星区中心（16 个点）

用**黄金角螺旋 + 半径抖动**铺满银河平面，保证分布均匀又不规则：

```
for i in 0..15:
  angle  = i * 2.39996323 + jitter(i)      // 黄金角
  radius = REGION_RADIUS * 1.9 * sqrt((i + 0.5) / 16) * (0.85 + 0.3 * rand(i))
  center = GALAXY_SPACE/2 + (cos(angle), sin(angle)) * radius
```

结果：16 个星区在平面上散开，间距大致均匀，但视觉上"自然"。

### 3.3 区域内恒星系（每区 64 个）

**网格拒绝采样**（比 Poisson-Disk 简单、确定性好、够用）：

```
grid = 8×8 单元格（边长 = REGION_RADIUS*2/8）
for cell in shuffled(grid):                  // 用 seed 打乱
  for attempt in 0..3:
    p = cell.center + (rand()*2-1) * cell.size * 0.45
    if distance(p, center) > REGION_RADIUS: continue
    if min distance to accepted < SYSTEM_MIN_SPACING: continue
    accept(p)
```

- 复杂度 O(n·k)，1024 个点 < 5ms；
- 固定 `layoutSeed` 下结果唯一；
- 若某区不足 64 个（极端种子），用螺旋补位保证不多不少。

### 3.4 恒星系属性

`StarSystem` 的属性全部由 `hash32(region, index, salt)` 推导：

```ts
starClass  = pick(['yellow','red','blue','green','white'], h1)
economy    = pick(['mining','industrial','tech','trade','agriculture','military'], h2)
wealth     = 1 + (h3 % 3)
danger     = 1 + (h4 % 3)
hasStation = (h5 % 100) < 35
```

### 3.5 行星属性

`getPlanetProfile(region, index, orbit)`：
- 地貌按恒星类型加权（红矮星更可能 frozen/desert，蓝星更可能 ocean/toxic）
- 资源偏向与星区经济联动（mining 区的行星 metal 偏向概率 +30%）
- `orbitDistance`：`orbit * 40 + hash % 20`（AU），用于星系内飞行时间

### 3.6 布局版本

```ts
export const LAYOUT_VERSION = 1
```

`ServerState.layout = { seed: number; version: number }`，在**世界创建时随机一次并落盘**。
客户端从 `welcome.snapshot` 拿到这对值，用同一份纯函数本地推演。
一旦某个世界创建，它的星图就固定了；要改布局只能开新世界（或写迁移）。

---

## 4. 航道网络（Hyperlane）

### 4.1 图的结构

```ts
export interface Hyperlane {
  a: string            // "3:27"
  b: string            // "3:41"
  length: number       // 坐标距离
  kind: 'local' | 'gate'   // 区内航道 / 跨区星门航道
  danger: number       // 1..3，来自两端星系的危险度
  // 可变字段（服务端落盘，可选）
  blockadedBy?: string // 被某个派系封锁
}
```

### 4.2 区内航道

1. 对每个恒星系，取**最近的 3 个邻居**建边（kNN）；
2. 用并查集检查连通性，若有孤立分量，用**最短跨分量边**连接（类似 Kruskal）；
3. 边的长度 = 欧氏距离；`kind = 'local'`。

结果：每区约 64×1.5 ≈ 96 条边，全图约 1500 条边。

### 4.3 跨区航道（星门）

1. 对 16 个星区中心做 **Delaunay 三角化**，得到相邻星区对（约 30~40 对）；
2. 每一对相邻星区，在两侧各取**距离对方中心最近的恒星系**，连一条边；
3. 该边标记 `kind = 'gate'`，两端恒星系标记 `isGateway = true`（星图上用特殊图标）。

> 为什么要有星门：跨区曲速如果完全自由，星图会变成"点谁飞谁"，
> 失去《无人深空》那种**沿着航线推进**的节奏。星门给了明确的战略节点（可争夺、可封锁）。

### 4.4 航线是"派生"的，不是"存储"的

- 边的集合由 `(layoutSeed, 坐标, 规则)` 确定性推导 → **不落盘**；
- 只有**可变状态**落盘：`blockadedBy`、玩家建造的额外航道、星门控制权；
- 好处：存档不膨胀（1500 条边约 150KB，省下来）；客户端能本地算出完整航线图。

### 4.5 预演结论（`scripts/galaxy_preview.py` 实测）

用 `SEED=20261018` 真实跑了一遍，结果：

| 指标 | Python 预演 | TypeScript 实现（`smoke:galaxy`） |
|---|---|---|
| 星区 / 恒星系 | 16 / 1024 | 16 / 1024 |
| 区内航道 | 1 867 条 | **1 822 条** |
| 跨区星门 | 29 座 | **30 座** |
| 连通分量 | 1 | 1 |
| 恒星系最小间距 | — | **622**（下限 620） |
| 星区最小中心距 | — | 9 494 |
| 示例跨图航线 | 28 段 · 38.6 光年 | **20 段 · 34.8 光年** |
| 构建耗时 | — | 约 40ms / 周目（1024 恒星系） |

**过程中修掉的问题**：最初用 8×8 网格采样，64 个格子装 64 个恒星系没有富余，
拒绝采样一旦失败就走"补位兜底"，最小间距掉到 434。改成 **10×10 网格**后
最小间距稳定在 622，航线也从 28 段降到 20 段。

**仍待调优**：kNN(3) 让航道偏稀疏，跨图航线 20 段仍偏曲折。
按 §4.5 的方案 2「主干航道」可以进一步缩短（P5）。

### 4.6 特殊情况

| 情况 | 处理 |
|---|---|
| 孤立恒星系 | 连通性修复保证至少 1 条边 |
| 两区重叠 | 松弛算法保证中心距 ≥ 2×REGION_RADIUS×0.9，云团允许轻微视觉重叠 |
| 星门被毁 | 只是 `blockadedBy` 清空/航线临时不可用，不改图结构 |
| 玩家建造航道 | 落盘为 `customLanes`，与派生航道合并 |

---

## 5. 旅行规则

### 5.1 三种移动

| 类型 | 适用 | 时间 | 燃料 |
|---|---|---|---|
| **亚光速** | 同恒星系内轨道间 | 沿用现有 `1000 + |Δorbit|*5` | 沿用现有 |
| **航道跳跃** | 沿 Hyperlane 一次跳一段 | 距离 × 系数 × 曲速等级 | 基础 + 距离 × 系数 |
| **自由曲速** | 不在航道上，直飞 | 距离 × 1.6 倍 | 距离 × 1.5 倍 |

自由曲速允许存在（NMS 也能自由飞），但**更贵更慢**，引导玩家走航道。

### 5.2 单跳上限（曲速等级）

```
maxJumpDistance = WARP_BASE + warpDriveLevel * WARP_PER_LEVEL
// 例：BASE 4000，每级 +3000 → 1 级 7000、3 级 13000
```

超过上限就必须**多段航行**（经停中间恒星系）。

### 5.3 多段航行的两种实现（**需要你拍板**）

| 方案 | 机制 | 优点 | 缺点 |
|---|---|---|---|
| **A. 单任务多段** | 一个 `FleetMission` 携带 `path: string[]`，每段到达时结算并继续 | 玩家体验连贯，一次操作 | 需要改任务结算（现有 task 假设一次到达） |
| **B. 逐段任务** | 每段生成一个独立任务，到达后玩家手动/自动派下一段 | 完全复用现有逻辑 | 操作繁琐，需要"自动续飞"开关 |

> 推荐 **A**，但把 `FleetMission` 扩展为 `path?: { to: string; arriveAt: number }[]`，
> 现有 `arrivalTime` 表示"下一段到达时间"，结算后 `path.shift()` 并重设 `arrivalTime`。
> 这样对现有 `processMissionArrival` 只是"多一个分支"。

### 5.4 路线规划（客户端可算，服务端校验）

- 图算法：**Dijkstra**，权重 = `length × fuelFactor × (1 + danger×0.1)`
- 输入：起点恒星系、终点恒星系、曲速等级
- 输出：`{ legs: [{from,to,length,fuel,time}], totalFuel, totalTime }`
- 客户端用于 UI 预览；服务端在 `fleet.send` 时**重新计算并校验**（防作弊：不能伪造路径长度）

```ts
// 新增命令
| { type: 'fleet.sendRoute'; originPlanetId: string; targetSystemId: string; fleet: Partial<Fleet>; cargo?: Resources; missionType: MissionType }
```

### 5.5 与现有距离公式的兼容

```
同轨道            → 5                        （不变）
同恒星系不同轨道   → 1000 + |Δorbit| * 5       （不变）
跨恒星系          → 2700 + routeDistance * SCALE  （新）
```

`SCALE` 需重新标定，建议先用 `0.35`（让相邻星系的飞行时间与现在"跨系统"接近），
再按 P4 的航程表微调。

---

## 6. 发现、迷雾与可见性

| 状态 | 玩家能看到 | 说明 |
|---|---|---|
| 未进入星区 | 区域轮廓 + 恒星系光点（无属性） | 星图有"未探索的诱惑" |
| 已扫描（scan 1 次） | 恒星系档案 + 是否存在行星 | 消耗探测器 |
| 已扫描（scan 2 次） | 行星类型/归属/矿脉 | 解锁殖民与攻击目标 |
| 已访问 | 全部 + 可命名 | 首次访问者可命名 |

- 航道可见性：**两端都发现**才显示航道；星门航道只要一端发现就显示（作为探索目标）。
- 服务端按 `Player.discoveredSystems` 过滤 `galaxy` 补丁字段。
- 未发现的恒星系坐标照常下发（否则星图画不出来），但**不下发任何属性**。

---

## 7. 星图 UI 设计

### 7.1 三级缩放

```
[银河视图] 16 个星区云团 + 星门连线      ← 缩放 0.02~0.1
    ↓ 点击星区
[区域视图] 64 个恒星系 + 区内航道         ← 缩放 0.2~1
    ↓ 点击恒星系
[星系视图] 恒星 + 10 条轨道 + 行星        ← 替换现有 GalaxyView 的槽位列表
```

### 7.2 视觉编码（沿用现有主题变量）

| 元素 | 编码 |
|---|---|
| 恒星系点 | 大小 = 行星数；颜色 = 经济类型（6 色调色板） |
| 描边 | 危险度（1 灰 / 2 橙 / 3 红） |
| 星门 | 菱形/环状图标 + 虚线航道 |
| 归属 | 派系色环 / 玩家头像点 |
| 迷雾 | 低透明度 + 问号 |
| 航线规划 | 黄色折线 + 每段悬浮显示「距离 / 燃料 / 时间」 |

### 7.3 交互

- 悬停：速览卡（名字、经济、危险、发现者）
- 单击：选中并显示右侧详情抽屉
- 双击/右键：设为航行目标 → 弹出「派遣舰队」对话框（复用现有 `FleetView` 的选择器）
- 过滤器：经济类型、危险度、派系、是否已发现、资源偏向
- 图例可折叠

### 7.4 渲染性能

- SVG 足够：1024 个点 + 1500 条线，视口裁剪后通常 < 200 个元素
- 缩放到区域级别时，区外节点不渲染
- 使用 `<g transform>` 做缩放/平移，避免重排

---

## 8. 服务端与协议增量

```ts
// ServerState 新增
layout: { seed: number; version: number }
systems: Record<string, StarSystem>        // 只存可变字段（名字/发现者/派系/星门状态）
customLanes?: Hyperlane[]                  // 玩家建造的航道（可选）

// Player 新增
discoveredSystems?: Record<string, { at: number; scans: number; named?: string }>

// 快照/补丁新增
galaxy: {
  layout: { seed: number; version: number }
  systems: Record<string, PublicSystem>    // 已发现的
  lanes?: Hyperlane[]                      // 已发现两端的
}
```

新命令：
- `galaxy.scan { systemId }` — 消耗探测器，`scans++`，返回新解锁的信息
- `galaxy.rename { systemId, name }` — 仅发现者可改名
- `fleet.sendRoute { originPlanetId, targetSystemId, ... }` — 服务端重算路径并校验

---

## 9. 存档与迁移

1. 世界创建时写入 `layout = { seed: random, version: LAYOUT_VERSION }`
2. 旧存档没有 `layout` → 迁移时补一个固定 seed（**所有旧世界用同一个 seed**，保证星图一致）
3. 旧坐标 `galaxy<=9, system<=10` 的恒星系按新算法**重新排布**到星图上：
   - 旧星球本身不受影响（地址不变）
   - 只是它在星图上的位置变了 → 需要一次性的「舰队任务时间重算」
4. 迁移时为每个玩家把母星系标为已发现
5. `targetPosition` 语义不变，旧任务继续可用

> 迁移的最大风险：**正在飞行中的舰队**。建议迁移时把所有飞行中任务的
> `arrivalTime` 按新距离公式重算一次，并把 `returnTime` 同步。

---

## 10. 性能与数据量

| 项 | 估算 |
|---|---|
| 恒星系元数据（1024 个，仅可变字段） | ~150 KB |
| 航道（派生，不落盘） | 0 |
| 星图 SVG 节点（区域视图） | 64 个/区，渲染 < 5ms |
| 路径规划（Dijkstra，1024 节点） | < 2ms |
| 布局生成（1024 点） | < 5ms（客户端首帧前完成） |

---

## 11. 分期（按本设计更新）

| 阶段 | 内容 | 人日 |
|---|---|---|
| **P0** | `galaxyConfig` + `galaxyGen`（布局/属性）+ 航道图生成 + 单测 + Node 可视化导出（输出 SVG 检查布局） | 3~4 |
| **P1** | 距离函数重写 + 路径规划 + `fleet.sendRoute` + 航程平衡表 | 4~5 |
| **P2** | 星图 UI（三级缩放 + 迷雾 + 航线预览） | 6~8 |
| **P3** | 扫描/发现/命名 + 协议 + 服务端落盘 + 迁移 | 4~5 |
| **P4** | 多段航行任务（方案 A）+ 拦截/补给点 | 4~6 |
| **P5** | 派系控制星门 / 玩家建造航道 / 空间站（可选） | 6~10 |

**核心 P0~P4 ≈ 21~28 人日（4~6 周）**。

> 建议先做 **P0 + 一个只读的 P2 原型**（约 8~10 人日）：
> 先看星图好不好看、点起来顺不顺手，再决定是否投入距离与航行改造。
> 这一步不碰任何现有平衡。

---

## 12. 已拍板的决策

| 问题 | 结论 | 落地位置 |
|---|---|---|
| 多段航行模型 | **单任务多段**（`FleetMission.route[]`） | [GALAXY_SYSTEMS_DETAIL.md §1](./GALAXY_SYSTEMS_DETAIL.md) |
| 自由曲速 | **允许，但时间 ×1.6 / 燃料 ×1.5 / 危险 +1** | 同上 §2 |
| 星门归属 | **可占领、可争夺、可收过路费、可封锁** | 同上 §3 |
| 迁移时飞行中的舰队 | **按新距离重算到达时间** | 同上 §9 |
| 周目（多周目宇宙） | **12 层共享层，可上可下，保留科技失去基地** | [GALAXY_CYCLES.md](./GALAXY_CYCLES.md) |

玩法细节（扫描分级、派系经济、世界事件、配置草案、验收断言）统一放在
[GALAXY_SYSTEMS_DETAIL.md](./GALAXY_SYSTEMS_DETAIL.md)。

---

## 13. 附录：核心函数签名草案

```ts
// src/logic/galaxyGen.ts
export const getSystemCoords = (layoutSeed: number, region: number, index: number): Point
export const getSystemMeta = (layoutSeed: number, region: number, index: number): StarSystem
export const getPlanetProfile = (layoutSeed: number, region: number, index: number, orbit: number): PlanetProfile
export const getRegionCenter = (layoutSeed: number, region: number): Point

// src/logic/hyperlaneLogic.ts
export const buildLaneGraph = (layoutSeed: number): Hyperlane[]
export const adjacency = (lanes: Hyperlane[]): Map<string, Array<{ to: string; lane: Hyperlane }>>
export const planRoute = (adj, from: string, to: string, warpLevel: number): RoutePlan | null
export const routeFuelAndTime = (plan: RoutePlan, warpLevel: number): { fuel: number; seconds: number }

// src/logic/galaxyDiscoveryLogic.ts
export const canScan = (player, system, now): { ok: boolean; reason?: string }
export const applyScan = (player, system): { unlocked: 'summary' | 'detail' }

// 复用/改造
// fleetLogic.calculateDistance(from, to) → 内部改为调用 planRoute/坐标距离
```
