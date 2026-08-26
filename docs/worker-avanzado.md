# Fase 1: Worker Avanzado (Dosificación & Circuit Breaker) — Walkthrough

Se ha completado el refactor de `emailWorker.ts` para que se comporte exactamente igual al flujo original de n8n, sumando robustez y previniendo el SPAM masivo.

---

## 1. Horario Comercial Estricto ⏱️

Se reemplazó el `setInterval` (que ejecutaba las 24hs) por `node-cron`. 
- **Nuevo Comportamiento:** El worker solo se despierta de Lunes a Viernes, en el minuto 0 de cada hora, entre las **09:00 AM y las 17:00 PM**, respetando la zona horaria de Buenos Aires (`America/Argentina/Buenos_Aires`).
- Archivo modificado: `src/index.ts`.

---

## 2. Cálculo Dinámico de Lotes (Pacing) 📊

El sistema ya no extrae "todos los que pueda" de la cola.
- **Nuevo Comportamiento:** Al despertar, el worker toma la campaña más prioritaria que esté `en_proceso`. Busca su `fecha_limite_envio`.
- Calcula los **días efectivos** que quedan hasta esa fecha.
- Divide los correos pendientes entre los `días efectivos` y las `9` ejecuciones diarias que tiene programadas (de 9 a 17hs).
- Obtiene un **objetivo por hora**, restringido entre un mínimo global y un máximo global (5 a 25 mails por cuenta activa).
- Solo extrae de la base de datos la cantidad exacta de correos calculada para esa hora.

---

## 3. Retardo Anti-Spam (Sleep) 💤

Para emular el escudo protector anti-spam de n8n, se incluyó una pausa obligatoria.
- **Nuevo Comportamiento:** Entre cada correo enviado exitosamente dentro del lote, el sistema hace una pausa exacta de **5 segundos** antes de procesar el siguiente destinatario.

---

## 4. Reintentos Circulares (Anillo SMTP) 🔄

Se mejoró la resiliencia ante fallos individuales.
- **Nuevo Comportamiento:** Si la *Cuenta 1* falla al enviar un correo, el worker captura el error y, **dentro de la misma ejecución**, solicita la *siguiente cuenta disponible* (Ej. *Cuenta 2*) e intenta nuevamente.
- Esto se repite hasta que el correo sale exitosamente o hasta agotar la cantidad de cuentas configuradas en el sistema.

---

## 5. Circuit Breaker Global 🚨

Se añadió un bloqueo de emergencia diario para evitar bardeos con los límites de Google.
- **Nuevo Comportamiento:** Si al ocurrir un fallo, el mensaje de error de SMTP contiene frases como `"quota exceeded"` o `"daily sending limit"`, el sistema marca a esa cuenta como **agotada** para todo el día.
- Si por la rotación circular **todas las cuentas activas fallan** (no quedan cuentas con cuota disponible), el sistema activa el "Circuit Breaker Global":
  1. Detiene por completo el procesamiento del lote actual.
  2. Cancela virtualmente todas las ejecuciones restantes del día guardando una bandera de `cuotaAgotadaHoy`.
  3. Despacha una alerta de emergencia al administrador por Email y Telegram.

---

## 6. Alerta de Cuota Agotada (Diseño Institucional) 🎨

- Se implementó la plantilla HTML institucional provista para notificar emergencias, respetando los colores y la estructura original de 3F.
- **Nuevo Comportamiento:** Ante el agotamiento de límite global, el sistema enviará automáticamente este reporte a la casilla configurada (`SMTP_NOTIFIER_HOST` en variables de entorno), incluyendo la advertencia en Telegram.
- Archivo modificado: `src/services/notificationService.ts`.

> [!TIP]
> **Próximos pasos recomendados:**
> El motor quedó altamente optimizado. El siguiente paso en tu roadmap es implementar **Redis (Fase 4)** para acelerar consultas críticas a la base de datos y aliviar la carga, o hacer el push a tu repositorio corporativo para testear el Cron en vivo.
