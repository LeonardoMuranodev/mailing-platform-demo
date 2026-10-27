#!/bin/sh
# ─────────────────────────────────────────────────────────
# backup-db.sh — Volcado automatizado de PostgreSQL
#
# Genera un dump comprimido de la BD, elimina backups
# antiguos según BACKUP_RETENTION_DAYS, y sube a Google Drive
# si las credenciales están configuradas.
#
# Variables de entorno requeridas:
#   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
#   BACKUP_RETENTION_DAYS (default: 7)
#   TELEGRAM_TOKEN, TELEGRAM_CHAT_ID (para notificaciones)
#
# Variables opcionales para Google Drive:
#   GDRIVE_ENABLED=true
#   GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN
#   GDRIVE_FOLDER_ID (carpeta destino en Drive)
# ─────────────────────────────────────────────────────────

set -e

BACKUP_DIR="/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="genmailer_backup_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

# ── Funciones de notificación ────────────────────────────
notify_telegram() {
  local message="$1"
  if [ -n "$TELEGRAM_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage" \
      -H "Content-Type: application/json" \
      -d "{\"chat_id\":\"${TELEGRAM_CHAT_ID}\",\"text\":\"${message}\",\"parse_mode\":\"Markdown\"}" \
      > /dev/null 2>&1 || true
  fi
}

# ── 1. Crear directorio de backups ──────────────────────
mkdir -p "$BACKUP_DIR"

echo "[Backup] Iniciando dump de ${DB_NAME}@${DB_HOST}:${DB_PORT}..."

# ── 2. Ejecutar pg_dump ────────────────────────────────
export PGPASSWORD="$DB_PASSWORD"

if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-acl --clean --if-exists \
  | gzip > "$FILEPATH"; then

  FILE_SIZE=$(du -h "$FILEPATH" | cut -f1)
  echo "[Backup] ✅ Dump completado: ${FILENAME} (${FILE_SIZE})"
else
  notify_telegram "🔴 *BACKUP FALLIDO*\n\nError ejecutando pg_dump contra ${DB_HOST}:${DB_PORT}/${DB_NAME}"
  echo "[Backup] ❌ Error en pg_dump"
  exit 1
fi

unset PGPASSWORD

# ── 3. Limpieza de backups antiguos ─────────────────────
DELETED=$(find "$BACKUP_DIR" -name "genmailer_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
echo "[Backup] 🧹 Backups eliminados (>${RETENTION_DAYS} días): ${DELETED}"

# ── 4. Subida y Retención en Google Drive (opcional) ───
DRIVE_STATUS="⏭ No configurado"
DELETED_DRIVE_COUNT=0

# Sanitize variables (Windows CRLF to LF protection)
CLEAN_GDRIVE_ENABLED=$(echo "$GDRIVE_ENABLED" | tr -d '\r')
CLEAN_CLIENT_ID=$(echo "$GDRIVE_CLIENT_ID" | tr -d '\r')
CLEAN_CLIENT_SECRET=$(echo "$GDRIVE_CLIENT_SECRET" | tr -d '\r')
CLEAN_REFRESH_TOKEN=$(echo "$GDRIVE_REFRESH_TOKEN" | tr -d '\r')
CLEAN_FOLDER_ID=$(echo "$GDRIVE_FOLDER_ID" | tr -d '\r')
CLEAN_MAX_BACKUPS=$(echo "${GDRIVE_MAX_BACKUPS:-7}" | tr -d '\r')

if [ "$CLEAN_GDRIVE_ENABLED" = "true" ] && [ -n "$CLEAN_REFRESH_TOKEN" ]; then
  echo "[Backup] ☁️  Subiendo a Google Drive..."

  # Obtener access token desde refresh token
  ACCESS_TOKEN=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "client_id=${CLEAN_CLIENT_ID}&client_secret=${CLEAN_CLIENT_SECRET}&refresh_token=${CLEAN_REFRESH_TOKEN}&grant_type=refresh_token" \
    | grep -o '"access_token"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)

  if [ -z "$ACCESS_TOKEN" ]; then
    DRIVE_STATUS="🔴 Error obteniendo token de acceso"
    echo "[Backup] ❌ No se pudo obtener access token de Google"
  else
    # Subir archivo a Google Drive usando resumable upload
    # Paso 1: Iniciar upload
    UPLOAD_URL=$(curl -s -X POST \
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"${FILENAME}\",\"parents\":[\"${CLEAN_FOLDER_ID}\"]}" \
      -D - | grep -i "location:" | tr -d '\r' | sed 's/location: //i')

    if [ -n "$UPLOAD_URL" ]; then
      # Paso 2: Subir contenido
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X PUT "$UPLOAD_URL" \
        -H "Content-Type: application/gzip" \
        --data-binary "@${FILEPATH}")

      if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
        DRIVE_STATUS="✅ Subido exitosamente"
        echo "[Backup] ✅ Archivo subido a Google Drive"

        # Paso 3: Retención en Google Drive — conservar solo los últimos CLEAN_MAX_BACKUPS
        echo "[Backup] 🧹 Verificando retención en Google Drive (máximo ${CLEAN_MAX_BACKUPS} backups)..."
        
        LIST_RES=$(curl -s -G "https://www.googleapis.com/drive/v3/files" \
          -H "Authorization: Bearer ${ACCESS_TOKEN}" \
          --data-urlencode "q='${CLEAN_FOLDER_ID}' in parents and trashed=false and name contains 'genmailer_backup_'" \
          --data-urlencode "orderBy=createdTime desc" \
          --data-urlencode "pageSize=100" \
          --data-urlencode "fields=files(id,name,createdTime)")

        if command -v jq >/dev/null 2>&1; then
          FILES_TO_DELETE=$(echo "$LIST_RES" | jq -r ".files[${CLEAN_MAX_BACKUPS}:][]? | .id + \"\t\" + .name")
          
          if [ -n "$FILES_TO_DELETE" ]; then
            while IFS="$(printf '\t')" read -r OLD_ID OLD_NAME; do
              if [ -n "$OLD_ID" ]; then
                echo "[Backup] 🗑️  Eliminando backup antiguo en Drive: ${OLD_NAME} (${OLD_ID})..."
                DEL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
                  "https://www.googleapis.com/drive/v3/files/${OLD_ID}" \
                  -H "Authorization: Bearer ${ACCESS_TOKEN}")

                if [ "$DEL_HTTP" = "204" ] || [ "$DEL_HTTP" = "200" ]; then
                  DELETED_DRIVE_COUNT=$((DELETED_DRIVE_COUNT + 1))
                  echo "[Backup] ✅ Eliminado de Drive: ${OLD_NAME}"
                else
                  echo "[Backup] ⚠️  Fallo al eliminar de Drive ${OLD_NAME} (HTTP ${DEL_HTTP})"
                fi
              fi
            done <<EOF
$FILES_TO_DELETE
EOF
            echo "[Backup] 🧹 Total backups eliminados en Google Drive: ${DELETED_DRIVE_COUNT}"
          else
            echo "[Backup] ✨ Google Drive al día (<= ${CLEAN_MAX_BACKUPS} backups)"
          fi
        else
          echo "[Backup] ⚠️  jq no está disponible; omitiendo limpieza automática en Drive."
        fi

      else
        DRIVE_STATUS="🔴 Error HTTP ${HTTP_CODE}"
        echo "[Backup] ❌ Error subiendo a Drive (HTTP ${HTTP_CODE})"
      fi
    else
      DRIVE_STATUS="🔴 Error iniciando upload"
      echo "[Backup] ❌ Error obteniendo URL de upload"
    fi
  fi
fi

# ── 5. Notificación final ──────────────────────────────
REMAINING=$(find "$BACKUP_DIR" -name "genmailer_backup_*.sql.gz" | wc -l)

DRIVE_SUMMARY="${DRIVE_STATUS}"
if [ "$DELETED_DRIVE_COUNT" -gt 0 ]; then
  DRIVE_SUMMARY="${DRIVE_STATUS} (🧹 ${DELETED_DRIVE_COUNT} viejos purgados)"
fi

notify_telegram "🗄 *BACKUP COMPLETADO — GenMailer*\n\n📁 Archivo: \`${FILENAME}\`\n📦 Tamaño: ${FILE_SIZE}\n🧹 Eliminados en disco: ${DELETED}\n📚 Total en disco: ${REMAINING}\n☁️ Google Drive: ${DRIVE_SUMMARY}"

echo "[Backup] 📬 Notificación enviada"
echo "[Backup] ✅ Proceso de backup finalizado"
