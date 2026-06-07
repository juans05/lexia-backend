/**
 * LexAI Perú - Redis Configuration
 *
 * Cliente Redis para:
 * - Caché de respuestas frecuentes
 * - Rate limiting
 * - Sesiones distribuidas (opcional)
 * - Cola de trabajos asincronos (futuro)
 *
 * Uso:
 *   const redis = getRedisClient();
 *   await redis.set('key', 'value', { EX: 3600 }); // 1 hora
 *   const valor = await redis.get('key');
 */
import { RedisClientType } from 'redis';
/**
 * Inicializar cliente Redis
 *
 * Solo se inicializa si REDIS_ENABLED=true en .env
 */
export declare function inicializarRedis(): Promise<RedisClientType | null>;
/**
 * Obtener instancia del cliente Redis
 *
 * Retorna null si Redis no está habilitado o conectado
 */
export declare function getRedisClient(): RedisClientType | null;
/**
 * Verificar si Redis está disponible
 */
export declare function estaRedisDisponible(): boolean;
/**
 * Guardador genérico de valores en caché
 *
 * @param key - Clave del caché
 * @param value - Valor a guardar (será serializado a JSON)
 * @param expirationSeconds - Segundos de expiración (default: 1 hora)
 */
export declare function guardarEnCache(key: string, value: any, expirationSeconds?: number): Promise<void>;
/**
 * Obtener valor del caché
 *
 * @param key - Clave del caché
 * @returns Valor deserializado o null
 */
export declare function obtenerDelCache<T = any>(key: string): Promise<T | null>;
/**
 * Eliminar valor del caché
 *
 * @param key - Clave del caché
 */
export declare function eliminarDelCache(key: string): Promise<void>;
/**
 * Limpiar caché por patrón (wildcard)
 *
 * Ejemplo: limpiarCachePattern('consulta:*')
 *
 * @param pattern - Patrón glob (ej: key:*)
 */
export declare function limpiarCachePattern(pattern: string): Promise<void>;
/**
 * Obtener o ejecutar función si no existe en caché
 *
 * Patrón comúnmentilizado para evitar hits a BD repetidos
 *
 * @param key - Clave del caché
 * @param fetcher - Función que obtiene el valor
 * @param expirationSeconds - Segundos de expiración
 */
export declare function obtenerOEjecutar<T = any>(key: string, fetcher: () => Promise<T>, expirationSeconds?: number): Promise<T>;
/**
 * Rate limiting usando Redis
 *
 * Implementa algoritmo sliding window simple
 *
 * @param key - Identificador (ej: IP del cliente)
 * @param limite - Máximo de requests permitidos
 * @param ventanaSegundos - Ventana de tiempo en segundos
 * @returns { permitido: boolean, intentosRestantes: number, resetEn: number }
 */
export declare function verificarRateLimit(key: string, limite: number, ventanaSegundos: number): Promise<{
    permitido: boolean;
    intentosRestantes: number;
    resetEn: number;
}>;
/**
 * Obtener estadísticas de Redis
 */
export declare function obtenerEstadisticasRedis(): Promise<any>;
/**
 * Cerrar conexión a Redis
 *
 * Se ejecuta al shutdown de la aplicación
 */
export declare function cerrarRedis(): Promise<void>;
/**
 * Inicializar limpieza automática de caché
 *
 * Limpia claves expiradas según políticas definidas
 */
export declare function inicializarLimpiezaAutomaticaCache(): void;
//# sourceMappingURL=redis.d.ts.map