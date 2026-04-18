FROM node:20-alpine AS builder
RUN npm install -g pnpm@9
WORKDIR /app

# Manifests do monorepo (necessários para pnpm workspaces)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/shaikron-web/package.json ./apps/shaikron-web/

# Instala só as deps do shaikron-web
RUN pnpm install --frozen-lockfile --filter @matrix/shaikron-web...

# Copia o código
COPY apps/shaikron-web ./apps/shaikron-web

# Build args para injetar no Vite
ARG VITE_API_BASE_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN pnpm --filter @matrix/shaikron-web build

# ── Runtime — nginx serve ──────────────────────────────────────────────
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/shaikron-web/dist /usr/share/nginx/html
COPY apps/shaikron-web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
