# 星系改造 · 缺口复核（对照现有代码）

> 用「设计 → 代码」逐项对账，找出六份设计文档里**没提到、但落地时会撞上**的地方。
> 每条都标了文件与影响，最后给出优先级与建议插入的阶段。

---

## 0. 结论摘要

| 级别 | 问题 | 位置 |
|---|---|---|
| 🔴 阻塞 | NPC id 跨周目重复（`npc_0`/`npc_planet_0`） | `planetLogic.createNPCPlanet` |
| 🔴 阻塞 | `world.planets` / `world.players` 是单层扁平表，没有周目维度 | `core/generate.ts`、`server/room.ts` |
| 🔴 阻塞 | 快照/补丁不按周目过滤，会跨层泄露 | `core/protocol.ts` |
| 🟠 重要 | 传感器阵列没有距离校验（可跨图扫描） | `core/commands.ts` |
| 🟠 重要 | 出生点硬编码 `1:1:1`，多周目需要安全区分配 | `planetLogic.createInitialPlanet` |
| 🟠 重要 | 导出/导入只认 3 个 localStorage 键 | `SettingsView.vue` |
| 🟡 一般 | 深链接、报告、成就、提示、GM 面板都缺周目维度 | 多处 |
| 🟡 一般 | 探索奖励、空间站、深空遭遇属于"只提了一句" | 设计文档 |

---

## 1. 与现有代码的集成缺口

### 1.1 🔴 NPC id 跨周目重复

```ts
// src/logic/planetLogic.ts
export const createNPCPlanet = (npcId: number, ...) => ({
  id: `npc_planet_${npcId}`,
  ownerId: `npc_${npcId}`,
  ...
})
```

每个周目都会从 0 开始生成 NPC，于是第 1 层和第 2 层都有 `npc_0`。
后果：

- `NPC.relations`（外交关系）会串层；
- NPC 的 `fleetMissions` 找不到归属；
- 报告里的 `spyId` / `attackerId` 指向错误的层；
- `world.npcs` 注册表直接覆盖。

**修复**：id 加周目前缀 `npc_c3_17` / `npc_planet_c3_17`，并在 `createNPCPlanet` 签名里加 `cycle`。
这是一次性改动，但**必须最早做**，否则后面所有数据都会污染。

### 1.2 🔴 单层扁平表：`world.planets` 与 `world.players`

```ts
// src/core/generate.ts
world.planets[positionKey(position)] = planetLogic.createNPCPlanet(i, position, prefix)
```

`positionKey` 只拼 `galaxy:system:position`，不含周目。同理 `Room.syncPlayers` 会把
**所有玩家**塞进 `world.players`，而 `allPlayers(world)`、`collectAllPlanets(world)`
被战斗、任务结算、外交、传感器阵列大量使用。

**这条比文档里写的"按层拆存档"更根本**：不只是存档要拆，**运行时内存模型也要拆**。

三种做法：

| 方案 | 做法 | 代价 |
|---|---|---|
| **A. 周目作用域（推荐）** | `World` 增加 `cycle` 字段；`Room` 在处理某层时设置 `world.cycle = n`，`allPlayers` / `collectAllPlanets` / `findMissionTarget` 按 `player.cycle === world.cycle` 过滤 | 与现有 `world.player = player` 的 hack 完全同构，**不动 480 处调用** |
| B. key 前缀 | `positionKey` 变成 `cycle:galaxy:system:position` | 所有 key 都要迁移，报告/深链全受影响 |
| C. 每层一个 World 对象 | `cycles[n]` 各自持有 World | 内存翻倍，tick 需要循环调度，改动最大 |

**选 A**。现有代码已经在用「临时替换 `world.player`」来表达"当前上下文"，
再加一个 `world.cycle` 是同一套模式，风险最低。

### 1.3 🔴 快照与补丁不按周目过滤

```ts
// src/core/protocol.ts
export const collectVisiblePlanets = (world: World, viewer: Player) => {
  for (const player of allPlayers(world)) { ... }   // ← 全部玩家
}
```

`Room.broadcast` 是按会话逐个构建 patch 的（这点很好），但过滤条件里没有周目。
12 层同时在线时，每个玩家都会收到其它层的行星补丁 —— 既是**信息泄露**，也是**带宽浪费**。

**修复**：`buildSnapshot` / `buildPatch` 增加 `cycle` 参数（或用 `world.cycle` 作用域），
`collectVisiblePlanets` 跳过 `player.cycle !== viewer.cycle`。

### 1.4 🟠 传感器阵列没有距离校验

```ts
case 'phalanx.scan': {
  const moon = findOwnPlanet(world, command.moonId)
  if (!moon || !moon.isMoon) return fail()
  if (moon.resources.deuterium < PHALANX_SCAN_COST) return fail(...)
  return succeed({ scan: collectFleetsAt(world, command.targetPosition) })
}
```

**现在就没有范围判断**——任意月球花 5000 重氢可以扫全图任意坐标。
改版后星图从 900 格变成 19200 格，这个漏洞会被放大。

**修复**：加 `|Δsystem| <= 等级 × 2`（同层）与跨层拒绝，顺便补上这条设计（文档里只写了"语义天然契合"）。

### 1.5 🟠 出生点硬编码

```ts
// src/logic/planetLogic.ts
position: { galaxy: 1, system: 1, position: 1 }
```

服务端 `createHomePlanet` 会再分配空闲位置，但**默认落点逻辑里没有"安全区"概念**。

**修复**：新增 `findSpawnPosition(cycle, seed)` —— 在指定层找一个 `danger=1`、
两跳内无星门、且相邻系有空位的恒星系。新玩家默认进第 1 层。

### 1.6 🟠 导出/导入只认 3 个键

```ts
// src/views/SettingsView.vue
const gameData = localStorage.getItem(pkg.name)
const universeData = localStorage.getItem(`${pkg.name}-universe`)
const npcData = localStorage.getItem(`${pkg.name}-npcs`)
```

多周目后单机版也要分层存储，导出格式必须升级（`version: 2` + `cycles: {...}`），
并保留对旧格式的读取（`migration.ts`）。

### 1.7 🟡 深链接与报告缺周目

```ts
// NPCActivityDialog.vue
router.push(`/galaxy?galaxy=${...}&system=${...}`)
```

如果 `galaxy` 采用**全局星区号**（1..192），链接天然可用，只需前端解码
`cycle = ceil((galaxy-1)/16)`；否则要加 `&cycle=` 参数。

> 这是"全局 galaxy 号"方案的一个隐藏红利：**旧链接、旧报告、旧存档全部继续有效**。

### 1.8 🟡 其它零散点

| 位置 | 问题 |
|---|---|
| `world.debrisFields` | key 同样是 `galaxy:system:position`，需要层作用域 |
| `world.npcBehaviorAccum` / `npcGrowthAccum` | 单层累加器，多周目要按层 |
| `Room.syncPlayers` | 需要按 `player.cycle` 重建 `world.players` |
| `RankingView` | 合并的是 `netStore.players`，`PlayerPublicProfile` 没有 `cycle` 字段 |
| `GMView` | 行星列表来自 `universeStore`，需要周目选择器 |
| `useHints` | 有 `hints.galaxy.*`，新星图要重写提示文案与位置 |
| `achievementLogic` | 只有 `colonizations` 计数，**没有任何星系/探索成就** |
| `campaignLogic` | 战役任务是否引用坐标需确认（目前看是按事件触发） |

---

## 2. 设计缺口（玩法层面）

### 2.1 探索奖励太弱

现在只给了「首次发现 +2% 矿脉（上限 +10%）」。对一个需要玩家主动扫描 1024 个恒星系的系统来说，
这个回报几乎不存在。**需要一条完整的发现者奖励链**：

| 发现行为 | 奖励 |
|---|---|
| 首次扫描恒星系 | 一次性资源（按层倍率） + 成就进度 |
| 首次发现行星 | 少量暗物质 / 稀有资源 |
| 为恒星系命名 | 全服可见的命名权 + 发现者标记 |
| 发现 10/50/200 个 | 称号 + 专属徽章 + 扫描范围 +1 |
| 首个抵达某层 | 全服广播 + 永久纪念（星图上标记） |

### 2.2 空间站只有 `hasStation: boolean`

文档里反复出现"空间站"，但没定义它做什么。最小可玩版本至少要有：

- 补给（燃料/维修，价格随繁荣度浮动）
- 中转（舰队停靠，不消耗返程燃料）
- 任务板（NPC 发布的运输/护航任务）

否则它只是一个装饰性图标。

### 2.3 星门经济在小服可能为 0

过路费来自**玩家交通**。十几人的服务器，可能一整天没人经过一座星门 → 占领毫无收益 →
星门争夺机制直接失效。

**解法（低成本高回报）**：让 **NPC 商队**定期沿航道移动并缴纳过路费。
这样星门天然有收益，也让星图"活"起来（能看到商队光点在航道上跑）。

### 2.4 深空遭遇完全没设计

《无人深空》的星图之所以不空，是因为到处都是"信号"。我们的星图目前只有：
恒星系、航道、星门、四种事件。缺一层 **"未知信号"**：

- 漂流残骸（一次性资源/蓝图）
- 海盗巢穴（可清剿）
- 远古遗迹（解锁科技）
- 虫洞（临时捷径）

这些可以做成星图上的**临时图标**，扫描后发现，几天后消失——成本很低，但极大提升"想去看一眼"的冲动。

### 2.5 新手出生周目与人口分布

12 层共享，"新玩家进哪层"是个真问题：

- 全进第 1 层：老区被老玩家占满，新人难发展
- 自动进最新层：新人直接面对高强度 NPC
- **建议**：新玩家进第 1 层，但给 72 小时保护 + 优先分配"未被占领的安全星区"；
  同时当第 1 层活跃玩家超过阈值时，自动开一个"新芽层"

### 2.6 跃迁后的脆弱期

跃迁 = 失去所有星球 + 一颗新母星。如果此时被别人盯上，等于自杀。

**建议**：跃迁落地给 24~48 小时保护期（可被主动攻击打破），与新手保护共用一套逻辑。

### 2.7 单人模式没写

六份文档基本按联机写。但单机玩家也想要新星图与周目：

- 单机 = 1 个玩家、1 个世界，周目可以保留（本地跃迁），但**没有发现共享/排行榜**
- 生成器必须能在浏览器里跑（纯函数，无 Node API）——这点已经满足
- 存档从「3 个 localStorage 键」升级为「按层存储 + 版本号」

### 2.8 冻结层里的离线舰队

玩家 A 在 3 层下线，3 层只有 A → 该层冻结。A 的舰队本应 2 小时后到达，
但冻结期间不 tick。

- 现在文档写的是"激活时追赶"，功能上没问题（A 上线时结算）
- 但有个体验问题：**A 上线时看到的战报是 2 小时前的**，且期间无人能攻击他（安全但失真）
- **补充规则**：冻结层里"有任务在飞"时不做完全冻结，而是降频 tick（如 5 秒一次，只推进任务，不跑 NPC 行为）

### 2.9 命名与发现者权益太单薄

"首个发现者可命名"很酷，但需要配套：

- 命名审核（敏感词）
- 重名处理（同名时显示发现者）
- 管理员重置命名的 GM 命令
- 命名历史（谁改的、何时）

---

## 3. i18n 清单（这次别再漏）

上次修语言系统时，联机面板是内联中英文案。这次改造涉及的**新名词比联机面板多一个数量级**，
建议**先建 key 再写组件**。

| 类别 | 数量 | 示例 key |
|---|---|---|
| 经济类型 | 6 | `galaxy.economy.mining/industrial/tech/trade/agriculture/military` |
| 行星地貌 | 8 | `galaxy.biome.rocky/ocean/desert/frozen/toxic/lava/gas/barren` |
| 恒星类型 | 5 | `galaxy.starClass.yellow/red/blue/green/white` |
| 环境危害 | 5 | `galaxy.hazard.none/storm/radiation/extremeCold/extremeHeat` |
| 危险度 | 3 | `galaxy.danger.low/medium/high` |
| 世界事件 | 4+ | `galaxy.event.pirateRaid/ionStorm/resourceRush/gateLockdown` |
| 星门状态 | 5 | `galaxy.gate.neutral/owned/blockaded/destroyed/contested` |
| 扫描 | 8 | `galaxy.scan.needScan/scanning/level1/level2/cooldown/noProbe` … |
| 航行 | 10 | `galaxy.route.legs/fuel/toll/direct/multiLeg/noPath/outOfRange` … |
| 发现 | 6 | `galaxy.discovery.first/nameIt/namedBy/unknownSignal` |
| 周目 | 12 | `cycle.title/status.*/jump.*/condition.*` |
| 派系 | 4 | `faction.miners_guild/...`（名称也要翻译，不只 id） |
| 聊天/提示 | 5 | `galaxy.hint.firstScan` 等 |

**合计约 80~120 个 key × 8 种语言**。上次 43 个 key 就漏了，这次建议：

1. 先在 `zh-CN.ts` 建完整结构（TS 类型会强制其它文件对齐？不会，但至少中文不缺）；
2. 用一个脚本检查 8 个文件的 key 是否齐全（可以复用我做 `add-locale-keys.mjs` 的思路，
   改成**校验**脚本，进 CI）；
3. 组件里禁止出现中文字面量（加一条 ESLint 规则或 review 清单）。

---

## 4. 测试缺口

现有 `pnpm test` 覆盖引擎与服务端，但新星系系统几乎没有断言。建议补：

| 测试 | 断言 |
|---|---|
| 生成确定性 | 同 seed 两次生成，坐标与属性完全一致 |
| 布局质量 | 1024 个恒星系两两距离 ≥ 最小间距；区域中心距 ≥ 2R×0.9 |
| 连通性 | 航道图连通分量 = 1（每个 seed 至少跑 20 个） |
| 性能 | 生成 + 建图 < 50ms；路线规划 < 5ms |
| 快照隔离 | A 层玩家的 snapshot 不含 B 层行星 |
| 命令校验 | 跨层 `fleet.send` 被拒绝 |
| 扫描 | 未扫描恒星系属性不下发 |
| 周目迁移 | 旧存档加载后 cycle=1、坐标不变 |
| 冻结追赶 | 冻结 3 小时，任务全部结算，NPC 成长 ≤ 6h |
| 深链 | `?galaxy=40&system=5` 自动切到第 3 层 |

---

## 5. 运维与回滚

| 项 | 建议 |
|---|---|
| `layoutVersion` | 写进存档；客户端不匹配时拒绝联机，提示刷新 |
| 存档版本链 | `v1（旧）→ v2（周目）`，迁移函数可重入 |
| 回滚开关 | 环境变量 `GALAXY_MODE=legacy\|v2`，出问题能切回旧星图（旧数据保留） |
| 监控 | tick 耗时、各层在线人数、存档大小、活跃层数、扫描 QPS |
| 管理命令 | `admin.resetCycle`、`admin.unfreeze`、`admin.renameSystem` |
| 压测 | 12 层同时活跃时的 tick 与广播耗时（目标 < 200ms/秒） |

---

## 6. 优先级：P0 之前必须先定

1. **周目作用域方案**（§1.2 方案 A）——决定后面所有代码的形状
2. **NPC id 命名规则**（§1.1）——越晚改越脏
3. **`galaxy` 是否采用全局号**（§1.7）——决定深链与报告兼容性
4. **i18n key 结构**（§3）——决定组件怎么写
5. **单人模式是否同步改造**（§2.7）——决定生成器要不要进浏览器包

其余（空间站、深空遭遇、NPC 商队、新手层）可以放到 P5/P6 之后。

---

## 7. 想象：三个低成本高回报的点子

### 7.1 NPC 商队（让星图"活"起来）

- 每隔几分钟，从某个经济星系生成一支商队，沿航道飞往另一个星系
- 商队缴纳过路费 → 星门真正有收益
- 商队可被劫掠（风险/收益），但会降低该派系好感
- 星图上能看到缓缓移动的光点

成本：复用现有舰队任务系统 + 一个生成器。收益：让静态星图变成动态经济循环。

### 7.2 未知信号（让"探索"有目标）

- 每个星区常驻 3~5 个"信号"，随扫描刷新
- 类型：残骸 / 海盗巢穴 / 遗迹 / 虫洞
- 残骸给一次性资源，遗迹给科技蓝图，虫洞是限时捷径，海盗巢穴可清剿换声望
- 几天后自动消失，制造"现在不去就没了"的紧迫感

成本：一个信号表 + 几种结算分支。收益：把"扫描"从数据操作变成有意义的选择。

### 7.3 星图涂色（让进度可见）

- 玩家已发现的恒星系在星图上永久点亮（自己可见）
- 顶部显示"探索度 37%"
- 全服显示"人类已发现 12%"（所有玩家发现记录的并集）

成本极低（已有 `discoveredSystems`），但**视觉成就感极强**——这是无人深空最上瘾的部分之一。

---

## 8. 建议的落地顺序（修正后）

```
P0 前置：周目作用域 + NPC id + i18n 结构 + 全局 galaxy 号   ← 本文件
P0      : 生成器 + 航道图 + 单测
P1      : 经济/危险度接入 + 传感器阵列范围校验
P2      : 扫描/发现/命名 + 协议隔离（按层过滤）
P3      : 星图 UI（含深链、移动端）
P4      : 曲速/多段航行 + 距离重平衡
P5      : 派系/星门争夺/NPC 商队
P6      : 多周目（拆档、冻结追赶、跃迁）
P7      : 未知信号 / 空间站 / 星图涂色
```
