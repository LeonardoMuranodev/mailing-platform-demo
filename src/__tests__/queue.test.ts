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
}));

vi.mock('../scripts/seedUsuarios.js', () => ({
  seedUsuarios: vi.fn().mockResolvedValue(undefined),
}));

import { poblarColaEnvios } from '../services/queueService.js';

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

    // 4. UPDATE estado
    mockQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 1,
    });

    const result = await poblarColaEnvios(campanaId);

    expect(result.campana_id).toBe(campanaId);
    expect(result.total_insertados).toBe(3);
    expect(result.para_todos_rubros).toBe(true);

    // Verificar que se hicieron las 4 queries
    expect(mockQuery).toHaveBeenCalledTimes(4);

    // Verificar que el INSERT usó unnest con los IDs correctos
    const insertCall = mockQuery.mock.calls[2];
    expect(insertCall[0]).toContain('INSERT INTO cola_envios');
    expect(insertCall[1]).toEqual([campanaId, ['contact-1', 'contact-2', 'contact-3']]);

    // Verificar que el UPDATE cambió el estado a 'en_proceso'
    const updateCall = mockQuery.mock.calls[3];
    expect(updateCall[0]).toContain("UPDATE campanas SET estado = 'en_proceso'");
    expect(updateCall[1]).toEqual([campanaId]);
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

    expect(result.total_insertados).toBe(0);
    expect(result.rubros_filtrados).toEqual(['rubro-1', 'rubro-2']);
    // No debe hacer INSERT si no hay contactos
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('debería lanzar error si la campaña no existe', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await expect(poblarColaEnvios('inexistente')).rejects.toThrow(
      'Campaña con id "inexistente" no encontrada',
    );
  });

  it('debería lanzar error si la campaña no está en estado "aprobada"', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'camp-borrador',
        asunto: 'Borrador',
        cuerpo_html: '<p>Borrador</p>',
        estado: 'borrador',
        para_todos_rubros: true,
        rubros_seleccionados: '[]',
        prioridad: 'baja',
        fecha_limite_envio: '2024-12-31',
        creado_en: '2024-01-01T00:00:00Z',
        actualizado_en: '2024-01-01T00:00:00Z',
      }],
      rowCount: 1,
    });

    await expect(poblarColaEnvios('camp-borrador')).rejects.toThrow(
      'La campaña debe estar en estado "aprobada"',
    );
  });
});
