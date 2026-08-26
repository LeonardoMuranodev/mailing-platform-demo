# Fase 1: El Motor (Core Business & Entregabilidad)

Este plan detalla la implementación del núcleo de envíos masivos del sistema 3F Mailer, responsable de despachar los correos respetando las cuotas y rotando las cuentas SMTP.

## User Review Required

> [!IMPORTANT]
> **Ejecución del Worker:** El worker correrá como un proceso en segundo plano (vía `setInterval`) dentro del mismo contenedor del backend de Node.js. ¿Estás de acuerdo con este enfoque o preferís un contenedor/proceso separado exclusivamente para el envío (microservicio)? Para la escala actual, correrlo dentro del mismo backend es más sencillo y eficiente.

## Open Questions

> [!WARNING]
> 1. **Link de desuscripción:** Como menciona el TASK.md, *¿Consultaste con las encargadas si el link de desuscripción y manejo de rebotes es estrictamente necesario legal/operativamente para esta versión?* Si no es crítico, propongo omitirlo o simplemente agregar un mailto: genérico al final del correo.
> 2. **Inicio de envíos:** Actualmente se puede poblar la cola (`POST /api/queue/poblar/:id`). ¿El envío debe arrancar automáticamente apenas se puebla la cola, o preferís que haya que apretar un botón "Iniciar Envío" que pase la campaña de estado `aprobada` a `en_proceso`?

## Proposed Changes

### 1. Motor de Envío (Worker SMTP)
El core de la lógica de despachos.

#### [NEW] `src/services/emailWorker.ts`
- Implementará la función `procesarCola()`.
- **Lógica:**
  1. Busca un lote (ej. 50 correos) en `cola_envios` con estado `pendiente` de campañas que estén en estado `en_proceso` (o `aprobada`).
  2. Por cada correo, solicita una cuenta SMTP con cuota disponible vía `obtenerSiguienteSmtpDisponible`. Si no hay, pausa el worker.
  3. Desencripta la contraseña de la cuenta SMTP.
  4. Genera el HTML usando `generarHtmlDesdeCampana` y despacha usando `nodemailer`.
  5. Si el envío es exitoso, actualiza el estado en `cola_envios` a `enviado` e incrementa la cuota de la cuenta llamando a `incrementarCuotaSmtp` (Round-Robin & Circuit Breaker).
  6. Si falla, incrementa los `intentos`. Si supera el máximo (ej. 3), pasa a `fallido`.
- Verificará si una campaña se completó (0 pendientes) para cambiar su estado a `completada` y lanzar notificación.

#### [MODIFY] `src/index.ts`
- Importar y ejecutar `setInterval(procesarCola, 15000)` para que el worker revise la cola cada 15 segundos (configurable).

### 2. Aviso de Campaña Terminada

#### [MODIFY] `src/services/notificationService.ts`
- Agregar la función `notificarCampanaTerminada(campanaId, nombre, stats)` que envía un resumen por Telegram (usando `telegramNotifier.ts`) y/o Email a los admins cuando finaliza el envío masivo.

### 3. Verificación DNS (SPF / DMARC)

#### [NEW] `src/controllers/dnsController.ts` & `src/routes/dnsRoutes.ts`
- Crear un endpoint `GET /api/dns/verificar/:dominio` (ej: `/api/dns/verificar/gmail.com`).
- Usará el módulo nativo `node:dns/promises` para consultar registros `TXT` y `MX`.
- Retornará si el dominio tiene configurado SPF (busca `v=spf1`) y DMARC (busca `_dmarc.dominio`).

#### [MODIFY] `src/routes/index.ts`
- Registrar las nuevas rutas de `/api/dns`.

### 4. Controlador de Campañas (Opcional según respuesta)

#### [MODIFY] `src/controllers/campanaController.ts`
- Si se decide requerir un botón manual de inicio, agregar un endpoint `POST /api/campanas/:id/iniciar` que cambie el estado de la campaña de `aprobada` a `en_proceso`, lo que habilitará al worker a empezar a enviar.

## Verification Plan

### Automated Tests
- Ejecutaré los tests creados en la Fase 5 (`npm test`) para asegurar que nada se rompa.
- Opcionalmente agregaré un pequeño test unitario para el worker usando los mocks existentes.

### Manual Verification
- Solicitaré al usuario que inicie la aplicación, cree una campaña, pueble la cola y verifique los logs de la terminal para ver cómo el worker toma los correos, usa cuentas SMTP simuladas (o de Mailpit), y actualiza la base de datos de los estados `pendiente` a `enviado`.
- Probar el endpoint `/api/dns/verificar/gmail.com` para comprobar la detección de SPF.
