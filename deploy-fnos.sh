#!/usr/bin/env bash
# ============================================================
#  飞牛 fnOS / Linux 一键部署（git clone 源码方式）
#
#  首次部署：   ./deploy-fnos.sh
#  更新部署：   ./deploy-fnos.sh --update
#  只启动：     ./deploy-fnos.sh --start
#  查看日志：   ./deploy-fnos.sh --logs
#  停止：       ./deploy-fnos.sh --stop
#
#  可选参数：
#    --port 8080                      改宿主机端口（默认 25122）
#    --registry https://registry.npmmirror.com   国内 npm 加速
# ============================================================
set -euo pipefail

# 启用 BuildKit，才能使用 pnpm store 缓存挂载
export DOCKER_BUILDKIT=1

ACTION="deploy"
FORCE_BUILD=0
TAG="noskyman:latest"
REG="https://registry.npmjs.org"
PORT="25122"

usage() {
  sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --update|-u)  ACTION="update"; shift ;;
    --start)      ACTION="start"; shift ;;
    --stop)       ACTION="stop"; shift ;;
    --restart)    ACTION="restart"; shift ;;
    --logs)       ACTION="logs"; shift ;;
    --status)     ACTION="status"; shift ;;
    --force|-f)   FORCE_BUILD=1; shift ;;
    --tag)        TAG="${2:-}"; shift 2 ;;
    --registry)   REG="${2:-}"; shift 2 ;;
    --port)       PORT="${2:-}"; shift 2 ;;
    -h|--help)    usage ;;
    *) echo "未知参数：$1"; exit 1 ;;
  esac
done

cd "$(dirname "$0")"

if [[ ! -f Dockerfile || ! -f package.json ]]; then
  echo "错误：请在项目根目录执行（需要 Dockerfile 和 package.json）"
  exit 1
fi

# ---------- 权限 ----------
if [[ $EUID -eq 0 ]]; then
  SUDO=""
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
else
  SUDO=""
fi

# ---------- Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  cat <<'EOF'
未检测到 docker。

飞牛：先在「应用中心」安装 Docker，再重新运行本脚本。
其他系统：curl -fsSL https://get.docker.com | sh
EOF
  exit 1
fi

if docker info >/dev/null 2>&1; then
  DOCKER="docker"
else
  DOCKER="$SUDO docker"
fi

# ---------- Compose ----------
if $DOCKER compose version >/dev/null 2>&1; then
  COMPOSE="$DOCKER compose"
  # compose v2 支持 --pull never，避免联网拉取本地已构建的镜像
  PULL_FLAGS="--pull never"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="${SUDO:+$SUDO }docker-compose"
  PULL_FLAGS=""
else
  echo "错误：缺少 docker compose（飞牛 Docker 应用一般自带）"
  exit 1
fi

export OGAME_PORT="$PORT"
mkdir -p data

# 清理历史遗留容器（改名前的 ogame / ogame-vue-ts），存档在 ./data 不受影响
for legacy in ogame ogame-vue-ts; do
  if $DOCKER ps -a --format '{{.Names}}' | grep -qx "$legacy"; then
    echo "==> 清理旧容器：$legacy"
    $DOCKER rm -f "$legacy" >/dev/null
  fi
done

case "$ACTION" in
  deploy|update)
    if [[ "$ACTION" == "update" ]]; then
      if git rev-parse --git-dir >/dev/null 2>&1; then
        echo "==> 拉取最新代码"
        git pull --ff-only || { echo "git pull 失败，请手动处理"; exit 1; }
      else
        echo "提示：当前目录不是 git 仓库，跳过拉取"
      fi
    fi
    STAMP_FILE=".deploy-last-commit"
    CURRENT="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
    IMAGE_EXISTS=0
    $DOCKER image inspect "$TAG" >/dev/null 2>&1 && IMAGE_EXISTS=1

    NEED_BUILD=1
    if [[ $FORCE_BUILD -eq 0 && $IMAGE_EXISTS -eq 1 && -f "$STAMP_FILE" ]]; then
      STAMP="$(cat "$STAMP_FILE")"
      DIRTY=0
      git diff --quiet 2>/dev/null || DIRTY=1
      git diff --cached --quiet 2>/dev/null || DIRTY=1
      if [[ "$STAMP" == "$CURRENT" && $DIRTY -eq 0 ]]; then
        NEED_BUILD=0
        echo "==> 代码未变化（$CURRENT），跳过构建（加 --force 可强制重建）"
      fi
    fi

    if [[ $NEED_BUILD -eq 1 ]]; then
      echo "==> 构建镜像 $TAG"
      echo "    npm 源：$REG"
      $DOCKER build --build-arg "NPM_REGISTRY=$REG" -t "$TAG" .
      echo "$CURRENT" > "$STAMP_FILE"
    fi
    echo "==> 启动容器"
    $COMPOSE up -d $PULL_FLAGS
    ;;
  start)
    $COMPOSE up -d $PULL_FLAGS
    ;;
  stop)
    $COMPOSE down
    ;;
  restart)
    $COMPOSE restart
    ;;
  logs)
    $COMPOSE logs -f --tail=200
    ;;
  status)
    $COMPOSE ps
    ;;
esac

if [[ "$ACTION" != "logs" && "$ACTION" != "status" && "$ACTION" != "stop" ]]; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -z "${IP:-}" ]] && IP="<本机IP>"
  echo ""
  echo "访问地址： http://$IP:$PORT"
  echo "首次打开若显示旧界面：http://$IP:$PORT/reset-sw"
fi
