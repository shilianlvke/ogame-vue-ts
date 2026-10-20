# 飞牛 fnOS Docker 部署

项目使用「Vue 静态前端 + Node.js WebSocket 服务端」一体化镜像，只暴露 **25122** 一个端口。

当前仓库只维护飞牛 fnOS 的 Docker 部署方式，不再提供 Electron、Android、Go 服务端、GitHub Pages、静态 nginx 镜像等部署文件。

## 文件说明

| 文件 | 用途 |
|---|---|
| `Dockerfile` | 多阶段构建前端 + Node 服务端，生产阶段只安装运行依赖 |
| `docker-compose.yml` | 飞牛默认运行配置，只使用本地 `noskyman:latest` 镜像 |
| `deploy-fnos.sh` | 飞牛源码目录一键构建、启动、更新、查看日志 |
| `docker-build.ps1` | Windows 电脑构建镜像并导出 `noskyman.tar` |
| `.dockerignore` | 构建上下文排除项 |

`docker-compose.yml` 现在只包含 `image:`，不会再联网拉取 Docker Hub 的同名镜像。

## 方式一：飞牛上从源码一键部署（推荐）

前置条件：

- 飞牛「应用中心」已安装 Docker；
- 已安装 `git`；
- 能拉取 `node:22-alpine`，或在 Docker 设置里配置了镜像加速。

```bash
cd /vol1/docker
git clone <仓库地址> ogame
cd ogame

chmod +x deploy-fnos.sh
./deploy-fnos.sh
```

脚本会构建 `noskyman:latest`，然后执行 `docker compose up -d`。

常用命令：

```bash
./deploy-fnos.sh                 # 首次部署：构建 + 启动
./deploy-fnos.sh --update        # git pull + 按需重建 + 启动
./deploy-fnos.sh --start         # 只启动
./deploy-fnos.sh --stop          # 停止并移除容器
./deploy-fnos.sh --restart       # 重启
./deploy-fnos.sh --logs          # 跟踪日志
./deploy-fnos.sh --status        # 查看状态
./deploy-fnos.sh --port 8080     # 修改宿主机端口
./deploy-fnos.sh --registry https://registry.npmmirror.com
./deploy-fnos.sh --base-image docker.m.daocloud.io/library/node:22-alpine
./deploy-fnos.sh --china         # 国内 npm + 基础镜像源
```

存档位于 `./data/world.json`，重建容器不会删除。

## 方式二：电脑构建镜像，复制到飞牛

Windows：

```powershell
.\docker-build.ps1
# 等价于
# docker build -t noskyman:latest .
# docker save noskyman:latest -o noskyman.tar
```

把以下两个文件放到飞牛同一目录，例如 `/vol1/docker/ogame/`：

```text
/vol1/docker/ogame/
├── noskyman.tar
└── docker-compose.yml
```

飞牛「Docker」应用：

1. **镜像** → 导入 → 选择 `noskyman.tar`；
2. **项目** → 新建 → 选择 `docker-compose.yml`；
3. 启动。

或 SSH：

```bash
cd /vol1/docker/ogame
docker load -i noskyman.tar
docker compose up -d
```

## 端口与数据

```yaml
ports:
  - "${OGAME_PORT:-25122}:25122"
volumes:
  - ./data:/app/data
```

修改宿主机端口：

```bash
OGAME_PORT=8080 docker compose up -d
```

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | 25122 | 容器内端口，需与端口映射右侧一致 |
| `GAME_SPEED` | 1（Compose 中为 10） | 游戏倍速 |
| `NPC_COUNT` | 200 | NPC 数量 |
| `VISIBILITY` | public | `public` 公开信息 / `full` 全部可见 |
| `LOCALE` | zh-CN | 默认语言 |
| `NEWBIE_PROTECTION_HOURS` | 24 | 新手保护 |
| `MAX_ACCOUNT` | 空 | 内置满级账号：`用户名:密码` |
| `TICK_MS` | 1000 | tick 间隔 |
| `AUTOSAVE_MS` | 30000 | 自动存档间隔 |

## 反向代理 / HTTPS

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

Lucky / SakuraFrp 等穿透工具同样需要开启 WebSocket，并保留 `/ws` 路径，不要改写。

服务端健康检查：

```bash
curl http://127.0.0.1:25122/health
```

## 更新与缓存

每次 `pnpm build` 都会生成 `docs/version.json`，页面会自动检查新构建并提示刷新。

如果首次打开仍是旧界面：

```text
http://<NAS IP>:25122/reset-sw
```

反向代理不要缓存 `version.json` 和 `index.html`。

## 常见问题

| 现象 | 处理 |
|---|---|
| 拉取 `noskyman:latest` 超时 | 确认使用的是当前 `docker-compose.yml`（只有 `image:`，无 `build:`），并先 `docker load` |
| `open Dockerfile: no such file` | 该错误只会在强制构建时出现；源码部署请使用完整仓库并运行 `./deploy-fnos.sh` |
| 页面能开但进不了游戏 | 检查 25122 端口和 WebSocket 转发 |
| 打开是旧版本 | 访问 `/reset-sw` 清理 Service Worker 缓存 |
| 存档丢失 | 检查 `./data` 挂载路径是否变化 |

## 构建镜像加速

飞牛 Docker 设置中填写镜像加速地址，或编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://dockerproxy.com"
  ]
}
```

然后重启 Docker。

npm 依赖可使用 `--registry https://registry.npmmirror.com` 或 `--china`。
