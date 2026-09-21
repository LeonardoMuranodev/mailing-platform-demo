/**
 * Tests de integración para la rotación SMTP (Round-Robin).
 * Cubre: Selección de cuenta, circuit breaker, sin cuentas disponibles.
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

import {
  obtenerSiguienteSmtpDisponible,
  incrementarCuotaSmtp,
} from '../services/queueService.js';

describe('SMTP Rotation — Round-Robin', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('obtenerSiguienteSmtpDisponible()', () => {
    it('debería retornar la cuenta SMTP con ultimo_uso más antiguo', async () => {
      const cuentaEsperada = {
        id: 'smtp-1',
        email: 'dpi5m@test.com',
        host: 'smtp.gmail.com',
        puerto: 465,
        usuario: 'dpi5m@test.com',
        password_encrypted: 'encrypted_pass',
        estado: 'activo',
        enviados_hoy: 50,
        limite_diario: 400,
        ultimo_uso: '2024-01-01T10:00:00Z',
        creado_en: '2024-01-01T00:00:00Z',
        actualizado_en: '2024-01-01T00:00:00Z',
      };

      mockQuery.mockResolvedValueOnce({
        rows: [cuentaEsperada],
        rowCount: 1,
      });

      const result = await obtenerSiguienteSmtpDisponible();

      expect(result).toEqual(cuentaEsperada);

      // Verificar que la query usa ORDER BY ultimo_uso ASC NULLS FIRST
      const queryText = mockQuery.mock.calls[0][0] as string;
      expect(queryText).toContain('ORDER BY ultimo_uso ASC NULLS FIRST');
      expect(queryText).toContain("estado = 'activo'");
      expect(queryText).toContain('enviados_hoy < limite_diario');
    });

    it('debería retornar null si no hay cuentas disponibles', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const result = await obtenerSiguienteSmtpDisponible();
      expect(result).toBeNull();
    });
  });

  describe('incrementarCuotaSmtp()', () => {
    it('debería incrementar enviados_hoy y actualizar ultimo_uso', async () => {
      const cuentaActualizada = {
        id: 'smtp-1',
        email: 'dpi5m@test.com',
        host: 'smtp.gmail.com',
        puerto: 465,
        usuario: 'dpi5m@test.com',
        password_encrypted: 'encrypted_pass',
        estado: 'activo',
        enviados_hoy: 51, // incrementado
        limite_diario: 400,
        ultimo_uso: '2024-01-01T12:00:00Z',
        creado_en: '2024-01-01T00:00:00Z',
        actualizado_en: '2024-01-01T12:00:00Z',
      };

      mockQuery.mockResolvedValueOnce({
        rows: [cuentaActualizada],
        rowCount: 1,
      });

      const result = await incrementarCuotaSmtp('smtp-1');

      expect(result.enviados_hoy).toBe(51);
      expect(result.estado).toBe('activo');

      // Verificar el UPDATE
      const queryText = mockQuery.mock.calls[0][0] as string;
      expect(queryText).toContain('enviados_hoy = enviados_hoy + 1');
      expect(queryText).toContain('ultimo_uso = CURRENT_TIMESTAMP');
    });

    it('debería cambiar estado a "agotado" al alcanzar el límite diario (Circuit Breaker)', async () => {
      const cuentaAgotada = {
        id: 'smtp-2',
        email: 'dpi2m@test.com',
        host: 'smtp.gmail.com',
        puerto: 465,
        usuario: 'dpi2m@test.com',
        password_encrypted: 'encrypted_pass',
        estado: 'agotado', // cambiado por el CASE
        enviados_hoy: 400, // alcanzó el límite
        limite_diario: 400,
        ultimo_uso: '2024-01-01T15:00:00Z',
        creado_en: '2024-01-01T00:00:00Z',
        actualizado_en: '2024-01-01T15:00:00Z',
      };

      mockQuery.mockResolvedValueOnce({
        rows: [cuentaAgotada],
        rowCount: 1,
      });

      const result = await incrementarCuotaSmtp('smtp-2');

      expect(result.estado).toBe('agotado');
      expect(result.enviados_hoy).toBe(400);

      // Verificar que el CASE SQL está presente
      const queryText = mockQuery.mock.calls[0][0] as string;
      expect(queryText).toContain("WHEN enviados_hoy + 1 >= limite_diario THEN 'agotado'");
    });

    it('debería lanzar error si la cuenta SMTP no existe', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      await expect(incrementarCuotaSmtp('inexistente')).rejects.toThrow(
        'Cuenta SMTP con id "inexistente" no encontrada',
      );
    });
  });
});

describe('resetearContadoresSmtp', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('debería ejecutar el UPDATE para resetear contadores y cambiar estado agotado', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });
    
    // resetearContadoresSmtp debe importarse estáticamente arriba
    const { resetearContadoresSmtp } = await import('../services/smtpAccountService.js');
    await resetearContadoresSmtp();
    
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const queryText = mockQuery.mock.calls[0][0] as string;
    expect(queryText).toContain('UPDATE cuentas_smtp');
    expect(queryText).toContain('enviados_hoy = 0');
    expect(queryText).toContain("estado = CASE WHEN estado = 'agotado' THEN 'activo' ELSE estado END");
  });
});
