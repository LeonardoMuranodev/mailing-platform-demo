/**
 * Servicio de Dosificación Dinámica de Envíos.
 * Calcula el lote óptimo de despacho por hora considerando:
 * - Cantidad de pendientes.
 * - Días operativos reales (excluyendo fines de semana según configuración y feriados).
 * - Franja horaria laboral (ej. 9 a 17 hs).
 * - Límites de seguridad mínimo y máximo de las cuentas SMTP activas.
 */

export interface ParametrosCalculoRitmo {
  totalPendientes: number;
  fechaLimite?: string | null;
  fechaActual?: Date | string;
  diasPermitidos?: number[]; // 1 = Lunes, ..., 7 = Domingo
  fechasExcluidas?: string[]; // ['YYYY-MM-DD']
  horaInicio?: string; // '09:00'
  horaFin?: string; // '17:00'
  minGlobalPorHora: number;
  maxGlobalPorHora: number;
}

export interface ResultadoCalculoRitmo {
  objetivoHora: number;
  diasOperativos: number;
  ejecucionesDiarias: number;
  ejecucionesTotales: number;
  calculoTeorico: number;
  ajustadoPorMinimo: boolean;
  ajustadoPorMaximo: boolean;
}

/**
 * Normaliza una fecha a string YYYY-MM-DD en la zona horaria de Buenos Aires
 */
export function normalizarFechaBsAs(fecha: Date | string): string {
  if (typeof fecha === 'string') {
    // Si viene en formato ISO o YYYY-MM-DD
    const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }

  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const bsasTime = new Date(d.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  const yyyy = bsasTime.getFullYear();
  const mm = String(bsasTime.getMonth() + 1).padStart(2, '0');
  const dd = String(bsasTime.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Cuenta los días operativos reales entre dos fechas (ambas inclusive),
 * filtrando fines de semana no permitidos y feriados.
 */
export function contarDiasOperativos(
  fechaInicio: Date | string,
  fechaFin: Date | string,
  diasPermitidos: number[] = [1, 2, 3, 4, 5],
  fechasExcluidas: string[] = []
): number {
  const inicioStr = normalizarFechaBsAs(fechaInicio);
  const finStr = normalizarFechaBsAs(fechaFin);

  if (finStr < inicioStr) {
    return 1;
  }

  // Iterar día por día usando mediodía UTC para evitar desfasajes horarios
  const curr = new Date(`${inicioStr}T12:00:00Z`);
  const end = new Date(`${finStr}T12:00:00Z`);
  let diasOperativos = 0;

  const setExcluidas = new Set(fechasExcluidas.map(f => normalizarFechaBsAs(f)));

  while (curr <= end) {
    const rawDay = curr.getUTCDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sab
    const dayOfWeek = rawDay === 0 ? 7 : rawDay; // 1 = Lun ... 7 = Dom
    const yyyy = curr.getUTCFullYear();
    const mm = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(curr.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const esPermitido = diasPermitidos.includes(dayOfWeek);
    const esFeriado = setExcluidas.has(dateStr);

    if (esPermitido && !esFeriado) {
      diasOperativos++;
    }

    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return diasOperativos < 1 ? 1 : diasOperativos;
}

/**
 * Calcula la cantidad de ejecuciones de worker por día según hora de inicio y fin.
 * Por ejemplo: de '09:00' a '17:00' son 9 ejecuciones (9, 10, 11, 12, 13, 14, 15, 16, 17).
 */
export function calcularEjecucionesDiarias(horaInicio: string = '09:00', horaFin: string = '17:00'): number {
  const inicioH = parseInt(horaInicio.split(':')[0], 10);
  const finH = parseInt(horaFin.split(':')[0], 10);

  if (isNaN(inicioH) || isNaN(finH) || finH < inicioH) {
    return 9; // Fallback estándar
  }

  return finH - inicioH + 1;
}

/**
 * Calcula el objetivo horario de envíos considerando días operativos,
 * ejecuciones restantes y límites globales.
 */
export function calcularObjetivoHora(params: ParametrosCalculoRitmo): ResultadoCalculoRitmo {
  const {
    totalPendientes,
    fechaLimite,
    fechaActual = new Date(),
    diasPermitidos = [1, 2, 3, 4, 5],
    fechasExcluidas = [],
    horaInicio = '09:00',
    horaFin = '17:00',
    minGlobalPorHora,
    maxGlobalPorHora,
  } = params;

  const ejecucionesDiarias = calcularEjecucionesDiarias(horaInicio, horaFin);

  // Si no hay fecha límite o no hay pendientes
  if (!fechaLimite || totalPendientes <= 0) {
    return {
      objetivoHora: minGlobalPorHora,
      diasOperativos: 1,
      ejecucionesDiarias,
      ejecucionesTotales: ejecucionesDiarias,
      calculoTeorico: minGlobalPorHora,
      ajustadoPorMinimo: false,
      ajustadoPorMaximo: false,
    };
  }

  // Días operativos reales (descartando fines de semana y feriados)
  const diasOperativos = contarDiasOperativos(
    fechaActual,
    fechaLimite,
    diasPermitidos,
    fechasExcluidas
  );

  const ejecucionesTotales = diasOperativos * ejecucionesDiarias;
  const calculoTeorico = Math.ceil(totalPendientes / ejecucionesTotales);

  let objetivoHora = calculoTeorico;
  let ajustadoPorMinimo = false;
  let ajustadoPorMaximo = false;

  if (objetivoHora < minGlobalPorHora) {
    objetivoHora = minGlobalPorHora;
    ajustadoPorMinimo = true;
  }

  if (objetivoHora > maxGlobalPorHora) {
    objetivoHora = maxGlobalPorHora;
    ajustadoPorMaximo = true;
  }

  return {
    objetivoHora,
    diasOperativos,
    ejecucionesDiarias,
    ejecucionesTotales,
    calculoTeorico,
    ajustadoPorMinimo,
    ajustadoPorMaximo,
  };
}
