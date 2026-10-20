<div align="center">

<img src="../public/logo.svg" alt="OGame Vue TS 標誌" width="128" height="128" />

# OGame Vue TS

**連線重構版 · Multiplayer Rework**

以 Vue 3 + TypeScript 重寫的 OGame 風格太空策略遊戲

主儲存庫：[Gitee](https://gitee.com/shilianlvke/ogame-vue-ts) · 鏡像：[GitHub](https://github.com/shilianlvke/ogame-vue-ts)

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![授權條款：CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey?style=flat-square)](https://creativecommons.org/licenses/by-nc/4.0)
[![Docker：fnOS](https://img.shields.io/badge/Deploy-fnOS%20Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](DEPLOY_DOCKER.md)

[简体中文](../README.md) | 繁體中文 | [English](README-EN.md) | [Deutsch](README-DE.md) | [Русский](README-RU.md) | [Español](README-ES.md) | [한국어](README-KO.md) | [日本語](README-JA.md)

<sub>其他語言版本可能落後於簡體中文版，內容以本頁為準。</sub>

</div>

> **重要聲明**
>
> 本專案是 [setube/ogame-vue-ts](https://github.com/setube/ogame-vue-ts) 的**非官方二次開發版本**，並非上游專案的官方分支，也未獲得 Gameforge AG 或 OGame 官方的授權、認可或背書。
>
> 本專案僅供學習、研究與個人娛樂使用，**禁止任何形式的商業使用**。完整聲明請見 [來源、授權條款與法律聲明](#來源授權條款與法律聲明)。

---

## 目錄

- [專案簡介](#專案簡介)
- [功能亮點](#功能亮點)
- [單機與連線架構](#單機與連線架構)
- [技術棧](#技術棧)
- [快速開始](#快速開始)
- [連線部署](#連線部署)
- [專案結構](#專案結構)
- [常用腳本](#常用腳本)
- [測試與品質](#測試與品質)
- [開發狀態](#開發狀態)
- [文件](#文件)
- [參與貢獻](#參與貢獻)
- [來源、授權條款與法律聲明](#來源授權條款與法律聲明)
- [致謝](#致謝)

## 專案簡介

**OGame Vue TS · 連線重構版** 是在原作者 [setube](https://github.com/setube) 的開源專案 [ogame-vue-ts](https://github.com/setube/ogame-vue-ts) 基礎上二次開發而成的太空策略遊戲。

本專案保留了原作的單機玩法與核心數值體系，並在此基礎上針對連線架構、介面互動、星系檢視、基地系統、部署方式等進行了較大幅度的重構與擴充。

目前版本提供兩種執行方式：

- **單機模式**：遊戲核心在瀏覽器中執行，存檔保存在本機，開箱即可遊玩；
- **連線模式**：由 Node.js WebSocket 伺服器作為唯一權威狀態來源，支援帳號、多人同服、PvP、聊天、排行榜與 NPC 生態。

> 本專案目前僅維護 **Web 端 + 飛牛 fnOS Docker** 部署方式。Android、Electron、Go 伺服器等舊有部署形態已移除，相關程式碼可從 Git 歷史中查閱。

## 功能亮點

### 基地與帝國經營

- 建築、研究、船塢、防禦四大模組整合為統一基地；
- 建築佇列、研究佇列、艦隊任務欄位與資源消耗即時結算；
- 月球基地、月球生成、殘骸場與回收機制；
- 軍官系統、資源加成、帝國積分與多星球管理。

### 艦隊與戰鬥

- 艦艇建造、艦隊編成、任務派遣與多段航行；
- 戰鬥模擬器，可在投入資源前驗證艦隊配置；
- 戰鬥報告、戰利品、殘骸場與攻防結算；
- 星門佔領、通行費、封鎖與 NPC 商隊。

### 外交與 NPC 生態

- NPC 關係、好感度、貿易、贈禮、情報與外交事件；
- 敵對 NPC 偵查、攻擊與復仇行為；
- NPC 成長、經濟產出與多玩家共享世界；
- 外交通知、事件報告與關係狀態篩選。

### 星系與探索

- 全螢幕 2.5D 星圖，恆星系 / 本星系 / 銀河全景三層檢視；
- 10 顆行星圍繞恆星緩慢公轉，軌道、大小與速度具有隨機性；
- 點擊行星或恆星系後聚焦、鏡頭跟隨與情境面板淡入；
- 掃描、命名、星門、未知訊號、蟲洞、殘骸與遺跡探索；
- 12 周目 × 16 星區 × 64 恆星系的週期化宇宙。

### 連線與長期營運

- 帳號註冊、登入、工作階段與斷線重連；
- 伺服器權威世界，用戶端透過指令與狀態修補同步；
- 玩家交易、PvP、偵查、飛彈、艦隊任務與即時通知；
- 公共聊天、私聊、線上狀態、排行榜與賽季／周目機制；
- 伺服器 JSON 存檔、自動儲存與 Docker 資料磁碟區持久化。

### 體驗與可維護性

- 8 種語言：簡體中文、繁體中文、English、Deutsch、Русский、Español、한국어、日本語；
- 深色 / 淺色主題、響應式版面與 PWA；
- 單機存檔 IndexedDB 持久化；
- 統一指令層、無頭核心與可測試的遊戲規則層；
- 飛牛 fnOS Docker 一鍵部署與映像匯出。

## 單機與連線架構

```text
┌──────────────────────────────────────────────┐
│                 瀏覽器用戶端                 │
│  Vue 3 + Pinia + Vue Router + Tailwind CSS   │
│     檢視層僅派送指令，不直接修改世界狀態     │
└───────────────┬──────────────────────────────┘
                │
        ┌───────┴────────┐
        │                │
  單機模式              連線模式
        │                │
        ▼                ▼
┌────────────────┐   WebSocket
│  src/core      │       │
│  無頭遊戲核心  │       ▼
│  tick/指令     │   Node.js 伺服器
│  規則/狀態     │   server/ + ws
└──────┬─────────┘       │
       │                ▼
       ▼             伺服器權威世界
  IndexedDB          data/world.json
```

- `src/core`：無頭遊戲核心，負責世界狀態、tick、任務、NPC、指令與協定；
- `src/logic`：純遊戲規則與數值計算，盡量不依賴 UI；
- `server/`：Node.js WebSocket 伺服器、帳號、房間、持久化與靜態資源託管；
- `src/stores` / `src/views`：瀏覽器端狀態與介面；
- `scripts/`：無頭冒煙測試、伺服器測試、建置腳本。

單機模式直接重用無頭核心；連線模式則由伺服器執行同一套核心邏輯，用戶端只負責送出指令與呈現快照。

## 技術棧

| 分類 | 技術 |
|---|---|
| 前端 | Vue 3、TypeScript、Vite（Rolldown-Vite） |
| 狀態與路由 | Pinia、Vue Router 4 |
| UI | Tailwind CSS v4、shadcn-vue、reka-ui、Lucide |
| 動畫與回饋 | tw-animate-css、vue-sonner |
| 單機持久化 | IndexedDB |
| 連線伺服器 | Node.js 22、WebSocket（ws） |
| 部署 | Docker、飛牛 fnOS、Node 靜態資源託管 |
| 品質保證 | vue-tsc、無頭引擎冒煙測試、伺服器整合測試、i18n 驗證 |

## 快速開始

### 環境需求

- Node.js **22+**
- pnpm **10+**
- 現代瀏覽器（Chrome / Edge / Firefox / Safari）

### 複製與安裝

```bash
git clone https://gitee.com/shilianlvke/ogame-vue-ts.git
cd ogame-vue-ts
pnpm install
```

GitHub 鏡像：

```bash
git clone https://github.com/shilianlvke/ogame-vue-ts.git
```

### 本機開發

```bash
pnpm dev
```

預設開發網址：

```text
http://localhost:25121
```

### 正式環境建置

```bash
pnpm build
pnpm preview
```

`pnpm build` 會先執行 TypeScript 型別檢查，再將前端靜態資源建置到 `docs/`。

### 在本機執行連線伺服器

```bash
# 建置前端與 Node 伺服器
pnpm build
pnpm run build:node-server

# 啟動伺服器（預設讀取 docs/ 與 data/）
pnpm start:server
```

預設連接埠為 `25122`，可透過環境變數覆寫：

```bash
PORT=8080 STATIC_DIR=docs DATA_DIR=data pnpm start:server
```

伺服器啟動後：

- 遊戲頁面：`http://localhost:25122`
- 健康檢查：`http://localhost:25122/health`
- WebSocket：`ws://localhost:25122/ws`

> 正式環境請使用 HTTPS/WSS，並自行完成存取控制、備份與安全強化。

## 連線部署

目前建議使用飛牛 fnOS 的 Docker 部署方式。

### 方式一：飛牛原始碼一鍵部署（推薦）

前置條件：飛牛已安裝 Docker 與 git，且能拉取 `node:22-alpine` 或已設定映像加速。

```bash
cd /vol1/docker
git clone https://gitee.com/shilianlvke/ogame-vue-ts.git ogame
cd ogame

chmod +x deploy-fnos.sh
./deploy-fnos.sh
```

後續更新：

```bash
./deploy-fnos.sh --update
```

更多指令：

```bash
./deploy-fnos.sh --start
./deploy-fnos.sh --stop
./deploy-fnos.sh --restart
./deploy-fnos.sh --logs
./deploy-fnos.sh --status
./deploy-fnos.sh --port 8080
./deploy-fnos.sh --china
```

### 方式二：在電腦上建置映像後匯入

Windows：

```powershell
.\docker-build.ps1
```

該腳本會建置 `noskyman:latest` 並匯出 `noskyman.tar`。將 `noskyman.tar` 與 `docker-compose.yml` 上傳到飛牛的同一目錄後：

```bash
docker load -i noskyman.tar
docker compose up -d
```

完整說明、環境變數、反向代理 WebSocket 設定與常見問題請見：

- [飛牛 fnOS Docker 部署文件](DEPLOY_DOCKER.md)

> `docker-compose.yml` 只使用本機的 `noskyman:latest` 映像，不會主動連網拉取；原始碼建置由 `deploy-fnos.sh` 完成。

## 專案結構

```text
.
├── src/
│   ├── core/          # 無頭遊戲核心：世界、tick、指令、任務、NPC、協定
│   ├── logic/         # 純遊戲規則與數值計算
│   ├── components/    # Vue 元件
│   ├── views/         # 頁面檢視
│   ├── stores/        # Pinia 狀態
│   ├── locales/       # 8 語言文案
│   ├── services/      # 存檔、更新、WebDAV 等服務
│   └── workers/       # 戰鬥 Worker
├── server/            # Node.js WebSocket 伺服器
├── scripts/           # 建置、i18n、無頭／伺服器冒煙測試
├── doc/               # 部署、連線、星系設計與參考文件
├── public/            # 靜態資源
├── Dockerfile         # 前端 + Node 伺服器多階段映像
├── docker-compose.yml # 飛牛執行設定
├── deploy-fnos.sh     # 飛牛一鍵部署腳本
└── docker-build.ps1   # Windows 建置並匯出映像
```

## 常用腳本

| 指令 | 說明 |
|---|---|
| `pnpm dev` | 啟動 Vite 開發伺服器 |
| `pnpm build` | 型別檢查並將前端建置到 `docs/` |
| `pnpm preview` | 預覽正式環境建置結果 |
| `pnpm typecheck` | TypeScript 型別檢查 |
| `pnpm check:i18n` | 驗證 8 個語言套件的 key |
| `pnpm test` | 型別檢查 + i18n + 全部無頭／伺服器冒煙測試 |
| `pnpm smoke` | 無頭引擎冒煙測試 |
| `pnpm smoke:server` | 真實 WebSocket 伺服器整合測試 |
| `pnpm build:node-server` | 建置 Node 伺服器到 `server-dist/` |
| `pnpm dev:server` | 建置並啟動本機 Node 伺服器 |
| `pnpm start:server` | 啟動已建置的 Node 伺服器 |

## 測試與品質

```bash
pnpm typecheck
pnpm check:i18n
pnpm test
```

`pnpm test` 涵蓋：

- 無頭遊戲引擎；
- 周目作用域；
- 星圖規模、決定性、版面與連通性；
- 滿級帳號與戰役流程；
- 伺服器登入、可見性、指令、修補、tick、存檔與重連；
- 用戶端同步與真實 WebSocket 鏈路。

## 開發狀態

專案仍在持續開發中，介面、遊戲平衡、網路協定與存檔結構都可能繼續調整。

升級前請務必備份：

- 單機存檔：瀏覽器本機資料；
- 連線存檔：伺服器 `data/world.json`；
- Docker 部署：掛載的 `./data` 目錄。

星系系統重構進度與設計記錄：

- [星系狀態總覽](GALAXY_STATUS.md)
- [銀河重新設計](GALAXY_REDESIGN.md)
- [星圖設計](GALAXY_MAP_DESIGN.md)
- [周目與循環](GALAXY_CYCLES.md)
- [連線架構](MULTIPLAYER.md)

## 文件

| 文件 | 內容 |
|---|---|
| [飛牛 Docker 部署](DEPLOY_DOCKER.md) | fnOS 一鍵部署、映像匯入、環境變數與反向代理 |
| [連線架構](MULTIPLAYER.md) | 無頭核心、指令層、伺服器與同步協定 |
| [遊戲參考](ogame-reference.md) | 建築、科技、艦艇、防禦、軍官資料 |
| [星系狀態](GALAXY_STATUS.md) | 星系重構階段與驗收狀態 |

## 參與貢獻

歡迎提交 Issue 與 Pull Request，但請先確認：

1. **本專案的問題請勿提交到上游儲存庫**。上游作者不對本二次開發版本負責。
2. 提交程式碼即表示你同意以本專案的 CC BY-NC 4.0 授權條款發布該貢獻。
3. 請勿移除或弱化上游署名、授權條款連結與修改說明。
4. 請勿提交任何商業授權、付費服務或與官方 OGame 相關的誤導性內容。
5. 涉及連線、安全、存檔格式的變更，請同時補充測試與文件。

問題與回饋請提交到：

- Gitee：<https://gitee.com/shilianlvke/ogame-vue-ts>
- GitHub：<https://github.com/shilianlvke/ogame-vue-ts>

## 來源、授權條款與法律聲明

> 本節用於說明專案來源、授權條款與基本立場，不構成法律意見。涉及商業使用、公開營運、再散布或大規模部署時，請自行諮詢專業法律人士。

### 上游專案與二次開發關係

- **上游專案**：[setube/ogame-vue-ts](https://github.com/setube/ogame-vue-ts)
- **上游作者**：[setube](https://github.com/setube)
- **本專案**：由 [shilianlvke](https://gitee.com/shilianlvke) 維護的二次開發版本

本專案基於上游專案進行修改，具體修改範圍以本儲存庫的 Git 歷史為準。主要變更包括但不限於：

- 連線架構、Node.js WebSocket 伺服器、帳號與多人同步；
- 介面、基地、艦隊、外交、排行、訊息等頁面重構；
- 全螢幕 2.5D 星系檢視與聚焦互動；
- 星系、周目、星門、未知訊號等玩法擴充；
- Docker / 飛牛 fnOS 部署；
- 移除 Android、Electron、Go 伺服器等舊有部署形態。

本版本與上游作者之間不存在隸屬、合作、贊助或背書關係。上游作者不對本版本的程式碼、部署、營運或任何後果負責。

### 授權條款

本專案沿用上游專案的授權條款：

**[Creative Commons Attribution-NonCommercial 4.0 International（CC BY-NC 4.0）](https://creativecommons.org/licenses/by-nc/4.0/)** · [授權條款文件](../LICENSE)

本專案**不提供任何商業授權**。如需將相關程式碼或內容用於商業目的，請勿使用本專案。

你可以：

- **分享**：以任何媒介或格式複製、散布本專案；
- **改作**：修改、轉換或以本專案為基礎進行創作。

但必須遵守：

- **姓名標示**：保留上游作者、本專案作者、授權條款連結與修改說明，不得暗示作者為你或你的使用背書；
- **非商業性使用**：不得將本專案用於商業目的；
- **不得增加額外限制**：不得透過法律條款或技術手段限制他人行使授權條款允許的權利。

本儲存庫中由本專案新增的程式碼與文件，除另有說明外，同樣以 CC BY-NC 4.0 發布。第三方依賴、圖示、字型、商標及其他第三方內容仍歸各自權利人所有，並適用其各自的授權條款。

### 商標與官方關係

- **OGame** 及相關名稱、商標、遊戲內容歸 **Gameforge AG** 或其權利人所有。
- 本專案是獨立、非官方的粉絲向技術專案，與 Gameforge AG、官方 OGame 團隊沒有任何關聯、授權、贊助或背書關係。
- 本專案中對 OGame 名稱的使用僅用於描述遊戲類型與致敬來源，不主張任何商標權。
- 如權利人認為本專案內容侵害其合法權益，請透過本儲存庫 Issue 聯絡維護者，我們將及時處理。

### 連線營運與資料責任

- 單機模式的存檔保存在使用者瀏覽器本機；
- 連線模式會在伺服器 `data/world.json` 中保存世界與帳號資料，並可能處理聊天、戰報等玩家內容；
- 部署者應自行負責伺服器安全、存取控制、資料備份、隱私告知、資料刪除管道與當地法律法規合規；
- 若公開營運，請自行確認是否需要備案、許可、隱私政策或其他合規文件；
- 請勿將未強化的服務直接暴露到公網；
- 因部署、營運、資料遺失、服務中斷或安全事件造成的損失，由部署者自行承擔。

### 免責聲明

本專案按 **「現狀」** 提供，不提供任何明示或默示的擔保，包括但不限於適售性、特定用途適用性、未侵權、持續可用性與無錯誤運作。

在適用法律允許的最大範圍內，作者與貢獻者不對因使用或無法使用本專案而產生的任何直接、間接、附隨、特殊或後果性損失承擔責任，包括但不限於資料遺失、服務中斷、裝置損壞、利潤損失或法律糾紛。

**本專案禁止商業使用。** 任何組織或個人在公開營運、商業部署或再散布前，應自行評估並承擔全部法律與合規責任。

## 致謝

- 感謝 [setube](https://github.com/setube) 創作並開源 [ogame-vue-ts](https://github.com/setube/ogame-vue-ts)，本專案的所有二次開發都建立在其工作之上；
- 感謝上游專案的歷史貢獻者與社群玩家；
- 感謝 [OGame](https://ogame.org) 帶來的經典太空策略體驗；
- 感謝 Vue、Vite、Pinia、Tailwind CSS、shadcn-vue、reka-ui、Lucide、Node.js、ws 等開源專案及其貢獻者。

---

<div align="center">

**OGame Vue TS · 連線重構版**

原版作者：[setube](https://github.com/setube)<br>
本版本維護：[shilianlvke](https://gitee.com/shilianlvke)

<sub>非官方專案 · 僅限非商業使用 · CC BY-NC 4.0</sub>

</div>
