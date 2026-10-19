# 联机改造说明

本文记录把本项目从「纯单机」改造为「可联机」的架构决策与当前进度。

## 1. 结论先行

本项目可以改造成轻度联机，且底子优于一般单机游戏：

- `src/logic` 层原本就几乎不依赖 Vue（22 个文件，零 Vue import）；
- `Planet.ownerId` 与 `defender: Player | null` 参数已经存在，多玩家抽象早有预留；
- 资源采用「按 `lastUpdate` 惰性结算」，天然支持离线收益与断线重连；
- 世界状态（game / universe / npcs）本身可整体序列化为 JSON。

真正的成本不在网络层，而在于**把游戏仿真从「每个客户端各跑一份」变成「唯一权威源」**——
因为共享宇宙里同一个 NPC 不能被两个客户端各自模拟。

## 2. 分层结构

```
┌─────────────────────────────────────────────┐
│ 浏览器客户端（Vue / Pinia）                  │
│  App.vue：只做「把 store 引用交给引擎」+ 事件呈现 │
│  视图：只调 dispatchCommand()，不直接改 store   │
└───────────────────┬─────────────────────────┘
                    │ 命令 / 直接调用（单机）
┌───────────────────▼─────────────────────────┐
│ src/core —— 无头核心（不依赖 Vue / DOM / Worker）│
│  types.ts      World / EngineContext / 事件    │
│  world.ts      宇宙地图查询、就地修改工具        │
│  engine.ts     tick()：整个游戏的 1 秒心跳      │
│  missions.ts   舰队任务 / 导弹结算             │
│  npc.ts        NPC 注册表、成长、行为           │
│  generate.ts   NPC 星球生成                   │
│  battleRunner.ts 战斗执行器（可注入）           │
│  commands.ts   命令层：校验 + 状态变更的唯一入口  │
│  runtime.ts    客户端运行时（world + ctx + dispatch）│
└───────────────────┬─────────────────────────┘
                    │ 复用
┌───────────────────▼─────────────────────────┐
│ src/logic —— 纯游戏规则（无框架依赖）          │
└─────────────────────────────────────────────┘
```

同一套 `src/core` + `src/logic` 将来既被浏览器调用，也被 Node 服务端调用。

## 3. World：引擎唯一的状态入口

```ts
interface World {
  player: Player                    // 单机=本地玩家；服务端=本 tick 推进的玩家
  planets: Record<string, Planet>   // 非玩家星球（对应 universeStore.planets）
  npcs: NPC[]                       // 对应 npcStore.npcs
  debrisFields: Record<string, DebrisField>
  locale: Locale
  gameSpeed: number
  battleToFinish: boolean
  npcGrowthAccum: number            // 原 npcUpdateCounter
  npcBehaviorAccum: number          // 原 npcBehaviorCounter
  achievementAccum: number          // 原 achievementCheckCounter
}
```

**核心约定：引擎只做就地修改（in-place mutation），绝不重新赋值 World 字段。**
客户端把 Pinia state 里的对象直接塞进 `World`，就地修改才能触发 Vue 响应式；
数组的增删一律走 `splice/push`（见 `replaceArray`）。

单机模式下 `World` 只在 `App.vue` 初始化一次，`player / locale / gameSpeed / battleToFinish`
每个 tick 从 store 同步一次，其余字段（累计器）跨 tick 保持。

## 4. 事件：引擎不碰 UI

引擎通过 `ctx.emit()` 抛出语义事件，客户端决定怎么呈现：

| 事件 | 客户端行为 |
|---|---|
| `queueComplete` | 建造/研究完成通知（浏览器通知 + toast） |
| `unlocks` | 新解锁通知 |
| `toast` | NPC 贸易/情报/援助等提示条 |
| `achievement` | 成就解锁 toast |

服务端联机时，这些事件会被翻译成推送给对应玩家的消息，而不再依赖浏览器 Notification。

## 5. 代码搬迁对照

| 原位置（App.vue） | 新位置 |
|---|---|
| `updateGame` | `core/engine.ts` → `tick()` |
| `processMissionArrival` / `processMissionReturn` | `core/missions.ts` |
| `processNPCMissionArrival` / `processNPCMissionReturn` | `core/missions.ts` |
| `processMissileAttackArrival` | `core/missions.ts` |
| `updateNPCGrowth` / `updateNPCBehavior` / `updateNPCRelationStats` | `core/npc.ts` |
| `syncNPCPlanetToUniverse` / `removeIncomingFleetAlertById` | `core/world.ts` |
| `generateNPCPlanets` | `core/generate.ts` |
| `checkAchievementUnlocks` | `core/engine.ts` |
| 被消灭 NPC 清理 | `core/engine.ts` |

行为保持一致的细节：

- tick 内执行顺序完全沿用原实现（军官过期 → 队列 → 玩家任务 → 导弹 → NPC 任务 → NPC 成长 → NPC 行为 → 成就 → 战役 → 清理）；
- 任务目标解析顺序（自己的星球按月球类型精确匹配 → 自己的星球任意类型 → 宇宙地图）沿用 `findMissionTarget`；
- NPC 攻击到达由原来的「`.then` 异步回调」改为「在 tick 中 await」，避免服务端出现未结算的副作用；
- 舰队任务 / NPC 任务遍历改为数组快照，避免结算过程中修改数组导致漏处理；
- 时间戳统一使用 tick 传入的 `now`，便于服务端与测试复现。

## 6. 逻辑层解耦

| 原依赖 | 处理方式 |
|---|---|
| `fleetLogic` 里 3 处 `useGameStore()`（只为读 `battleToFinish`） | 改为函数参数传入 |
| `battleLogic` 依赖 `workerManager`（Vue + Vite `?worker`） | 改为可注入的 `BattleRunner`：浏览器注入 Worker 版，Node 默认直算 |
| 浏览器通知 / toast | 改为 `ctx.emit()` 事件 |

浏览器端在 `App.vue` 初始化时调用 `setBattleRunner(workerBattleRunner)`，
因此**性能特征不变**（战斗仍在 Worker 中计算）；Node 环境无需任何初始化即可直算。

## 7. 验证

```bash
pnpm typecheck     # vue-tsc：前端 + 服务端 + 脚本三个 project
pnpm smoke         # 无头引擎冒烟测试（Node 环境）
pnpm smoke:server  # 服务端冒烟测试（真实 WebSocket 客户端）
pnpm test          # 以上三项串起来
```

`pnpm smoke` 会做三件事：

1. **服务端场景**：在纯 Node 环境（无 Vue / DOM / Worker）创建世界，生成 200 个 NPC，
   强制 5 个 NPC 敌对，快进模拟 6 小时（4320 ticks），断言：NPC 会侦查、会攻击、
   战斗结算正常、所有资源数值有限且非负。
2. **客户端场景**：用 Vue 的 `reactive()` 复现 Pinia 语义，断言引擎的就地修改
   能落到原对象上、引用不被切断、建造队列能完成并抛出 `queueComplete` 事件。
3. **命令场景**：断言资源不足的命令被拒绝且无副作用、合法命令正确扣费入队、
   操作他人星球被拒绝、舰队派遣会扣舰队与燃料、军官招募/解雇生效。

`pnpm smoke:server` 的覆盖范围见 §9。

## 8. 命令层（阶段 2 第 1 步，已完成）

### 为什么需要

只要 UI 还能直接 `gameStore.player.xxx = ...`，服务端就无法信任客户端。
命令层把「玩家意图」变成可序列化、可校验的数据，服务端复用同一份校验逻辑。

### 结构

```
视图 ──dispatchCommand(command)──▶ runtime ──applyCommand(world, ctx, command)──▶ 校验 + 逻辑
                                       │
                                       └─ 服务端可跳过 runtime，直接调用 applyCommand
```

- [commands.ts](../src/core/commands.ts)：`GameCommand` 联合类型 + `applyCommand()`
- [runtime.ts](../src/core/runtime.ts)：客户端单例（持有 `world` / `ctx` / `sync`）

### 已覆盖的命令

| 分类 | 命令 |
|---|---|
| 建筑 | `building.upgrade`、`building.demolish`、`building.cancel` |
| 研究 | `research.start`、`research.cancel` |
| 船厂 | `ship.build`、`ship.scrap`、`defense.build` |
| 舰队 | `fleet.send`、`fleet.recall` |
| 导弹 | `missile.launch` |
| 传感器阵列 | `phalanx.scan` |
| 军官 | `officer.hire`、`officer.renew`、`officer.dismiss` |
| 星球 | `planet.abandon` |
| 等待队列 | `queue.addWaiting`、`queue.removeWaiting` |

配套改动：`PHALANX_SCAN_COST` 从 `GalaxyView` 硬编码移入 `core/commands.ts`，
扫描扣费改由命令完成（服务端会重新校验余额）。

### 仍未收敛的写操作（有意保留，见 §9）

| 位置 | 内容 | 处理计划 |
|---|---|---|
| `CampaignView` | 战役进度、分支选择 | 阶段 3 一并命令化 |
| `MessagesView` | 战报/侦查报告标记已读、清空 | 属于本地 UI 状态，不上行 |
| `FleetView` | `fleetPresets` | 玩家本地偏好 |
| `SettingsView` / `HomeView` | 主题、隐私协议、检查更新 | 本地偏好 |
| `GMView` | 调试后门 | 联机模式必须在服务端禁用 |

### 服务端接入方式

```ts
import { applyCommand } from '@/core/commands'

const result = applyCommand(world, ctx, command)
if (!result.ok) socket.send({ t: 'reject', reason: result.reason })
```

因为 `applyCommand` 只接受「命令 + 世界」，服务端可以在落库前做二次校验、
也可以把同一条命令回放给其它客户端做视觉同步。

## 9. 联机服务端（阶段 2 第 2 步，已完成）

### 运行方式

```bash
pnpm build              # 前端产物 docs/
pnpm build:node-server  # 服务端产物 server-dist/
pnpm start:server       # 单进程同时提供静态资源 + WebSocket

pnpm test               # 类型检查 + 引擎冒烟 + 服务端冒烟
```

环境变量（见 [server/main.ts](../server/main.ts)）：

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `25122` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `STATIC_DIR` | `docs` | 前端构建产物 |
| `DATA_DIR` | `data` | 存档目录（`world.json`） |
| `GAME_SPEED` | `1` | 游戏速度倍率 |
| `NPC_COUNT` | `200` | 新建世界的 NPC 星球数 |
| `VISIBILITY` | `public` | `public`（防透视）/ `full`（调试） |
| `LOCALE` | `zh-CN` | 默认语言 |
| `NEWBIE_PROTECTION_HOURS` | `24` | 新账号新手保护期（0 = 关闭） |
| `COMMAND_RATE_LIMIT` | `30` | 每秒每人命令上限 |
| `TICK_MS` | `1000` | tick 间隔 |
| `AUTOSAVE_MS` | `30000` | 自动存档间隔 |

运维接口：`GET /health`、`GET /api/info`；游戏入口：`ws://<host>:<port>/ws`。

### 进程内结构

```
server/
  main.ts    CLI 入口（读环境变量、打印地址、优雅退出）
  app.ts     HTTP + WS + tick 定时器 + 自动存档
  room.ts    Room：玩家/会话/tick/命令队列/补丁广播
  state.ts   ServerState 定义、创建、序列化
  persist.ts 存档原子写入（tmp + rename）
  http.ts    静态资源 + SPA 回退 + 目录穿越防护
```

### 多人 tick 模型

引擎被拆成三段（单机的 `tick()` 仍按原顺序串起来）：

| 阶段 | 执行次数 | 内容 |
|---|---|---|
| `tickPlayerPhase` | 每个玩家 1 次 | 队列、舰队任务、导弹 |
| `tickNpcPhase` | 每 tick 1 次 | NPC 任务、成长、行为（视角按玩家轮转） |
| `tickPlayerPostPhase` | 每个玩家 1 次 | 成就、战役、全局 NPC 清理 |

这样 NPC 的成长/行为不会随玩家数量线性放大；`world.player` 在阶段间切换，
命令则进入队列，**只在 tick 之外执行**，避免异步战斗结算期间被命令打断。

### 协议要点

| 消息 | 方向 | 说明 |
|---|---|---|
| `hello` | C→S | 名字 + 密码/令牌 + 语言；协议版本不匹配直接断开 |
| `welcome` | S→C | `playerId`、`token`、全量 `snapshot` |
| `cmd` | C→S | `{ seq, command }`，服务端 `applyCommand` 校验 |
| `ack` / `reject` | S→C | 命令结果（`reject` 带 i18n reason） |
| `patch` | S→C | 增量：自己的变化字段、变化的公开星球、NPC/残骸/玩家档案、事件 |
| `ping` / `pong` | 双向 | 心跳 |

**可见性**：`public` 模式下，别人的星球只下发
`id / name / ownerId / position / isMoon / temperature / oreDeposits`，
资源、建筑、舰队、防御、队列一律清零；NPC 自带星球的**公开视图**（供银河/外交页聚合），
但不含舰队、科技与舰队任务。`protocol.ts` 的 `buildPatch` 用「上次发送的 JSON」做差异，
且星球公开视图不包含 `lastUpdate`、矿脉按千位取整，避免每秒产生全宇宙增量。

### 存档与重连

- 每 30 秒（可配）落盘一次，退出时再存一次；写入走临时文件 + rename；
- 令牌存在账号里，客户端带着 `token` 重连即可回到同一个玩家；
- 玩家离线后舰队继续飞行、资源继续产出（懒结算），下次登录结算离线收益。

### 已验证（`pnpm smoke:server`）

真实 WebSocket 客户端跑通：`/health`、协议版本拒绝、双人登录、
母星坐标不冲突、**公开视图不泄露资源/舰队/队列**、命令被拒绝/被接受、
增量补丁、公开星球改名可见、tick 推进资源、令牌重连、存档重启恢复、在线人数，
以及最后一段 **真实客户端 store 端到端**（见 §10）。

### 反向代理（公网部署）

服务端已经自带静态资源，直接暴露端口即可；若前面有 nginx，需要额外转发 WebSocket：

```nginx
location /ws {
    proxy_pass http://127.0.0.1:25122;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```

其余路径照常 `proxy_pass` 即可。手机端（Capacitor）连 `ws://` 会受混合内容限制，
公网部署建议上 HTTPS + WSS。

## 10. 客户端联机模式（阶段 2 第 3 步，已完成）

### 入口：首页即「模式选择 + 联机登录」

`/`（首页）不再自动跳转总览，而是常驻的主菜单：

- **单机模式卡片**：有本机存档时显示「继续单机游戏」，否则「开始游戏」；
  联机进行中该卡片禁用（避免用服务器存档跑本地 tick）；
- **联机模式卡片**：未连接时是登录表单（服务器地址 / 昵称 / 密码），
  已连接时显示状态徽章、玩家名、服务器地址与「进入游戏」；
- 首次点击任一模式都会先弹出隐私协议确认；
- 侧边栏顶部的 Logo 和设置页右上角的「主菜单」按钮都能回到这里。

配套的导航修正：以前「切换星球」等操作会 `push('/')` 并依赖旧的
`/ → /overview` 重定向来刷新页面；现在这些位置统一改为 `push('/overview')`。

### 结构

```
src/net/
  apply.ts         snapshot / patch → 本地状态（纯函数，可单测）
  onlineClient.ts  WebSocket 连接、自动重连、心跳
  messages.ts      联机错误码 / 状态 → i18n key 的映射
src/stores/
  netStore.ts      联机配置、存档备份、消息分发、命令上行
src/views/
  HomeView.vue     首页：单机 / 联机模式选择与登录
src/components/settings/
  OnlinePanel.vue  设置页里的「联机模式」面板（换号 / 恢复单机存档）
src/components/chat/
  ChatPanel.vue    联机模式下的银河频道浮动面板
```

### 数据流

```
服务器 ──welcome/patch──▶ netStore.handleWelcome/handlePatch ──▶ apply*() ──▶ Pinia
UI ──dispatchCommand──▶ runtime ──(联机)──▶ OnlineClient ──cmd──▶ 服务器 ──patch──▶ Pinia
```

- `dispatchCommand` 在联机模式下**只负责提交**，返回 `{ ok: true }` 表示已发送；
  真正的拒绝通过 `reject` 消息异步回到 UI（`toast` 提示原因）。
- `apply.ts` 全部是就地修改（`replaceObjectContents` / `replaceRecord` / `replaceArrayContents`），
  保持 Pinia 里的对象引用不变，响应式更新与单机完全一致。
- 本地 tick 在联机模式下不再推进世界（`updateGame` 只更新时间戳），
  积分与成就也由服务端计算——保证唯一权威源。
- 联机相关的文案统一走语言包：`home.mode*`（模式选择）、`online.*`（登录/状态/错误）、
  `chat.*`（银河频道），8 种语言全部补齐；`messages.ts` 只负责把服务端错误码
  （`auth:wrong_password` 等）映射成 `online.error.*` 的 key，不再内嵌文案。

### 存档安全

- 首次连接时把三份单机存档（`game` / `universe` / `npcs`）原样备份到
  `ogame-vue-ts-local-backup:*`，退出联机可一键恢复并刷新；
- 联机配置写在**独立**的 `ogame-vue-ts-online` 键里（含 `enabled`、地址、昵称、令牌），
  下次打开页面会自动重连；
- 主题、引导、隐私协议等本机偏好不会因为服务器快照而丢失（`LOCAL_PLAYER_FIELDS` 白名单）。

### 已验证

`scripts/server-smoke.ts` 的最后一段会：
1. `setActivePinia(createPinia())`，用**真实的 `useNetStore` / `useGameStore`**；
2. `netStore.connect()` → 收到 `welcome` → 断言 Pinia 里出现了服务器玩家、可见星球、NPC；
3. `dispatchCommand({ type: 'building.upgrade' })` → 服务端 `ack` → `patch` 回写 → 断言队列出现在 Pinia；
4. 重复入队 → 服务端 `reject` → 断言拒绝原因 `errors.buildingAlreadyInQueue`；
5. 断开 → 状态回到 idle。

也就是说「客户端 store ↔ WebSocket ↔ 服务端权威校验」这条链路已经在 Node 里真实跑通，
剩下的只有 Vue 渲染层（需要浏览器手工验证）。

## 11. 阶段 3 进展

### 已完成：PvP 战报路由

真人互打时，双方都会拿到战报，防守方还会收到来袭警报：

| 场景 | 攻击方 | 防守方 |
|---|---|---|
| 派遣攻击 | 任务创建 | **立即**收到 `incomingFleetAlerts`（发起者名字 + 舰队规模 + 到达时间） |
| 攻击到达 | 战报入 `battleReports` | 战报入 `battleReports`（独立副本，已读状态互不影响）+ 警报清除 |
| 侦查 | 侦查报告 | `spiedNotifications`（谁在什么时候侦查了哪个星球） |
| 行星毁灭 | 战报 + 任务报告 | 战报 + 星球从名下移除 + 警报清除 |

实现要点：

- 来袭警报在 [commands.ts](../src/core/commands.ts) 的 `fleet.send` 里创建（服务端权威，
  客户端发不出伪造警报）；`incomingFleetAlerts` 复用 `npcId/npcName` 字段存放发起者。
- [missions.ts](../src/core/missions.ts) 里所有 PvP 分支都按 `ownerId` 解析真正的防守方，
  战报写入防守方自己名下，随下一次补丁下发。
- 同时修了一个既有 bug：**战斗生成的月球属于目标星球的主人**（原来会被塞进攻击方星球列表）。
- 行星被摧毁时按「拥有者」移除星球（原来只查 `world.player.planets`，PvP 下会漏删）。

### 已完成：排行榜含真人

`PlayerPublicProfile` 增加了各分类积分（服务端用 `rankingLogic.calculatePlayerScores` 算出），
[RankingView](../src/views/RankingView.vue) 在联机时会并入其他真人玩家。

### 已完成：NPC 多玩家化

服务端每 tick 只跑一次 NPC 阶段，因此「NPC 该找谁」必须逐 NPC 决策。

**目标选择**（[selectNPCBehaviorTarget](../src/logic/npcBehaviorLogic.ts)）：

1. 先过滤出与自己**敌对**的玩家；
2. 在候选里选**最近**的一个（跨星系距离权重最高，其次是星系内坐标）；
3. 没有敌对关系时，在全部玩家里选最近的——贸易、情报、援助这些中立/友好行为
   会自然落到星系邻居身上。

这样 NPC 的注意力按星系位置自然分布，而不是只盯着轮转到的那个玩家。

**配套修复的两个跨玩家 bug**：

| 问题 | 原行为 | 现在 |
|---|---|---|
| NPC 攻击目标与关系检查不一致 | 随机挑一份侦查报告，可能打「非当前检查对象」的玩家 | 只攻击当前目标玩家的星球 |
| 反击警报投递给错误玩家 | 一律写进传入的 `player` | 按目标星球 `ownerId` 投递给真正的主人 |

**事件投递**：`EngineContext.emit` 增加可选的 `playerId`，NPC 的贸易/情报/援助提示
会发给对应的目标玩家，而不是当前 tick 的「环境玩家」。

**验证**（`pnpm smoke` 场景 E）：8 个 NPC 分居两个玩家旁边，全部设为侵略型并敌对，
断言「敌对优先」「距离兜底」两条规则，并跑真实行为 + 任务到达，
最终 Alice 与 Bob **各被侦查 4 次**（改造前只有轮转到的那个玩家会被针对）。

### 已完成：传感器阵列服务端结算

联机模式下 NPC 的舰队任务不下发客户端，因此扫描必须由服务端算：

1. 命令改为 `phalanx.scan { moonId, targetPosition }`；
2. 服务端扣重氢后，用 `collectFleetsAt()` 收集「出发地或目的地在目标坐标」的所有任务
   （NPC 与其它玩家的都算），放进 `CommandSuccess.scan`；
3. 房间把结果作为独立的 `scan` 下行消息发给发起者（命令返回值无法同步带回客户端）；
4. 客户端 `netStore.waitForScan(token)` 等待本次结果，[GalaxyView](../src/views/GalaxyView.vue)
   在联机时走这条路径，单机仍保留本地读取逻辑。

### 已完成：账号与运营能力

**账号体系**（[server/auth.ts](../server/auth.ts)）

- 新账号必须设置密码（≥4 位），服务端用 `scrypt` + 随机盐哈希，常数时间比较；
- 昵称唯一（不区分大小写），重名会返回 `auth:name_taken`；
- 令牌（token）用于同设备自动重连；换设备时用「昵称 + 密码」登录，
  服务端会**续发新令牌**并作废旧令牌；
- 认证失败返回 `auth:*` 错误码，客户端本地化提示后停止重连，让用户改正再试。

**新手保护**

- 新账号默认 24 小时保护期（`NEWBIE_PROTECTION_HOURS` 可配，0 关闭），
  写在 `Player.protectionUntil` 上；
- 保护期内**双向生效**：不能攻击/侦查别人，也不会被别人攻击或导弹袭击；
- 判定在命令层完成（`fleet.send` / `missile.launch`），客户端无法绕过。

**GM 后门**

- 联机模式下路由守卫直接屏蔽 `/gm`，科乐美秘籍也不再激活 GM；
- GM 面板本身仍是纯本地改状态，即使绕过也会在下一个补丁被服务端覆盖。

**限流与日志**

- `COMMAND_RATE_LIMIT` 控制每秒命令数，超限直接 `reject` 并打一条日志；
- 未知命令类型（通常意味着客户端被篡改）会记录 `[room] 非法命令`。

### 已完成：银河频道聊天

- 命令：`chat.send { text, toPlayerId? }`，`text` 截断到 160 字，同一玩家 **1 秒最多一条**；
- 公共频道写入**所有玩家**的 `chatMessages`，私聊只写入双方；
- 每个玩家只保留最近 100 条，随补丁的 `reports.chatMessages` 下发（断线重连也能看到历史）；
- 客户端是右下角的浮动面板（[ChatPanel.vue](../src/components/chat/ChatPanel.vue)），
  只在联机模式渲染，带未读角标与 1 秒发送冷却。

### 待办

1. **真人外交**：目前真人之间只有聊天与战斗，没有结盟/互不侵犯/资源援助；
2. **NPC 成长锚点**：NPC 的距离难度在首次生成时锚定到当时玩家的母星
   （见 §12），多玩家时可按「最近玩家」重新锚定；
3. **账号找回**：目前没有邮箱/密保，忘记密码只能重新开号（令牌仍可重连）。

## 12. 已知取舍

- `ctx.random` 可注入，但 `src/logic` 内部仍有 `Math.random()`（战斗、月球、NPC 决策）。
  服务端作为唯一仿真源时这不成问题；若将来要做「回放/确定性复现」，需要统一随机源。
- 引擎仍是「单玩家视角」（`world.player`），服务端通过切换 `world.player` 串行推进；
  真正的事件级并发（多名玩家同一 tick 内互相攻击）没有做仲裁，属于阶段 3。
- 等待队列的「添加」已命令化（`queue.addWaiting`，覆盖建筑/研究/舰船/防御）；
  执行时仍会重新走一遍资源/前置条件校验（`waitingQueueLogic.processAllWaitingQueues`），
  因此不构成资源层面的信任漏洞。
- 联机模式下 `dispatchCommand` 是「提交式」：本地返回 `{ ok: true }` 后等待服务端补丁，
  因此资源不足这类拒绝会晚一个 RTT 才提示（`reject` → toast），
  而不是像单机那样同步弹窗。UI 的按钮禁用仍按本地状态判断，正常流程无感。
- NPC 明细（科技、舰队任务、侦查报告）不下发；需要这些情报的玩法统一走服务端结算
  （传感器阵列已经这样实现，见 §11）。
- NPC 的**距离难度**在首次生成时锚定：`updateNPCGrowthByDistance` 只在
  `distanceToHomeworld === undefined` 时计算一次，所以世界里的 NPC 实力梯度
  是相对「第一个加入的玩家」展开的。多人时这是一个合理的近似（远端 NPC 依然更弱），
  若要按每个玩家分别缩放，需要把难度改成「相对最近玩家」并接受随玩家移动而重算。
- NPC 行为仍以「一次处理一个目标玩家」为单位：同一个 NPC 的侦查/攻击冷却
  （`lastSpyTime` / `lastAttackTime`）是全局的，因此它对 A 行动后会同样冷却一段时间
  才会考虑 B。这是有意的（一个 NPC 只有一支侦察队），也避免了群发式袭击。
- 月球归属修正后，单机玩家不会再因为「攻击 NPC 触发月球」而白拿一颗月球
  （那颗月球本来就不是他的）；玩家获得月球的正常途径仍是防守 NPC 进攻。
- 账号目前没有找回流程：忘记密码只能重新注册（同设备仍可用令牌继续）。
  公网长期运营建议后续接入邮箱/第三方登录，或由管理员签发一次性邀请码。
- 新手保护只看时间（默认 24h），没有 OGame 那种「积分区间保护」；
  若需要更精细的匹配，可在 `isProtected` 里叠加积分差判断。

## 13. 排障：同一浏览器的两个窗口

**现象**：两个（无痕）窗口分别用不同昵称连服务器，结果两边不停「断线-重连」，
而且别人看到的聊天发送者永远是最先登录的那个账号。

**原因**：同一个浏览器的多个窗口（包括同一无痕会话里的多个窗口）**共享 localStorage**。
第二个窗口读到了第一个窗口保存的登录令牌，于是两个连接都被服务端认成同一个玩家：
- 每次新连接都会把旧连接顶掉（`replaced`）→ 客户端自动重连 → 再顶掉对方，形成死循环；
- 聊天消息的发送者取自服务端玩家对象，两个窗口其实是同一个玩家，所以昵称永远是第一个账号。

**已修复**（服务端 + 客户端双保险）：

| 位置 | 修复 |
|---|---|
| `server/room.ts` | 令牌与请求昵称不一致时忽略令牌，按新登录处理 |
| `netStore.connect()` | 只有「输入的昵称 == 令牌所属账号」时才携带令牌 |
| `onlineClient` | 收到 `replaced` 关闭原因时**停止重连**，状态置为错误 |
| `OnlinePanel` | 提示「该账号已在其它窗口登录」，并说明多开方式 |

**正确的多开方式**：

- 两个账号：用**不同浏览器**，或「一个普通窗口 + 一个无痕窗口」；
- 同一浏览器想换号：先点设置里的「恢复单机存档」（会刷新页面并退出联机），
  再用另一个昵称 + 密码连接（昵称与令牌不一致会自动按新账号注册）。


