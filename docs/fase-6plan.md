# Plan de Implementación: Analíticas y Tracking (Fase 6)

Este plan detalla cómo añadiremos tracking de aperturas (Open Tracking), tracking de clics y variabilidad invisible en los correos para mejorar la entregabilidad.

## Proposed Changes

### 1. Base de Datos: Extensión de `cola_envios`
Para registrar las analíticas sin complicar la estructura con tablas nuevas, añadiremos columnas a la tabla `cola_envios` (que ya vincula un contacto con una campaña).

#### [MODIFY] Base de Datos (Script SQL)
- `ALTER TABLE cola_envios ADD COLUMN fecha_apertura TIMESTAMP WITH TIME ZONE;`
- `ALTER TABLE cola_envios ADD COLUMN fecha_click TIMESTAMP WITH TIME ZONE;`

### 2. Backend: Endpoints de Tracking

Crearemos una nueva ruta pública para procesar las aperturas y los clics.

#### [NEW] `src/routes/trackRoutes.ts` y `src/controllers/trackController.ts`
- **GET `/api/track/open/:colaId`**: 
  - Actualizará `fecha_apertura` a `CURRENT_TIMESTAMP` en `cola_envios` (si está en null, para registrar la primera apertura).
  - Retornará una imagen transparente de 1x1 píxel en Base64.
- **GET `/api/track/click/:colaId`**:
  - Leerá la URL de destino desde un query parameter (ej. `?url=https://...`).
  - Actualizará `fecha_click` a `CURRENT_TIMESTAMP`.
  - Hará un HTTP 302 Redirect a la URL de destino.

#### [MODIFY] `src/index.ts`
- Registrar `app.use('/api/track', trackRoutes)`. **Asegurando que no tenga el middleware de autenticación** para que los clientes de correo puedan acceder.

### 3. Backend: Inyección en el Worker de Envíos

Modificaremos el Worker que procesa la cola y envía los emails a través de Nodemailer para inyectar estos elementos en el HTML antes del envío.

#### [MODIFY] `src/workers/queueWorker.ts`
Antes de llamar a `transport.sendMail()`, procesaremos dinámicamente el `cuerpo_html` de cada contacto:
1. **Pixel Invisible (Open Tracking):** Añadir al final del `<body>` la etiqueta: `<img src="https://TU_DOMINIO/api/track/open/{cola_envios.id}" width="1" height="1" alt="" />`.
2. **Click Tracking:** Reemplazar todas las URLs en las etiquetas `<a href="...">` por `<a href="https://TU_DOMINIO/api/track/click/{cola_envios.id}?url=ENCODED_ORIGINAL_URL">`.
3. **Inyección Invisible (Bypass Spam):** Añadir en el footer: `<span style="display:none; color:transparent; opacity:0; font-size:0px;">Ref: {cola_envios.id}-{timestamp}</span>`. Esto hace que el Hash del código fuente del email sea 100% distinto para cada destinatario, diluyendo los filtros automatizados de Spam de Google.

### 4. Frontend: Dashboard de Campañas

Añadiremos los KPIs de tracking en la tabla de campañas.

#### [MODIFY] `client/src/components/GestorCampanas.tsx`
- Consumir un endpoint de estadísticas o extender el endpoint de campañas para traer la cantidad de correos enviados, abiertos y clickeados.
- Mostrar una barra de progreso o porcentajes (% Open Rate, % Click Rate) por cada campaña.

## Open Questions

> [!IMPORTANT]
> **Dominio Público Base:** Para que los links y el pixel invisible funcionen, los emails deben tener la URL pública de tu backend. ¿Utilizamos una variable de entorno `FRONTEND_URL` o `API_URL` (ej. `https://mailing.tresdefebrero.gov.ar`) para inyectar el dominio en el HTML?

## Verification Plan
1. Ejecutar las migraciones SQL localmente.
2. Crear una campaña de prueba y poblar la cola.
3. Revisar en la consola o en un Mailcatcher (Mailpit local) que el HTML final inyectado contenga el Pixel, los links redirigidos y el Hash invisible.
4. Simular un clic y apertura manualmente visitando las URLs generadas, y verificar en la base de datos que se actualicen las fechas.
