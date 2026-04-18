#!/usr/bin/env bash
# =============================================================================
# deploy-shaikron-web.sh — Build e deploy do Shaikron Frontend via Docker
# Executar na VPS: bash /var/www/matrix/infra/scripts/deploy-shaikron-web.sh
# =============================================================================

set -euo pipefail

APP_DIR="/var/www/matrix"
COMPOSE_FILE="${APP_DIR}/infra/docker/shaikron/docker-compose.web.yml"
NGINX_CONF="${APP_DIR}/infra/nginx/shaikron-web.conf"
NGINX_DEST="/etc/nginx/conf.d/shaikron-web.conf"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

# 1. Pull do código
info "Atualizando código..."
cd "$APP_DIR"
git pull origin main
log "Código atualizado ($(git rev-parse --short HEAD))"

# 2. Nginx
info "Configurando nginx..."
cp "$NGINX_CONF" "$NGINX_DEST"
NGINX_PID=$(cat /run/nginx.pid 2>/dev/null || pgrep -f "nginx: master" | head -1)
if [ -n "$NGINX_PID" ]; then
  kill -HUP "$NGINX_PID" && log "Nginx recarregado (HUP pid $NGINX_PID)"
else
  warn "Não foi possível recarregar nginx — conf copiada, reinicie manualmente"
fi

# 3. Build + deploy do container
info "Build da imagem Docker (pode demorar ~2min)..."
docker compose -f "$COMPOSE_FILE" build --no-cache
log "Imagem construída"

info "Subindo container..."
docker compose -f "$COMPOSE_FILE" up -d
log "Container shaikron-web rodando"

# 4. Status
echo ""
docker compose -f "$COMPOSE_FILE" ps
echo ""
log "Deploy concluído — app.shaikron.scheffelt.xyz"
