import { describe, it, expect } from 'vitest';
import {
  normalizarEmail,
  esEmailValido,
  parsearDestinatariosManuales,
  parsearRubrosSeleccionados,
} from '../utils/campanaParsers.js';

describe('Campana Parsers & Normalizers (Senior Backend Refactor)', () => {
  describe('normalizarEmail()', () => {
    it('debe limpiar espacios y convertir a minúsculas', () => {
      expect(normalizarEmail('  Contacto@Empresa.COM  ')).toBe('contacto@empresa.com');
    });

    it('debe retornar string vacío si es null, undefined o no es string', () => {
      expect(normalizarEmail(null)).toBe('');
      expect(normalizarEmail(undefined)).toBe('');
      expect(normalizarEmail('')).toBe('');
      expect(normalizarEmail('   ')).toBe('');
    });
  });

  describe('esEmailValido()', () => {
    it('debe retornar true para correos con formato válido', () => {
      expect(esEmailValido('juan.perez@empresa.com.ar')).toBe(true);
      expect(esEmailValido('info+ventas@dominio.gob.ar')).toBe(true);
    });

    it('debe retornar false para correos malformados o vacíos', () => {
      expect(esEmailValido('correo_sin_arroba')).toBe(false);
      expect(esEmailValido('sin_dominio@')).toBe(false);
      expect(esEmailValido('@sin_usuario.com')).toBe(false);
      expect(esEmailValido('')).toBe(false);
      expect(esEmailValido(null)).toBe(false);
    });
  });

  describe('parsearDestinatariosManuales()', () => {
    it('debe parsear un array de correos deduplicando y normalizando', () => {
      const input = ['  TEST@EMPRESA.COM  ', 'test@empresa.com', 'OTRO@TEST.COM', ''];
      const result = parsearDestinatariosManuales(input);
      expect(result).toEqual(['test@empresa.com', 'otro@test.com']);
    });

    it('debe parsear un JSON string de correos', () => {
      const json = JSON.stringify(['contacto1@test.com', '  CONTACTO2@TEST.COM ']);
      const result = parsearDestinatariosManuales(json);
      expect(result).toEqual(['contacto1@test.com', 'contacto2@test.com']);
    });

    it('debe parsear un string separado por comas, punto y coma y saltos de línea', () => {
      const raw = 'uno@test.com, dos@test.com; tres@test.com\ncuatro@test.com\r\ncinco@test.com';
      const result = parsearDestinatariosManuales(raw);
      expect(result).toEqual([
        'uno@test.com',
        'dos@test.com',
        'tres@test.com',
        'cuatro@test.com',
        'cinco@test.com',
      ]);
    });

    it('debe retornar array vacío para inputs nulos, vacíos o inválidos', () => {
      expect(parsearDestinatariosManuales(null)).toEqual([]);
      expect(parsearDestinatariosManuales(undefined)).toEqual([]);
      expect(parsearDestinatariosManuales('')).toEqual([]);
      expect(parsearDestinatariosManuales('   ')).toEqual([]);
    });
  });

  describe('parsearRubrosSeleccionados()', () => {
    it('debe retornar array de strings limpios desde un array nativo', () => {
      const input = [' metalurgica ', 'comercio', ''];
      expect(parsearRubrosSeleccionados(input)).toEqual(['metalurgica', 'comercio']);
    });

    it('debe parsear un JSON string válido de rubros', () => {
      const json = JSON.stringify(['gastronomia', 'tecnologia']);
      expect(parsearRubrosSeleccionados(json)).toEqual(['gastronomia', 'tecnologia']);
    });

    it('debe manejar cadenas JSON malformadas retornando array vacío', () => {
      expect(parsearRubrosSeleccionados('{invalido:')).toEqual([]);
      expect(parsearRubrosSeleccionados(null)).toEqual([]);
      expect(parsearRubrosSeleccionados(undefined)).toEqual([]);
    });
  });
});

