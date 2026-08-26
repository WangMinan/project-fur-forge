# syntax=docker/dockerfile:1.7

# T34-F6 · 标准 Node 24 多阶段构建。
#
# 约束：
# - 使用完整 Node 24 Debian/glibc 运行环境，兼容 better-sqlite3 与 ffmpeg-static；
# - 依赖闭包由 pnpm 管理，不手工复制 ali-oss 或任何单包依赖树；
# - pnpm 11 默认阻止未批准的依赖构建脚本，因此依赖阶段必须复制版本控制内的
#   pnpm-workspace.yaml，严格执行仓库已审查的 allowBuilds/strictDepBuilds 策略；
# - 本地不构建镜像；由 GitHub Actions 的 image-build job 验证。

FROM node:24.18.1-bookworm-slim AS base

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:${PATH}

WORKDIR /app

RUN corepack enable \
    && corepack prepare pnpm@11.18.0 --activate

# ---------- deps：只根据 lockfile 拉取依赖，最大化缓存复用 ----------
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# fetch 不执行项目或依赖脚本；源码尚未复制也不会触发 nuxt prepare。
# 复制 pnpm-workspace.yaml 是必要条件：其中的 allowBuilds/strictDepBuilds
# 决定哪些依赖安装脚本可执行；遗漏它会在 CI 中触发 ERR_PNPM_IGNORED_BUILDS。
RUN pnpm fetch --frozen-lockfile --store-dir=/pnpm/store

# ---------- build：离线安装、执行允许的构建脚本并生成生产产物 ----------
FROM base AS build

COPY --from=deps /pnpm/store /pnpm/store
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY . .

RUN pnpm install \
      --offline \
      --frozen-lockfile \
      --store-dir=/pnpm/store

RUN pnpm build

# 运维脚本 bundle 成单个 ESM 文件；native/runtime 依赖保持 external，
# 由生产 node_modules 提供。运行镜像不需要 tsx、Playwright 或测试依赖。
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
    && cp scripts/oss-preflight.mjs \
          scripts/oss-preflight-core.mjs \
          scripts/production-preflight-core.mjs \
          scripts/esa-sdk.mjs \
          scripts/embedded-ffmpeg.mjs \
          /app/ops-dist/

# pnpm deploy 面向 workspace package，必须显式选择根项目。输出目录不能与仓库
# 自身的 deploy/nginx 配置目录重叠，因此使用独立的 runtime-deploy。
RUN pnpm --filter=project-fur-paws --prod deploy --legacy /app/runtime-deploy

# ---------- runtime：非 root，只包含运行和运维所需内容 ----------
FROM node:24.18.1-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_FILE=/app/data/studio.db

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y tini \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data /app/backups \
    && chown -R node:node /app

COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/runtime-deploy/node_modules ./node_modules
COPY --from=build --chown=node:node /app/ops-dist ./ops
COPY --from=build --chown=node:node /app/shared/utils/privacy-policy-readiness.mjs ./shared/utils/privacy-policy-readiness.mjs
COPY --from=build --chown=node:node /app/server/database/migrations ./server/database/migrations
COPY --from=build --chown=node:node /app/package.json ./package.json

# 构建期验证：实际创建 SQLite 内存库、加载 OSS/ESA SDK，并确认 FFmpeg 可执行。
RUN node --input-type=module -e "\
  import { accessSync, constants } from 'node:fs'; \
  import Database from 'better-sqlite3'; \
  import ffmpegPath from 'ffmpeg-static'; \
  await import('ali-oss'); \
  import { \$OpenApiUtil } from '@alicloud/openapi-core'; \
  import { EsaClient, DescribePurgeTasksRequest, PurgeCachesRequest, PurgeCachesRequestContent } from './ops/esa-sdk.mjs'; \
  const esaClient = new EsaClient(new \$OpenApiUtil.Config({ accessKeyId: 'runtime-verify-id', accessKeySecret: 'runtime-verify-secret', endpoint: 'esa.cn-hangzhou.aliyuncs.com', protocol: 'HTTPS', regionId: 'cn-hangzhou' })); \
  const purgeContent = new PurgeCachesRequestContent({ files: ['https://public-media.ditedog.com/prod/web/runtime-verify.webp'] }); \
  const purgeRequest = new PurgeCachesRequest({ siteId: 1234567890, type: 'file', content: purgeContent }); \
  const describeRequest = new DescribePurgeTasksRequest({ siteId: 1234567890, type: 'file' }); \
  if (typeof esaClient.purgeCaches !== 'function' || purgeRequest.type !== 'file' || describeRequest.type !== 'file') throw new Error('ESA SDK runtime constructors are unavailable'); \
  const db = new Database(':memory:'); \
  db.prepare('select 1').get(); \
  db.close(); \
  if (!ffmpegPath) throw new Error('ffmpeg-static path is unavailable'); \
  accessSync(ffmpegPath, constants.X_OK); \
  console.log('runtime dependencies verified');"

USER node

VOLUME ["/app/data", "/app/backups"]
EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", ".output/server/index.mjs"]
