# 星系改造 · 四个前置决策

> 对应 [GALAXY_GAP_REVIEW.md §6](./GALAXY_GAP_REVIEW.md) 的四个阻塞项。
> 每个决策给出可选项、影响面、默认推荐与验收方式。
> **这四个定完，P0 才能开工。**

总工时估算：**约 2.5 人日**（不含 P0 本体的生成器）。

| # | 决策 | 默认推荐 | 工时 |
|---|---|---|---|
| 1 | 周目作用域 | 全局 id + 轻量过滤 | 0.5 |
| 2 | NPC id 规则 | 周目前缀（第 1 层兼容旧格式） | 0.5 |
| 3 | galaxy 编号 | 全局号 1..192 | 0.5 |
| 4 | i18n 结构 | 按功能域嵌套 + CI 校验 | 1.0 |

> 决策 1 与 3 强耦合：**先定 3，1 才有意义**。

---

## 决策 1：周目作用域（运行时内存模型怎么装下 12 层）

### 背景

现有代码假设"一个世界 = 一层"：

```ts
// src/core/world.ts
export const allPlayers = (world: World): Player[] => world.players?.length ? world.players : [world.player]

// src/core/protocol.ts
for (const player of allPlayers(world)) { /* 收集可见行星 */ }
```

`world.players` 由服务端把所有在线玩家一次性同步进来；`world.planets` 是
`galaxy:system:position` 的扁平表。**多周目后这两张表会混在一起。**

### 选项

| 方案 | 做法 | 改动量 | 风险 |
|---|---|---|---|
| **1A 交换式** | `World` 增加 `cycle`；`Room` 处理某层时把 `world.planets` 换成该层的表（像现在换 `world.player` 一样） | 中 | 忘记切换 → 静默串层 |
| **1B 全局 id + 轻量过滤** | `galaxy` 用全局号（决策 3A），于是**行星 key 天然唯一**；只给「玩家查询」加周目过滤 | **小** | 依赖决策 3A |
| **1C 每层独立 World** | `state.cycles[n].world`，各自完整 | 大 | 内存翻倍、tick 循环重写、快照逻辑全改 |

### 推荐：1B

理由：**key 的唯一性可以由地址本身解决，不需要额外的运行时隔离**。

```
行星 key = "40:27:3"        ← galaxy=40 已经隐含第 3 层
NPC id   = "npc_c3_17"      ← 决策 2 保证唯一
```

真正需要过滤的只有「按玩家/按星球遍历」的那几个入口：

```ts
// core/world.ts —— 只加一层过滤，不动 480 处调用点
export const allPlayers = (world: World): Player[] => {
  const list = world.players?.length ? world.players : [world.player]
  return world.cycle ? list.filter(p => (p.cycle ?? 1) === world.cycle) : list
}

export const cycleOfGalaxy = (galaxy: number): number =>
  Math.ceil(galaxy / GALAXY_CONFIG.REGIONS_PER_CYCLE)
```

需要过滤的入口清单（**只有 6 个**）：

| 函数 | 处理 |
|---|---|
| `allPlayers` | 按 `world.cycle` 过滤 |
| `collectAllPlanets` | 按 `cycleOfGalaxy(planet.position.galaxy)` 过滤 |
| `collectVisiblePlanets`（protocol） | 同上 |
| `findMissionTarget` | 只在自己的层里找 |
| `ensureNpcRegistry` | 按层维护注册表 |
| `syncPlayers`（room） | 仍同步全部，但带上 `player.cycle` |

`world.cycle` 由 `Room` 在每次 tick / 每次 `applyCommand` 前设置，与现在设置
`world.player = player` 完全同构。

### 验收

- 单元测试：构造两个层的玩家，`allPlayers(world)` 在 `world.cycle=2` 时只返回第 2 层
- 断言：`world.cycle` 未设置时行为与现在完全一致（单机兼容）

---

## 决策 2：NPC id 规则

### 背景

```ts
// src/logic/planetLogic.ts
id: `npc_planet_${npcId}`,   // npc_planet_0
ownerId: `npc_${npcId}`      // npc_0
```

12 层各自从 0 开始 → **id 必然冲突**。旧存档里已有 `npc_0..npc_199`。

### 选项

| 方案 | 形如 | 优点 | 缺点 |
|---|---|---|---|
| **2A 周目前缀** | `npc_c3_17` | 可读、日志能看出层、天然唯一 | 第 1 层需兼容旧格式或做迁移 |
| **2B 全局自增** | `npc_1240` | 实现最简单，天然唯一 | 看不出层，需查表；全局计数器要落盘 |
| **2C 内容哈希** | `npc_8f3a…` | 不可能冲突 | 完全不可读，调试困难 |

### 推荐：2A（第 1 层保留旧 id）

```ts
export const npcId = (cycle: number, index: number): string =>
  cycle === 1 ? `npc_${index}` : `npc_c${cycle}_${index}`   // 旧存档零迁移
```

- **第 1 层沿用 `npc_0`**：旧存档、旧战报、旧外交关系全部继续有效
- 第 2 层起用 `npc_c2_0`，日志里一眼看出层
- `npc_planet_*` 同理

代价是"第 1 层格式特殊"，但要为此写一份迁移（重写 relations 的 key、mission 的
`npcId`、report 的 `spyId`…）风险高得多。**用一点不一致换零迁移，值得。**

### 验收

- 生成第 1、2 层后，两层的 NPC id 集合不相交
- 旧存档加载后，`npc_0` 仍能正确解析到第 1 层的 NPC

---

## 决策 3：`galaxy` 编号（全局号 vs 局部号）

### 背景

`Position { galaxy, system, position }` 被 30 个文件、约 480 处引用。
`galaxy` 现在是 1..9，改版后每层 16 个星区、共 12 层。

### 选项

| 方案 | 结构 | 优点 | 缺点 |
|---|---|---|---|
| **3A 全局号** | `galaxy = (cycle-1)*16 + region`，范围 1..192 | **地址格式不变**；key 天然唯一；旧存档 1..9 落在第 1 层；深链/报告不用改 | 层号靠算术推导；每层星区数改了就全体偏移 |
| **3B 局部号 + cycle 字段** | `Position { cycle, galaxy, system, position }` | 语义清晰，层可独立配置星区数 | **破坏地址格式**，480 处 + 所有 key + 深链 + 报告都要改 |
| **3C 复合字符串** | `"c3:5:27:2"` | 最干净 | 迁移量最大，等于重做坐标系统 |

### 推荐：3A

```
cycle  = ceil(galaxy / 16)
region = ((galaxy - 1) % 16) + 1
```

关键红利：

| 场景 | 结果 |
|---|---|
| 旧存档 `galaxy=1..9` | 自动落在第 1 层的 1..9 区，**零迁移** |
| 旧深链 `?galaxy=3&system=27` | 继续可用（第 1 层） |
| 旧战报里的 `targetPosition` | 继续可解析 |
| 新深链 `?galaxy=40` | 前端解码 → 第 3 层第 8 区，自动切换周目 |
| `calculateDistance` | 形状不变，只是数值范围变大 |

**唯一约束**：`REGIONS_PER_CYCLE` 必须固定（写进 config 并进 `layoutVersion`）。
如果哪天要从 16 改成 24，需要一次全局坐标迁移——所以建议**一开始就定 16，长期不变**。

### 验收

- `cycleOfGalaxy(1)=1`、`cycleOfGalaxy(16)=1`、`cycleOfGalaxy(17)=2`、`cycleOfGalaxy(192)=12`
- 旧存档加载后所有星球 `cycleOfGalaxy(galaxy) === 1`

---

## 决策 4：i18n key 结构

### 背景

上次联机面板用内联中英文案，后来返工补了 8 个语言包。这次新增名词约 80~120 个，
**必须在写组件之前定结构**。

### 选项

| 方案 | 示例 | 优点 | 缺点 |
|---|---|---|---|
| **4A 按功能域嵌套** | `galaxy.economy.mining`、`cycle.status.frozen` | 与现有文件结构一致（home/common/settings…），查找直观 | 深层嵌套；每加一类要改 8 个文件 |
| 4B 扁平命名空间 | `galaxyEconomyMining` | 无嵌套 | 难扫描、易撞名、无法按域批量处理 |
| 4C 按模块拆文件 | `locales/galaxy/zh-CN.ts` 构建时合并 | 单文件小、可独立维护 | 要改 `src/locales/index.ts` 的加载逻辑 |

### 推荐：4A（先），并加两道保险

**结构**（直接照这个建）：

```ts
galaxy: {
  economy: { mining, industrial, tech, trade, agriculture, military },
  biome: { rocky, ocean, desert, frozen, toxic, lava, gas, barren },
  starClass: { yellow, red, blue, green, white },
  hazard: { none, storm, radiation, extremeCold, extremeHeat },
  danger: { low, medium, high },
  event: { pirateRaid, ionStorm, resourceRush, gateLockdown },
  gate: { neutral, owned, blockaded, contested, destroyed },
  scan: { needScan, scanning, level1, level2, cooldown, noProbe, outOfRange },
  route: { legs, fuel, toll, direct, multiLeg, noPath, outOfRange },
  discovery: { first, nameIt, namedBy, unknownSignal, explorePercent },
  hint: { firstScan, firstRoute, firstGate }
},
cycle: {
  title, current, online, highest,
  status: { active, frozen, unexplored },
  jump: { up, down, cancel, confirm, arriving },
  condition: { ok, missing },
  keep, lose, countdown, cooldown, pressure
},
faction: { miners_guild, deep_council, free_fleet, swarm }
```

**保险 1：CI 校验脚本**

```bash
pnpm run check:i18n
# 对比 8 个语言包与 zh-CN 的 key 集合，缺任何一条直接失败
```

复用我之前写 `add-locale-keys.mjs` 的思路，改成只读校验（不写文件），进 `pnpm test`。

**保险 2：组件里禁止中文字面量**

- ESLint 规则：Vue 模板中的中文文本报错（白名单：注释、非 UI 测试）
- 或退一步：review 清单里加一条"新组件不得出现中文字面量"

**何时改用 4C**：如果 `galaxy.*` 的 key 超过 150 个，或需要按周目/赛季切换文案，
再拆文件——那属于工程优化，不是现在的瓶颈。

### 验收

- `pnpm run check:i18n` 在缺 key 时退出码非 0
- 任意新增 `galaxy.*` key 后，8 个语言包同步（脚本可自动补齐英文占位）

---

## 附：四个决策的组合结果

```
galaxy 全局号 1..192         （决策 3A）
  → 行星 key 天然唯一，无需运行时隔离   （决策 1B）
  → 旧存档 / 旧深链 / 旧战报零迁移
NPC id = npc_c{cycle}_{i}    （决策 2A，第 1 层兼容旧格式）
i18n = galaxy.* / cycle.* / faction.* 三段式 + CI 校验  （决策 4A）
```

### 落地顺序（2.5 人日）

| 步骤 | 内容 | 人日 |
|---|---|---|
| 1 | `galaxyConfig`（REGIONS_PER_CYCLE 等常量）+ `cycleOfGalaxy` 工具函数 | 0.2 |
| 2 | `allPlayers` / `collectAllPlanets` / `collectVisiblePlanets` 加过滤 + 单测 | 0.3 |
| 3 | `npcId()` 辅助函数 + `createNPCPlanet` 加 cycle 参数 + 单测 | 0.5 |
| 4 | i18n 三段式结构写入 8 个语言包 + `check:i18n` 脚本 | 1.0 |
| 5 | 旧存档回归：跑一遍 `pnpm test`，确认 `cycle=1`、坐标不变 | 0.5 |

> 这 5 步做完，`pnpm test` 应该全绿，且**现有功能行为完全不变**——
> 之后才开始 P0 的生成器，风险最低。

---

## 实施记录（已完成）

| 步骤 | 产出 | 验证 |
|---|---|---|
| 1 | `src/config/galaxyConfig.ts`（12 周目 × 16 星区 = 192，`cycleOfGalaxy`/`galaxyOf`） | `smoke:cycle` |
| 2 | `World.cycle` + `allPlayers` / `collectAllPlanets` / `findMissionTarget` / `findPlanetAt` / `collectVisiblePlanets` 过滤 | `smoke:cycle` 场景 4~6 |
| 3 | `src/core/ids.ts`（`npcIdOf` 第 1 层兼容旧格式）+ `createNPCPlanet(cycle)` | `smoke:cycle` 场景 3 |
| 4 | 8 个语言包新增 `galaxy.*` / `cycle.*` / `faction.*`（57 key）+ `scripts/i18n.mjs` | `pnpm check:i18n` |
| 5 | 回归 | `pnpm test` 全绿（引擎 / 周目 / 服务端） |

新增脚本：

```bash
pnpm run check:i18n   # 校验星系/周目文案在 8 个语言包中齐全
pnpm run smoke:cycle  # 周目作用域与隔离
```

**顺带修复**：`errors.targetProtected` / `errors.attackerProtected` 之前只补了
zh-CN 与 en，本次已补齐 zh-TW / de / ru / ko / ja / es-LA。

**遗留**：de / ru / ko / ja / es-LA 的 57 个星系文案暂为英文占位（已标记 TODO），
以及 193 条历史 i18n 缺口——见 [GALAXY_GAP_REVIEW_2.md §7](./GALAXY_GAP_REVIEW_2.md)。

> 第二轮复核见 [GALAXY_GAP_REVIEW_2.md](./GALAXY_GAP_REVIEW_2.md)：
> 单机 localStorage 上限、名称本地化、全局累加器饿死等新发现。

---

## P0 实施记录（生成器）

| 产出 | 说明 |
|---|---|
| `src/config/galaxyConfig.ts` | 追加 `LAYOUT_CONFIG`（银河平面、星区半径、采样网格、kNN 参数） |
| `src/utils/random.ts` | `hashString` / `mixSeed` / `mulberry32` / `pickWeighted`（确定性随机） |
| `src/types/galaxy.ts` | `StarSystem` / `PlanetProfile` / `Hyperlane` / `CycleLayout` |
| `src/logic/galaxyGen.ts` | 星区布局、恒星系采样、属性推导、行星档案、周目布局缓存 |
| `src/logic/hyperlaneLogic.ts` | 区内 kNN 航道、星区相邻、星门、邻接表、Dijkstra 路径规划 |
| `scripts/galaxy-smoke.ts` | 8 组断言：规模/确定性/布局/连通/属性/路径/行星档案/性能 |

实测（`SEED=20261018`）：

```
[galaxy] 16 星区 × 64 恒星系 = 1024
[galaxy] 确定性：同 seed 一致，不同周目不同图
[galaxy] 布局：最小间距 622（下限 620）/ 星区最小中心距 9494
[galaxy] 连通：区内航道 1822 条 / 星门 30 座，连通分量 1
[galaxy] 属性：经济 6/6 · 恒星 5/5 · 有空间站 368/1024
[galaxy] 路径：1:1:1 → 1:16:1 共 20 段 / 34.8 光年，限射程后不可达
[galaxy] 性能：4 个周目 × 1024 恒星系 = 162.6ms
```

新增命令：`pnpm run smoke:galaxy`（已加入 `pnpm test`）。

---

## P1 实施记录（元数据接入）

| 产出 | 说明 |
|---|---|
| `src/core/galaxyContext.ts` | World ↔ 星图的桥：布局缓存、坐标→恒星系/行星档案、航道跳数 |
| `src/logic/galaxyEconomyLogic.ts` | 经济类型 → 矿脉修正 / 建造研究加成（±20% 硬上限） |
| `src/logic/oreDepositLogic.ts` | 矿脉生成接受修正；`OreDeposits.modifiers` 保证衰减效率一致 |
| `src/logic/galaxyGen.ts` | `getPlanetProfile` 供矿脉偏向使用 |
| `src/logic/npcGrowthLogic.ts` | `initializeNPCByDistance` 增加 `dangerBonus` |
| `src/core/npc.ts` | 按恒星系危险度给 NPC 难度加成（danger 1/2/3 → +0/+1/+2） |
| `src/core/commands.ts` | 传感器阵列按**航道跳数**限射程（1 级 = 2 跳，每级 +1） |

要点：

- `World` 增加 `layoutSeed` 与 `galaxyLayout` 缓存（不落盘），首次查询构建约 40ms；
- 矿脉修正会写进 `OreDeposits.modifiers`，这样"初始储量"能被衰减效率正确还原；
- 飞船/殖民地的矿脉**暂未接入**修正（`processColonizeArrival` 还没拿到 world），列为 P2 待办；
- 传感器阵列扫描现在**需要建筑等级**，服务端冒烟已同步补上（月球建 1 级阵列）。

实测（`smoke:galaxy`）：

```
[galaxy] 经济：矿业修正 metal×1.15，矿脉 4000000000 → 4800000000
[galaxy] 跳数：相邻=1，跨图限 2 跳 → 不可达
```

---

## P2 实施记录（扫描 / 发现 / 命名）

| 产出 | 说明 |
|---|---|
| `Player.discoveredSystems` | `{ at, scans, named?, name?, namedBy? }`，随 `patch.self` 自动同步 |
| `commands: galaxy.scan` | 射程 `2 + 天体物理/2` 跳；消耗 1 探测卫星 + 25 重氢/跳；同系 10 分钟冷却；第一次 L1、第二次 L2 |
| `commands: galaxy.rename` | 2~24 字；首个命名者拥有命名权，名字写入**所有已发现该星系的玩家**的发现记录 |
| `PROTOCOL_VERSION` | 2 → 3 |

**为什么没有改协议加 `systemNames`**：

重命名不需要新的全局字段——把名字写进每个"已发现者"的 `discoveredSystems` 记录里，
就能随现有的 `self` 补丁同步给所有人，且天然只对"已发现该星系"的玩家可见（等于免费的迷雾）。
`World` 上不需要额外的命名表。

新增 6 个错误码（8 语言）：`scanOutOfRange` / `scanNoProbe` / `scanInsufficientDeuterium` /
`scanCooldown` / `renameTooShort` / `renameAlreadyNamed`。

实测：

```
[galaxy] 扫描/命名：tier 2，命名「My Haven」
```

**未做（P3 一起）**：快照仍然下发所有 NPC 星球，没有按"是否已发现"过滤；
客户端也还没有消费 `discoveredSystems` 的界面。

---

## P4 实施记录（航线距离 + 多段航行）

| 产出 | 说明 |
|---|---|
| `src/config/routeMode.ts` | `legacy` / `v2` 灰度开关；服务端读 `ROUTE_DISTANCE_MODE`，客户端读 `VITE_ROUTE_DISTANCE_MODE` |
| `src/logic/fleetRouteLogic.ts` | `previewRoute` / `resolveDistance` / `planMissionRoute` / `advanceMissionLeg` |
| `FleetMission.route` / `routeIndex` | 多段航行的航段与当前段索引 |
| `missions.processMissionArrival` | 到达非最终段时先推进，不做任务结算 |
| `commands.fleet.send` | v2 模式跨恒星系自动切成多段，`arrivalTime` 指向第一段 |

方案 C 常量：`ROUTE_DISTANCE_SCALE = 20`、`CROSS_GATE_PENALTY = 120000`。

实测（`smoke:galaxy`）：

```
[route] 相邻系 legacy 2795 → v2 29801（约 2 分钟）
[route] 多段：20 段，总时长约 63 分钟
```

**已处理的坑**：多段任务的返程时间原本只按"最后一段"计算，会导致回家比出发快得多。
现在 `createFleetMission` 用**全程时长**创建任务，再把 `arrivalTime` 挪到第一段，
返程公式 `arrivalTime - departureTime` 自然等于全程。

**已知缺口**（P5 再补）：

- 航段没有拦截/补给，只是"经过即推进"；
- 舰队列表不显示"第几段"；
- 远征任务不参与多段；
- NPC 任务仍用旧距离公式。

### P4 收尾（玩家可见部分）

| 产出 | 说明 |
|---|---|
| 舰队列表 | 多段任务显示「航段 x / y」 |
| 星图 | 自己舰队的剩余航线画成金色折线，可单独开关 |
| 同步 | 无需改协议：`fleetMissions` 属于 `patch.self` 的 core 字段，`routeIndex` 变化会自动推送 |

已知缺口（留给 P5）：航段没有拦截/补给、远征任务不参与多段、NPC 仍用旧距离公式。

---

## P5 实施记录（第一步：星门归属）

| 产出 | 说明 |
|---|---|
| `src/logic/gateLogic.ts` | `gateOwnerOf` / `gateTollOf` / `buildGateInfos`：按布局种子确定性分配归属 |
| 星图 | 星门连线按归属着色（中立紫、矿业琥珀、自由舰队青、虫群红）；详情面板显示「星门：<派系> · 过路费 N 重氢」 |

实测：`[gate] 30 座星门：中立 13 / 派系 17`。

**尚未实现（P5 后续）**：

1. 驻守舰队推进控制点、满 100 换手（`MissionType.Station` 已存在，可直接复用）；
2. 过路费实际扣费（需要和 `fleet.send` 的燃料结算串起来）；
3. 封锁航道 + 自动绕行；
4. NPC 商队（让星门有稳定收益）。

### P5 第二步：占领机制（纯逻辑）

`src/logic/gateCaptureLogic.ts`：

- `controlRateOf(power)`：`clamp(power/10000, 0.5, 6)` 点/分钟；
- `advanceGateControl(state, garrisons, seconds)`：挑战方净推进，满 100 换手并清零；
- 无驻守时按 `0.5 点/分钟` 衰减；
- 防守方战力更高时净值为负，不会被推进。

实测（`smoke:galaxy`）：`[gate] 占领：6 点/分钟 → 约 17 分钟拿下；防守方优势时不丢门；闲置衰减正常`。

**尚未接入游戏循环**：下一步在 tick 里收集 `MissionType.Station` 驻守舰队，
把战力喂给 `advanceGateControl`，并把 `world.gates` 纳入存档。

### P5 第三步：占领接入 tick

`src/core/gatePhase.ts`：

- `ensureGateStates(world)`：首次访问按布局种子建立星门表（`world.gates`）；
- `tickGatePhase(world, delta)`：收集所有玩家在该恒星系的 `MissionType.Station` 驻守舰队，
  按战力推进控制点，返回换手事件；
- 已接入 `core/engine.tick()` 与 `server/room.ts` 的三阶段循环。

实测：`[gate] 相位：驻守 1:1:51 约 25 分钟内完成占领`。

**仍缺**：`world.gates` 还没写进存档（重启会按种子重建）、换手事件没广播、
过路费/封锁/商队未实现。

### P5 第四步：落盘与公告

- `ServerState.gates`：星门归属随存档持久化，重启不再按种子重建；
- tick 前若内存没有 gates，从 state 恢复；tick 后写回；
- 换手时给**所有玩家**的聊天记录追加一条系统公告（`fromId: 'system'`），
  复用现有 chat 补丁通道，不需要新协议字段。

**仍缺**：过路费、封锁/绕行、NPC 商队。

### P5 第五步：过路费

`src/logic/tollLogic.ts`：

- `resolveGateOwner`：运行时 `world.gates` 优先，否则按种子推导；
- `computeRouteTolls`：只对 **gate 段**收费；中立 / 自家星门免费；
- 玩家所有者的收益进其首星重氢；NPC 派系收益视为系统回收；
- 接入 `fleet.send`：多段任务创建后一次性扣费。

实测：`[toll] 过路费：经过他国星门收 400 重氢，中立/自家免费`。

**仍缺**：封锁与自动绕行、NPC 商队。

### P5 第六步：封锁与绕行

- `planRoute` 增加 `isBlocked` 回调，跳过被封锁的星门航道；
- `blockedGateSystems(world.gates)` 提供封锁集合；
- `previewRoute` 与 `planMissionRoute` 都尊重封锁；全部封锁后跨区不可达，
  `fleet.send` 自动退回单段（自由曲速更贵的简化版）。

实测：`[gate] 封锁：全封后跨区不可达，解封后恢复`。

**P5 仍缺**：NPC 商队（让星门有稳定收益）。

### P5 第七步：NPC 商队（收尾）

`src/logic/caravanLogic.ts`：

- 每 10 分钟生成 2 支商队（最多 6 支），沿星门航道单向飞行 4 分钟；
- 到达时向星门所有者缴纳过路费（玩家入账、派系回收）；
- 由 `tickGatePhase` 顺带推进。

实测：`[gate] 商队：1 支商队到达，星门所有者收到 400 重氢`。

**已知缺口**：商队状态只在服务端，还没通过协议下发给客户端（星图上暂时看不到移动光点）。

P5 至此闭环：归属 → 占领 → 落盘 → 公告 → 过路费 → 封锁 → 商队。

---

## P7 实施记录（第一步：未知信号）

`src/logic/signalLogic.ts`：

- `signalOf(seed, systemId, allIds)`：确定性生成，8% 概率；
- 类型：残骸（资源）/ 遗迹（资源偏晶体）/ 虫洞（指向另一个恒星系）；
- 实测：`[signal] 79/1024 个恒星系存在未知信号`。

**尚未实现**：扫描发现信号、领取奖励、虫洞跳转、星图上的信号标记。

## P6 未完成项

周目排行榜（RankingView 目前是全局榜，未按 cycle 分组）。

### P7 第四步：虫洞穿越

- `signal.warp` 命令：消耗 1000 重氢，标记目标星系为已发现，虫洞一次性；
- 星图面板对虫洞信号显示「穿越」，对残骸/遗迹显示「领取」；
- 实测：`[signal] 虫洞：穿越消耗重氢，发现目标 1:1:36`。

**仍缺**：商队可见性（协议下发）、少量 UI 文案。
