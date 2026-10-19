# Docker 部署（飞牛 fnOS / 群晖 / 通用 Linux）

项目是「前端静态文件 + Node WebSocket 服务端」一体化镜像，只暴露 **25122** 一个端口。

> ⚠️ 本仓库的开发环境没有安装 Docker，Dockerfile 与 Compose **没有在本地实际构建验证过**。
> 下面两个报错是实际部署时遇到的，已按根因给出解决方案。

## 先看两个常见报错

### 报错 1：`context deadline exceeded`（拉取镜像超时）

```
Image noskyman:latest Pulling
Get "https://registry-1.docker.io/v2/": context deadline exceeded
```

原因：Compose 文件里同时有 `image:` 和 `build:` 时，Docker **先尝试拉取同名镜像**；国内访问 Docker Hub 超时。

处理：
- **用导入镜像的方式**：`docker-compose.yml` 现在只有 `image:`，不会触发拉取
- 或者给 NAS 配置镜像加速（见文末）

### 报错 2：`open Dockerfile: no such file or directory`

```
failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory
```

原因：执行 `docker compose` 的目录里**没有 Dockerfile**（只上传了 compose 文件）。

处理：
- **导入镜像**：不需要 Dockerfile，用 `docker-compose.yml`
- **源码构建**：整个项目目录都要上传，并且用 `docker-compose.build.yml`

## 文件说明

| 文件 | 用途 |
|---|---|
| `docker-compose.yml` | **默认**，只用本地镜像，不联网 |
| `docker-compose.image.yml` | 同上（内容一致，语义更明确） |
| `docker-compose.build.yml` | 从源码构建（需要完整目录 + 能拉基础镜像） |
| `Dockerfile` | 多阶段构建：构建前后端 → 运行阶段只装生产依赖 |
| `docker-build.ps1` | 电脑上一键构建 + 导出 tar |
| `.dockerignore` | 排除 `node_modules` / `docs` / `server-dist` / `data` |

## 推荐方式：电脑构建 → NAS 导入

```powershell
# Windows 电脑，项目根目录
.\docker-build.ps1
# 等价于：
#   docker build -t noskyman:latest .
#   docker save noskyman:latest -o noskyman.tar
```

把这两个文件传到 NAS 的同一目录，例如 `/vol1/docker/ogame/`：

```
/vol1/docker/ogame/
├── noskyman.tar
└── docker-compose.yml
```

飞牛「Docker」应用里：

1. **镜像** → 导入 → 选 `noskyman.tar`
2. **项目** → 新建 → 选 `docker-compose.yml`
3. 启动

或 SSH：

```bash
cd /vol1/docker/ogame
docker load -i noskyman.tar
docker compose up -d
```

## 备选：NAS 上从源码构建

要求：完整项目目录（含 `Dockerfile`、`src/`、`server/`、`scripts/`），且能拉取 `node:22-alpine`。

```bash
cd /vol1/docker/ogame-src
docker compose -f docker-compose.build.yml up -d --build
```

首次构建 5~15 分钟。

## 配置镜像加速（国内 NAS）

飞牛：**Docker → 设置 → 镜像仓库/加速器**，填入：

```
https://docker.m.daocloud.io
https://dockerproxy.com
https://docker.1ms.run
```

或 SSH 编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com"
  ]
}
```

然后 `sudo systemctl restart docker`。

## 端口与数据

```yaml
ports:
  - "25122:25122"          # 改左边可换宿主机端口，如 "8080:25122"
volumes:
  - ./data:/app/data       # 存档，换路径如 /vol1/ogame-data:/app/data
```

存档文件：`data/world.json`，备份直接复制；容器重建不会删。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | 25122 | 服务端端口，需与端口映射右侧一致 |
| `GAME_SPEED` | 1 | 游戏倍速 |
| `NPC_COUNT` | 200 | NPC 数量 |
| `VISIBILITY` | public | `public` 公开信息 / `full` 全部可见 |
| `LOCALE` | zh-CN | 默认语言 |
| `NEWBIE_PROTECTION_HOURS` | 24 | 新手保护 |
| `MAX_ACCOUNT` | 空 | 内置满级账号，`用户名:密码`，仅在账号不存在时创建 |
| `TICK_MS` | 1000 | tick 间隔 |
| `AUTOSAVE_MS` | 30000 | 自动存档间隔 |

## 反代 / HTTPS

必须转发 WebSocket：

```nginx
location / {
    proxy_pass http://127.0.0.1:25122;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

否则页面能打开但连不上服务器。

## 首次访问

```
http://<NAS IP>:25122
```

看到旧界面时访问一次 `http://<NAS IP>:25122/reset-sw` 清 Service Worker 缓存。

## 浏览器自动更新

每次 `pnpm build` 都会生成 `docs/version.json`（包含 `version` 与构建时间 `buildTime`）。
页面启动后、每 5 分钟、窗口重新聚焦或从后台恢复时会检查这个文件：

- 版本号或构建时间任意一个变化，就认为部署了新构建；
- 页面会弹出“立即刷新”提示；
- 切到后台或空闲 60 秒后会自动刷新；
- 刷新前会先落盘存档，并清理旧 Service Worker / CacheStorage。

因此正常部署后不需要再让用户手动强制刷新。设置 → 关于 → “检查更新”
也是手动触发同一套检测：有变化就提示刷新，没有变化提示已是最新版本。
反向代理不要缓存 `version.json` 与 `index.html`（仓库自带的 `nginx.conf`
已设置 `no-store` / `no-cache`）。

## 常见问题

| 现象 | 处理 |
|---|---|
| 拉取镜像超时 | 用 `docker-compose.yml`（无 build）；或配镜像加速 |
| `open Dockerfile: no such file` | 用导入镜像方式，或上传完整源码并加 `-f docker-compose.build.yml` |
| 页面能开、进不了游戏 | WebSocket 未转发 / 端口映射不对 |
| 打开是旧版本 | 访问 `/reset-sw` |
| 存档丢失 | 检查 `./data` 挂载路径是否变化 |

## Ubuntu 一键构建

全新 Ubuntu（22.04/24.04）用仓库根目录的 `build-on-ubuntu.sh`：

```bash
chmod +x build-on-ubuntu.sh

# 只构建
./build-on-ubuntu.sh

# 构建并导出 tar（拿到 NAS 导入）
./build-on-ubuntu.sh --save

# 构建并直接启动
./build-on-ubuntu.sh --run

# 国内加速（npm 源）
./build-on-ubuntu.sh --save --registry https://registry.npmmirror.com
```

脚本会自动：

1. 检测并安装 Docker（`get.docker.com`，已装则跳过）
2. 构建镜像 `noskyman:latest`
3. `--save` 导出 `noskyman.tar`
4. `--run` 用 `docker compose up -d` 启动

### Ubuntu 上还需要注意

- **基础镜像拉取**：`node:22-alpine` 来自 Docker Hub，国内需要先配镜像加速
  （`/etc/docker/daemon.json` 的 `registry-mirrors`，然后 `sudo systemctl restart docker`）
- **npm 源**：用 `--registry https://registry.npmmirror.com`，否则 `pnpm install` 可能很慢
- 脚本使用 LF 换行；如果从 Windows 拷贝后报 `$'\r': command not found`，执行：
  `sed -i 's/\r$//' build-on-ubuntu.sh`

## 飞牛上 git 源码一键部署（推荐）

飞牛自带 Docker 应用，直接 `git clone` 源码后用脚本部署：

```bash
cd /vol1/docker
git clone <仓库地址> ogame
cd ogame

chmod +x deploy-fnos.sh
./deploy-fnos.sh
```

脚本会：构建镜像 → 启动容器 → 打印访问地址。

### 常用命令

```bash
./deploy-fnos.sh            # 首次部署（构建 + 启动）
./deploy-fnos.sh --update   # git pull + 重新构建 + 重启
./deploy-fnos.sh --start    # 只启动
./deploy-fnos.sh --stop     # 停止并移除容器
./deploy-fnos.sh --logs     # 跟踪日志
./deploy-fnos.sh --status   # 查看容器状态
./deploy-fnos.sh --port 8080                     # 改宿主机端口
./deploy-fnos.sh --registry https://registry.npmmirror.com   # 国内 npm 加速
```

### 前置条件

| 条件 | 说明 |
|---|---|
| Docker 应用 | 飞牛「应用中心」安装 |
| git | 飞牛终端一般自带；没有则 `apt install git` |
| 网络 | 需要能拉取 `node:22-alpine`；国内先配镜像加速 |

镜像加速（飞牛 Docker 设置里填，或 `/etc/docker/daemon.json`）：

```json
{ "registry-mirrors": ["https://docker.m.daocloud.io"] }
```

### 更新流程

```bash
cd /vol1/docker/ogame
./deploy-fnos.sh --update
```

存档在 `./data/world.json`，重建容器不受影响。

## 飞牛图形界面里点「启动」报拉取超时？

现象：

```
✘ Image noskyman:latest Error Get "https://registry-1.docker.io/v2/": context deadline exceeded
```

原因：图形界面执行的是 `docker compose up`，会先按 `image:` 去 Docker Hub 拉镜像；
本地还没有该镜像、国内又连不上 Hub，就卡 40 秒后报错。

现在 `docker-compose.yml` 已带上 `build:`，所以：

- **图形界面**：先点「构建」（会本地构建镜像），再点「启动」；
  或者直接点启动，等拉取超时后它会自动转为本地构建（第一次会慢 40 秒左右）
- **SSH 跑脚本（推荐，不会尝试拉取）**：

```bash
./deploy-fnos.sh          # 构建 + 启动
./deploy-fnos.sh --update # 拉代码 + 重建 + 重启
```

脚本对 compose v2 会附加 `--pull never`，完全跳过联网拉取。

## 改名说明（ogame → noskyman）

为避免与旧部署冲突，镜像名和容器名已统一改为 **noskyman**：

| 项 | 旧 | 新 |
|---|---|---|
| 镜像 | `ogame-vue-ts:latest` | `noskyman:latest` |
| 容器 | `ogame` | `noskyman` |
| 导出文件 | `ogame-vue-ts.tar` | `noskyman.tar` |

升级时旧容器会占用同名资源，`deploy-fnos.sh` 现在会自动清理名为 `ogame` / `ogame-vue-ts` 的历史容器（存档在 `./data`，不受影响）。

如果旧容器挂载了别的数据目录，先确认再删：

```bash
docker inspect ogame --format '{{json .Mounts}}'
```

## 镜像为什么可以很小？（纯静态模式）

有人用 2.5MB 的镜像跑这个游戏，原因是**只打包了前端静态文件，没有游戏服务端**：

- 本项目 `docs/` 产物约 **2.6 MB**，正好是这个量级
- 那种镜像通常基于 `scratch` / `busybox`，只把自己的一份静态文件塞进去

对比：

| 模式 | 内容 | 体积量级 | 联机 |
|---|---|---|---|
| 静态镜像 | nginx + docs | ~20~25 MB | ❌ 不支持 |
| 本项目默认镜像 | Node 22 + 游戏服务端 + docs | ~80~120 MB | ✅ 支持 |

### 想要小镜像

```bash
docker compose -f docker-compose.static.yml up -d --build
# 访问 http://<IP>:8080
```

存档在浏览器 IndexedDB 里，**换浏览器/清缓存就没了**，也没有多人和账号系统。

### 想要联机

必须用默认镜像（含 Node 服务端），因为联机依赖 WebSocket + 服务端权威存档。

## 构建提速

### 1. 没变化就不构建

`deploy-fnos.sh --update` 会比对 `.deploy-last-commit` 与当前 git commit：

- 代码没变、工作区干净 → **跳过构建**，只重启容器
- 有变化 → 正常构建
- 想强制重建 → `./deploy-fnos.sh --update --force`

### 2. pnpm 依赖缓存

Dockerfile 里给 pnpm store 挂了缓存卷：

```dockerfile
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm config set store-dir /root/.pnpm-store \
 && pnpm install --frozen-lockfile
```

含义：

- `package.json` / `pnpm-lock.yaml` 没变 → 整个 install 层直接命中缓存，不执行
- 即使层失效，pnpm store 还在缓存里，只做链接，不重新下载

### 3. 什么时候一定会重装

- 改了 `package.json` 或 `pnpm-lock.yaml`
- 执行了 `docker builder prune` 清掉缓存
- 构建机换了 Docker 环境

脚本已 `export DOCKER_BUILDKIT=1`，缓存挂载才会生效。
