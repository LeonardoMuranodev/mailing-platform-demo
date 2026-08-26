/**
 * Helpers para mockear dependencias externas (DB + Redis) en tests.
 * Usa vi.mock() de Vitest para interceptar imports sin conexión real.
 */
import { vi } from 'vitest';

// ── Mock del pool de PostgreSQL ──────────────────────────────
// Tipo mínimo para simular QueryResult de pg
export interface MockQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number | null;
}

/** Función mock que se puede configurar por test */
export const mockQuery = vi.fn<(text: string, values?: unknown[]) => Promise<MockQueryResult>>();

/** Mock del pool de BD y su event emitter */
export const mockDbPool = {
  query: mockQuery,
  connect: vi.fn().mockResolvedValue({
    release: vi.fn(),
  }),
  on: vi.fn(),
};

// ── Mock de Redis ────────────────────────────────────────────
export const mockRedisGet = vi.fn<(key: string) => Promise<string | null>>();
export const mockRedisSetex = vi.fn<(key: string, ttl: number, value: string) => Promise<string>>();
export const mockRedisPing = vi.fn<() => Promise<string>>().mockResolvedValue('PONG');

export const mockRedis = {
  get: mockRedisGet,
  setex: mockRedisSetex,
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  scan: vi.fn().mockResolvedValue(['0', []]),
  ping: mockRedisPing,
  on: vi.fn(),
  status: 'ready',
};

// ── Función para resetear todos los mocks ────────────────────
export function resetAllMocks(): void {
  mockQuery.mockReset();
  mockRedisGet.mockReset();
  mockRedisSetex.mockReset();
  mockRedisPing.mockReset().mockResolvedValue('PONG');
  mockDbPool.connect.mockReset().mockResolvedValue({ release: vi.fn() });
}
