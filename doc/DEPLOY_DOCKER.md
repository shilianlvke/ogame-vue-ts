# Docker 部署（飞牛 fnOS / 群晖 / 通用 Linux）

项目是「前端静态文件 + Node WebSocket 服务端」一体化镜像，只暴露 **25122** 一个端口。

> ⚠️ 本仓库的开发环境没有安装 Docker，Dockerfile 与 Compose **没有在本地实际构建验证过**。
> 下面两个报错是实际部署时遇到的，已按根因给出解决方案。

## 先看两个常见报错

### 报错 1：`context deadline exceeded`（拉取镜像超时）

```
Image ogame-vue-ts:latest Pulling
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
#   docker build -t ogame-vue-ts:latest .
#   docker save ogame-vue-ts:latest -o ogame-vue-ts.tar
```

把这两个文件传到 NAS 的同一目录，例如 `/vol1/docker/ogame/`：

```
/vol1/docker/ogame/
├── ogame-vue-ts.tar
└── docker-compose.yml
```

飞牛「Docker」应用里：

1. **镜像** → 导入 → 选 `ogame-vue-ts.tar`
2. **项目** → 新建 → 选 `docker-compose.yml`
3. 启动

或 SSH：

```bash
cd /vol1/docker/ogame
docker load -i ogame-vue-ts.tar
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

## 常见问题

| 现象 | 处理 |
|---|---|
| 拉取镜像超时 | 用 `docker-compose.yml`（无 build）；或配镜像加速 |
| `open Dockerfile: no such file` | 用导入镜像方式，或上传完整源码并加 `-f docker-compose.build.yml` |
| 页面能开、进不了游戏 | WebSocket 未转发 / 端口映射不对 |
| 打开是旧版本 | 访问 `/reset-sw` |
| 存档丢失 | 检查 `./data` 挂载路径是否变化 |
