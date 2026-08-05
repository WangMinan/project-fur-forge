FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_FILE=/app/data/studio.db
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate \
    && mkdir -p /app/data /app/backups \
    && chown -R node:node /app/data /app/backups
COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/shared ./shared
COPY --from=build --chown=node:node /app/config ./config
COPY --from=build --chown=node:node /app/drizzle.config.ts /app/tsconfig.json ./
RUN chmod +x /app/scripts/container-entrypoint.sh \
    && node -e "import('ali-oss')" \
    && node -e "import('better-sqlite3')"
USER node
VOLUME ["/app/data", "/app/backups"]
EXPOSE 3000
ENTRYPOINT ["/app/scripts/container-entrypoint.sh"]
CMD ["serve"]
