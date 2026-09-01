# Importador Visual de Contactos

Esta funcionalidad permite a los usuarios subir un archivo CSV, previsualizar sus datos y mapear visualmente las columnas del archivo con los campos de la base de datos antes de importarlos.

## Open Questions

- ¿Te gustaría que el importador permita subir también archivos Excel (`.xlsx`)? Inicialmente el plan usa `papaparse` que solo lee `.csv` (que es el estándar para exportar de Google Sheets o Excel). Si necesitás `.xlsx` directo, deberíamos usar una librería más pesada como `xlsx`. Por ahora el plan solo incluye `.csv`.
- Cuando se importen contactos masivamente, ¿queremos asignarles un "Rubro" por defecto (ej: "Sin Rubro" o que el usuario seleccione uno global para todo el archivo) o preferís que puedan mapear una columna del CSV al campo "Rubro"?

## Proposed Changes

### Backend (`mails-app-backend`)

Añadiremos un nuevo endpoint que reciba los datos ya procesados y mapeados (en formato JSON) desde el frontend. Esto es más robusto que enviar el CSV crudo.

#### [MODIFY] `src/controllers/contactoController.ts`
- Agregar la función `importarMasivoJson` que reciba `req.body.contactos`.
- Iterar sobre el array y enviarlo al service correspondiente.

#### [MODIFY] `src/services/contactoService.ts`
- Agregar la función `importarContactosJson(contactos: Array<{email: string, empresa_nombre?: string, cuit?: string, rubro_id?: string}>)`.
- Ejecutar un `INSERT ... ON CONFLICT (email) DO UPDATE` masivo para optimizar el rendimiento.

#### [MODIFY] `src/routes/contactoRoutes.ts`
- Agregar la ruta `POST /api/contactos/import-json` protegida por el middleware de autenticación.

---

### Frontend (`mails-app-frontend`)

El frontend se encargará de leer el archivo, parsearlo localmente, mostrar una interfaz de mapeo y finalmente enviar el JSON estructurado.

#### [MODIFY] `client/package.json`
- Instalar `papaparse` y `@types/papaparse` para parsear CSVs en el navegador.

#### [NEW] `client/src/components/ImportadorVisual.tsx`
- Crear un nuevo componente modal que:
  1. Tenga un área de *drag & drop* para subir el archivo `.csv`.
  2. Parsee el archivo con `papaparse`.
  3. Muestre una tabla con las primeras 3-5 filas del archivo.
  4. Encima de cada columna del CSV, muestre un selector (`<select>`) para que el usuario asigne a qué campo corresponde (Email, Nombre Empresa, CUIT, Ignorar).
  5. Tenga un botón "Importar X contactos" que envíe los datos mapeados al nuevo endpoint del backend.

#### [MODIFY] `client/src/components/DirectorioContactos.tsx`
- Integrar el componente `<ImportadorVisual>` reemplazando el flujo de subida de CSV antiguo.
- Añadir el estado para abrir/cerrar este nuevo modal interactivo.

#### [MODIFY] `client/src/services/api.ts`
- Agregar la función `importarContactosJson(contactos: any[])` apuntando al nuevo endpoint del backend.

## Verification Plan

### Manual Verification
1. Exportar un archivo de prueba desde Google Sheets en formato `.csv` con cabeceras aleatorias (ej: "Correo Principal", "Organización", "Id Fiscal").
2. Subir el archivo en la plataforma.
3. Verificar que la tabla de previsualización muestra correctamente los datos del CSV.
4. Mapear "Correo Principal" -> `Email`, "Organización" -> `Empresa`, "Id Fiscal" -> `CUIT`.
5. Importar y comprobar que el sistema procesa los contactos, que se ven reflejados en el listado y que los duplicados (mismo email) se actualizan en lugar de fallar.
