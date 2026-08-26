/**
 * Tests de integración para el flujo de autenticación.
 * Cubre: Login exitoso, login fallido, endpoint /me.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockQuery, mockDbPool, resetAllMocks, mockRedis } from './helpers/mockDb.js';

// ── Mocks globales (antes de importar módulos bajo test) ─────
vi.mock('../config/db.js', () => ({
  dbPool: mockDbPool,
  testDbConnection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/redis.js', () => ({
  redis: mockRedis,
}));

// Mockear telegramNotifier para que no envíe nada real
vi.mock('../services/telegramNotifier.js', () => ({
  notifyError: vi.fn().mockResolvedValue(undefined),
  notifyDbError: vi.fn().mockResolvedValue(undefined),
  notifyUncaughtException: vi.fn().mockResolvedValue(undefined),
  notifyUnhandledRejection: vi.fn().mockResolvedValue(undefined),
}));

// Mockear seed para que no corra
vi.mock('../scripts/seedUsuarios.js', () => ({
  seedUsuarios: vi.fn().mockResolvedValue(undefined),
}));

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { login, verificarToken } from '../services/authService.js';
import { config } from '../config/env.js';
import type { JwtPayload } from '../types/usuario.js';

describe('Auth Service', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('login()', () => {
    const testUser = {
      id: 'uuid-123',
      nombre: 'Test User',
      email: 'test@3f.com',
      password_hash: '', // se genera en cada test
      rol: 'encargada' as const,
      creado_en: '2024-01-01T00:00:00Z',
      actualizado_en: '2024-01-01T00:00:00Z',
    };

    it('debería retornar token y usuario con credenciales válidas', async () => {
      const password = 'password123';
      const hash = await bcrypt.hash(password, 10);

      mockQuery.mockResolvedValueOnce({
        rows: [{ ...testUser, password_hash: hash }],
        rowCount: 1,
      });

      const result = await login('test@3f.com', password);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user).toEqual({
        id: testUser.id,
        nombre: testUser.nombre,
        email: testUser.email,
        rol: testUser.rol,
      });

      // Verificar que el token es JWT válido
      const decoded = jwt.decode(result.token) as JwtPayload;
      expect(decoded.email).toBe('test@3f.com');
      expect(decoded.rol).toBe('encargada');
    });

    it('debería lanzar error con email inexistente', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(login('noexiste@3f.com', 'password123')).rejects.toThrow(
        'Credenciales inválidas',
      );
    });

    it('debería lanzar error con contraseña incorrecta', async () => {
      const hash = await bcrypt.hash('password_correcta', 10);

      mockQuery.mockResolvedValueOnce({
        rows: [{ ...testUser, password_hash: hash }],
        rowCount: 1,
      });

      await expect(login('test@3f.com', 'password_incorrecta')).rejects.toThrow(
        'Credenciales inválidas',
      );
    });
  });

  describe('verificarToken()', () => {
    it('debería decodificar un token válido', () => {
      const payload: JwtPayload = {
        userId: 'uuid-123',
        email: 'test@3f.com',
        rol: 'desarrollador',
      };

      // Firmar con el MISMO secret que usa el servicio
      const token = jwt.sign(payload, config.jwt.secret, {
        expiresIn: '1h',
      });

      const result = verificarToken(token);
      expect(result.userId).toBe('uuid-123');
      expect(result.email).toBe('test@3f.com');
      expect(result.rol).toBe('desarrollador');
    });

    it('debería lanzar error con token inválido', () => {
      expect(() => verificarToken('token.invalido.aqui')).toThrow(
        'Token inválido o expirado',
      );
    });

    it('debería lanzar error con token expirado', () => {
      const payload: JwtPayload = {
        userId: 'uuid-123',
        email: 'test@3f.com',
        rol: 'invitado',
      };

      const token = jwt.sign(payload, config.jwt.secret, {
        expiresIn: '0s', // expira inmediatamente
      });

      expect(() => verificarToken(token)).toThrow('Token inválido o expirado');
    });
  });
});
