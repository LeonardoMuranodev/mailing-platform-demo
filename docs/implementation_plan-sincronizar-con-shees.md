# Sincronización de Contactos con Google Sheets

El objetivo es permitir a las encargadas sincronizar la base de datos de contactos directamente desde una planilla de Google Sheets ("mails normalizado") mediante un botón en la interfaz de "Contactos".

## Open Questions

Para poder avanzar con la integración nativa en Node.js, necesito que me proporciones o aclares lo siguiente:

1. **Credenciales de la Service Account**: Necesitaremos las credenciales (el archivo `.json` o, en su defecto, el `client_email` y el `private_key`) de la cuenta `n8n-muni-credencial@n8n-muni-server.iam.gserviceaccount.com` para agregarlas al archivo `.env` del servidor.
2. **ID de la Planilla (Spreadsheet ID)**: Necesito el ID de la planilla de Google Sheets (es la cadena larga de letras y números que aparece en la URL del documento: `https://docs.google.com/spreadsheets/d/<ESTE_ES_EL_ID>/edit`).
3. **Estructura de Columnas**: ¿Cuáles son los nombres exactos de las columnas en la hoja "mails normalizado"? Necesito saber cómo están escritos los encabezados (ej. `Email`, `Empresa`, `Rubro`, etc.) para poder mapearlos correctamente a nuestra base de datos.
4. **Comportamiento de Sincronización**: Cuando se sincronice, ¿querés que sea aditiva (solo agrega/actualiza contactos existentes) o destructiva (elimina contactos que ya no estén en el Sheets)? Lo estándar y más seguro suele ser hacer un *upsert* (insertar o actualizar si el email ya existe) sin borrar los demás.

## Proposed Changes

### 1. Variables de Entorno (`.env` & `src/config/env.ts`)
#### [MODIFY] [env.ts](file:///c:/Users/Tecno3F/mails-app/src/config/env.ts)
Se agregarán las configuraciones para la API de Google:
- `GOOGLE_SHEET_ID`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_PRIVATE_KEY`

### 2. Servicio de Sincronización
#### [NEW] [src/services/googleSheetsService.ts](file:///c:/Users/Tecno3F/mails-app/src/services/googleSheetsService.ts)
- Función para autenticarse usando la librería `googleapis` o `google-auth-library`.
- Función para leer el rango de datos de la hoja "mails normalizado".
- Lógica de normalización y volcado (upsert) masivo en la tabla `contactos`, similar a lo que actualmente hace la importación por CSV.

### 3. API Route y Controller
#### [MODIFY] [src/controllers/contactoController.ts](file:///c:/Users/Tecno3F/mails-app/src/controllers/contactoController.ts)
- Nuevo método `sincronizarConSheets` que invoque el servicio.
#### [MODIFY] [src/routes/contactoRoutes.ts](file:///c:/Users/Tecno3F/mails-app/src/routes/contactoRoutes.ts)
- Nuevo endpoint `POST /api/contactos/sync-sheets`.

### 4. Interfaz de Usuario (Frontend)
#### [MODIFY] [client/src/pages/Contactos.tsx](file:///c:/Users/Tecno3F/mails-app/client/src/pages/Contactos.tsx)
- Se añadirá el botón "Sincronizar con Sheets" junto a los botones de Importar, Crear y Exportar.
- Al hacer clic, mostrará un estado de carga (spinner) y, al finalizar, una alerta con la cantidad de registros insertados o actualizados, recargando la grilla.
#### [MODIFY] [client/src/services/api.ts](file:///c:/Users/Tecno3F/mails-app/client/src/services/api.ts)
- Nuevo método de llamada HTTP `syncContactosSheets()`.

## Verification Plan

### Manual Verification
- Cargar las variables de entorno con credenciales válidas en el entorno de desarrollo.
- Presionar el botón "Sincronizar con Sheets" en la UI.
- Validar que los contactos del Sheet aparezcan actualizados en la base de datos sin duplicar (respetando la restricción unique de email).
