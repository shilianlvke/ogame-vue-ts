# syntax=docker/dockerfile:1

# ============================================================
#  All-in-one image: static frontend + Node game server (WebSocket)
#  Build: docker build -t ogame-vue-ts .
#  Run:   docker run -p 25122:25122 -v ./data:/app/data ogame-vue-ts
# ============================================================

# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

# NPM_REGISTRY can be overridden: https://registry.npmmirror.com
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN npm install -g pnpm@10 \
 && pnpm config set registry "$NPM_REGISTRY"

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm config set store-dir /root/.pnpm-store \
 && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build \
 && pnpm run build:node-server

# ---------- runtime stage ----------
FROM node:22-alpine AS runtime
WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmjs.org

ENV NODE_ENV=production \
    PORT=25122 \
    STATIC_DIR=/app/docs \
    DATA_DIR=/app/data

RUN apk add --no-cache tini \
 && npm install -g pnpm@10 \
 && pnpm config set registry "$NPM_REGISTRY"

# production dependencies only (ws is external in the server bundle)
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm config set store-dir /root/.pnpm-store \
 && pnpm install --prod --frozen-lockfile --ignore-scripts

COPY --from=build /app/server-dist ./server-dist
COPY --from=build /app/docs ./docs

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 25122

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:25122/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server-dist/main.js"]
