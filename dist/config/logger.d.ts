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
/**
 * Métodos con alias comunes
 */
export declare const loggerExtendido: winston.Logger & {
    success: (mensaje: string, meta?: any) => winston.Logger;
    warning: (mensaje: string, meta?: any) => winston.Logger;
    errorConContexto: (mensaje: string, error: any, contexto?: any) => void;
    debugObjeto: (mensaje: string, objeto: any) => winston.Logger;
    trace: (mensaje: string, datos?: any) => winston.Logger;
    requestAPI: (metodo: string, ruta: string, statusCode: number, tiempoMs: number) => void;
    eventoNegocio: (evento: string, usuarioId?: string, detalles?: any) => winston.Logger;
};
export default loggerExtendido;
/**
 * Imprimir información del logger en startup
 */
export declare function imprimirInfoLogger(): void;
//# sourceMappingURL=logger.d.ts.map