#!/usr/bin/env bash
# =============================================================================
# deploy-calo.sh — Deploy dos apps Calo na VPS Speedfy via SSH
# =============================================================================
# Uso: bash infra/scripts/deploy-calo.sh [api|web|admin|all]
# Padrão: all
# =============================================================================

set -euo pipefail

VPS_IP="209.50.228.131"
VPS_USER="root"
REPO_DIR="/root/matrix"
TARGET="${1:-all}"

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }

# Executa comando remoto na VPS
remote() { ssh "${VPS_USER}@${VPS_IP}" "$@"; }

# -----------------------------------------------------------------------------
info "Fazendo push do código para o repositório..."
git push origin main
log "Push concluído"

# -----------------------------------------------------------------------------
info "Atualizando código na VPS..."
remote "cd ${REPO_DIR} && git pull origin main"
log "Código atualizado"

# -----------------------------------------------------------------------------
deploy_api() {
  info "Build e deploy da API..."
  remote "cd ${REPO_DIR} && docker compose build --no-cache api && docker compose up -d api"
  log "matrix-api no ar"
}

deploy_web() {
  info "Build e deploy do Web (catálogo)..."
  remote "cd ${REPO_DIR} && docker compose build --no-cache web && docker compose up -d web"
  log "matrix-web no ar"
}

deploy_admin() {
  info "Build e deploy do Calo Admin..."
  remote "cd ${REPO_DIR} && docker compose build --no-cache calo-admin && docker compose up -d calo-admin"
  log "matrix-calo-admin no ar"
}

case "$TARGET" in
  api)   deploy_api ;;
  web)   deploy_web ;;
  admin) deploy_admin ;;
  all)
    deploy_api
    deploy_web
    deploy_admin
    ;;
  *) echo "Uso: $0 [api|web|admin|all]"; exit 1 ;;
esac

# -----------------------------------------------------------------------------
info "Status dos containers:"
remote "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'matrix|NAME'"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Deploy concluído: ${TARGET}${NC}"
echo -e "${GREEN}  api   → https://api.scheffelt.xyz${NC}"
echo -e "${GREEN}  web   → https://calo.scheffelt.xyz${NC}"
echo -e "${GREEN}  admin → https://admin.calo.scheffelt.xyz${NC}"
echo -e "${GREEN}============================================${NC}"
