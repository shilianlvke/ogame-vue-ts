# syntax=docker/dockerfile:1

# ============================================================
#  一体化镜像：前端静态文件 + Node 游戏服务端（WebSocket）
#  构建：docker build -t ogame-vue-ts .
#  运行：docker run -p 25122:25122 -v ./data:/app/data ogame-vue-ts
# ============================================================

# ---------- 构建阶段 ----------
FROM node:22-alpine AS build
WORKDIR /app

RUN npm install -g pnpm@10

# 先只拷依赖清单，命中缓存
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 再拷源码并构建：前端产物 docs/，服务端产物 server-dist/
COPY . .
RUN pnpm run build \
 && pnpm run build:node-server

# ---------- 运行阶段 ----------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=25122 \
    STATIC_DIR=/app/docs \
    DATA_DIR=/app/data

RUN apk add --no-cache tini \
 && npm install -g pnpm@10

# 服务端打包后仍依赖 ws 等外部包，这里只装生产依赖
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts \
 && pnpm store prune \
 && npm cache clean --force

COPY --from=build /app/server-dist ./server-dist
COPY --from=build /app/docs ./docs

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 25122

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:25122/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server-dist/main.js"]
