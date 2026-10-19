# 联机状态一致性审计

> 背景：联机模式下服务端权威，任何"只改客户端 store"的操作都会被下一次补丁覆盖。
> 本文件记录全量扫描结果与优先级。

## 已修复

| 功能 | 修复方式 |
|---|---|
| 行星改名 | `planet.rename` 命令 |
| 恒星系改名 | `galaxy.rename` 命令 |
| 等待队列（建造/研究/舰船/防御） | `queue.addWaiting` 命令 |
| 消息中心删除 / 清空 / 标记已读 | `messages.clear` / `messages.delete` / `messages.markRead` 命令 |
| 外交通知标记已读（含来袭警报） | `messages.markRead` 命令 |
| 礼物接受 / 拒绝 | `diplomacy.respond`（`kind: 'gift'`） |
| NPC 贸易提议接受 / 拒绝 | `diplomacy.respond`（`kind: 'trade'`） |
| 玩家交易创建 / 接受 / 拒绝 / 撤回 | `player.trade.create` / `player.trade.respond` / `player.trade.cancel` |
| 玩家在线状态 / 交易解锁状态 | 服务端 `players` 档案实时下发 |
| 联合攻击邀请接受 / 拒绝 | `diplomacy.respond`（`kind: 'jointAttack'`） |
| 舰队任务终止（返航 / 已到达） | `fleet.abort` 命令 |
| 战役对话声望 / 分支解锁 | `campaign.choice` 命令 |
| 战役接取 / 领奖 | `campaign.start` / `campaign.claim` 命令 |
| 扫描 / 信号 / 星门 / 跃迁 | 一开始就走命令 |

消息类命令统一由 [messageLogic.ts](../src/logic/messageLogic.ts) 处理：
清空、删除、已读都直接修改服务端玩家数组，因此新通知到达时，
补丁里的数组只会包含"当前仍然存在"的通知，不会把已删除的旧通知带回来。

## 仍存在的问题（按严重度）

### 低：提示（hints）偏好

`useHints.ts` 的 `dismissedHints` / `hintsEnabled` 只写本地。
联机下补丁可能覆盖 → 已关闭的提示可能重新出现。

建议：并入一个 `player.prefs` 命令，或明确作为本地偏好（不参与服务端同步）。

### 低：舰队预设

`FleetView.vue:989/991` 的 `fleetPresets` 本地增删。
它被列在 `netStore` 的 `LOCAL_PLAYER_FIELDS` 中，重连快照会保留；
但补丁如果携带同名字段仍可能覆盖，属于便利功能，优先级低。

### 低：GM 工具

`GMView.vue` 全部直接改 `selectedPlanet`（资源/建筑/舰队/防御）。
GM 页面本质是开发工具，联机下改了也会被覆盖；建议加"仅单机可用"提示。

### 低：隐私同意

`HomeView.vue:245` 的 `privacyAgreed` 只在本地，换设备会重新弹。
可接受。

## 无需处理

- 资源是否足够的**只读比较**（BuildingsView / DefenseView）
- 残骸场只读判断（FleetView）
- UI 状态：`currentPlanetId`、侧边栏、`locale`、`isPaused`、`gameSpeed`（单机）
- 本地偏好：主题、背景、隐私协议、舰队预设

## 建议修复顺序

1. 提示（hints）偏好并入 `player.prefs`，或明确保留为本地状态
2. GM 工具增加"仅单机可用"提示
3. 其余本地偏好统一梳理，避免与补丁字段重名
