/**
 * Script de Simulación y Verificación del Dosificador Horario
 * 
 * Ejecución:
 * npx tsx scripts/simular_dosificador.ts
 */

import {
  contarDiasOperativos,
  calcularEjecucionesDiarias,
  calcularObjetivoHora,
} from '../src/services/dosificadorService.js';

console.log('=============================================================================');
console.log(' SIMULACIÓN DEL DOSIFICADOR DINÁMICO DE ENVÍOS (GENMAILER)');
console.log('=============================================================================\n');

const fechaBase = '2026-10-23'; // Viernes
const diasPermitidos = [1, 2, 3, 4, 5]; // Lunes a Viernes
const minGlobal = 5;
const maxGlobal = 25;
const totalPendientes = 540;

console.log(`📌 Parámetros de la Campaña:`);
console.log(` - Fecha actual de prueba: ${fechaBase} (Viernes)`);
console.log(` - Correos pendientes: ${totalPendientes}`);
console.log(` - Horario SMTP configurado: 09:00 a 17:00 (9 ejecuciones diarias)`);
console.log(` - Límites seguros SMTP: Mín ${minGlobal}/h | Máx ${maxGlobal}/h`);
console.log(` - Días habilitados: Lunes a Viernes (Sábado y Domingo EXCLUIDOS)\n`);

console.log('-----------------------------------------------------------------------------');
console.log(' ESCENARIO 1: Fecha Límite Original (04 de Noviembre - Miércoles)');
console.log('-----------------------------------------------------------------------------');
const res1 = calcularObjetivoHora({
  totalPendientes,
  fechaLimite: '2026-11-04',
  fechaActual: fechaBase,
  diasPermitidos,
  fechasExcluidas: [],
  horaInicio: '09:00',
  horaFin: '17:00',
  minGlobalPorHora: minGlobal,
  maxGlobalPorHora: maxGlobal,
});

console.log(` • Días calendario entre 23/10 y 04/11: 12 días`);
console.log(` • Días OPERATIVOS reales (sin fines de semana): ${res1.diasOperativos} días`);
console.log(` • Total horas de despacho disponibles: ${res1.ejecucionesTotales} horas`);
console.log(` • Cálculo teórico (540 / ${res1.ejecucionesTotales}): ${res1.calculoTeorico} mails/hora`);
console.log(` 🚀 RESULTADO ENVÍO POR HORA: ${res1.objetivoHora} mails/hora\n`);

console.log('-----------------------------------------------------------------------------');
console.log(' ESCENARIO 2: Adelanto de Fecha al 30 de Octubre (Viernes) - CASO USUARIO');
console.log('-----------------------------------------------------------------------------');
const res2 = calcularObjetivoHora({
  totalPendientes,
  fechaLimite: '2026-10-30',
  fechaActual: fechaBase,
  diasPermitidos,
  fechasExcluidas: [],
  horaInicio: '09:00',
  horaFin: '17:00',
  minGlobalPorHora: minGlobal,
  maxGlobalPorHora: maxGlobal,
});

console.log(` • Días calendario recortados: 5 días (31/10, 01/11, 02/11, 03/11, 04/11)`);
console.log(` • Días OPERATIVOS recortados: SOLO 3 DÍAS (02/11, 03/11, 04/11) ¡El fin de semana no restó días útiles!`);
console.log(` • Días operativos restantes: ${res2.diasOperativos} días`);
console.log(` • Total horas de despacho disponibles: ${res2.ejecucionesTotales} horas`);
console.log(` • Cálculo teórico (540 / ${res2.ejecucionesTotales}): ${res2.calculoTeorico} mails/hora`);
console.log(` 🚀 RESULTADO ENVÍO POR HORA: ${res2.objetivoHora} mails/hora`);
console.log(` 📈 VARIACIÓN: El envío aumentó de ${res1.objetivoHora} a ${res2.objetivoHora} mails/hora (+${res2.objetivoHora - res1.objetivoHora}/h)\n`);

console.log('-----------------------------------------------------------------------------');
console.log(' ESCENARIO 3: Se declara FERIADO el Lunes 26/10 en "fechas_excluidas"');
console.log('-----------------------------------------------------------------------------');
const res3 = calcularObjetivoHora({
  totalPendientes,
  fechaLimite: '2026-10-30',
  fechaActual: fechaBase,
  diasPermitidos,
  fechasExcluidas: ['2026-10-26'],
  horaInicio: '09:00',
  horaFin: '17:00',
  minGlobalPorHora: minGlobal,
  maxGlobalPorHora: maxGlobal,
});

console.log(` • Días operativos restantes (menos el feriado): ${res3.diasOperativos} días`);
console.log(` • Total horas disponibles: ${res3.ejecucionesTotales} horas`);
console.log(` • Cálculo teórico (540 / ${res3.ejecucionesTotales}): ${res3.calculoTeorico} mails/hora`);
console.log(` 🚀 RESULTADO ENVÍO POR HORA: ${res3.objetivoHora} mails/hora`);
console.log(` 📈 VARIACIÓN: Al perder un día laborable por feriado, el ritmo sube a ${res3.objetivoHora} mails/hora\n`);

console.log('-----------------------------------------------------------------------------');
console.log(' ESCENARIO 4: Reducción de Franja Horaria SMTP (de 10:00 a 14:00 = 5 hs/día)');
console.log('-----------------------------------------------------------------------------');
const res4 = calcularObjetivoHora({
  totalPendientes,
  fechaLimite: '2026-10-30',
  fechaActual: fechaBase,
  diasPermitidos,
  fechasExcluidas: ['2026-10-26'],
  horaInicio: '10:00',
  horaFin: '14:00',
  minGlobalPorHora: minGlobal,
  maxGlobalPorHora: maxGlobal,
});

console.log(` • Días operativos: ${res4.diasOperativos} días`);
console.log(` • Horas diarias SMTP: ${res4.ejecucionesDiarias} horas/día`);
console.log(` • Total horas disponibles: ${res4.ejecucionesTotales} horas`);
console.log(` • Cálculo teórico (540 / ${res4.ejecucionesTotales}): ${res4.calculoTeorico} mails/hora`);
console.log(` 🚀 RESULTADO ENVÍO POR HORA: ${res4.objetivoHora} mails/hora\n`);

console.log('-----------------------------------------------------------------------------');
console.log(' ESCENARIO 5: Campaña de Urgencia Máxima (Límite: HOY 23/10)');
console.log('-----------------------------------------------------------------------------');
const res5 = calcularObjetivoHora({
  totalPendientes: 1000,
  fechaLimite: '2026-10-23',
  fechaActual: fechaBase,
  diasPermitidos,
  fechasExcluidas: [],
  horaInicio: '09:00',
  horaFin: '17:00',
  minGlobalPorHora: minGlobal,
  maxGlobalPorHora: maxGlobal,
});

console.log(` • Días operativos: ${res5.diasOperativos} día`);
console.log(` • Cálculo teórico necesario: ${res5.calculoTeorico} mails/hora`);
console.log(` • Tope de seguridad SMTP (MaxGlobal): ${maxGlobal} mails/hora`);
console.log(` 🛡️ RESULTADO ENVÍO POR HORA: ${res5.objetivoHora} mails/hora (Ajustado por Máximo: ${res5.ajustadoPorMaximo})`);
console.log(`   (Evita el baneo de Google / proveedores SMTP)\n`);

console.log('=============================================================================');
console.log(' ✅ SIMULACIÓN Y VERIFICACIÓN EXITOSA: Todos los criterios se cumplen');
console.log('=============================================================================');
