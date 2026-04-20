FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9

# ── Dependências ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json tsconfig.base.json ./

COPY apps/api/package.json ./apps/api/
COPY packages/billing/package.json ./packages/billing/
COPY packages/database/package.json ./packages/database/

RUN pnpm install --no-frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

COPY apps/api ./apps/api
COPY packages/billing ./packages/billing
COPY packages/database ./packages/database

RUN cd packages/database && npx prisma generate --schema=prisma/schema.prisma

RUN pnpm --filter @boilerplate/database build
RUN pnpm --filter @boilerplate/billing build
RUN pnpm --filter @matrix/api build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/billing/package.json ./packages/billing/
COPY packages/database/package.json ./packages/database/

RUN pnpm install --no-frozen-lockfile --prod

COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/generated ./packages/database/generated
COPY --from=builder /app/packages/billing/dist ./packages/billing/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/index.js"]
