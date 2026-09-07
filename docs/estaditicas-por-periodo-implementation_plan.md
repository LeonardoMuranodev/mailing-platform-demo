# Implementación de Filtros de Fecha en Estadísticas

Se agregarán filtros de fecha rápidos y personalizados en el panel de estadísticas para replicar y mejorar la funcionalidad que tenían en Looker Studio.

## Proposed Changes

### Backend

#### [MODIFY] [src/services/statsService.ts](file:///c:/Users/Tecno3F/mails-app/src/services/statsService.ts)
- Se modificará `obtenerEstadisticasGlobales(startDate?: string, endDate?: string)` para aceptar parámetros de fecha.
- Se actualizarán las 4 consultas SQL (`campanasQuery`, `colaQuery`, `rubrosQuery`, `historicoQuery`) para incluir una cláusula `WHERE` dinámica. Si se envían fechas, filtrará los registros usando la columna `creado_en` (o `fecha_envio` para el histórico temporal).

#### [MODIFY] [src/controllers/statsController.ts](file:///c:/Users/Tecno3F/mails-app/src/controllers/statsController.ts)
- Se ajustará `getGlobalStats` para leer `startDate` y `endDate` desde `req.query` y pasárselos al servicio.

### Frontend

#### [MODIFY] [client/src/services/api.ts](file:///c:/Users/Tecno3F/mails-app/client/src/services/api.ts)
- Se actualizará la función `obtenerEstadisticasGlobales` para aceptar un objeto de parámetros `{ startDate?: string, endDate?: string }` y concatenarlos a la URL como query params.

#### [MODIFY] [client/src/components/EstadisticasGenerales.tsx](file:///c:/Users/Tecno3F/mails-app/client/src/components/EstadisticasGenerales.tsx)
- Se agregarán estados para `startDate` y `endDate`.
- En la parte superior, al lado del botón de actualizar, se diseñará un panel de filtros con:
  - Botón rápido "Mes Actual"
  - Botón rápido "Año Actual"
  - Dos inputs de tipo fecha (Date) para seleccionar un periodo personalizado.
  - Botón de "Limpiar" para ver todo el histórico.
- Al cambiar estas fechas, el dashboard se actualizará automáticamente y recalculará los KPIs y las barras.

## Open Questions

> [!NOTE]
> Para el gráfico "Histórico de Envíos", actualmente muestra los envíos de los últimos 30 días. Con el nuevo filtro, si seleccionás "Año Actual", el gráfico intentará dibujar una línea con los 365 días (o agrupará por mes si fuesen muchos). ¿Estás de acuerdo con que el gráfico respete el filtro de fechas seleccionado, dibujando por día, o prefieres que el gráfico se mantenga mostrando sólo los últimos 30 días independientemente del filtro superior? (Recomiendo que respete el filtro, para tener una vista coherente).

## Verification Plan
1. Seleccionar "Mes Actual" y confirmar que las llamadas al backend llevan los parámetros (ej. `2026-09-01` a `2026-09-30`).
2. Validar que las estadísticas de campañas coinciden con las campañas creadas en ese periodo.
3. Probar un rango personalizado de fechas.
4. Exportar el CSV y confirmar que no se rompió la exportación.
