FROM node:20-alpine AS base
RUN npm install -g pnpm

# ── Dependências ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/auth/package.json ./packages/auth/
COPY packages/billing/package.json ./packages/billing/
COPY packages/database/package.json ./packages/database/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY . .
RUN packages/database/node_modules/.bin/prisma generate --schema=packages/database/prisma/schema.prisma
RUN pnpm --filter @boilerplate/database build
RUN pnpm --filter @boilerplate/billing build
RUN pnpm --filter @matrix/api build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Root node_modules (pnpm virtual store + workspace symlinks)
COPY --from=deps /app/node_modules ./node_modules

# App node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Workspace packages (symlinked from apps/api/node_modules)
COPY --from=deps /app/packages/billing/node_modules ./packages/billing/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules

# Prisma generated client (only exists after prisma generate in builder)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY --from=builder /app/packages/billing/dist ./packages/billing/dist
COPY --from=builder /app/packages/billing/package.json ./packages/billing/package.json
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/index.js"]
