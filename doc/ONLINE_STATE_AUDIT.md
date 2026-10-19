# 联机状态一致性审计

> 背景：联机模式下服务端权威，任何"只改客户端 store"的操作都会被下一次补丁覆盖。
> 本文件记录全量扫描结果与优先级。

## 已修复

| 功能 | 修复方式 |
|---|---|
| 行星改名 | `planet.rename` 命令 |
| 恒星系改名 | `galaxy.rename` 命令 |
| 等待队列（建造/研究/舰船/防御） | `queue.addWaiting` 命令 |
| 战役接取/领奖 | `campaign.start` / `campaign.claim` 命令 |
| 扫描 / 信号 / 星门 / 跃迁 | 一开始就走命令 |

## 仍存在的问题（按严重度）

### 高：消息中心删除/清空

`MessagesView.vue` 里对 11 个数组做了本地 `splice` / 清空：

```
battleReports / spyReports / spiedNotifications / missionReports
npcActivityNotifications / giftNotifications / giftRejectedNotifications
tradeOffers / intelReports / jointAttackInvites
```

这些字段属于服务端补丁的 `reports` 部分，**本地删除后下一次补丁会重新下发**，
表现为"删了又回来"。

建议：新增 `messages.clear` 命令（`kind` + 可选 `index`），服务端按类型清理。

### 中：舰队任务列表本地移除

`FleetView.vue:1376` 直接 `fleetMissions.splice(index, 1)`。
如果这是"移除已结束任务"，联机下删掉后服务端补丁会恢复；应改由服务端在任务结算时移除。

### 中：战役进度初始化与分支重置

`CampaignView.vue:197` 在客户端调用 `initializeCampaignProgress`，
`:435` 本地重置 `unlockedBranches`。

如果服务端创建玩家时没有初始化战役进度，`campaign.start` 会因 `notInitialized` 失败。
需要确认服务端 `createPlayer` 是否调用了 `initializeCampaignProgress`。

### 低：提示（hints）偏好

`useHints.ts` 的 `dismissedHints` / `hintsEnabled` 只写本地。
联机下补丁会覆盖 → 已关闭的提示可能重新出现。

建议：并入一个 `player.prefs` 命令，或明确作为本地偏好（不参与服务端同步）。

### 低：舰队预设

`FleetView.vue:989/991` 的 `fleetPresets` 本地增删，联机下会被覆盖。
属于便利功能，可接受；若要持久化需加命令。

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

## 建议修复顺序

1. `messages.clear`（影响最大、最容易被玩家发现）
2. 战役进度服务端初始化（不然新服玩家接不了任务）
3. 舰队任务本地移除（确认语义后修）
4. 其余偏好类，统一并入 `player.prefs`
