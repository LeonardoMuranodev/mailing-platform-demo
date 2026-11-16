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
  getTelegramEnvironmentInfo: vi.fn().mockReturnValue({
    location: 'LOCAL',
    modo: 'TEST',
    tag: '[LOCAL | TEST]',
    hostname: 'test-host',
    descLocation: 'LOCAL (test-host)',
    descModo: 'MODO TEST (Pruebas)',
  }),
}));

// Mockear seed para que no corra
vi.mock('../scripts/seedUsuarios.js', () => ({
  seedUsuarios: vi.fn().mockResolvedValue(undefined),
}));

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { login, verificarToken } from '../services/authService.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { authController } from '../controllers/authController.js';
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
      email: 'test@organizacion.com',
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

      const result = await login('test@organizacion.com', password);

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
      expect(decoded.email).toBe('test@organizacion.com');
      expect(decoded.rol).toBe('encargada');
    });

    it('debería lanzar error con email inexistente', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      await expect(login('noexiste@organizacion.com', 'password123')).rejects.toThrow(
        'Credenciales inválidas',
      );
    });

    it('debería lanzar error con contraseña incorrecta', async () => {
      const hash = await bcrypt.hash('password_correcta', 10);

      mockQuery.mockResolvedValueOnce({
        rows: [{ ...testUser, password_hash: hash }],
        rowCount: 1,
      });

      await expect(login('test@organizacion.com', 'password_incorrecta')).rejects.toThrow(
        'Credenciales inválidas',
      );
    });
  });

  describe('verificarToken()', () => {
    it('debería decodificar un token válido', () => {
      const payload: JwtPayload = {
        userId: 'uuid-123',
        email: 'test@organizacion.com',
        rol: 'desarrollador',
      };

      // Firmar con el MISMO secret que usa el servicio
      const token = jwt.sign(payload, config.jwt.secret, {
        expiresIn: '1h',
      });

      const result = verificarToken(token);
      expect(result.userId).toBe('uuid-123');
      expect(result.email).toBe('test@organizacion.com');
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
        email: 'test@organizacion.com',
        rol: 'invitado',
      };

      const token = jwt.sign(payload, config.jwt.secret, {
        expiresIn: '0s', // expira inmediatamente
      });

      expect(() => verificarToken(token)).toThrow('Token inválido o expirado');
    });
  });

  describe('requireAuth Middleware (Cookies HttpOnly vs Bearer)', () => {
    it('debe autenticar exitosamente extrayendo el token desde la Cookie HttpOnly auth_token', async () => {
      const payload: JwtPayload = {
        userId: 'uuid-cookie-1',
        email: 'cookie@organizacion.com',
        rol: 'desarrollador',
      };
      const token = jwt.sign(payload, config.jwt.secret, { expiresIn: '1h' });

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'uuid-cookie-1', rol: 'desarrollador' }],
        rowCount: 1,
      });

      const req = {
        cookies: { auth_token: token },
        headers: {},
        query: {},
      } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('uuid-cookie-1');
      expect(req.user.email).toBe('cookie@organizacion.com');
    });

    it('debe autenticar exitosamente mediante header Authorization Bearer como fallback', async () => {
      const payload: JwtPayload = {
        userId: 'uuid-bearer-1',
        email: 'bearer@organizacion.com',
        rol: 'encargada',
      };
      const token = jwt.sign(payload, config.jwt.secret, { expiresIn: '1h' });

      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'uuid-bearer-1', rol: 'encargada' }],
        rowCount: 1,
      });

      const req = {
        cookies: {},
        headers: { authorization: `Bearer ${token}` },
        query: {},
      } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe('uuid-bearer-1');
    });

    it('debe rechazar con 401 si no hay ni cookie ni header ni query token', async () => {
      const req = {
        cookies: {},
        headers: {},
        query: {},
      } as any;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      await requireAuth(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        })
      );
    });
  });

  describe('authController (Emisión y Limpieza de Cookie HttpOnly)', () => {
    it('login debe emitir cookie auth_token con HttpOnly', async () => {
      const password = 'pass';
      const hash = await bcrypt.hash(password, 10);
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'usr-1', nombre: 'Admin', email: 'admin@organizacion.com', password_hash: hash, rol: 'desarrollador' }],
        rowCount: 1,
      });

      const req = { body: { email: 'admin@organizacion.com', password } } as any;
      const res = {
        cookie: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;
      const next = vi.fn();

      await authController.login(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        'auth_token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('logout debe limpiar cookie auth_token con path="/"', async () => {
      const req = {} as any;
      const res = {
        clearCookie: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as any;

      await authController.logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'auth_token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ message: expect.stringContaining('Sesión cerrada') }),
        })
      );
    });
  });
});
