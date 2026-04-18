FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9

# ── Dependências ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Manifests do monorepo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY turbo.json ./

# Manifests de todos os packages usados pela API
COPY apps/api/package.json ./apps/api/
COPY packages/billing/package.json ./packages/billing/
COPY packages/database/package.json ./packages/database/

RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

# Copiar todo o código-fonte dos packages necessários
COPY apps/api ./apps/api
COPY packages/billing ./packages/billing
COPY packages/database ./packages/database

# Gerar Prisma Client
RUN cd packages/database && npx prisma generate --schema=prisma/schema.prisma

# Build dos packages em ordem de dependência
RUN pnpm --filter @boilerplate/database build
RUN pnpm --filter @boilerplate/billing build
RUN pnpm --filter @matrix/api build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# pnpm virtual store completo
COPY --from=builder /app/node_modules ./node_modules

# node_modules de cada package
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/billing/node_modules ./packages/billing/node_modules
COPY --from=builder /app/packages/database/node_modules ./packages/database/node_modules

# Prisma generated client
COPY --from=builder /app/packages/database/generated ./packages/database/generated

# Dists dos packages
COPY --from=builder /app/packages/billing/dist ./packages/billing/dist
COPY --from=builder /app/packages/billing/package.json ./packages/billing/package.json
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/database/package.json ./packages/database/package.json

# API
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

# Manifests necessários para o pnpm resolver symlinks em runtime
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/index.js"]
