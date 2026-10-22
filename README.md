<div align="center">

<img src="public/logo.svg" alt="OGame Vue TS Logo" width="128" height="128" />

# OGame Vue TS

**联机重构版 · Multiplayer Rework**

一个以 Vue 3 + TypeScript 重写的 OGame 风格太空策略游戏

主仓库：[Gitee](https://gitee.com/shilianlvke/ogame-vue-ts) · 镜像：[GitHub](https://github.com/shilianlvke/ogame-vue-ts)

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey?style=flat-square)](https://creativecommons.org/licenses/by-nc/4.0)
[![Docker: fnOS](https://img.shields.io/badge/Deploy-fnOS%20Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](doc/DEPLOY_DOCKER.md)

[简体中文](README.md) | [繁體中文](doc/README-zh-TW.md) | [English](doc/README-EN.md) | [Deutsch](doc/README-DE.md) | [Русский](doc/README-RU.md) | [Español](doc/README-ES.md) | [한국어](doc/README-KO.md) | [日本語](doc/README-JA.md)

<sub>其他语言版本可能滞后于简体中文版，内容以本页为准。</sub>

</div>

> **重要声明**
>
> 本项目是 [setube/ogame-vue-ts](https://github.com/setube/ogame-vue-ts) 的**非官方二次开发版本**，不是上游项目的官方分支，也未获得 Gameforge AG 或 OGame 官方的授权、认可或背书。
>
> 本项目仅用于学习、研究和个人娱乐，**禁止任何形式的商业使用**。完整声明见 [来源、许可与法律声明](#来源许可与法律声明)。

---

## 目录

- [项目简介](#项目简介)
- [功能亮点](#功能亮点)
- [单机与联机架构](#单机与联机架构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [联机部署](#联机部署)
- [项目结构](#项目结构)
- [常用脚本](#常用脚本)
- [测试与质量](#测试与质量)
- [开发状态](#开发状态)
- [文档](#文档)
- [参与贡献](#参与贡献)
- [来源、许可与法律声明](#来源许可与法律声明)
- [致谢](#致谢)

## 项目简介

**OGame Vue TS · 联机重构版** 是在原作者 [setube](https://github.com/setube) 的开源项目 [ogame-vue-ts](https://github.com/setube/ogame-vue-ts) 基础上二次开发得到的太空策略游戏。

本项目保留了原作的单机玩法与核心数值体系，并在此基础上对联机架构、界面交互、星系视图、基地系统、部署方式等进行了较大幅度的重构与扩展。

当前版本提供两种运行方式：

- **单机模式**：游戏核心运行在浏览器中，存档保存在本地，开箱即玩；
- **联机模式**：由 Node.js WebSocket 服务端作为唯一权威状态源，支持账号、多人同服、PvP、聊天、排行榜与星图地点。

> 本项目目前只维护 **Web 端 + 飞牛 fnOS Docker** 部署方式。Android、Electron、Go 服务端等旧部署形态已移除，相关代码可从 Git 历史中查阅。

## 功能亮点

### 基地与帝国经营

- 建筑、研究、船坞、防御四大模块整合为统一基地；
- 建筑队列、研究队列、舰队任务槽位与资源消耗实时结算；
- 月球基地、月球生成、残骸场与回收机制；
- 军官系统、资源加成、帝国积分与多星球管理。

### 舰队与战斗

- 舰船建造、舰队编成、任务派遣与多段航行；
- 战斗模拟器，可在投入资源前验证舰队配置；
- 战斗报告、战利品、残骸场与攻防结算；
- 星门占领、过路费、封锁与中立商队。

### 星图地点（POI）

- 遗迹、残骸、贸易站、巢穴与虫洞按恒星系确定性生成；
- 遗迹回收产出旧资源与锈蚀合金，巢穴为一次性战力挑战；
- 贸易站每 6 小时刷新 3 个商品位，用暗物质购买；
- NPC 自主行为、外交关系与 NPC 商店已按工厂版 §14.2 下线。

### 星系与探索

- 全屏 2.5D 星图，恒星系 / 本星系 / 银河全景三级视图；
- 10 颗行星围绕恒星缓慢公转，轨道、大小与速度具有随机性；
- 点击行星或恒星系后聚焦、镜头跟随与上下文面板渐显；
- 扫描、命名、星门、未知信号、虫洞、残骸、遗迹、贸易站与巢穴探索；
- 12 周目 × 16 星区 × 64 恒星系的周期化宇宙。

### 联机与长期运营

- 账号注册、登录、会话与断线重连；
- 服务端权威世界，客户端通过命令与状态补丁同步；
- 玩家交易、PvP、侦查、导弹、舰队任务与实时通知；
- 公共聊天、私聊、在线状态、排行榜与赛季/周目机制；
- 服务端 JSON 存档、自动保存与 Docker 数据卷持久化。

### 体验与可维护性

- 8 种语言：简体中文、繁體中文、English、Deutsch、Русский、Español、한국어、日本語；
- 深色 / 浅色主题、响应式布局与 PWA；
- 单机存档 IndexedDB 持久化；
- 统一命令层、无头核心与可测试的游戏规则层；
- 飞牛 fnOS Docker 一键部署与镜像导出。

## 单机与联机架构

```text
┌──────────────────────────────────────────────┐
│               浏览器客户端                    │
│  Vue 3 + Pinia + Vue Router + Tailwind CSS   │
│  视图层只派发命令，不直接修改世界状态          │
└───────────────┬──────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
  单机模式             联机模式
        │                │
        ▼                ▼
┌──────────────┐   WebSocket
│  src/core    │        │
│  无头游戏核心 │        ▼
│  tick/命令   │   Node.js 服务端
│  规则/状态   │   server/ + ws
└──────┬───────┘        │
       │                ▼
       ▼         服务端权威世界
  IndexedDB       data/world.json
```

- `src/core`：无头游戏核心，负责世界状态、tick、任务、星图地点、命令与协议；
- `src/logic`：纯游戏规则与数值计算，尽量不依赖 UI；
- `server/`：Node.js WebSocket 服务端、账号、房间、持久化与静态资源托管；
- `src/stores` / `src/views`：浏览器端状态与界面；
- `scripts/`：无头冒烟测试、服务端测试、构建脚本。

单机模式直接复用无头核心；联机模式则由服务端运行同一套核心逻辑，客户端只负责发送命令和渲染快照。

## 技术栈

| 分类 | 技术 |
|---|---|
| 前端 | Vue 3、TypeScript、Vite（Rolldown-Vite） |
| 状态与路由 | Pinia、Vue Router 4 |
| UI | Tailwind CSS v4、shadcn-vue、reka-ui、Lucide |
| 动画与反馈 | tw-animate-css、vue-sonner |
| 单机持久化 | IndexedDB |
| 联机服务端 | Node.js 22、WebSocket（ws） |
| 部署 | Docker、飞牛 fnOS、Node 静态资源托管 |
| 质量保障 | vue-tsc、无头引擎冒烟测试、服务端集成测试、i18n 校验 |

## 快速开始

### 环境要求

- Node.js **22+**
- pnpm **10+**
- 现代浏览器（Chrome / Edge / Firefox / Safari）

### 克隆与安装

```bash
git clone https://gitee.com/shilianlvke/ogame-vue-ts.git
cd ogame-vue-ts
pnpm install
```

GitHub 镜像：

```bash
git clone https://github.com/shilianlvke/ogame-vue-ts.git
```

### 本地开发

```bash
pnpm dev
```

默认开发地址：

```text
http://localhost:25121
```

### 生产构建

```bash
pnpm build
pnpm preview
```

`pnpm build` 会先执行 TypeScript 类型检查，再构建前端静态资源到 `docs/`。

### 本地运行联机服务端

```bash
# 构建前端与 Node 服务端
pnpm build
pnpm run build:node-server

# 启动服务端（默认读取 docs/ 与 data/）
pnpm start:server
```

默认端口为 `25122`，可通过环境变量覆盖：

```bash
PORT=8080 STATIC_DIR=docs DATA_DIR=data pnpm start:server
```

服务端启动后：

- 游戏页面：`http://localhost:25122`
- 健康检查：`http://localhost:25122/health`
- WebSocket：`ws://localhost:25122/ws`

> 生产环境请使用 HTTPS/WSS，并自行完成访问控制、备份与安全加固。

## 联机部署

当前推荐使用飞牛 fnOS 的 Docker 部署方式。

### 方式一：飞牛源码一键部署（推荐）

前置条件：飞牛已安装 Docker 与 git，且能拉取 `node:22-alpine` 或已配置镜像加速。

```bash
cd /vol1/docker
git clone https://gitee.com/shilianlvke/ogame-vue-ts.git ogame
cd ogame

chmod +x deploy-fnos.sh
./deploy-fnos.sh
```

后续更新：

```bash
./deploy-fnos.sh --update
```

更多命令：

```bash
./deploy-fnos.sh --start
./deploy-fnos.sh --stop
./deploy-fnos.sh --restart
./deploy-fnos.sh --logs
./deploy-fnos.sh --status
./deploy-fnos.sh --port 8080
./deploy-fnos.sh --china
```

### 方式二：电脑构建镜像后导入

Windows：

```powershell
.\docker-build.ps1
```

该脚本会构建 `noskyman:latest` 并导出 `noskyman.tar`。把 `noskyman.tar` 与 `docker-compose.yml` 上传到飞牛同一目录后：

```bash
docker load -i noskyman.tar
docker compose up -d
```

完整说明、环境变量、反代 WebSocket 配置与常见问题见：

- [飞牛 fnOS Docker 部署文档](doc/DEPLOY_DOCKER.md)

> `docker-compose.yml` 只使用本地 `noskyman:latest` 镜像，不会主动联网拉取；源码构建由 `deploy-fnos.sh` 完成。

## 项目结构

```text
.
├── src/
│   ├── core/          # 无头游戏核心：世界、tick、命令、任务、星图地点、协议
│   ├── logic/         # 纯游戏规则与数值计算
│   ├── components/    # Vue 组件
│   ├── views/         # 页面视图
│   ├── stores/        # Pinia 状态
│   ├── locales/       # 8 语言文案
│   ├── services/      # 存档、更新、WebDAV 等服务
│   └── workers/       # 战斗 Worker
├── server/            # Node.js WebSocket 服务端
├── scripts/           # 构建、i18n、无头/服务端冒烟测试
├── doc/               # 部署、联机、星系设计与参考文档
├── public/            # 静态资源
├── Dockerfile         # 前端 + Node 服务端多阶段镜像
├── docker-compose.yml # 飞牛运行配置
├── deploy-fnos.sh     # 飞牛一键部署脚本
└── docker-build.ps1   # Windows 构建并导出镜像
```

## 常用脚本

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动 Vite 开发服务器 |
| `pnpm build` | 类型检查并构建前端到 `docs/` |
| `pnpm preview` | 预览生产构建 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm check:i18n` | 校验 8 个语言包的 key |
| `pnpm test` | 类型检查 + i18n + 全部无头/服务端冒烟测试 |
| `pnpm smoke` | 无头引擎冒烟测试 |
| `pnpm smoke:server` | 真实 WebSocket 服务端集成测试 |
| `pnpm build:node-server` | 构建 Node 服务端到 `server-dist/` |
| `pnpm dev:server` | 构建并启动本地 Node 服务端 |
| `pnpm start:server` | 启动已构建的 Node 服务端 |

## 测试与质量

```bash
pnpm typecheck
pnpm check:i18n
pnpm test
```

`pnpm test` 覆盖：

- 无头游戏引擎；
- 周目作用域；
- 星图规模、确定性、布局与连通性；
- 满级账号与战役流程；
- 服务端登录、可见性、命令、补丁、tick、存档与重连；
- 客户端同步与真实 WebSocket 链路。

## 开发状态

项目仍在持续开发中，界面、游戏平衡、网络协议和存档结构都可能继续调整。

升级前请务必备份：

- 单机存档：浏览器本地数据；
- 联机存档：服务端 `data/world.json`；
- Docker 部署：挂载的 `./data` 目录。

星系系统重构进度与设计记录：

- [星系状态总览](doc/GALAXY_STATUS.md)
- [银河重设计](doc/GALAXY_REDESIGN.md)
- [星图设计](doc/GALAXY_MAP_DESIGN.md)
- [周目与循环](doc/GALAXY_CYCLES.md)
- [联机架构](doc/MULTIPLAYER.md)

## 文档

| 文档 | 内容 |
|---|---|
| [飞牛 Docker 部署](doc/DEPLOY_DOCKER.md) | fnOS 一键部署、镜像导入、环境变量与反代 |
| [联机架构](doc/MULTIPLAYER.md) | 无头核心、命令层、服务端与同步协议 |
| [游戏参考](doc/ogame-reference.md) | 建筑、科技、舰船、防御、军官数据 |
| [星系状态](doc/GALAXY_STATUS.md) | 星系重构阶段与验收状态 |

## 参与贡献

欢迎提交 Issue 和 Pull Request，但请先确认：

1. **本项目的问题不要提交到上游仓库**。上游作者不对本二次开发版本负责。
2. 提交代码即表示你同意以本项目的 CC BY-NC 4.0 许可发布该贡献。
3. 不要移除或弱化上游署名、许可证链接和修改说明。
4. 不要提交任何商业授权、付费服务或与官方 OGame 相关的误导性内容。
5. 涉及联机、安全、存档格式的改动，请同时补充测试与文档。

问题与反馈请提交到：

- Gitee：<https://gitee.com/shilianlvke/ogame-vue-ts>
- GitHub：<https://github.com/shilianlvke/ogame-vue-ts>

## 来源、许可与法律声明

> 本节用于说明项目来源、许可与基本立场，不构成法律意见。涉及商业使用、公开运营、再分发或大规模部署时，请自行咨询专业法律人士。

### 上游项目与二次开发关系

- **上游项目**：[setube/ogame-vue-ts](https://github.com/setube/ogame-vue-ts)
- **上游作者**：[setube](https://github.com/setube)
- **本项目**：由 [shilianlvke](https://gitee.com/shilianlvke) 维护的二次开发版本

本项目基于上游项目进行修改，具体修改范围以本仓库 Git 历史为准。主要改动包括但不限于：

- 联机架构、Node.js WebSocket 服务端、账号与多人同步；
- 界面、基地、舰队、星图地点、排行、消息等页面重构；
- 全屏 2.5D 星系视图与聚焦交互；
- 星系、周目、星门、未知信号等玩法扩展；
- Docker / 飞牛 fnOS 部署；
- 移除 Android、Electron、Go 服务端等旧部署形态。

本版本与上游作者之间不存在隶属、合作、赞助或背书关系。上游作者不对本版本的代码、部署、运营或任何后果负责。

### 许可证

本项目沿用上游项目的许可协议：

**[Creative Commons Attribution-NonCommercial 4.0 International（CC BY-NC 4.0）](https://creativecommons.org/licenses/by-nc/4.0/)** · [许可证文件](LICENSE)

本项目**不提供任何商业授权**。如需将相关代码或内容用于商业目的，请勿使用本项目。

你可以：

- **共享**：以任何媒介或格式复制、发行本项目；
- **演绎**：修改、转换或以本项目为基础进行创作。

但必须遵守：

- **署名**：保留上游作者、本项目作者、许可证链接和修改说明，不得暗示作者为你或你的使用背书；
- **非商业使用**：不得将本项目用于商业目的；
- **不得追加限制**：不得通过法律条款或技术手段限制他人行使许可证允许的权利。

本仓库中由本项目新增的代码与文档，除另有说明外，同样以 CC BY-NC 4.0 发布。第三方依赖、图标、字体、商标及其他第三方内容仍归各自权利人所有，并适用其各自许可证。

### 商标与官方关系

- **OGame** 及相关名称、商标、游戏内容归 **Gameforge AG** 或其权利人所有。
- 本项目是独立的、非官方的粉丝向技术项目，与 Gameforge AG、官方 OGame 团队没有任何关联、授权、赞助或背书关系。
- 本项目中对 OGame 名称的使用仅用于描述游戏类型与致敬来源，不主张任何商标权。
- 如权利人认为本项目内容侵犯其合法权益，请通过本仓库 Issue 联系维护者，我们将及时处理。

### 联机运营与数据责任

- 单机模式的存档保存在用户浏览器本地；
- 联机模式会在服务端 `data/world.json` 中保存世界与账号数据，并可能处理聊天、战报等玩家内容；
- 部署者应自行负责服务器安全、访问控制、数据备份、隐私告知、数据删除渠道与当地法律法规合规；
- 若公开运营，请自行确认是否需要备案、许可、隐私政策或其他合规文件；
- 请勿将未加固的服务直接暴露到公网；
- 因部署、运营、数据丢失、服务中断或安全事件造成的损失，由部署者自行承担。

### 免责声明

本项目按 **“现状”** 提供，不提供任何明示或默示的担保，包括但不限于适销性、特定用途适用性、不侵权、持续可用性和无错误运行。

在适用法律允许的最大范围内，作者与贡献者不对因使用或无法使用本项目而产生的任何直接、间接、附带、特殊或后果性损失承担责任，包括但不限于数据丢失、服务中断、设备损坏、利润损失或法律纠纷。

**本项目禁止商业使用。** 任何组织或个人在公开运营、商业部署或再分发前，应自行评估并承担全部法律与合规责任。

## 致谢

- 感谢 [setube](https://github.com/setube) 创作并开源 [ogame-vue-ts](https://github.com/setube/ogame-vue-ts)，本项目的全部二次开发都建立在其工作之上；
- 感谢上游项目的历史贡献者与社区玩家；
- 感谢 [OGame](https://ogame.org) 带来的经典太空策略体验；
- 感谢 Vue、Vite、Pinia、Tailwind CSS、shadcn-vue、reka-ui、Lucide、Node.js、ws 等开源项目及其贡献者。

---

<div align="center">

**OGame Vue TS · 联机重构版**

原版作者：[setube](https://github.com/setube)<br>
本版本维护：[shilianlvke](https://gitee.com/shilianlvke)

<sub>非官方项目 · 仅限非商业使用 · CC BY-NC 4.0</sub>

</div>
