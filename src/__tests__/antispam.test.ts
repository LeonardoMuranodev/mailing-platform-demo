import { describe, it, expect } from 'vitest';
import {
  randomInt,
  obtenerDemoraAleatoria,
  obtenerDemoraError,
  generarMessageId,
  inyectarEntropiaHtml,
} from '../services/antispamService.js';

describe('Servicio Anti-Spam y Cadencia Humana', () => {
  describe('1. Función randomInt', () => {
    it('debe devolver un entero dentro del rango inclusivo', () => {
      for (let i = 0; i < 50; i++) {
        const val = randomInt(10, 20);
        expect(val).toBeGreaterThanOrEqual(10);
        expect(val).toBeLessThanOrEqual(20);
        expect(Number.isInteger(val)).toBe(true);
      }
    });
  });

  describe('2. Cadencia Aleatoria entre Envíos', () => {
    it('en modo normal (cron) genera demoras variables entre 12s y 32s', () => {
      const demora = obtenerDemoraAleatoria(false, 1);
      expect(demora.ms).toBeGreaterThanOrEqual(12000);
      expect(demora.ms).toBeLessThanOrEqual(32000);
      expect(demora.esPausaLarga).toBe(false);
    });

    it('en modo normal (cron) introduce micro-pausas humanas periódicas (40s a 75s)', () => {
      // Probar múltiples correlativos para asegurar que la pausa humana se dispara
      let huboPausaLarga = false;
      for (let correlativo = 2; correlativo <= 20; correlativo++) {
        const demora = obtenerDemoraAleatoria(false, correlativo);
        if (demora.esPausaLarga) {
          huboPausaLarga = true;
          expect(demora.ms).toBeGreaterThanOrEqual(40000);
          expect(demora.ms).toBeLessThanOrEqual(75000);
          expect(demora.descripcion).toContain('Micro-pausa');
          break;
        }
      }
      expect(huboPausaLarga).toBe(true);
    });

    it('en modo forzado genera demoras ágiles pero no fijas (5s a 12s)', () => {
      for (let i = 0; i < 10; i++) {
        const demora = obtenerDemoraAleatoria(true, i + 1);
        expect(demora.ms).toBeGreaterThanOrEqual(5000);
        expect(demora.ms).toBeLessThanOrEqual(12000);
        expect(demora.esPausaLarga).toBe(false);
      }
    });

    it('dos llamadas sucesivas deben tener variabilidad (desviación no nula)', () => {
      const valores = new Set<number>();
      for (let i = 0; i < 20; i++) {
        valores.add(obtenerDemoraAleatoria(false, 1).ms);
      }
      // En 20 llamadas aleatorias entre 12000 y 32000 deben haber múltiples valores distintos
      expect(valores.size).toBeGreaterThan(5);
    });
  });

  describe('3. Cooldown ante Errores de Transporte', () => {
    it('debe devolver un tiempo de enfriamiento entre 15s y 30s', () => {
      for (let i = 0; i < 15; i++) {
        const cooldown = obtenerDemoraError();
        expect(cooldown).toBeGreaterThanOrEqual(15000);
        expect(cooldown).toBeLessThanOrEqual(30000);
      }
    });
  });

  describe('4. Message-ID Realista y Específico por Dominio', () => {
    it('debe generar un Message-ID RFC válido con el dominio del remitente', () => {
      const msgIdGmail = generarMessageId('cuenta2@gmail.com');
      expect(msgIdGmail).toMatch(/^<[a-f0-9]+\.[a-z0-9]+@gmail\.com>$/);

      const msgIdMuni = generarMessageId('prensa@organizacion.com');
      expect(msgIdMuni).toMatch(/^<[a-f0-9]+\.[a-z0-9]+@organizacion\.com>$/);
    });

    it('cada Message-ID debe ser único', () => {
      const id1 = generarMessageId('cuenta2@gmail.com');
      const id2 = generarMessageId('cuenta2@gmail.com');
      expect(id1).not.toBe(id2);
    });
  });

  describe('5. Entropía y Salting Invisible en HTML', () => {
    it('inyecta comentario con sal y referencia antes de </body>', () => {
      const original = '<html><body><h1>Hola</h1></body></html>';
      const conSal = inyectarEntropiaHtml(original, 'uuid-1234');

      expect(conSal).toContain('uuid-1234');
      expect(conSal).toContain('salt:');
      expect(conSal).toContain('</body>');
      expect(conSal).toMatch(/<!-- Ref: uuid-1234-[a-z0-9]+ salt:[a-f0-9]+ -->\s*<\/body>/);
    });

    it('dos llamadas sobre el mismo HTML producen hashes distintos (firma única)', () => {
      const original = '<div>Contenido</div>';
      const sal1 = inyectarEntropiaHtml(original, 'uuid-1234');
      const sal2 = inyectarEntropiaHtml(original, 'uuid-1234');

      expect(sal1).not.toBe(sal2);
    });
  });
});
