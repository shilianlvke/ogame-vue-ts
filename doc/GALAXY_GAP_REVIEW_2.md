# 星系改造 · 第二轮缺口复核

> 上一轮（[GALAXY_GAP_REVIEW.md](./GALAXY_GAP_REVIEW.md)）找的是"设计与现有代码冲突"。
> 这一轮是在**真正动手改代码之后**再扫一遍：有些问题只有写了代码才会暴露。
>
> 对应已实施的前置改造见 [GALAXY_DECISIONS.md §实施记录](./GALAXY_DECISIONS.md)。

---

## 0. 本轮结论

| 级别 | 问题 | 状态 |
|---|---|---|
| 🔴 | 单机存档在 **localStorage**，12 层会撞 5MB 上限 | ✅ 已迁移 IndexedDB |
| 🔴 | NPC / 星球名称按 **服务端语言** 生成，多语言玩家看到同一串中文 | ✅ 已改为英文程序化命名 |
| 🟠 | `npcGrowthAccum` / `npcBehaviorAccum` 是全局累加器，多周目会互相饿死 | ✅ 已改为按周目 |
| 🟠 | `buildSnapshot` 的 `npcs` 未按周目过滤 | ✅ 已过滤（含签名） |
| 🟠 | `Room.tick` 仍是单层调用，多周目 tick 循环需要重写 | ✅ 已加按层循环骨架 |
| 🟡 | 报告/聊天里的坐标与名称快照会过期 | 未处理 |
| 🟡 | 193 条历史 i18n 缺口（含 `common.success`） | 已量化，未翻译 |
| 🟡 | 12 层倍率与现有 `GALAXY_MULTIPLIER` 叠加关系未定义 | 未处理 |

---

## 1. 🔴 单机存档在 localStorage，这是硬上限

多周目设计里我写的是「服务端按层拆文件」——**只覆盖了联机**。单机模式的存档走的是：

```ts
// SettingsView.vue（导出/导入也是这三个键）
localStorage.getItem(pkg.name)                 // 玩家
localStorage.getItem(`${pkg.name}-universe`)   // 星际地图
localStorage.getItem(`${pkg.name}-npcs`)       // NPC
```

浏览器 localStorage 通常 **5MB**（部分浏览器 10MB，且是字符串编码，中文更占）。
实测服务端世界 JSON 已经是 **820KB**（182 NPC + 4 玩家）。按 12 层推算：

| 层数 | 估算体积 | 结果 |
|---|---|---|
| 1 层（现状） | ~0.8MB | 安全 |
| 4 层 | ~3MB | 接近警戒 |
| 12 层 | ~9MB | **必然爆 QuotaExceededError** |

**这不是"优化"，是"上线就会坏"**。三条路：

| 方案 | 做法 | 代价 |
|---|---|---|
| **A. 迁移 IndexedDB（推荐）** | 单机存档改存 IndexedDB（配额通常按磁盘百分比，几百 MB 起），localStorage 只留轻量设置 | 需要写一层存储适配 + 迁移旧数据 + 导出格式升级 |
| B. 按层懒加载 | 只把"当前层 + 有玩家的层"放进 localStorage，其余压缩后存储 | 压缩后仍可能超；且 localStorage 没有分片能力 |
| C. 单机不做多周目 | 多周目只对联机开放，单机保持单层 | 最省事，但单机玩家没有新内容 |

**建议 A**，并且这件事必须在 P6（多周目）之前完成，否则联机做得再好，单机用户一开新周目就崩。

> 顺带：现有导出/导入是"读三个 localStorage 键拼 JSON"，迁移后要改成"从存储层导出"，
> 并保留 v1 格式的读取（旧备份还能导入）。

> ✅ **已实施**：新增 `src/services/saveStorage.ts`
>
> - `main.ts` 在挂载前 `await initSaveStorage()`：打开 IDB、把数据**一次性读进内存**，
>   之后所有读写仍是同步 API，Pinia 持久化插件与导出/导入**不用改成异步**；
> - 写入走内存 + 200ms 去抖批量落盘；`pagehide` 时尽力 flush；
> - 首次启动自动把 localStorage 旧存档迁到 IDB，成功后删除旧键（省配额）；
> - 没有 IndexedDB 的环境（Node 冒烟、老浏览器）自动回退 localStorage；
> - 三个 store、导出/导入、GM 重置、联机存档备份全部切到 `saveStorage`；
> - **清空存档**（设置页 / GM 重置）改为 `await flushSaveStorage()` 后再刷新——
>   否则异步清空还没落盘就 reload，旧档会"复活"。

---

## 2. 🔴 名称按服务端语言生成，多语言玩家会看到"中文星球"

```ts
// src/core/npc.ts
name: generateNPCName(planet.ownerId, world.locale)
```

`world.locale` 是**整个服务器**一个值（`LOCALE=zh-CN`）。于是：

- 英文玩家连上中文服，看到的是中文 NPC 名与中文星球名；
- 更微妙的是：**同一个恒星系在不同玩家眼里应该叫同一个名字**（共享宇宙），
  但名字现在由生成时的语言决定，且**写进了存档**。

这是"共享世界的命名"与"本地化"的经典冲突。三种解法：

| 方案 | 做法 | 说明 |
|---|---|---|
| **A. 语言无关的生成名 + 客户端本地化（推荐）** | 名字由 `seed` 生成一个"结构"（音节/词根 id），客户端按 locale 渲染 | 需要一套可本地化的音节表；复杂度中等 |
| B. 服务端固定语言 | 接受"全服一个语言"，UI 文案本地化但专有名词不本地化 | 最简单，MMO 常见做法 |
| C. 玩家自定义命名覆盖 | 系统只给编号（`K-3:27`），发现者命名 | 最省成本，但前期星图全是编号 |

**建议**：短期用 **B**（专有名词不翻译，UI 文案翻译），长期在 P7 做 A。
关键是要**现在决定**，否则存档里会积攒一批"中文名"，以后改代价更大。

> 这条和上次 i18n 的教训同源：**"服务端生成的内容"也要考虑多语言**。

> ✅ **已实施（方案 B 的变体）**：名字改为**英文程序化命名**，与语言彻底解耦。
>
> - 新增 `src/logic/nameGenerator.ts`：音节表拼装 + FNV 种子 + NMS 风格后缀
>   （`Xeloth Prime`、`Veyra-7`、`Vex Arano`），同一 id 永远同名；
> - `npcNameGenerator.ts` 退化为兼容层，删掉了 8 套本地化名字库；
> - **NPC 名、NPC 星球名、玩家母星名、殖民地名**全部改为程序化英文名；
> - 旧存档里遗留的中文名可用设置页「更新 NPC 名称」一次性迁移
>   （`countOldFormatNPCs` 按"是否为两个英文词"识别旧格式）；
> - 星球名不再调用 `t('planet.homePlanet')`，因此不会随语言切换而变化。

---

## 3. 🟠 全局累加器会让某些层"饿死"

```ts
// src/core/types.ts
npcGrowthAccum: number
npcBehaviorAccum: number
achievementAccum: number
```

这三个是**世界级**的秒数累加器。多周目后的 tick 若写成：

```ts
for (const cycle of activeCycles) {
  world.cycle = cycle
  tick(world, ctx, delta)   // ← 每个 tick 都 +delta
}
```

第 1 层跑完累加器就超过阈值并被清零，第 2 层永远等不到 —— **后面的层永久不推进 NPC**。

**修复**：把累加器改成按层存放：

```ts
cycleAccum: Record<number, { npcGrowth: number; npcBehavior: number }>
// 或者干脆把累加器放进 CycleState
```

`achievementAccum` 是玩家维度，不受影响。

---

## 4. 🟠 `buildSnapshot` 的 `npcs` 没有按周目过滤

`collectVisiblePlanets` 我已经加了过滤，但快照里还有一段：

```ts
// src/core/protocol.ts
npcs: buildPublicNpcs(world)     // ← 遍历 world.npcs，全部下发
```

`world.npcs` 是由 `ensureNpcRegistry(world)` 从 **`world.planets` 全部条目**建的。
多周目后，A 层玩家会收到 B 层 NPC 的公开档案（名称/坐标/派系）。

**修复**：
- `ensureNpcRegistry` 只处理 `inCurrentCycle(world, planet)` 的星球；
- `buildPublicNpcs` 再兜底过滤一次；
- `npcsSignature`（补丁的变更检测）同样要按层计算，否则补丁会一直抖动。

---

## 5. 🟠 `Room.tick` 仍是单层调用

现在的 tick 是"一遍过"：

```ts
tickPlayerPhase(world, ctx, delta)   // 遍历 allPlayers(world)
tickNpcPhase(world, ctx, delta)      // 全局一次
tickPlayerPostPhase(...)
```

`allPlayers` 现在会按 `world.cycle` 过滤，而 `world.cycle` 默认 1 —— 这意味着
**只要不写多周目 tick 循环，第 2 层及以后的玩家永远不会被 tick**。

这不是 bug（现在只有 1 层），但**是个陷阱**：P6 上线时如果忘了改 tick，第 2 层会"静止"。

**建议**：现在就在 `Room.tick` 里留一个显式的循环骨架（即使只有一个活跃层）：

```ts
for (const cycle of this.activeCycles()) {
  this.world.cycle = cycle
  tickPhase(...)
}
```
并在 `activeCycles()` 里先返回 `[1]`，P6 时再换成真实逻辑。

---

## 6. 🟡 报告与聊天里的"坐标 / 名称"会过期

- 战报、侦查报告、通知里存的是**生成时的名称与坐标字符串**；
- 改版后恒星系可以被首个发现者**改名**；
- 周目是第四维，坐标从 `3:27:2` 变成 `C3:3:27:2`。

于是会出现：「战报说打的是 K-3:27，但现在那个星系叫新名字」。三种处理：

| 方案 | 说明 |
|---|---|
| A. 报告只存 id，渲染时实时解析（推荐） | 永远显示最新名字；代价是渲染时要查表 |
| B. 存快照名 + 标注"（旧称）" | 保留历史真实感 |
| C. 不管 | 接受不一致 |

**另外**：聊天里的坐标应支持 `C3:3:27:2` 这种格式并**可点击跳转星图**——
4 维坐标靠手输是不可能的。这是一个低成本高体验的点。

---

## 7. 🟡 i18n：193 条历史缺口

新加的 `check:i18n` 第一次跑就抓到了存量问题：

```
✅ en     1906 keys · 历史缺口 1        （common.success 缺失）
✅ zh-TW  1987 keys · 多余 161 · 历史缺口 30
✅ de     1876 keys · 英文占位 57 · 历史缺口 31
...
合计 193 条
```

- `common.success` 在 en/de/ja/es-LA/ko 缺失 → 某个 toast 在英文界面会显示原始 key；
- `errors.*` 有 30+ 条只在 zh-CN 里（多是我之前补新手保护时只加了两三种语言）；
- zh-TW 反而**多出 161 条**（`guide.*` 等），说明语言包长期各自演化。

**建议**：单独开一个"i18n 大扫除"任务（约 1 人日）：
1. 用 `node scripts/i18n.mjs fill` 的机制批量补缺；
2. 英文能机器翻译的先补，其余标 `TODO(i18n)`；
3. 把 `check:i18n` 从"只校验新区块"升级为"全量校验"。

---

## 8. 🟡 数值叠加关系没定义

现有矿脉公式里有 `GALAXY_MULTIPLIER: 0.05`（每个银河 +5%）。
新设计引入了三层倍率：

```
层倍率（周目）× 经济类型 × 行星资源偏向 × 现有 GALAXY_MULTIPLIER
```

四者相乘可能互相放大。**必须在 P1 前定义清楚**：

- 层倍率作用于**产出**还是**矿脉储量**？
- `GALAXY_MULTIPLIER` 保留、替换还是废弃？
- 叠加后是否截断到 `[0.5, 2.0]`？

建议：层倍率只作用于**产出**，矿脉用"经济类型 + 行星偏向"，`GALAXY_MULTIPLIER` 废弃（或并入层倍率）。

---

## 9. 🟡 其它想得到但还没写进文档的

| 主题 | 缺口 | 建议 |
|---|---|---|
| **星图搜索** | 1024 个恒星系，没有搜索框 | 按名称/坐标搜索 + 最近访问列表 |
| **可访问性** | 6 种经济色 + 3 档危险的色觉友好性未验证 | 加形状/图标编码，做一次 deuteranopia 模拟 |
| **低端机性能** | 1024 节点 SVG 在千元机上可能掉帧 | 区域视图只渲染视口内节点；必要时降级为 Canvas |
| **成就** | 全是单层语义（殖民数），没有"发现/周目"成就 | 新增发现类成就与"最高抵达层"徽章 |
| **排行榜** | `PlayerPublicProfile` 没有 `cycle` 字段 | P6 前加字段，否则榜单无法分层 |
| **NPC 商队** | 上轮提了但没细化 | 复用现有 NPC 舰队任务，每小时生成 2~3 支，缴纳过路费 |
| **未知信号** | 上轮提了但没细化 | 每星区 3~5 个，随扫描刷新，几天后消失 |
| **回滚开关** | 出问题无法切回旧星图 | `GALAXY_MODE=legacy` 环境变量 |
| **监控** | 无法观测 tick 耗时/各层人数 | `/health` 里加 `cycles` 字段 |
| **命名滥用** | 发现者命名没有审核 | 敏感词过滤 + GM 重置命令 |
| **周目与保护期** | 跃迁落地后立刻可能被打 | 落地给 24~48h 保护（可被主动攻击打破） |

---

## 10. 与上一轮的关系

| 上一轮提出 | 本轮状态 |
|---|---|
| NPC id 跨层冲突 | ✅ 已修（`npcIdOf` + 第 1 层兼容旧格式） |
| 单层扁平表 | 🟡 已加"轻量过滤"（`world.cycle` + 6 个入口），但 `npcs`/累加器还有残留 |
| 快照跨层泄露 | 🟡 行星已过滤，`npcs` 未过滤 |
| 传感器阵列无范围校验 | ❌ 未做（P1） |
| 出生点硬编码 | ❌ 未做（P0 后） |
| 导出格式 | ❌ 未做（与 §1 IndexedDB 一起做） |
| 深链接 / 报告坐标 | ❌ 未做（P3） |
| 周目作用域 | ✅ 已实施并被 `smoke:cycle` 覆盖 |
| i18n 结构 | ✅ 三段式已落地 + CI 校验（历史缺口已量化） |

---

## 11. 建议的优先级（P0 之前还能做的三件小事）

> ✅ **已在同一次提交中完成**，详见 §12。

1. **`Room.tick` 留出多周目循环骨架**（半天，避免 P6 忘改）
2. **`ensureNpcRegistry` / `buildPublicNpcs` 按层过滤**（半天，补完隔离）
3. **`npcGrowthAccum` 改为按层**（半天，避免"饿死"）

这三件都是小改动，但能把"半隔离"变成"真隔离"，建议和 P0 一起做。

---

## 12. 三项小修实施记录

| 项 | 改动 | 验证 |
|---|---|---|
| tick 骨架 | `Room.activeCycles()` 返回要模拟的周目（当前=有玩家的层），tick 按层循环三阶段 | 服务端冒烟全绿 |
| NPC 隔离 | `ensureNpcRegistry` 只处理 `inCurrentCycle` 的星球，并记住 `npcRegistryCycle`；`buildPublicNpcs` 与 `npcsSignature` 都按层过滤 | `smoke:cycle` 场景 9 |
| 累加器 | `npcGrowthAccum` / `npcBehaviorAccum` 改为 `Record<cycle, number>` | `smoke:cycle` 场景 8 |

两个容易踩的细节：

1. **存档恢复不能重建注册表**：`npcRegistryCycle` 在旧存档里不存在，若直接按
   "cycle 不匹配就重建"处理，会把已保存的外交关系/难度/冷却全部冲掉。
   现在的逻辑是：注册表非空且未记录周目 → **直接认领**，只设置标记。
2. **补丁签名也要过滤**：`npcsSignature` 若基于全部 NPC，其它层的 NPC 会让签名
   每次都"变化"，导致每个 tick 重发整份 NPC 列表。
