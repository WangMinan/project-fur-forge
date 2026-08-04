FROM node:24-bookworm-slim AS build

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:24-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_FILE=/app/data/studio.db

WORKDIR /app
RUN mkdir -p /app/data && chown node:node /app/data
COPY --from=build --chown=node:node /app/.output ./.output

USER node
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
