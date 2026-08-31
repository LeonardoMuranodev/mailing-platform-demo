# Plan de Implementación: Infraestructura (Fase 8)

Este plan aborda las mejoras de resiliencia y observabilidad del sistema detalladas en la Fase 8, garantizando que el servidor pueda correr de forma autónoma durante semanas de forma segura y transparente.

## Proposed Changes

### 1. Detección Automática de "Cuenta Quemada"
Actualmente el sistema detecta si una cuenta alcanza el límite de envío (ej. "Quota Exceeded") de forma síncrona, pero **no** suspende la cuenta si Google comienza a rebotar silenciosamente los correos por considerar que se está enviando SPAM. Implementaremos un "Circuit Breaker" basado en la tasa de rebotes.

#### [NEW] Base de Datos & Lógica
- **Umbral de Rebotes:** Configuraremos una variable de entorno `MAX_BOUNCES_PER_HOUR` (ej. 20 rebotes por hora).
- **[MODIFY] `src/services/bounceService.ts`:**
  - Al finalizar de procesar todos los rebotes vía IMAP, ejecutaremos una consulta SQL que cuente los rebotes (`estado = 'fallido'`) por `cuenta_smtp_id` en las últimas X horas.
  - Si una cuenta supera el umbral, se ejecutará `UPDATE cuentas_smtp SET estado = 'bloqueado' WHERE id = $1`.
- **[MODIFY] `src/services/telegramNotifier.ts`:**
  - Añadir la función `notificarCuentaBloqueadaPorRebotes(email, cantidadRebotes)` para enviar una alerta roja a Telegram, avisándote que el sistema pausó esa cuenta preventivamente para proteger la reputación del dominio.

### 2. Logs Estructurados y Rotativos
Actualmente el sistema emite eventos mediante `console.log` y `console.error`, lo cual se pierde al reiniciar el contenedor o es muy difícil de auditar después de varios días.

#### [NEW] Librerías y Configuración
- **Instalación:** `npm install winston winston-daily-rotate-file`
- **[NEW] `src/utils/logger.ts`:**
  - Crearemos un módulo central de logging.
  - **Transporte Consola:** Mostrará logs con colores (ej. `[INFO]`, `[ERROR]`) de forma amigable para desarrollo.
  - **Transporte Archivo:** Guardará automáticamente un archivo por día en la carpeta `/logs` (ej. `logs/app-2026-08-31.log`).
  - Se configurará para retener los logs de los últimos 14 días y comprimir los antiguos (`.gz`) para no saturar el disco.

#### [MODIFY] Refactorización Global
Reemplazaremos todas las llamadas nativas de consola por el nuevo logger en los archivos clave del backend:
- `src/index.ts`
- `src/services/emailWorker.ts`
- `src/services/bounceService.ts`
- `src/config/db.ts`
- Controladores y Rutas (`src/routes/index.ts`, etc.)

---

## Open Questions

> [!IMPORTANT]
> **Políticas de Retención y Umbrales:**
> 1. ¿Estás de acuerdo con establecer un umbral inicial de **15 rebotes por hora** para bloquear temporalmente una cuenta? (Si lo supera, asume que está "quemada").
> 2. ¿La carpeta `/logs` deberá persistirse en el `docker-compose.yml` a través de un nuevo volumen (ej. `./logs:/usr/src/app/logs`) para que puedas acceder a ellos fácilmente desde tu computadora?

---

## Verification Plan
1. **Logs:** Ejecutar el servidor y verificar que se genere la carpeta `logs/` en el host con el archivo del día, comprobando el formato (timestamp y nivel).
2. **Cuenta Quemada:** Simular múltiples rebotes en la base de datos (asignando varios `cola_envios` como fallidos para una misma cuenta en la última hora), luego forzar la ejecución de `bounceService` y verificar por consola/telegram que la cuenta pasó a estado `bloqueado` de forma automática.
