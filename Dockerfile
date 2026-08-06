# T34-F6 标准 Node 24 多阶段构建。
#
# 与旧实现的关键差异：不再手工遍历 `pnpm list` 复制 ali-oss 依赖闭包。
# 生产依赖使用 pnpm 官方的 `pnpm deploy --prod`，由包管理器保证闭包完整、
# 版本一致、native 依赖正确落地。
#
# 本轮（用户明确要求）不在本地构建或运行此镜像；构建验证由 GitHub Actions 承担。

# ---------- deps：只解析依赖，最大化层缓存 ----------
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
# 先只复制清单，源码变动不会让依赖层失效。
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts=false

# ---------- build：构建 Nuxt/Nitro 产物并导出生产依赖 ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

# 把运维脚本 bundle 成单个 JS：运行镜像因此不需要 tsx 或任何开发工具链，
# 也不会出现“复制了 TypeScript 源码却缺少执行器”的情况。
# native / 平台相关依赖保持 external，由生产 node_modules 提供。
RUN pnpm exec esbuild scripts/container-ops.ts \
      --bundle \
      --platform=node \
      --target=node24 \
      --format=esm \
      --outfile=/app/ops-dist/ops.mjs \
      --external:better-sqlite3 \
      --external:ffmpeg-static \
      --external:ali-oss \
      --external:drizzle-orm \
      --banner:js="import{createRequire as __nodeRequire}from'node:module';const require=__nodeRequire(import.meta.url);" \
    && cp scripts/oss-preflight.mjs scripts/oss-preflight-core.mjs \
          scripts/embedded-ffmpeg.mjs /app/ops-dist/

# 生产依赖闭包：pnpm 官方机制，不手工复制任何单个包。
RUN pnpm deploy --prod --legacy /app/deploy

# ---------- runtime：非 root、只带运行所需内容 ----------
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_FILE=/app/data/studio.db

WORKDIR /app

# tini 作为 PID 1 正确转发 SIGTERM，保证优雅停机。
RUN apt-get update \
    && apt-get install --no-install-recommends -y tini \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data /app/backups \
    && chown -R node:node /app

COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/deploy/node_modules ./node_modules
COPY --from=build --chown=node:node /app/ops-dist ./ops
# 迁移文件与 drizzle 元数据必须进镜像：migrate 与 readiness 都依赖它们。
COPY --from=build --chown=node:node /app/server/database/migrations ./server/database/migrations
COPY --from=build --chown=node:node /app/package.json ./package.json

# 构建期自检：native binding 与 OSS SDK 必须真正可加载。
RUN node -e "import('better-sqlite3').then(()=>import('ali-oss')).then(()=>console.log('runtime deps ok'))"

USER node
VOLUME ["/app/data", "/app/backups"]
EXPOSE 3000

# tini 转发信号；默认命令为 serve。运维子命令见 docs/DEPLOYMENT.md：
#   docker compose run --rm app node ops/ops.mjs migrate
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", ".output/server/index.mjs"]
