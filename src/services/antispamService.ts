import crypto from 'node:crypto';

/**
 * Servicio Anti-Spam y Cadencia Humana para Envíos SMTP.
 * Evita la detección de bots y bloqueos algorítmicos mediante:
 * 1. Jitter aleatorio no lineal entre envíos.
 * 2. Micro-pausas humanas periódicas simuladas.
 * 3. Cooldown de seguridad ante errores de transporte.
 * 4. Message-IDs RFC compatibles con el dominio del remitente.
 * 5. Salting / hash invisible único por mensaje.
 */

export interface InfoDemora {
  ms: number;
  esPausaLarga: boolean;
  descripcion: string;
}

/**
 * Genera un número entero aleatorio en un rango inclusivo [min, max]
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calcula la demora aleatoria entre correos sucesivos.
 * @param esForzado Si el envío fue gatillado manualmente (demora más ágil)
 * @param correlativoLote Índice del correo dentro del lote actual (1, 2, 3...)
 */
export function obtenerDemoraAleatoria(esForzado: boolean = false, correlativoLote: number = 1): InfoDemora {
  if (esForzado) {
    // Modo manual: 5 a 12 segundos aleatorios
    const ms = randomInt(5000, 12000);
    return {
      ms,
      esPausaLarga: false,
      descripcion: `Demora manual aleatoria: ${(ms / 1000).toFixed(1)}s`,
    };
  }

  // Modo automático (Cron horario):
  // Cada 6 u 11 envíos (periódico pero no monótono), simular una pausa natural de descanso/revisión
  const debeHacerPausaLarga = correlativoLote > 1 && (correlativoLote % 6 === 0 || correlativoLote % 11 === 0);

  if (debeHacerPausaLarga) {
    const ms = randomInt(40000, 75000); // 40 a 75 segundos
    return {
      ms,
      esPausaLarga: true,
      descripcion: `Micro-pausa humana aleatoria (lote #${correlativoLote}): ${(ms / 1000).toFixed(1)}s`,
    };
  }

  // Delay estándar aleatorio: 12 a 32 segundos con micro-jitter
  const ms = randomInt(12000, 32000);
  return {
    ms,
    esPausaLarga: false,
    descripcion: `Cadencia aleatoria natural: ${(ms / 1000).toFixed(1)}s`,
  };
}

/**
 * Demora de cooldown obligatoria cuando ocurre un error temporal de transporte
 * para permitir que el servidor SMTP se descongestione sin gatillar rate-limits.
 */
export function obtenerDemoraError(): number {
  return randomInt(15000, 30000); // 15 a 30 segundos
}

/**
 * Genera un Message-ID estándar RFC 2822 coherente con el dominio del remitente
 * para no delatar nombres de contenedores internos o hostnames de Docker.
 */
export function generarMessageId(emailEmisor: string): string {
  const dominio = emailEmisor.includes('@') ? emailEmisor.split('@')[1] : 'gmail.com';
  const unique = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now().toString(36);
  return `<${unique}.${timestamp}@${dominio}>`;
}

/**
 * Inyecta una sal / entropía invisible al final del correo para que cada mensaje
 * tenga un hash criptográfico único sin alterar el texto ni la visualización en el cliente de correo.
 */
export function inyectarEntropiaHtml(htmlOriginal: string, itemId: string): string {
  const entropy = crypto.randomBytes(6).toString('hex');
  const timestamp = Date.now().toString(36);
  const invisibleComment = `<!-- Ref: ${itemId}-${timestamp} salt:${entropy} -->`;

  if (htmlOriginal.includes('</body>')) {
    return htmlOriginal.replace('</body>', `${invisibleComment}\n</body>`);
  }
  return `${htmlOriginal}\n${invisibleComment}`;
}
