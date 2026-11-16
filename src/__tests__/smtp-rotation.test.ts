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

import {
  obtenerSiguienteSmtpDisponible,
  incrementarCuotaSmtp,
} from '../services/queueService.js';
import { resetearContadoresSmtp, marcarCuentaComoPrincipal, actualizarCuentaSmtp, eliminarCuentaSmtp } from '../services/smtpAccountService.js';

describe('SMTP Rotation — Round-Robin', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('obtenerSiguienteSmtpDisponible()', () => {
    it('debería retornar la cuenta SMTP con ultimo_uso más antiguo', async () => {
      const cuentaEsperada = {
        id: 'smtp-1',
        email: 'cuenta5@dominio.com',
        host: 'smtp.gmail.com',
        puerto: 465,
        usuario: 'cuenta5@dominio.com',
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
      expect(queryText).toContain('es_exclusiva IS FALSE OR es_exclusiva IS NULL');
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

  describe('obtenerSmtpExclusivo()', () => {
    it('debería obtener la cuenta exclusiva por ID cuando se especifica cuentaId', async () => {
      const { obtenerSmtpExclusivo } = await import('../services/queueService.js');
      const cuentaPrincipal = {
        id: 'principal-uuid',
        email: 'cuenta-principal@dominio.com',
        host: 'smtp.gmail.com',
        puerto: 465,
        usuario: 'cuenta-principal@dominio.com',
        password_encrypted: 'dummy_oauth',
        estado: 'activo',
        enviados_hoy: 10,
        limite_diario: 400,
        es_principal: true,
        es_exclusiva: true,
        ultimo_uso: '2024-01-01T10:00:00Z',
        creado_en: '2024-01-01T00:00:00Z',
        actualizado_en: '2024-01-01T00:00:00Z',
      };

      mockQuery.mockResolvedValueOnce({
        rows: [cuentaPrincipal],
        rowCount: 1,
      });

      const result = await obtenerSmtpExclusivo('principal-uuid');
      expect(result).toEqual(cuentaPrincipal);

      const queryText = mockQuery.mock.calls[0][0] as string;
      const params = mockQuery.mock.calls[0][1];
      expect(queryText).toContain('WHERE id = $1');
      expect(params).toEqual(['principal-uuid']);
    });

    it('debería obtener la cuenta exclusiva o principal fallback cuando no se pasa cuentaId', async () => {
      const { obtenerSmtpExclusivo } = await import('../services/queueService.js');
      const cuentaPrincipal = {
        id: 'principal-uuid',
        email: 'cuenta-principal@dominio.com',
        estado: 'activo',
        enviados_hoy: 0,
        limite_diario: 400,
        es_principal: true,
      };

      mockQuery.mockResolvedValueOnce({
        rows: [cuentaPrincipal],
        rowCount: 1,
      });

      const result = await obtenerSmtpExclusivo();
      expect(result).toEqual(cuentaPrincipal);

      const queryText = mockQuery.mock.calls[0][0] as string;
      expect(queryText).toContain('es_principal = true OR es_exclusiva = true');
    });
  });

  describe('incrementarCuotaSmtp()', () => {
    it('debería incrementar enviados_hoy y actualizar ultimo_uso', async () => {
      const cuentaActualizada = {
        id: 'smtp-1',
        email: 'cuenta5@dominio.com',
        host: 'smtp.gmail.com',
        puerto: 465,
        usuario: 'cuenta5@dominio.com',
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
        email: 'cuenta2@dominio.com',
        host: 'smtp.gmail.com',
        puerto: 465,
        usuario: 'cuenta2@dominio.com',
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
    await resetearContadoresSmtp();
    
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const queryText = mockQuery.mock.calls[0][0] as string;
    expect(queryText).toContain('UPDATE cuentas_smtp');
    expect(queryText).toContain('enviados_hoy = 0');
    expect(queryText).toContain("estado = CASE WHEN estado = 'agotado' THEN 'activo' ELSE estado END");
  });
});

describe('Gestión de Cuenta Principal GenMailer', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('marcarCuentaComoPrincipal actualiza es_principal atómicamente', async () => {
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({}) // UPDATE es_principal = false
        .mockResolvedValueOnce({   // UPDATE target
          rowCount: 1,
          rows: [{
            id: 'smtp-1',
            email: 'admin@dominio.com',
            es_principal: true,
            password_encrypted: 'clave',
          }],
        })
        .mockResolvedValueOnce({}), // COMMIT
      release: vi.fn(),
    };
    mockDbPool.connect.mockResolvedValueOnce(mockClient);

    const res = await marcarCuentaComoPrincipal('smtp-1');
    expect(res.es_principal).toBe(true);
    expect(res.password_encrypted).toBe('********');
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
