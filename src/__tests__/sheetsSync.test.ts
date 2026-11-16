import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbPool } from '../config/db.js';
import { importarContactosJson } from '../services/contactoService.js';
import { splitEmails } from '../services/googleSheetsService.js';

describe('Google Sheets & Contactos Protection (V2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('No debe sobreescribir un estado de rebote o inactivo existente con "funcional"', async () => {
    const querySpy = vi.spyOn(dbPool, 'query').mockImplementation(async (sql: any, _params?: any) => {
      if (typeof sql === 'string' && sql.includes('SELECT id, nombre FROM rubros')) {
        return { rows: [] } as any;
      }
      if (typeof sql === 'string' && sql.includes('SELECT id, nombre, cuit FROM empresas')) {
        return { rows: [{ id: 'emp-123', nombre: 'Test S.A.', cuit: '20123456789' }] } as any;
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO contactos')) {
        // Verificar que la consulta SQL contenga la cláusula CASE defensiva
        expect(sql).toContain("contactos.estado LIKE 'rebotado%' OR contactos.estado IN ('inactivo', 'mal_escrito')");
        expect(sql).toContain("EXCLUDED.estado = 'funcional'");
        return { rowCount: 1, rows: [{ id: 'cont-1' }] } as any;
      }
      return { rows: [] } as any;
    });

    const resultado = await importarContactosJson([
      {
        email: 'rebotado_previo@empresa.com',
        empresa_nombre: 'Test S.A.',
        cuit: '20123456789',
        rubro_id: null,
        tipo: 'empresa',
        estado: 'funcional', // Viene como funcional desde un sheet o archivo desactualizado
      },
    ]);

    expect(resultado.procesados).toBe(1);
    expect(resultado.insertados_o_actualizados).toBe(1);
    querySpy.mockRestore();
  });

  it('Debe incluir la lógica defensiva ante múltiples contactos en lote', async () => {
    let insertQuery = '';
    const querySpy = vi.spyOn(dbPool, 'query').mockImplementation(async (sql: any, _params?: any) => {
      if (typeof sql === 'string' && sql.includes('SELECT id, nombre FROM rubros')) {
        return { rows: [] } as any;
      }
      if (typeof sql === 'string' && sql.includes('SELECT id, nombre, cuit FROM empresas')) {
        return { rows: [] } as any;
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO contactos')) {
        insertQuery = sql;
        return { rowCount: 2, rows: [{ id: 'cont-1' }, { id: 'cont-2' }] } as any;
      }
      return { rows: [] } as any;
    });

    const resultado = await importarContactosJson([
      {
        email: 'contacto1@test.com',
        empresa_nombre: 'Empresa A',
        cuit: null,
        rubro_id: null,
        tipo: 'empresa',
        estado: 'funcional',
      },
      {
        email: 'contacto2@test.com',
        empresa_nombre: 'Empresa B',
        cuit: null,
        rubro_id: null,
        tipo: 'empresa',
        estado: 'inactivo',
      },
    ]);

    expect(resultado.procesados).toBe(2);
    expect(resultado.insertados_o_actualizados).toBe(2);
    expect(insertQuery).toContain('ON CONFLICT (email) DO UPDATE');
    expect(insertQuery).toContain('contactos.estado');
    querySpy.mockRestore();
  });

  describe('splitEmails() — División y normalización de celdas con correos múltiples', () => {
    it('debe dividir correctamente emails separados por pipe (|)', () => {
      const raw = 'contacto@aitec-ingenieria.com.ar | ventas@aitec-ingenieria.com.ar';
      const res = splitEmails(raw);
      expect(res).toEqual([
        'contacto@aitec-ingenieria.com.ar',
        'ventas@aitec-ingenieria.com.ar',
      ]);
    });

    it('debe soportar punto y coma (;), coma (,), barra (/) y saltos de línea', () => {
      const raw = 'admin@empresa.com; gerencia@empresa.com, info@empresa.com / compras@empresa.com\nrrhh@empresa.com';
      const res = splitEmails(raw);
      expect(res).toEqual([
        'admin@empresa.com',
        'gerencia@empresa.com',
        'info@empresa.com',
        'compras@empresa.com',
        'rrhh@empresa.com',
      ]);
    });

    it('debe ignorar notas entre paréntesis o texto basura sin romper el email', () => {
      const raw = 'ventas@empresa.com (Juan) | admin@empresa.com (No llamar despues de las 18)';
      const res = splitEmails(raw);
      expect(res).toEqual([
        'ventas@empresa.com',
        'admin@empresa.com',
      ]);
    });

    it('debe deduplicar emails repetidos en la misma celda (case-insensitive)', () => {
      const raw = 'info@empresa.com | INFO@EMPRESA.COM | info@empresa.com';
      const res = splitEmails(raw);
      expect(res).toEqual(['info@empresa.com']);
    });

    it('debe retornar un array vacío si la celda no contiene correos válidos', () => {
      expect(splitEmails('')).toEqual([]);
      expect(splitEmails(null)).toEqual([]);
      expect(splitEmails('Sin correo / s/d / no posee')).toEqual([]);
    });
  });
});
