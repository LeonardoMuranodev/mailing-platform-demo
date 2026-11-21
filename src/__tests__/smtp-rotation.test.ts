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
import { 
  resetearContadoresSmtp, 
  desbloquearCuentasExpiradas, 
  toggleEstadoSmtp, marcarCuentaComoPrincipal, actualizarCuentaSmtp, eliminarCuentaSmtp } from '../services/smtpAccountService.js';

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

describe('resetearContadoresSmtp y desbloquearCuentasExpiradas', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('desbloquearCuentasExpiradas debería reactivar cuentas bloqueadas tras 24hs e insertar log', async () => {
    mockQuery.mockResolvedValueOnce({ 
      rowCount: 1, 
      rows: [{ id: 'smtp-bloq-1', email: 'bloqueada@gmail.com' }] 
    });
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // insert into smtp_logs

    const desbloqueadas = await desbloquearCuentasExpiradas();
    expect(desbloqueadas).toBe(1);

    expect(mockQuery).toHaveBeenCalledTimes(2);
    const queryUpdate = mockQuery.mock.calls[0][0] as string;
    expect(queryUpdate).toContain('UPDATE cuentas_smtp');
    expect(queryUpdate).toContain("estado = 'activo'");
    expect(queryUpdate).toContain('bloqueada_hasta = NULL');
    expect(queryUpdate).toContain("WHERE estado = 'bloqueado'");

    const queryLog = mockQuery.mock.calls[1][0] as string;
    expect(queryLog).toContain('INSERT INTO smtp_logs');
  });

  it('debería ejecutar el reset diario de contadores y desbloquear cuentas', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // desbloquearCuentasExpiradas
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] }); // reset diario

    await resetearContadoresSmtp();
    
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const queryReset = mockQuery.mock.calls[1][0] as string;
    expect(queryReset).toContain('UPDATE cuentas_smtp');
    expect(queryReset).toContain('enviados_hoy = 0');
    expect(queryReset).toContain("estado = CASE WHEN estado IN ('agotado', 'bloqueado') THEN 'activo' ELSE estado END");
  });
});

describe('toggleEstadoSmtp', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('debería cambiar a activo y limpiar bloqueada_hasta', async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'smtp-1', email: 'test@gmail.com', estado: 'activo' }],
    });

    const res = await toggleEstadoSmtp('smtp-1', 'activo');
    expect(res?.estado).toBe('activo');

    const query = mockQuery.mock.calls[0][0] as string;
    expect(query).toContain("SET estado = 'activo'");
    expect(query).toContain('bloqueada_hasta = NULL');
  });

  it('debería cambiar a bloqueado y fijar bloqueada_hasta para el día siguiente', async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'smtp-1', email: 'test@gmail.com', estado: 'bloqueado' }],
    });

    const res = await toggleEstadoSmtp('smtp-1', 'bloqueado');
    expect(res?.estado).toBe('bloqueado');

    const query = mockQuery.mock.calls[0][0] as string;
    expect(query).toContain("SET estado = 'bloqueado'");
    expect(query).toContain("bloqueada_hasta = (CURRENT_DATE + INTERVAL '1 day')::timestamptz");
  });

  it('debería cambiar a inactivo sin ambigüedad de parámetros en SQL', async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'smtp-1', email: 'test@gmail.com', estado: 'inactivo' }],
    });

    const res = await toggleEstadoSmtp('smtp-1', 'inactivo');
    expect(res?.estado).toBe('inactivo');

    const query = mockQuery.mock.calls[0][0] as string;
    expect(query).toContain('SET estado = $1');
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

  it('actualizarCuentaSmtp permite actualizar el umbral_errores de una cuenta', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'smtp-2',
        email: 'cuenta2@gmail.com',
        host: 'smtp.gmail.com',
        puerto: 465,
        password_encrypted: 'clave_cifrada',
        limite_diario: 400,
        estado: 'activo',
        umbral_errores: 30,
      }],
      rowCount: 1,
    });

    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'smtp-2',
        email: 'cuenta2@gmail.com',
        umbral_errores: 50,
      }],
      rowCount: 1,
    });

    const { actualizarCuentaSmtp } = await import('../services/smtpAccountService.js');
    const res = await actualizarCuentaSmtp('smtp-2', { umbral_errores: 50 });
    expect(res?.umbral_errores).toBe(50);

    const query = mockQuery.mock.calls[1][0] as string;
    const values = mockQuery.mock.calls[1][1] as unknown[];
    expect(query).toContain('umbral_errores = $1');
    expect(values).toContain(50);
  });

  it('resetearContadoresSmtp NO reactiva cuentas en estado inactivo', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 2 });

    await resetearContadoresSmtp();

    expect(mockQuery).toHaveBeenCalledTimes(2);
    const updateQuery = mockQuery.mock.calls[1][0] as string;
    expect(updateQuery).toContain("estado = CASE WHEN estado IN ('agotado', 'bloqueado') THEN 'activo' ELSE estado END");
    expect(updateQuery).toContain("WHERE estado IN ('agotado', 'bloqueado') OR enviados_hoy > 0");
  });
});
