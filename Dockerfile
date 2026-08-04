FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile \
    && pnpm build \
    && node -e "const { execFileSync } = require('node:child_process'); const { cpSync, mkdirSync } = require('node:fs'); const { dirname, join } = require('node:path'); const tree = JSON.parse(execFileSync('pnpm', ['list', '--prod', '--depth', 'Infinity', '--json'], { encoding: 'utf8' }))[0].dependencies['ali-oss']; const packages = new Map(); const collect = (entry) => { const current = packages.get(entry.from); if (current && current.version !== entry.version) throw new Error('Conflicting runtime dependency: ' + entry.from); if (!current) packages.set(entry.from, entry); Object.values(entry.dependencies || {}).forEach(collect); }; collect(tree); for (const entry of packages.values()) { const target = join('/runtime-node-modules', entry.from); mkdirSync(dirname(target), { recursive: true }); cpSync(entry.path, target, { recursive: true, dereference: true }); }"

FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_FILE=/app/data/studio.db

WORKDIR /app
RUN mkdir -p /app/data && chown node:node /app/data
COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /runtime-node-modules ./node_modules
RUN node -e "import('ali-oss')"

USER node
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
