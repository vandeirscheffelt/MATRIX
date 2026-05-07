#!/usr/bin/env bash
# =============================================================================
# deploy-shaikron-web.sh — Build e deploy do Shaikron Frontend via Docker
# Executar na VPS: bash /var/www/matrix/infra/scripts/deploy-shaikron-web.sh
# =============================================================================

set -euo pipefail

APP_DIR="/var/www/matrix"
COMPOSE_FILE="${APP_DIR}/infra/docker/shaikron/docker-compose.web.yml"
NGINX_CONF="${APP_DIR}/infra/nginx/shaikron-web.conf"
ICONTAINER_CONF_D="/etc/icontainer/apps/openresty/openresty/conf/conf.d"
ICONTAINER_CERTS="${ICONTAINER_CONF_D}/certs"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

# 1. Pull do código
info "Atualizando código..."
cd "$APP_DIR"
git pull origin main
log "Código atualizado ($(git rev-parse --short HEAD))"

# 2. Nginx (OpenResty via icontainer/Speedfy)
info "Configurando nginx..."
cp "$NGINX_CONF" "${ICONTAINER_CONF_D}/shaikron-web.conf"

# Sincronizar certs do Let's Encrypt para dentro do namespace do OpenResty
CERT_SRC="/etc/letsencrypt/live/app.shaikron.scheffelt.xyz"
if [ -f "${CERT_SRC}/fullchain.pem" ]; then
  cp "${CERT_SRC}/fullchain.pem" "${ICONTAINER_CERTS}/shaikron-fullchain.pem"
  cp "${CERT_SRC}/privkey.pem"   "${ICONTAINER_CERTS}/shaikron-privkey.pem"
  log "Certs sincronizados"
else
  warn "Certs não encontrados em ${CERT_SRC} — SSL pode falhar"
fi

OPENRESTY_PID=$(pgrep -f "openresty" | head -1)
if [ -n "$OPENRESTY_PID" ]; then
  nsenter -t "$OPENRESTY_PID" -m -u -i -n -p -- /usr/local/openresty/nginx/sbin/nginx -s reload 2>&1 \
    && log "OpenResty recarregado (pid $OPENRESTY_PID)" \
    || warn "Reload retornou erro — verifique a config"
else
  warn "PID do OpenResty não encontrado — conf copiada, recarregue manualmente"
fi

# 3. Build + deploy do container
info "Build da imagem Docker (pode demorar ~2min)..."
docker compose -f "$COMPOSE_FILE" build --no-cache
log "Imagem construída"

info "Subindo container..."
docker stop shaikron-web 2>/dev/null || true
docker rm shaikron-web 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" up -d
log "Container shaikron-web rodando"

# 4. Status
echo ""
docker compose -f "$COMPOSE_FILE" ps
echo ""
log "Deploy concluído — app.shaikron.scheffelt.xyz"
