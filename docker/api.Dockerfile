# ─────────── baza ───────────
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# ─────────── asılılıqlar ───────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile || pnpm install

# ─────────── development ───────────
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @gezgin/api exec prisma generate
EXPOSE 3000
CMD ["pnpm", "--filter", "@gezgin/api", "start:dev"]

# ─────────── build ───────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @gezgin/api exec prisma generate \
 && pnpm --filter @gezgin/shared build \
 && pnpm --filter @gezgin/api build \
 && pnpm prune --prod

# ─────────── production ───────────
FROM node:22-alpine AS production
RUN apk add --no-cache libc6-compat openssl curl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/packages ./packages
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/v1/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
