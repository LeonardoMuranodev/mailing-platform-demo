import { describe, it, expect } from 'vitest';
import {
  contarDiasOperativos,
  calcularEjecucionesDiarias,
  calcularObjetivoHora,
  normalizarFechaBsAs,
} from '../services/dosificadorService.js';

describe('Dosificador Dinámico de Envíos y Días Operativos', () => {
  // Configuración base de prueba
  const diasHabilesLunesAViernes = [1, 2, 3, 4, 5];
  const minGlobal = 5;
  const maxGlobal = 25;

  describe('1. Normalización de fechas en Buenos Aires', () => {
    it('debería normalizar string YYYY-MM-DD y Date en zona horaria de Buenos Aires', () => {
      expect(normalizarFechaBsAs('2026-10-30')).toBe('2026-10-30');
      expect(normalizarFechaBsAs('2026-10-30T15:00:00.000Z')).toBe('2026-10-30');
      const date = new Date('2026-11-04T12:00:00Z');
      expect(normalizarFechaBsAs(date)).toBe('2026-11-04');
    });
  });

  describe('2. Conteo de Días Operativos y Exclusión de Fines de Semana', () => {
    it('Caso solicitado por usuario: Límite 04/11 vs 30/10 no recorta 5 días calendario sino exactamente 3 días operativos', () => {
      // Base: Viernes 23 de Octubre de 2026
      const fechaActual = '2026-10-23'; // Viernes
      const fechaFinOriginal = '2026-11-04'; // Miércoles
      const fechaFinAdelantada = '2026-10-30'; // Viernes

      // Al 04/11:
      // Octubre: Vie 23 (1), Lun 26 (2), Mar 27 (3), Mie 28 (4), Jue 29 (5), Vie 30 (6)
      // Noviembre: Lun 02 (7), Mar 03 (8), Mie 04 (9)
      // Total días operativos al 04/11 = 9 días.
      const diasHastaNov4 = contarDiasOperativos(fechaActual, fechaFinOriginal, diasHabilesLunesAViernes);
      expect(diasHastaNov4).toBe(9);

      // Al 30/10:
      // Vie 23 (1), Lun 26 (2), Mar 27 (3), Mie 28 (4), Jue 29 (5), Vie 30 (6)
      // Total días operativos al 30/10 = 6 días.
      const diasHastaOct30 = contarDiasOperativos(fechaActual, fechaFinAdelantada, diasHabilesLunesAViernes);
      expect(diasHastaOct30).toBe(6);

      // Diferencia:
      // En calendario normal: 04/11 - 30/10 = 5 días (31/10 Sab, 01/11 Dom, 02/11 Lun, 03/11 Mar, 04/11 Mie).
      // En días operativos: 9 - 6 = 3 días (Sábado y Domingo no se descuentan porque el worker no trabaja!).
      const diferenciaOperativa = diasHastaNov4 - diasHastaOct30;
      expect(diferenciaOperativa).toBe(3);
    });

    it('no debe contar Sábado ni Domingo si la campaña cruza un fin de semana', () => {
      // Viernes 23/10 a Lunes 26/10: 4 días calendario (Vie, Sab, Dom, Lun)
      // Días laborales: Solo 2 (Viernes 23 y Lunes 26)
      const dias = contarDiasOperativos('2026-10-23', '2026-10-26', diasHabilesLunesAViernes);
      expect(dias).toBe(2);
    });

    it('debe descontar feriados y fechas excluidas configuradas en fechas_excluidas', () => {
      const fechaInicio = '2026-10-23';
      const fechaFin = '2026-10-30';
      // Sin feriados: 6 días operativos
      expect(contarDiasOperativos(fechaInicio, fechaFin, diasHabilesLunesAViernes, [])).toBe(6);

      // Si el Lunes 26/10 y Miércoles 28/10 son feriados:
      const feriados = ['2026-10-26', '2026-10-28'];
      const diasConFeriados = contarDiasOperativos(fechaInicio, fechaFin, diasHabilesLunesAViernes, feriados);
      expect(diasConFeriados).toBe(4);
    });

    it('si la fecha límite es hoy o ya pasó, garantiza mínimo 1 día operativo para evitar división por cero', () => {
      expect(contarDiasOperativos('2026-10-23', '2026-10-23')).toBe(1);
      expect(contarDiasOperativos('2026-10-23', '2026-10-10')).toBe(1);
    });
  });

  describe('3. Cálculo de Ejecuciones Diarias según Horarios SMTP', () => {
    it('debe calcular las horas hábiles entre hora_inicio y hora_fin', () => {
      // 09:00 a 17:00 son 9 horas: 9, 10, 11, 12, 13, 14, 15, 16, 17
      expect(calcularEjecucionesDiarias('09:00', '17:00')).toBe(9);
      // 10:00 a 14:00 son 5 horas
      expect(calcularEjecucionesDiarias('10:00', '14:00')).toBe(5);
      // 08:00 a 12:00 son 5 horas
      expect(calcularEjecucionesDiarias('08:00', '12:00')).toBe(5);
    });
  });

  describe('4. Comportamiento Dinámico: Cambio de Fecha y Aumento del Ritmo Horario', () => {
    it('al adelantar la fecha límite, la cuota por hora DEBE aumentar', () => {
      const fechaActual = '2026-10-23';
      const totalPendientes = 540;

      // 1. Campaña holgada con límite 04/11 (9 días operativos x 9 hs = 81 ejecuciones)
      const resFechaLarga = calcularObjetivoHora({
        totalPendientes,
        fechaLimite: '2026-11-04',
        fechaActual,
        diasPermitidos: diasHabilesLunesAViernes,
        horaInicio: '09:00',
        horaFin: '17:00',
        minGlobalPorHora: minGlobal,
        maxGlobalPorHora: maxGlobal,
      });

      // Teórico: 540 / 81 = 6.66 -> Math.ceil = 7 por hora
      expect(resFechaLarga.diasOperativos).toBe(9);
      expect(resFechaLarga.ejecucionesTotales).toBe(81);
      expect(resFechaLarga.calculoTeorico).toBe(7);
      expect(resFechaLarga.objetivoHora).toBe(7);

      // 2. El usuario adelanta la fecha al 30/10 (6 días operativos x 9 hs = 54 ejecuciones)
      const resFechaCorta = calcularObjetivoHora({
        totalPendientes,
        fechaLimite: '2026-10-30',
        fechaActual,
        diasPermitidos: diasHabilesLunesAViernes,
        horaInicio: '09:00',
        horaFin: '17:00',
        minGlobalPorHora: minGlobal,
        maxGlobalPorHora: maxGlobal,
      });

      // Teórico: 540 / 54 = 10 por hora
      expect(resFechaCorta.diasOperativos).toBe(6);
      expect(resFechaCorta.ejecucionesTotales).toBe(54);
      expect(resFechaCorta.calculoTeorico).toBe(10);
      expect(resFechaCorta.objetivoHora).toBe(10);

      // Verificación clave: al acortar días, el envío por hora aumenta
      expect(resFechaCorta.objetivoHora).toBeGreaterThan(resFechaLarga.objetivoHora);
    });

    it('al postergar la fecha límite hacia adelante, la cuota por hora DEBE disminuir', () => {
      const fechaActual = '2026-10-23';
      const totalPendientes = 300;

      // Fecha urgente: Lunes 26/10 (2 días operativos = 18 ejecuciones -> 300 / 18 = 17 por hora)
      const resUrgente = calcularObjetivoHora({
        totalPendientes,
        fechaLimite: '2026-10-26',
        fechaActual,
        diasPermitidos: diasHabilesLunesAViernes,
        minGlobalPorHora: 1,
        maxGlobalPorHora: 50,
      });

      // Fecha postergada: Viernes 30/10 (6 días operativos = 54 ejecuciones -> 300 / 54 = 6 por hora)
      const resPostergada = calcularObjetivoHora({
        totalPendientes,
        fechaLimite: '2026-10-30',
        fechaActual,
        diasPermitidos: diasHabilesLunesAViernes,
        minGlobalPorHora: 1,
        maxGlobalPorHora: 50,
      });

      expect(resUrgente.objetivoHora).toBe(17);
      expect(resPostergada.objetivoHora).toBe(6);
      expect(resPostergada.objetivoHora).toBeLessThan(resUrgente.objetivoHora);
    });

    it('un feriado intermedio aumenta el ritmo por hora porque reduce los días útiles de trabajo', () => {
      const fechaActual = '2026-10-23';
      const fechaLimite = '2026-10-30';
      const totalPendientes = 270;

      // Semana sin feriados: 6 días operativos x 9 hs = 54 ejecuciones -> 270 / 54 = 5 por hora
      const resNormal = calcularObjetivoHora({
        totalPendientes,
        fechaLimite,
        fechaActual,
        fechasExcluidas: [],
        minGlobalPorHora: 1,
        maxGlobalPorHora: 50,
      });

      // Supongamos que el Lunes 26/10 es feriado nacional: 5 días x 9 hs = 45 ejecuciones -> 270 / 45 = 6 por hora
      const resConFeriado = calcularObjetivoHora({
        totalPendientes,
        fechaLimite,
        fechaActual,
        fechasExcluidas: ['2026-10-26'],
        minGlobalPorHora: 1,
        maxGlobalPorHora: 50,
      });

      expect(resNormal.objetivoHora).toBe(5);
      expect(resConFeriado.objetivoHora).toBe(6);
      expect(resConFeriado.objetivoHora).toBeGreaterThan(resNormal.objetivoHora);
    });
  });

  describe('5. Protección de Seguridad SMTP (Topes Mínimo y Máximo)', () => {
    it('no debe exceder maxGlobalPorHora aunque la fecha sea inminente y los pendientes sean muchos', () => {
      // 10.000 correos para el mismo día (1 día x 9 hs = 9 ejecuciones -> 1112/hora necesario)
      const res = calcularObjetivoHora({
        totalPendientes: 10000,
        fechaLimite: '2026-10-23',
        fechaActual: '2026-10-23',
        minGlobalPorHora: 5,
        maxGlobalPorHora: 25,
      });

      expect(res.calculoTeorico).toBe(1112);
      expect(res.objetivoHora).toBe(25); // Tope estricto de seguridad SMTP
      expect(res.ajustadoPorMaximo).toBe(true);
    });

    it('no debe caer por debajo de minGlobalPorHora si la campaña es muy chica y holgada', () => {
      // 9 correos con 9 días operativos (9 x 9 = 81 ejecuciones -> 1 correo cada 9 hs)
      const res = calcularObjetivoHora({
        totalPendientes: 9,
        fechaLimite: '2026-11-04',
        fechaActual: '2026-10-23',
        minGlobalPorHora: 5,
        maxGlobalPorHora: 25,
      });

      expect(res.calculoTeorico).toBe(1);
      expect(res.objetivoHora).toBe(5); // Piso de actividad
      expect(res.ajustadoPorMinimo).toBe(true);
    });

    it('devuelve minGlobalPorHora si la campaña no tiene fecha límite definida', () => {
      const res = calcularObjetivoHora({
        totalPendientes: 500,
        fechaLimite: null,
        minGlobalPorHora: 8,
        maxGlobalPorHora: 30,
      });

      expect(res.objetivoHora).toBe(8);
    });

    it('devuelve minGlobalPorHora si totalPendientes es 0', () => {
      const res = calcularObjetivoHora({
        totalPendientes: 0,
        fechaLimite: '2026-10-30',
        minGlobalPorHora: 5,
        maxGlobalPorHora: 25,
      });

      expect(res.objetivoHora).toBe(5);
    });
  });
});
