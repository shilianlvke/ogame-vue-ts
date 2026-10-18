# 星系系统改造方案（无人深空风格）

> 目标：把当前「9×10×10 的网格坐标 + 随机 NPC 占位」改造成
> 「程序化星区 → 恒星系 → 多行星」的可探索宇宙，借用《无人深空》的核心体验，
> 同时**不推翻**现有的建造、研究、舰队、战斗、联机服务端。
>
> 📐 **空间化星图与航道的详细设计见 [GALAXY_MAP_DESIGN.md](./GALAXY_MAP_DESIGN.md)**：
> 自由布局坐标、跨区星门航道、多段曲速航行、迷雾与星图交互都在那份文档里。
>
> ⚙️ **玩法结算细节见 [GALAXY_SYSTEMS_DETAIL.md](./GALAXY_SYSTEMS_DETAIL.md)**：
> 多段任务状态机、自由曲速代价、星门争夺、扫描分级、派系经济、世界事件、配置与验收标准。
>
> 📊 **具体数值与可直接粘贴的 config 见 [GALAXY_BALANCE.md](./GALAXY_BALANCE.md)**；
> 🖼️ **界面与交互见 [GALAXY_UI_SPEC.md](./GALAXY_UI_SPEC.md)**；
> 🔍 **开工前必读的缺口复核见 [GALAXY_GAP_REVIEW.md](./GALAXY_GAP_REVIEW.md)**——
> 那里列出了与现有代码冲突的 3 个阻塞项（NPC id、单层扁平表、快照隔离）和 i18n 清单。

---

## 1. 先把「无人深空的星系系统」拆成可移植的机制

| NMS 机制 | 体验 | 本项目可移植性 |
|---|---|---|
| 程序化宇宙（星区 → 恒星系） | 地图永远探索不完，每个地方都不一样 | ★★★★ 纯数据生成，成本低 |
| 恒星系内多行星/卫星 | 一个坐标不再是"一个球" | ★★★★ 现有 `position` 可直接变成轨道号 |
| 扫描与发现（Discoveries） | 未知 → 扫描 → 命名 → 全服可见 | ★★★★ 服务端已有玩家态，加一张发现表即可 |
| 星图导航（经济/危险/派系着色） | 地图本身就是玩法 | ★★★☆ 需要新的星图 UI |
| 曲速旅行（Warp Drive + 燃料） | 远距离跳迁有成本与科技门槛 | ★★★ 现有舰队任务体系可承载 |
| 空间站 / 派系 / 经济 | 星系有"性格"，影响贸易与冲突 | ★★☆ 需要经济系统支撑，可后置 |
| 3D 自由飞行 / 步行 / 生物图鉴 / 基地 | 第一人称探索 | ☆ 与本作「舰队调度」定位冲突，不做 |

**结论**：前 5 项值得做，后 2 项应明确放弃。改造的核心是
**「坐标地址不变，坐标语义升级」**，而不是重写整个宇宙。

---

## 2. 现状盘点（决定改造成本的关键事实）

| 事实 | 位置 | 影响 |
|---|---|---|
| 宇宙是硬编码的 9×10×10 = 900 个槽位 | `gameLogic.generateRandomPosition`（`Math.random() * 9/10/10`）、`GalaxyView` 的 `v-for="g in 9"` / `v-for="s in 10"` | 扩容要改生成与选择器 |
| 一个 `position` = 一颗行星，没有「恒星」这个概念 | `Planet.position`、`universeStore.planets` 以 `galaxy:system:position` 为 key | 需要引入「恒星系元数据」 |
| 距离是**坐标算术**，不是几何距离 | `fleetLogic.calculateDistance`：同位置 5 / 同系 1000+ / 同区 2700+ / 跨区 20000+ | 星图要空间化，距离公式必须重写 |
| 矿脉由坐标推导 | `oreDepositLogic.calculateInitialDeposits(position)` + `GALAXY_MULTIPLIER 0.05` | 可接入「星系经济/行星偏向」 |
| NPC 是 200 个随机占位，没有阵营/领地 | `App.vue` 的 `generateNPCPlanets(200)`、`npcGrowthLogic` 距离难度 | 改造后应按「恒星系危险度 + 派系」生成 |
| 坐标耦合面很大 | 30 个文件、`galaxy` 128 处 / `system` 114 处 / `targetPosition` 238 处 | **必须保住 `galaxy:system:position` 这个地址格式** |
| 星系页 1587 行 | `GalaxyView.vue` | 改造时拆成「星图 + 星系视图」两个页面 |
| 已有权威服务端 + 增量协议 | `server/room.ts`、`core/protocol.ts` | 发现状态、星系元数据可以由服务端统一下发 |

**最关键的一条**：只要继续用 `galaxy:system:position` 作为**地址**，
90% 的业务代码（舰队、战斗、殖民、月球的父星球、传感器阵列）都不用动。

---

## 3. 三个方案，按野心从小到大

### 方案 A（推荐）：星区扩容 + 恒星系元数据 + 发现系统

- 星区 1..16，每个星区 64 个恒星系，每个恒星系 10 条轨道（保留现有轨道数，迁移零成本）
- 每个恒星系有：恒星类型、经济类型、繁荣度、危险度、所属派系、空间站、星图坐标
- 行星有：地貌、大小、资源偏向、环境危害（由种子确定性生成）
- 玩家可以「扫描」未发现的恒星系，首个发现者可以命名，全服可见
- 舰队跨星系旅行改为「曲速」，消耗新的燃料，需要对应科技

**体验增益**：地图从 900 个格子变成 1024 个有性格的恒星系；探索有目标感。
**成本**：核心 3~4 周，不含派系/空间站。

### 方案 B（轻量）：只加「恒星系档案」

- 不改坐标规模，只给现有 90 个恒星系生成「名字 + 经济 + 危险度 + 恒星类型」
- 星系页顶部展示恒星系档案，产量/矿脉/NPC 侵略性接入这些属性

**体验增益**：地图有了"地点感"，产量有区域差异。
**成本**：3~5 人日，几乎不破坏平衡，随时可以继续升级到 A。

### 方案 C（彻底）：NMS 式空间宇宙

- 星区无限程序化生成、恒星系空间坐标、曲速航线、派系领地、空间站交易、行星生物群系限制建筑
- **成本**：2~3 个月，且需要重做经济与 NPC 系统

> 建议：**先做 B 作为过渡（可选），直接做 A 也可以**；C 不推荐一步到位。

---

## 4. 方案 A 的完整设计

### 4.1 宇宙模型

```
Region（星区，1..16）           ←── 复用现有 galaxy 字段
  └ System（恒星系，1..64）      ←── 复用现有 system 字段，新增元数据
      └ Orbit（轨道，1..10）     ←── 复用现有 position 字段（旧存档 1..10 全部有效）
```

- 地址格式不变：`galaxy:system:position`
- 舞台从 9×10×10=900 扩到 16×64×10=10240
- **旧存档的所有坐标天然合法**，只是它们所在的恒星系现在有了「档案」

### 4.2 数据模型

```ts
// src/types/galaxy.ts
export type StarClass = 'yellow' | 'red' | 'blue' | 'green' | 'white'
export type EconomyType = 'mining' | 'industrial' | 'tech' | 'trade' | 'agriculture' | 'military'
export type Biome = 'rocky' | 'ocean' | 'desert' | 'frozen' | 'toxic' | 'lava' | 'gas' | 'barren'

export interface StarSystem {
  id: string            // "7:23"
  region: number        // 原 galaxy
  index: number         // 原 system
  seed: number          // 确定性种子
  name: string          // 可被首个发现者改名
  starClass: StarClass
  economy: EconomyType
  wealth: 1 | 2 | 3     // 繁荣度：影响贸易与矿脉
  danger: 1 | 2 | 3     // 危险度：影响 NPC 侵略性与海盗
  factionId: string     // 'neutral' | NPC id | 玩家 id（控制权）
  hasStation: boolean
  coords: { x: number; y: number }   // 星图坐标（区域内，0..1000）
  discoveredBy?: string              // 首个发现者
  namedBy?: string                   // 命名者
}

export interface PlanetProfile {
  biome: Biome
  sizeClass: 1 | 2 | 3
  resourceBias: 'metal' | 'crystal' | 'deuterium' | 'balanced' | 'darkMatter'
  hazard: 'none' | 'storm' | 'radiation' | 'extremeCold' | 'extremeHeat'
  orbitDistance: number   // AU，用于星系内飞行时间
}
```

- `StarSystem` 落 `ServerState.systems`（惰性生成后持久化）
- `PlanetProfile` **不落盘**：由 `(seed, orbit)` 纯函数实时推导，改配置即全局生效
- 行星本身（`Planet`）不加字段，避免污染 40KB 的 `types/game.ts`

### 4.3 程序化生成

新增 `src/logic/galaxyGen.ts`（纯函数，无 Vue/Node 依赖）：

```ts
// 确定性哈希：同一个坐标无论何时何地生成，结果都一样
export const hash32 = (a: number, b: number, c = 0): number => { /* xorshift */ }

export const getSystemMeta = (region: number, index: number): StarSystem => { /* ... */ }
export const getPlanetProfile = (region: number, index: number, orbit: number): PlanetProfile => { /* ... */ }
export const getSystemCoords = (region: number, index: number): { x: number; y: number } => { /* ... */ }
export const systemDistance = (a: StarSystem, b: StarSystem): number => { /* 欧氏距离 */ }
```

**为什么必须是纯函数**：
1. 服务端权威生成，客户端可以用同一份代码**本地画出未探索星系的轮廓**（NMS 的感觉）；
2. 联机时两边永远一致，不需要同步全部 1024 个恒星系；
3. 单机存档不需要保存元数据，读档时重新推导。

服务端只在「首次被访问/扫描」时把 `StarSystem` 写进存档（名字、发现者、控制权这类**可变**字段必须落盘）。

### 4.4 发现与命名

```ts
// Player 新增
discoveredSystems?: Record<string, { at: number; scanned: number; named?: string }>
```

- 命令 `galaxy.scan { region, index }`：
  - 消耗：1 个探测卫星（或少量重氢），有冷却
  - 服务端返回：恒星系档案 + 各轨道的**粗略信息**（行星星球是否存在、是否有人占领）
  - 二次扫描（`scanned` 次数增加）逐步解锁行星详情（对应 NMS 的多次扫描）
- 命令 `galaxy.rename { systemId, name }`：仅首个发现者可命名，服务端记录 `namedBy`
- 协议：`patch.galaxy` 增量下发「新发现的恒星系 + 改名」
- 防透视：未发现恒星系只下发星图坐标（用于画迷雾），**不下发行星与归属**

### 4.5 经济 / 危险度 → 接入现有系统

| 现有系统 | 改造点 |
|---|---|
| 矿脉 `calculateInitialDeposits(position)` | 增加 `economy`、`resourceBias`、`wealth` 系数 |
| 产量 | 可加「星系繁荣度」全局乘区（默认 1.0，避免破坏平衡） |
| NPC 难度 `npcGrowthLogic.calculateDistanceToHomeworld` | 改为「区域距离 × 0.3 + 星系危险度 × 10」，让危险区 NPC 更强 |
| NPC 行为 `npcBehaviorLogic` | 按 `system.danger` 调整侦查/攻击频率（复用现有 `AIBehaviorModifier`） |
| 殖民 | 地貌限制（如 `gas` 不可殖民，`barren` 可殖民但空间小）——建议 P5 |
| 传感器阵列 | 已经按恒星系扫描，语义天然契合，只需扩范围 |

### 4.6 旅行：曲速 + 亚光速

```ts
// FleetMission 新增
travelMode?: 'sublight' | 'warp'
```

- **同恒星系内**（轨道间）：亚光速，沿用现有公式 `1000 + |Δorbit| * 5`
- **跨恒星系**：必须曲速
  - 科技门槛：新增 `WarpDrive`（或复用 `HyperspaceDrive`）
  - 燃料：新增 `warpCell`（可由重氢 + 暗物质合成），或先用重氢 × 系数
  - 距离：`systemDistance(a, b)` 的欧氏距离 → 飞行时间
- `calculateDistance` 重写（地址不变，内部换算法）：

```ts
if (同一轨道) return 5
if (同一恒星系) return 1000 + |orbitΔ| * 5
const d = systemDistance(sysA, sysB)          // 星图欧氏距离
return 2700 + d * DISTANCE_SCALE              // DISTANCE_SCALE 需重新标定
```

⚠️ 这会改变**所有**舰队时间与燃料消耗，必须配合一次全局平衡（P4 的验收标准里要有「典型航程时间表」）。

### 4.7 UI 改造

把 1587 行的 `GalaxyView.vue` 拆成三块：

1. **`GalaxyMapView.vue`（新，主入口）**
   - SVG/Canvas 星图：区域内 64 个恒星系按 `coords` 散布
   - 颜色 = 经济类型，描边 = 危险度，图标 = 派系/空间站
   - 未发现 = 灰雾 + 问号（可点击扫描）
   - 点击恒星系 → 右侧抽屉展示档案 + 「设为航行目标」
2. **`SystemView.vue`（新）**
   - 中心恒星 + 10 条轨道，行星按轨道排列
   - 每颗行星：地貌图标、归属、矿脉条、操作（殖民/侦查/攻击）
   - 保留一个「列表模式」开关（延续现有密集操作习惯）
3. **`useGalaxySelection.ts`（抽出来的 composable）**
   - 处理 `region/system/orbit` 选择、URL 查询参数、跨页跳转

现有 `GalaxyView` 的导弹发射、传感器阵列、跳转等交互原样搬进 `SystemView`，减少回归面。

### 4.8 服务端与协议

| 层 | 改动 |
|---|---|
| `ServerState` | 新增 `systems: Record<string, StarSystem>`（惰性补齐） |
| `Player` | 新增 `discoveredSystems` |
| 命令 | `galaxy.scan`、`galaxy.rename` |
| 协议 | `WelcomeMessage.snapshot.galaxy`（已发现的星图）、`ServerPatch.galaxy`（增量） |
| 存档 | `systems` 落盘；`PlanetProfile` 不落盘 |
| 反作弊 | 扫描/命名走命令层，客户端不能伪造发现记录 |

### 4.9 存档迁移

`utils/migration.ts` 增加一个版本：

1. 为所有已存在的 `galaxy<=9, system<=10` 生成 `StarSystem` 元数据（纯函数推导）
2. 每个玩家：把自己的母星系标记为已发现（`scanned: 99`）
3. 旧 NPC 星球：`ownerId` 不变，所在恒星系的 `factionId` 设为该 NPC
4. 星图选择器范围从 9/10 扩到 16/64（`GalaxyView` 的 `v-for` 改为读配置）
5. 旧 `position` 轨道 1..10 全部保留 → **不产生坐标冲突**

---

## 5. 分阶段实施计划

| 阶段 | 内容 | 产出 / 验收 | 人日 |
|---|---|---|---|
| **P0** ✅ | `galaxyGen.ts` 纯函数 + `StarSystem/PlanetProfile` 类型 + 单测 | **已完成**：1024 恒星系 / 1822 航道 / 30 星门 / 连通分量 1 / 约 40ms 每图 | 2~3 |
| **P1** ✅ | 元数据接入：矿脉、NPC 难度、传感器阵列射程 | **已完成**：矿脉按经济/繁荣度/偏向修正；NPC 难度 = 距离 + 危险度；扫描改为按航道跳数限射程 | 3~4 |
| **P2** ✅ | 发现与命名：命令 + 协议 + 服务端落盘 + 迁移 | **已完成**：`galaxy.scan`（按跳数射程 / 探测卫星 + 重氢 / 10 分钟冷却 / 两级解锁）与 `galaxy.rename`（首名者命名，随发现记录同步）；协议升到 v3 | 3~4 |
| **P3** | UI：星图 + 星系视图拆分 | 能像 NMS 一样点星图 → 进星系 → 看行星；旧交互不丢 | 5~7 |
| **P4** | 曲速旅行 + 距离重平衡 | 跨区必须曲速；给出航程时间表并校准燃料 | 3~4 |
| **P5**（可选） | 派系控制、空间站、地貌限制殖民 | 星系有归属与设施 | 5~8 |
| **P6** | **多周目**：按层拆存档、跃迁与继承、冻结/追赶 | 12 层共享宇宙，可上下跃迁 | 8~11 |

**核心 P0~P4 ≈ 16~22 人日（3~4 周）**；加 P5 约 5~6 周；加 P6 约 7~9 周。

> 多周目的完整设计见 [GALAXY_CYCLES.md](./GALAXY_CYCLES.md)：
> 每层一张独立星图、按层拆存档、冻结层不 tick、跃迁保留科技但失去基地。

### 建议的最小可玩切片（MVP）

**P0 + P1 + P3 的只读部分**：
- 生成恒星系档案、接入矿脉/NPC 差异
- 星图能看、能点、能显示迷雾，但**先不做扫描命令**（全部可见）
- 不碰飞行公式 → 现有平衡零风险

约 **8~10 人日**，就能看到「像 NMS 的星图」，然后决定是否继续 P2/P4。

---

## 6. 风险与取舍

| 风险 | 说明 | 缓解 |
|---|---|---|
| 坐标耦合面大 | 30 个文件、480 处坐标引用 | **地址格式不变**，只加语义；P0 不动任何现有调用 |
| 飞行时间全局重平衡 | P4 会改变所有舰队时长 | 单独一个阶段做，并保留「旧公式开关」用于对比 |
| 星图性能 | 1024 个恒星系点 | SVG + 视口裁剪足够；不需要 WebGL |
| 联机防透视 | 未发现星系不能泄露行星 | 服务端按 `discoveredSystems` 过滤，协议层保证 |
| `GalaxyView` 拆分回归 | 1587 行、交互多 | 先抽 composable，再拆页面；旧列表视图保留一版 |
| NPC 难度体系依赖距离 | 改公式会导致现有 NPC 强度漂移 | 先加「危险度」作为独立乘区，距离公式 P4 再动 |
| 存档兼容 | 旧存档的 90 个恒星系 | 迁移时纯函数补齐元数据，坐标不变 |

### 明确不做（避免范围失控）

- 无限宇宙 / 3D 自由飞行 / 步行探索 / 生物图鉴 / 基地建造
- 真正的无缝空间站对接——本作是舰队调度，不是飞行模拟
- 随机生成行星**地形**（只生成属性，不生成地图）

---

## 7. 与现有实现的衔接清单

**完全不用动**：建造/研究/舰船/防御队列、战斗结算、任务报告、成就、战役、外交、聊天、联机命令层。

**需要小改**：

- `gameLogic.generateRandomPosition`（读配置而非硬编码）
- `GalaxyView` 的 `v-for="g in 9"` / `v-for="s in 10"`
- `oreDepositLogic.calculateInitialDeposits`（加系数）
- `npcGrowthLogic.calculateDistanceToHomeworld`（加危险度）
- `migration.ts`（升版本）

**需要大改**：`fleetLogic.calculateDistance`（P4）、`GalaxyView.vue`（P3 拆页面）。

**新增**：`types/galaxy.ts`、`logic/galaxyGen.ts`、`logic/galaxyDiscoveryLogic.ts`、`components/galaxy/GalaxyMap.vue`、`components/galaxy/SystemOrbits.vue`、`stores/galaxyStore.ts`（缓存元数据）、服务端 `systems` 状态与协议字段。
