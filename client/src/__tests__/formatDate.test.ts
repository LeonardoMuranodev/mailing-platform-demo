import { describe, it, expect } from 'vitest';
import { formatDate } from '../utils/formatDate';

describe('Frontend: formatDate utility', () => {
  it('debe retornar string vacío si la fecha es vacía o nula', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate((null as unknown) as string)).toBe('');
  });

  it('debe formatear una fecha válida en formato YYYY-MM-DD en español', () => {
    const formatted = formatDate('2026-09-01');
    expect(formatted.toLowerCase()).toContain('septiembre');
    expect(formatted).toContain('2026');
  });

  it('debe manejar días de dos dígitos correctamente', () => {
    const formatted = formatDate('2026-12-25');
    expect(formatted.toLowerCase()).toContain('diciembre');
    expect(formatted).toContain('25');
    expect(formatted).toContain('2026');
  });
});
