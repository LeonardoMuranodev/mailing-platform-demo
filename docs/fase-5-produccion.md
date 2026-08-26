# Fase 5: DevOps y Despliegue — Walkthrough

## Resumen

Se implementaron los 3 ejes de la Fase 5 del roadmap: **Testing**, **Optimización Docker** y **Despliegue Dual** (desarrollo + producción). Ambos entornos usan **Supabase** como BD.

---

## Cambios Realizados

### 1. Testing — 15 tests, 3 suites, 0 fallos ✅

| Suite | Tests | Flujo cubierto |
|-------|-------|---------------|
| [`auth.test.ts`](file:///c:/Users/Tecno3F/mails-app/src/__tests__/auth.test.ts) | 6 | Login exitoso/fallido, verificación JWT válido/inválido/expirado |
| [`queue.test.ts`](file:///c:/Users/Tecno3F/mails-app/src/__tests__/queue.test.ts) | 4 | Poblar cola OK, sin contactos, campaña inexistente, estado inválido |
| [`smtp-rotation.test.ts`](file:///c:/Users/Tecno3F/mails-app/src/__tests__/smtp-rotation.test.ts) | 5 | Round-Robin, circuit breaker (agotado), sin cuentas, incremento cuota |

**Infraestructura de test:**
- [`vitest.config.ts`](file:///c:/Users/Tecno3F/mails-app/vitest.config.ts) — Config de Vitest
- [`mockDb.ts`](file:///c:/Users/Tecno3F/mails-app/src/__tests__/helpers/mockDb.ts) — Mocking de pg Pool y Redis sin conexión real
- Scripts: `npm test` (run) y `npm run test:watch` (modo watch)

---

### 2. Optimización Docker

- [`Dockerfile.backend`](file:///c:/Users/Tecno3F/mails-app/Dockerfile.backend) — `NODE_ENV=production`, labels OCI, healthcheck → `/api/health`
- [`Dockerfile.frontend`](file:///c:/Users/Tecno3F/mails-app/client/Dockerfile.frontend) — Stage production usa `nginx.conf` externa, labels OCI
- [`nginx.conf`](file:///c:/Users/Tecno3F/mails-app/client/nginx.conf) — Config dedicada: SPA fallback, reverse proxy `/api` → backend, gzip, cache, security headers

---

### 3. Health Endpoint

- [`healthRoutes.ts`](file:///c:/Users/Tecno3F/mails-app/src/routes/healthRoutes.ts) — `GET /api/health` sin auth, verifica DB + Redis
- [`routes/index.ts`](file:///c:/Users/Tecno3F/mails-app/src/routes/index.ts) — Registrado **antes** de `requireAuth`

---

### 4. Docker Compose Dual

| Archivo | Entorno | Frontend | SMTP | Redis expuesto |
|---------|---------|----------|------|----------------|
| [`docker-compose.yml`](file:///c:/Users/Tecno3F/mails-app/docker-compose.yml) | Desarrollo | Vite HMR (:5173) | Mailpit | Sí (:6379) |
| [`docker-compose.prod.yml`](file:///c:/Users/Tecno3F/mails-app/docker-compose.prod.yml) | Producción | Nginx (:80) | Gmail real | No (solo interno) |

---

### 5. Seguridad — JWT_SECRET

- [`env.ts`](file:///c:/Users/Tecno3F/mails-app/src/config/env.ts) — JWT ahora lee: `JWT_SECRET` → `ENCRYPTION_KEY` → fallback
- [`.env`](file:///c:/Users/Tecno3F/mails-app/.env) — Agregada variable `JWT_SECRET`
- [`.env.production.example`](file:///c:/Users/Tecno3F/mails-app/.env.production.example) — Template para producción

---

### 6. Script de Despliegue

- [`deploy.sh`](file:///c:/Users/Tecno3F/mails-app/scripts/deploy.sh) — `git pull` → `docker build` → `docker up` → healthcheck wait → status

---

## Verificación

```
✅ npm test          → 15 tests passing (488ms)
✅ tsc --noEmit      → 0 errores de compilación
✅ TASK.md           → Fase 5 marcada como completada
```

## Para desplegar en producción

```bash
# 1. En el servidor, copiar el template y completar credenciales:
cp .env.production.example .env
nano .env

# 2. Ejecutar deploy:
bash scripts/deploy.sh

# 3. Verificar health:
curl http://localhost/api/health
```
