# ─────────── baza ───────────
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app

# ─────────── asılılıqlar ───────────
# Yalnız admin + shared paketləri quraşdırılır — mobil tətbiqin ağır
# asılılıqları (React Native, Metro) image-ə girmir.
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json ./apps/api/
COPY apps/admin/package.json ./apps/admin/
COPY apps/mobile/package.json ./apps/mobile/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile --filter @gezgin/admin... --filter @gezgin/shared...

# ─────────── build ───────────
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/admin ./apps/admin
RUN pnpm --filter @gezgin/shared build \
 && pnpm --filter @gezgin/admin build

# ─────────── production ───────────
FROM node:22-alpine AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3200
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# `output: standalone` lazım olan node_modules-u özü yığır
COPY --from=build /app/apps/admin/.next/standalone ./
COPY --from=build /app/apps/admin/.next/static ./apps/admin/.next/static
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
EXPOSE 3200
CMD ["node", "apps/admin/server.js"]
