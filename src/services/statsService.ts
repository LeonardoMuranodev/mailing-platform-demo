import { dbPool } from '../config/db.js';

export interface CampanasStat {
  estado: string;
  count: number;
}

export interface ColaStat {
  estado: string;
  count: number;
}

export interface RubroStat {
  rubro: string;
  cantidad_envios: number;
}

export interface HistoricoStat {
  fecha: string;
  envios: number;
}

export interface RankingCampana {
  asunto: string;
  procesados: number;
  exitosos: number;
  fallidos: number;
  aperturas: number;
}

export interface PadronStat {
  estado: string;
  count: number;
}

export interface GlobalStatsResult {
  campanas: CampanasStat[];
  cola: ColaStat[];
  rubros: RubroStat[];
  historico: HistoricoStat[];
  ranking: RankingCampana[];
  padron: PadronStat[];
  aperturasTotales: number;
  clicsTotales: number;
}

export async function obtenerEstadisticasGlobales(startDate?: string, endDate?: string): Promise<GlobalStatsResult> {
  const params: any[] = [];
  let whereClause = '';
  
  if (startDate && endDate) {
    params.push(startDate, endDate);
    whereClause = 'WHERE DATE(COALESCE(c.fecha_limite_envio, c.creado_en)) >= $1 AND DATE(COALESCE(c.fecha_limite_envio, c.creado_en)) <= $2';
  } else if (startDate) {
    params.push(startDate);
    whereClause = 'WHERE DATE(COALESCE(c.fecha_limite_envio, c.creado_en)) >= $1';
  } else if (endDate) {
    params.push(endDate);
    whereClause = 'WHERE DATE(COALESCE(c.fecha_limite_envio, c.creado_en)) <= $1';
  }

  // 1. Total de campañas y desglose por estado
  const campanasQuery = await dbPool.query(`
    SELECT c.estado, COUNT(*) as count 
    FROM campanas c
    ${whereClause}
    GROUP BY c.estado
  `, params);
  
  // 2. Total global de correos en cola_envios por estado
  const colaQuery = await dbPool.query(`
    SELECT ce.estado, COUNT(*) as count 
    FROM cola_envios ce
    JOIN campanas c ON ce.campana_id = c.id
    ${whereClause}
    GROUP BY ce.estado
  `, params);

  // 3. Distribución por rubros (top rubros)
  const rubrosQuery = await dbPool.query(`
    SELECT COALESCE(r.nombre, 'Sin rubro') as rubro, COUNT(ce.id) as cantidad_envios
    FROM cola_envios ce
    JOIN contactos co ON ce.contacto_id = co.id
    LEFT JOIN rubros r ON co.rubro_id = r.id::text
    JOIN campanas c ON ce.campana_id = c.id
    ${whereClause}
    GROUP BY COALESCE(r.nombre, 'Sin rubro')
    ORDER BY cantidad_envios DESC
    LIMIT 10
  `, params);
  
  // 4. Histórico Temporal
  const historicoWhere = whereClause 
    ? whereClause + ' AND ce.fecha_envio IS NOT NULL'
    : "WHERE ce.fecha_envio IS NOT NULL AND ce.fecha_envio >= CURRENT_DATE - INTERVAL '30 days'";

  const historicoQuery = await dbPool.query(`
    SELECT DATE(ce.fecha_envio) as fecha, COUNT(*) as envios
    FROM cola_envios ce
    JOIN campanas c ON ce.campana_id = c.id
    ${historicoWhere}
    GROUP BY DATE(ce.fecha_envio)
    ORDER BY DATE(ce.fecha_envio) ASC
  `, params);

  // 5. Aperturas y Clicks Totales
  const interaccionesQuery = await dbPool.query(`
    SELECT 
      COUNT(CASE WHEN ce.fecha_apertura IS NOT NULL THEN 1 END) as aperturas,
      COUNT(CASE WHEN ce.fecha_click IS NOT NULL THEN 1 END) as clics
    FROM cola_envios ce
    JOIN campanas c ON ce.campana_id = c.id
    ${whereClause}
  `, params);

  // 6. Ranking de Campañas (Top 10)
  const rankingQuery = await dbPool.query(`
    SELECT c.asunto, 
           COUNT(ce.id) as procesados,
           COUNT(CASE WHEN ce.estado = 'enviado' THEN 1 END) as exitosos,
           COUNT(CASE WHEN ce.estado = 'fallido' THEN 1 END) as fallidos,
           COUNT(CASE WHEN ce.fecha_apertura IS NOT NULL THEN 1 END) as aperturas
    FROM campanas c
    JOIN cola_envios ce ON c.id = ce.campana_id
    ${whereClause ? whereClause + " AND ce.estado IN ('enviado', 'fallido')" : "WHERE ce.estado IN ('enviado', 'fallido')"}
    GROUP BY c.id, c.asunto
    ORDER BY procesados DESC
    LIMIT 10
  `, params);

  // 7. Salud del Padrón (Estado de contactos en BD) - Esto es global siempre
  const padronQuery = await dbPool.query(`
    SELECT estado, COUNT(*) as count 
    FROM contactos
    GROUP BY estado
    ORDER BY count DESC, estado ASC
  `);

  return {
    campanas: campanasQuery.rows.map(row => ({
      estado: row.estado,
      count: parseInt(row.count, 10)
    })),
    cola: colaQuery.rows.map(row => ({
      estado: row.estado,
      count: parseInt(row.count, 10)
    })),
    rubros: rubrosQuery.rows.map(row => ({
      rubro: row.rubro,
      cantidad_envios: parseInt(row.cantidad_envios, 10)
    })),
    historico: historicoQuery.rows.map(row => ({
      fecha: row.fecha instanceof Date ? row.fecha.toISOString().split('T')[0] : row.fecha,
      envios: parseInt(row.envios, 10)
    })),
    ranking: rankingQuery.rows.map(row => ({
      asunto: row.asunto,
      procesados: parseInt(row.procesados, 10),
      exitosos: parseInt(row.exitosos, 10),
      fallidos: parseInt(row.fallidos, 10),
      aperturas: parseInt(row.aperturas, 10)
    })),
    padron: padronQuery.rows.map(row => ({
      estado: row.estado || 'funcional',
      count: parseInt(row.count, 10)
    })),
    aperturasTotales: parseInt(interaccionesQuery.rows[0]?.aperturas || '0', 10),
    clicsTotales: parseInt(interaccionesQuery.rows[0]?.clics || '0', 10)
  };
}

export interface CampanaExportRow {
  id: string;
  asunto: string;
  estado: string;
  fecha_limite_envio: string | null;
  creado_en: string;
  total_envios: number;
  enviados: number;
  fallidos: number;
  pendientes: number;
  abiertos: number;
  clicks: number;
}

export async function obtenerCampanasParaExportar(startDate?: string, endDate?: string): Promise<CampanaExportRow[]> {
  const params: any[] = [];
  let whereClause = '';

  if (startDate && endDate) {
    params.push(startDate, endDate);
    whereClause = 'WHERE DATE(COALESCE(c.fecha_limite_envio, c.creado_en)) >= $1 AND DATE(COALESCE(c.fecha_limite_envio, c.creado_en)) <= $2';
  } else if (startDate) {
    params.push(startDate);
    whereClause = 'WHERE DATE(COALESCE(c.fecha_limite_envio, c.creado_en)) >= $1';
  } else if (endDate) {
    params.push(endDate);
    whereClause = 'WHERE DATE(COALESCE(c.fecha_limite_envio, c.creado_en)) <= $1';
  }

  const query = await dbPool.query(`
    SELECT 
      c.id, c.asunto, c.estado, c.fecha_limite_envio, c.creado_en,
      COUNT(ce.id)::int as total_envios,
      COUNT(ce.id) FILTER (WHERE ce.estado = 'enviado')::int as enviados,
      COUNT(ce.id) FILTER (WHERE ce.estado = 'fallido')::int as fallidos,
      COUNT(ce.id) FILTER (WHERE ce.estado = 'pendiente' OR ce.estado = 'procesando')::int as pendientes,
      COUNT(ce.id) FILTER (WHERE ce.fecha_apertura IS NOT NULL)::int as abiertos,
      COUNT(ce.id) FILTER (WHERE ce.fecha_click IS NOT NULL)::int as clicks
    FROM campanas c
    LEFT JOIN cola_envios ce ON c.id = ce.campana_id
    ${whereClause}
    GROUP BY c.id
    ORDER BY c.creado_en DESC;
  `, params);
  
  return query.rows;
}
