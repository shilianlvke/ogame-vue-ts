#!/usr/bin/env bash
# ============================================================
#  Ubuntu 一键构建脚本（适用于全新系统）
#
#  用法：
#    chmod +x build-on-ubuntu.sh
#    ./build-on-ubuntu.sh                 # 只构建镜像
#    ./build-on-ubuntu.sh --save          # 构建并导出 ogame-vue-ts.tar
#    ./build-on-ubuntu.sh --run           # 构建并启动容器
#    ./build-on-ubuntu.sh --save --run    # 构建 + 导出 + 启动
#    ./build-on-ubuntu.sh --tag ogame:1.0 --save
#    ./build-on-ubuntu.sh --registry https://registry.npmmirror.com   # 国内加速
#
#  说明：
#    - 没有 Docker 时会自动安装（需要网络，国内建议先配好 apt 源）
#    - 构建需要能拉取 node:22-alpine；国内请先配置镜像加速
# ============================================================
set -euo pipefail

TAG="ogame-vue-ts:latest"
DO_SAVE=0
DO_RUN=0
DO_INSTALL=1
NPM_REGISTRY="https://registry.npmjs.org"

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)        TAG="${2:-}"; shift 2 ;;
    --save)       DO_SAVE=1; shift ;;
    --run)        DO_RUN=1; shift ;;
    --no-install) DO_INSTALL=0; shift ;;
    --registry)   NPM_REGISTRY="${2:-}"; shift 2 ;;
    -h|--help)    usage ;;
    *) echo "未知参数：$1"; exit 1 ;;
  esac
done

cd "$(dirname "$0")"

if [[ ! -f Dockerfile || ! -f package.json ]]; then
  echo "错误：当前目录缺少 Dockerfile 或 package.json"
  echo "请在项目根目录执行本脚本"
  exit 1
fi

# ---------- sudo ----------
if [[ $EUID -eq 0 ]]; then
  SUDO=""
else
  if ! command -v sudo >/dev/null 2>&1; then
    echo "错误：需要 root 权限，但系统没有 sudo"
    exit 1
  fi
  SUDO="sudo"
fi

# ---------- Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  if [[ $DO_INSTALL -eq 0 ]]; then
    echo "错误：未安装 Docker（已指定 --no-install）"
    exit 1
  fi
  echo "==> 未检测到 Docker，开始安装"
  $SUDO apt-get update -y
  $SUDO apt-get install -y ca-certificates curl
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO systemctl enable --now docker || true
  if [[ -n "${SUDO_USER:-}" ]]; then
    $SUDO usermod -aG docker "$SUDO_USER" || true
  fi
  echo "==> Docker 安装完成（重新登录后可不加 sudo）"
fi

# 当前 shell 是否可直接用 docker
if docker info >/dev/null 2>&1; then
  DOCKER="docker"
else
  DOCKER="$SUDO docker"
fi

# ---------- compose 插件（--run 才需要） ----------
if [[ $DO_RUN -eq 1 ]] && ! $DOCKER compose version >/dev/null 2>&1; then
  echo "==> 安装 docker compose 插件"
  $SUDO apt-get install -y docker-compose-plugin || \
  $SUDO apt-get install -y docker-compose-v2 || \
  echo "警告：compose 插件安装失败，请手动安装后再执行 --run"
fi

# ---------- 构建 ----------
echo "==> 构建镜像 $TAG"
$DOCKER build --build-arg "NPM_REGISTRY=$NPM_REGISTRY" -t "$TAG" .

# ---------- 导出 ----------
if [[ $DO_SAVE -eq 1 ]]; then
  OUT="ogame-vue-ts.tar"
  echo "==> 导出镜像到 $OUT"
  $DOCKER save "$TAG" -o "$OUT"
  SIZE=$(du -h "$OUT" | cut -f1)
  echo "==> 已导出：$OUT（$SIZE）"
fi

# ---------- 启动 ----------
if [[ $DO_RUN -eq 1 ]]; then
  echo "==> 启动容器（docker-compose.yml）"
  $DOCKER compose up -d
  echo "==> 访问：http://<本机IP>:25122"
  echo "    首次打开若显示旧界面，访问 /reset-sw 清 Service Worker 缓存"
fi

echo "==> 完成"
