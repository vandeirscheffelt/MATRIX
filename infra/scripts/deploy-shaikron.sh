#!/usr/bin/env bash
# =============================================================================
# deploy-shaikron.sh — Build e deploy do Shaikron API via Docker
# Executar na VPS: bash /var/www/matrix/infra/scripts/deploy-shaikron.sh
# =============================================================================

set -euo pipefail

APP_DIR="/var/www/matrix"
COMPOSE_FILE="${APP_DIR}/infra/docker/shaikron/docker-compose.yml"
NGINX_CONF="${APP_DIR}/infra/nginx/shaikron.conf"
NGINX_DEST="/etc/nginx/conf.d/shaikron.conf"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }

# 1. Pull do código
info "Atualizando código..."
cd "$APP_DIR"
git pull origin main
log "Código atualizado ($(git rev-parse --short HEAD))"

# 2. Nginx
info "Configurando nginx..."
cp "$NGINX_CONF" "$NGINX_DEST"
nginx -t && nginx -s reload
log "Nginx recarregado"

# 3. Build + deploy do container
info "Build da imagem Docker..."
docker compose -f "$COMPOSE_FILE" build --no-cache
log "Imagem construída"

info "Subindo container..."
docker compose -f "$COMPOSE_FILE" up -d
log "Container shaikron-api rodando"

# 4. Status
echo ""
docker compose -f "$COMPOSE_FILE" ps
echo ""
log "Deploy concluído — api.shaikron.scheffelt.xyz"
