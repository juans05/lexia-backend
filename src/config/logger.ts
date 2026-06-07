/**
 * LexAI Perú - Logger Configuration
 *
 * Sistema centralizado de logging con Winston:
 * - Logs a archivo en producción
 * - Logs a consola en desarrollo
 * - Niveles: error, warn, info, debug
 * - Formato estructurado (JSON)
 *
 * Uso:
 *   import logger from './config/logger';
 *   logger.info('Mensaje informativo');
 *   logger.error('Mensaje de error', error);
 *   logger.debug('Mensaje de debug', { contexto });
 */

import winston from 'winston';
import config from './env.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../../logs');

/**
 * Niveles de log personalizados
 */
const nivelLog = config.logging.level || 'info';

/**
 * Formato personalizado para consola (coloreado)
 */
const formatoConsola = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    let msg = `${timestamp} [${level.toUpperCase()}] ${message}`;

    if (Object.keys(meta).length > 0 && meta.message !== message) {
      msg += ` ${JSON.stringify(meta, null, 2)}`;
    }

    return msg;
  }),
  winston.format.colorize({ all: true })
);

/**
 * Formato para archivos (JSON estructurado)
 */
const formatoArchivo = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Transportes del logger
 */
const transportes: winston.transport[] = [];

// Console transport (siempre activo)
transportes.push(
  new winston.transports.Console({
    format: formatoConsola,
    level: nivelLog,
  })
);

// File transport (en producción)
if (config.isProduction) {
  transportes.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: formatoArchivo,
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: formatoArchivo,
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  );
}

/**
 * Crear instancia del logger
 */
const logger = winston.createLogger({
  level: nivelLog,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: {
    service: 'lexai-peru-backend',
    environment: config.nodeEnv,
  },
  transports: transportes,
});

/**
 * Métodos con alias comunes
 */
// Object.assign sobre la instancia Winston preserva el prototype (error, info, warn, debug...)
// El spread { ...logger } NO copia métodos del prototype, por eso falla logger.error
export const loggerExtendido = Object.assign(logger, {
  success: (mensaje: string, meta?: any) => logger.info(`✓ ${mensaje}`, meta),

  warning: (mensaje: string, meta?: any) => logger.warn(`⚠️  ${mensaje}`, meta),

  errorConContexto: (mensaje: string, error: any, contexto?: any) => {
    logger.error(mensaje, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...contexto,
    });
  },

  debugObjeto: (mensaje: string, objeto: any) =>
    logger.debug(mensaje, { objeto: JSON.stringify(objeto, null, 2) }),

  trace: (mensaje: string, datos?: any) => logger.debug(`[TRACE] ${mensaje}`, datos),

  requestAPI: (metodo: string, ruta: string, statusCode: number, tiempoMs: number) => {
    const simbolo = statusCode >= 400 ? '❌' : statusCode >= 300 ? '⚠️ ' : '✓';
    logger.info(`${simbolo} ${metodo.padEnd(6)} ${ruta} - ${statusCode} (${tiempoMs}ms)`);
  },

  eventoNegocio: (evento: string, usuarioId?: string, detalles?: any) =>
    logger.info(`[EVENTO] ${evento}`, { usuario_id: usuarioId, detalles }),
});

export default loggerExtendido;

/**
 * Imprimir información del logger en startup
 */
export function imprimirInfoLogger(): void {
  console.log('\n📊 Logger Configuration:');
  console.log(`   Nivel: ${nivelLog}`);
  console.log(`   Entorno: ${config.nodeEnv}`);

  if (config.isProduction) {
    console.log(`   Archivos: ${logsDir}`);
  }

  console.log('');
}
