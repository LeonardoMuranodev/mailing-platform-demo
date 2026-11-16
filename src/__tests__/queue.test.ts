/**
 * Tests de integración para la cola de envíos.
 * Cubre: Poblar cola con campaña aprobada, campaña inexistente, estado inválido.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQuery, mockDbPool, resetAllMocks, mockRedis } from './helpers/mockDb.js';

// ── Mocks globales ───────────────────────────────────────────
vi.mock('../config/db.js', () => ({
  dbPool: mockDbPool,
  testDbConnection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/redis.js', () => ({
  redis: mockRedis,
}));

vi.mock('../services/telegramNotifier.js', () => ({
  notifyError: vi.fn().mockResolvedValue(undefined),
  notifyDbError: vi.fn().mockResolvedValue(undefined),
  notifyUncaughtException: vi.fn().mockResolvedValue(undefined),
  notifyUnhandledRejection: vi.fn().mockResolvedValue(undefined),
  getTelegramEnvironmentInfo: vi.fn().mockReturnValue({
    location: 'LOCAL',
    modo: 'TEST',
    tag: '[LOCAL | TEST]',
    hostname: 'test-host',
    descLocation: 'LOCAL (test-host)',
    descModo: 'MODO TEST (Pruebas)',
  }),
}));

vi.mock('../scripts/seedUsuarios.js', () => ({
  seedUsuarios: vi.fn().mockResolvedValue(undefined),
}));

import { poblarColaEnvios, obtenerColaPorCampana } from '../services/queueService.js';

describe('Queue Service — poblarColaEnvios()', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('debería insertar contactos en la cola para una campaña aprobada (todos los rubros)', async () => {
    const campanaId = 'camp-uuid-1';

    // 1. Query de campaña
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: campanaId,
        asunto: 'Test campaña',
        cuerpo_html: '<p>Test</p>',
        estado: 'aprobada',
        para_todos_rubros: true,
        rubros_seleccionados: '[]',
        prioridad: 'alta',
        fecha_limite_envio: '2024-12-31',
        creado_en: '2024-01-01T00:00:00Z',
        actualizado_en: '2024-01-01T00:00:00Z',
      }],
      rowCount: 1,
    });

    // 2. Query de contactos
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'contact-1' },
        { id: 'contact-2' },
        { id: 'contact-3' },
      ],
      rowCount: 3,
    });

    // 3. INSERT masivo
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 3,
    });

    const result = await poblarColaEnvios(campanaId);

    expect(result.campana_id).toBe(campanaId);
    expect(result.total_insertados).toBe(3);
    expect(result.para_todos_rubros).toBe(true);

    // Verificar que se hicieron las 3 queries
    expect(mockQuery).toHaveBeenCalledTimes(3);

    // Verificar que la query de contactos filtra por es_contacto_base = true
    const selectQuery = mockQuery.mock.calls[1][0] as string;
    expect(selectQuery).toContain('es_contacto_base = true');

    // Verificar que el INSERT usó unnest con los IDs correctos
    const insertCall = mockQuery.mock.calls[2];
    expect(insertCall[0]).toContain('INSERT INTO cola_envios');
    expect(insertCall[1]).toEqual([campanaId, ['contact-1', 'contact-2', 'contact-3']]);
  });

  it('debería retornar 0 insertados si no hay contactos para los rubros', async () => {
    const campanaId = 'camp-uuid-2';

    // Campaña con rubros específicos
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: campanaId,
        asunto: 'Campaña rubros',
        cuerpo_html: '<p>Test</p>',
        estado: 'aprobada',
        para_todos_rubros: false,
        rubros_seleccionados: '["rubro-1", "rubro-2"]',
        prioridad: 'media',
        fecha_limite_envio: '2024-12-31',
        creado_en: '2024-01-01T00:00:00Z',
        actualizado_en: '2024-01-01T00:00:00Z',
      }],
      rowCount: 1,
    });

    // No hay contactos para esos rubros
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    const result = await poblarColaEnvios(campanaId);

    expect(result.campana_id).toBe(campanaId);
    expect(result.total_insertados).toBe(0);
    expect(result.para_todos_rubros).toBe(false);
    expect(result.rubros_filtrados).toEqual(['rubro-1', 'rubro-2']);

    // Solo se ejecutan 2 queries (campaña + búsqueda de contactos, no hay INSERT)
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('debería lanzar error si la campaña no existe', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
    });

    await expect(poblarColaEnvios('non-existent-id')).rejects.toThrow(
      'Campaña con id "non-existent-id" no encontrada',
    );
  });

  it('debería lanzar error si la campaña está en un estado no permitido (ej. completada)', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'camp-uuid-3',
        asunto: 'Campaña completada',
        cuerpo_html: '<p>Test</p>',
        estado: 'completada',
        para_todos_rubros: true,
        rubros_seleccionados: '[]',
        prioridad: 'baja',
        fecha_limite_envio: '2024-12-31',
        creado_en: '2024-01-01T00:00:00Z',
        actualizado_en: '2024-01-01T00:00:00Z',
      }],
      rowCount: 1,
    });

    await expect(poblarColaEnvios('camp-uuid-3')).rejects.toThrow(
      'La campaña debe estar en estado "aprobada" o "borrador" para poblar la cola. Estado actual: "completada"',
    );
  });

  it('debería permitir poblar la cola para una campaña en estado borrador', async () => {
    const campanaId = 'camp-uuid-borrador';

    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: campanaId,
        asunto: 'Borrador test',
        cuerpo_html: '<p>Test</p>',
        estado: 'borrador',
        para_todos_rubros: true,
        rubros_seleccionados: '[]',
        prioridad: 'alta',
        fecha_limite_envio: '2024-12-31',
        creado_en: '2024-01-01T00:00:00Z',
        actualizado_en: '2024-01-01T00:00:00Z',
      }],
      rowCount: 1,
    });

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'contact-b1' }],
      rowCount: 1,
    });

    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 1,
    });

    const result = await poblarColaEnvios(campanaId);
    expect(result.campana_id).toBe(campanaId);
    expect(result.total_insertados).toBe(1);
  });

  it('debería filtrar contactos por rubros específicos cuando para_todos_rubros es false', async () => {
    const campanaId = 'camp-uuid-4';

    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: campanaId,
        asunto: 'Campaña específica',
        cuerpo_html: '<p>Test</p>',
        estado: 'aprobada',
        para_todos_rubros: false,
        rubros_seleccionados: JSON.stringify(['Gastronomía', 'Comercio']),
        prioridad: 'alta',
        fecha_limite_envio: '2024-12-31',
        creado_en: '2024-01-01T00:00:00Z',
        actualizado_en: '2024-01-01T00:00:00Z',
      }],
      rowCount: 1,
    });

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'contact-gastro-1' }, { id: 'contact-comercio-1' }],
      rowCount: 2,
    });

    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 2,
    });

    const result = await poblarColaEnvios(campanaId);

    expect(result.campana_id).toBe(campanaId);
    expect(result.total_insertados).toBe(2);
    expect(result.para_todos_rubros).toBe(false);
    expect(result.rubros_filtrados).toEqual(['Gastronomía', 'Comercio']);

    // Verificar que la query de contactos incluye filtro por rubros y es_contacto_base
    const contactosQueryCall = mockQuery.mock.calls[1];
    expect(contactosQueryCall[0]).toContain('rubros r');
    expect(contactosQueryCall[0]).toContain('es_contacto_base = true');
    expect(contactosQueryCall[1]).toEqual([['gastronomía', 'comercio']]);
  });

  it('debería poblar la cola correctamente con destinatarios manuales (tipo_audiencia = manual)', async () => {
    const campanaId = 'camp-uuid-manual';

    // 1. Query de campaña con destinatarios manuales
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: campanaId,
        asunto: 'Campaña Manual VIP',
        cuerpo_html: '<p>Invitación</p>',
        estado: 'aprobada',
        tipo_audiencia: 'manual',
        destinatarios_manuales: '["gerencia@organizacion.com", "vip@empresa.com"]',
        para_todos_rubros: false,
        rubros_seleccionados: '[]',
        prioridad: 'alta',
        fecha_limite_envio: '2024-12-31',
        creado_en: '2024-01-01T00:00:00Z',
        actualizado_en: '2024-01-01T00:00:00Z',
      }],
      rowCount: 1,
    });

    // 2. Query de INSERT en contactos ON CONFLICT DO UPDATE
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 2 });

    // 3. Query de SELECT id FROM contactos WHERE email = ANY(...)
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'contact-uuid-1' }, { id: 'contact-uuid-2' }],
      rowCount: 2,
    });

    // 4. Query de INSERT INTO cola_envios
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 2 });

    const result = await poblarColaEnvios(campanaId);

    expect(result.campana_id).toBe(campanaId);
    expect(result.total_insertados).toBe(2);

    expect(mockQuery).toHaveBeenCalledTimes(4);
    const insertContactosQuery = mockQuery.mock.calls[1][0] as string;
    expect(insertContactosQuery).toContain('INSERT INTO contactos');
    expect(insertContactosQuery).toContain('es_contacto_base');
    const selectContactosQuery = mockQuery.mock.calls[2][0] as string;
    expect(selectContactosQuery).toContain('SELECT id FROM contactos WHERE email = ANY');
    const insertColaQuery = mockQuery.mock.calls[3][0] as string;
    expect(insertColaQuery).toContain('INSERT INTO cola_envios');
  });
});

describe('Queue Service — obtenerColaPorCampana() con filtros de fecha', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('aplica condiciones de fecha_desde y fecha_hasta con inclusión completa del día', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 1,
        contacto_email: 'test@example.com',
        estado: 'enviado',
        respuesta_smtp: '250 OK',
        intentos: 1,
        fecha_envio: '2026-11-03T14:00:00Z',
        fecha_apertura: null,
        fecha_click: null,
        cuenta_smtp_email: 'admin@dominio.com',
        creado_en: '2026-11-03T10:00:00Z',
      }],
      rowCount: 1,
    });

    const result = await obtenerColaPorCampana('camp-uuid-date', {
      fecha_desde: '2026-11-01',
      fecha_hasta: '2026-11-03',
      estado: 'enviado',
    });

    expect(result).toHaveLength(1);
    expect(mockQuery).toHaveBeenCalledTimes(1);

    const [sql, values] = mockQuery.mock.calls[0];
    expect(sql).toContain('ce.campana_id = $1');
    expect(sql).toContain('ce.estado = $2');
    expect(sql).toContain('COALESCE(ce.fecha_envio, ce.creado_en) >= $3::date');
    expect(sql).toContain("COALESCE(ce.fecha_envio, ce.creado_en) < ($4::date + interval '1 day')");
    expect(values).toEqual(['camp-uuid-date', 'enviado', '2026-11-01', '2026-11-03']);
  });
});
