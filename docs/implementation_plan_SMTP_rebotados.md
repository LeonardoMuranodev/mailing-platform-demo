# Plan de Implementación: Detección y Procesamiento de Rebotes (IMAP)

Este plan detalla cómo incorporaremos la lógica de detección de rebotes (bounces) desde una casilla de correo utilizando IMAP, replicando exactamente el comportamiento y clasificación que tenías en n8n, pero 100% nativo en el backend.

## 🎯 User Review Required

> [!WARNING]
> **Dependencias Adicionales:** Se instalarán los paquetes `imapflow` (para conexión IMAP moderna) y `mailparser` (para interpretar el texto de los correos rebotados). ¿Estás de acuerdo con estas adiciones al `package.json`?

> [!IMPORTANT]
> **Variables de Entorno:** Será necesario que agreguemos las credenciales IMAP al `.env`. Generalmente es la misma cuenta configurada para `SMTP_NOTIFIER_USER`, pero la llamaremos `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER` y `IMAP_PASS`.

> [!NOTE]
> **Frecuencia del Cron:** Propongo que este proceso (revisión de rebotes) corra **1 vez por día** (ej. a las 18:00 hs, luego de que termine el envío masivo) o cada hora. Lo configuraremos para que corra a las **18:00 hs de Lunes a Viernes** por defecto. Si preferís otra frecuencia, indícamelo.

## ❓ Open Questions

1. ¿La casilla de IMAP que vamos a leer es exclusivamente para rebotes o recibe otros mails? El sistema buscará correos **NO LEÍDOS**, extraerá el rebote y los marcará como **LEÍDOS** para no procesarlos dos veces. ¿Es correcto?
2. ¿A qué casilla querés que llegue el reporte consolidado HTML que proveíste? Usaremos la variable `SMTP_NOTIFIER_HOST` que ya usamos para los alertas, salvo que indiques otra cosa.

---

## 🛠️ Proposed Changes

### Componente: Dependencias y Configuración

#### [MODIFY] package.json
- Agregar `imapflow` y `mailparser` a las dependencias de producción.
- Agregar `@types/mailparser` a `devDependencies`.

#### [MODIFY] src/config/env.ts
- Mapear las nuevas variables de entorno IMAP.

### Componente: Lógica Core

#### [NEW] src/services/bounceService.ts
- Crear el script que conecta vía IMAP.
- Leer correos no leídos y extraer el texto plano (`mailparser`).
- Usar las **expresiones regulares y listas de exclusión** proporcionadas en tu código n8n para identificar el correo afectado y el motivo (`rebotado_bandeja_llena`, `rebotado_inexistente`, `rebotado_spam`).
- Actualizar la base de datos:
  - Cambiar el estado del contacto afectado en la tabla `contactos`.
  - Registrar el motivo del rebote en la tabla `cola_envios` (`respuesta_smtp`).
- Consolidar los resultados únicos.
- Generar y enviar el HTML provisto con el listado de correos inválidos (notificando a `SMTP_NOTIFIER_USER`).

#### [MODIFY] src/index.ts
- Configurar un nuevo proceso `cron` (ej. `0 18 * * 1-5`) para disparar `procesarRebotes()` automáticamente.

---

## 🧪 Verification Plan

### Automated Tests
- Ejecutaré `npm run build` y `npm test` para asegurar que las nuevas dependencias y el código no rompan nada de la Fase 1.

### Manual Verification
- Te indicaré qué variables de entorno configurar.
- Podrás testear el worker inyectando un correo de rebote de prueba (Forward) a tu casilla y verificando si el sistema:
  1. Lo lee y lo marca como leído.
  2. Actualiza tu base de datos (contacto a estado rebotado).
  3. Te envía el Email Consolidado con el HTML institucional a la bandeja de destino.
