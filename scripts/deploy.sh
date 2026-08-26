#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
# deploy.sh — Script de despliegue idempotente para 3F Mailer
# ══════════════════════════════════════════════════════════════
# Uso: bash scripts/deploy.sh
#
# Requisitos:
#   - Docker y Docker Compose instalados
#   - Git configurado con acceso al repositorio
#   - Archivo .env configurado en la raíz del proyecto
# ══════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colores ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[deploy]${NC} $1"; }
ok()  { echo -e "${GREEN}[  OK  ]${NC} $1"; }
warn(){ echo -e "${YELLOW}[ WARN ]${NC} $1"; }
err() { echo -e "${RED}[ERROR ]${NC} $1"; exit 1; }

# ── Verificar requisitos ─────────────────────────────────────
command -v docker >/dev/null 2>&1 || err "Docker no está instalado"
command -v git >/dev/null 2>&1 || err "Git no está instalado"

# ── Directorio del proyecto ──────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

log "Directorio del proyecto: $PROJECT_DIR"

# ── Verificar .env ───────────────────────────────────────────
if [ ! -f ".env" ]; then
  err "Archivo .env no encontrado. Copiar .env.production.example como .env y completar las variables."
fi

# ── Pull últimos cambios ─────────────────────────────────────
log "Descargando últimos cambios de Git..."
git pull origin main || warn "No se pudo hacer git pull (¿offline o sin cambios?)"
ok "Código actualizado"

# ── Build de imágenes ────────────────────────────────────────
log "Construyendo imágenes Docker..."
docker compose -f docker-compose.prod.yml build --parallel
ok "Imágenes construidas"

# ── Levantar servicios ───────────────────────────────────────
log "Levantando servicios..."
docker compose -f docker-compose.prod.yml up -d
ok "Servicios iniciados"

# ── Esperar healthcheck del backend ──────────────────────────
log "Esperando healthcheck del backend..."
MAX_RETRIES=30
RETRY_INTERVAL=2
RETRIES=0

while [ $RETRIES -lt $MAX_RETRIES ]; do
  if docker inspect --format='{{.State.Health.Status}}' mails-backend 2>/dev/null | grep -q "healthy"; then
    ok "Backend está healthy"
    break
  fi
  RETRIES=$((RETRIES + 1))
  sleep $RETRY_INTERVAL
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
  warn "Backend no reportó healthy en $(($MAX_RETRIES * $RETRY_INTERVAL))s. Revisar logs:"
  docker logs --tail 50 mails-backend
fi

# ── Status final ─────────────────────────────────────────────
echo ""
log "═══════════════════════════════════════════"
log "  Estado de los servicios:"
log "═══════════════════════════════════════════"
docker compose -f docker-compose.prod.yml ps
echo ""
ok "Despliegue completado 🚀"
