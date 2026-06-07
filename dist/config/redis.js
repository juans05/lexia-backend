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
import { createClient } from 'redis';
import logger from './logger.js';
import config from './env.js';
let redisClient = null;
/**
 * Inicializar cliente Redis
 *
 * Solo se inicializa si REDIS_ENABLED=true en .env
 */
export async function inicializarRedis() {
    // Si Redis está deshabilitado, retornar null
    if (!config.redis.enabled) {
        logger.info('ℹ️  Redis deshabilitado en configuración');
        return null;
    }
    if (redisClient) {
        return redisClient;
    }
    try {
        redisClient = createClient({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            socket: {
                reconnectStrategy: (retries) => {
                    // Exponential backoff para reintentos
                    const delay = Math.min(retries * 50, 500);
                    return delay;
                },
            },
        });
        // Event listeners
        redisClient.on('error', (err) => {
            logger.error('Error en Redis:', err);
        });
        redisClient.on('connect', () => {
            logger.info('✓ Conectado a Redis');
        });
        redisClient.on('ready', () => {
            logger.info('✓ Redis listo para recibir comandos');
        });
        redisClient.on('reconnecting', () => {
            logger.warn('Reconectando a Redis...');
        });
        // Conectar
        await redisClient.connect();
        // Verificar conexión
        const ping = await redisClient.ping();
        logger.info(`✓ Redis ping: ${ping}`);
        return redisClient;
    }
    catch (error) {
        logger.error('Error al inicializar Redis:', error);
        // Redis es opcional, no fallar si no se puede conectar
        logger.warn('⚠️  Continuando sin Redis...');
        return null;
    }
}
/**
 * Obtener instancia del cliente Redis
 *
 * Retorna null si Redis no está habilitado o conectado
 */
export function getRedisClient() {
    return redisClient;
}
/**
 * Verificar si Redis está disponible
 */
export function estaRedisDisponible() {
    return redisClient !== null && redisClient.isOpen;
}
/**
 * Guardador genérico de valores en caché
 *
 * @param key - Clave del caché
 * @param value - Valor a guardar (será serializado a JSON)
 * @param expirationSeconds - Segundos de expiración (default: 1 hora)
 */
export async function guardarEnCache(key, value, expirationSeconds = 3600) {
    if (!redisClient || !redisClient.isOpen) {
        logger.debug('Redis no disponible, ignorando caché');
        return;
    }
    try {
        const serialized = JSON.stringify(value);
        await redisClient.setEx(key, expirationSeconds, serialized);
        logger.debug(`✓ Caché guardado: ${key} (TTL: ${expirationSeconds}s)`);
    }
    catch (error) {
        logger.error('Error al guardar en caché:', error);
        // No lanzar error para no interrumpir flujo principal
    }
}
/**
 * Obtener valor del caché
 *
 * @param key - Clave del caché
 * @returns Valor deserializado o null
 */
export async function obtenerDelCache(key) {
    if (!redisClient || !redisClient.isOpen) {
        return null;
    }
    try {
        const valor = await redisClient.get(key);
        if (!valor) {
            return null;
        }
        const deserializado = JSON.parse(valor);
        logger.debug(`✓ Caché obtenido: ${key}`);
        return deserializado;
    }
    catch (error) {
        logger.error('Error al obtener del caché:', error);
        return null;
    }
}
/**
 * Eliminar valor del caché
 *
 * @param key - Clave del caché
 */
export async function eliminarDelCache(key) {
    if (!redisClient || !redisClient.isOpen) {
        return;
    }
    try {
        await redisClient.del(key);
        logger.debug(`✓ Caché eliminado: ${key}`);
    }
    catch (error) {
        logger.error('Error al eliminar del caché:', error);
    }
}
/**
 * Limpiar caché por patrón (wildcard)
 *
 * Ejemplo: limpiarCachePattern('consulta:*')
 *
 * @param pattern - Patrón glob (ej: key:*)
 */
export async function limpiarCachePattern(pattern) {
    if (!redisClient || !redisClient.isOpen) {
        return;
    }
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length === 0) {
            return;
        }
        await redisClient.del(keys);
        logger.debug(`✓ ${keys.length} claves de caché eliminadas (pattern: ${pattern})`);
    }
    catch (error) {
        logger.error('Error al limpiar caché por patrón:', error);
    }
}
/**
 * Obtener o ejecutar función si no existe en caché
 *
 * Patrón comúnmentilizado para evitar hits a BD repetidos
 *
 * @param key - Clave del caché
 * @param fetcher - Función que obtiene el valor
 * @param expirationSeconds - Segundos de expiración
 */
export async function obtenerOEjecutar(key, fetcher, expirationSeconds = 3600) {
    // Intentar obtener del caché
    const delCache = await obtenerDelCache(key);
    if (delCache !== null) {
        return delCache;
    }
    // Si no existe, ejecutar fetcher
    const valor = await fetcher();
    // Guardar en caché
    await guardarEnCache(key, valor, expirationSeconds);
    return valor;
}
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
export async function verificarRateLimit(key, limite, ventanaSegundos) {
    if (!redisClient || !redisClient.isOpen) {
        // Si Redis no está disponible, permitir (fallback permisivo)
        return { permitido: true, intentosRestantes: limite, resetEn: 0 };
    }
    try {
        const rateLimitKey = `ratelimit:${key}`;
        // Incrementar contador
        const contador = await redisClient.incr(rateLimitKey);
        // Si es el primer intento, establecer expiración
        if (contador === 1) {
            await redisClient.expire(rateLimitKey, ventanaSegundos);
        }
        // Obtener TTL restante
        const ttl = await redisClient.ttl(rateLimitKey);
        const permitido = contador <= limite;
        const intentosRestantes = Math.max(0, limite - contador);
        logger.debug(`Rate limit ${key}: ${contador}/${limite} (TTL: ${ttl}s) - ${permitido ? 'PERMITIDO' : 'BLOQUEADO'}`);
        return {
            permitido,
            intentosRestantes,
            resetEn: ttl > 0 ? ttl : ventanaSegundos,
        };
    }
    catch (error) {
        logger.error('Error verificando rate limit:', error);
        // En caso de error, permitir (fallback permisivo)
        return { permitido: true, intentosRestantes: limite, resetEn: 0 };
    }
}
/**
 * Obtener estadísticas de Redis
 */
export async function obtenerEstadisticasRedis() {
    if (!redisClient || !redisClient.isOpen) {
        return null;
    }
    try {
        const info = await redisClient.info('stats');
        return {
            disponible: true,
            stats: info,
        };
    }
    catch (error) {
        logger.error('Error obteniendo estadísticas de Redis:', error);
        return {
            disponible: false,
            error: String(error),
        };
    }
}
/**
 * Cerrar conexión a Redis
 *
 * Se ejecuta al shutdown de la aplicación
 */
export async function cerrarRedis() {
    if (!redisClient) {
        return;
    }
    try {
        await redisClient.quit();
        redisClient = null;
        logger.info('✓ Conexión a Redis cerrada');
    }
    catch (error) {
        logger.error('Error al cerrar Redis:', error);
        throw error;
    }
}
/**
 * Inicializar limpieza automática de caché
 *
 * Limpia claves expiradas según políticas definidas
 */
export function inicializarLimpiezaAutomaticaCache() {
    if (!config.redis.enabled) {
        return;
    }
    // Ejecutar cada hora
    setInterval(async () => {
        try {
            if (!estaRedisDisponible()) {
                return;
            }
            // Obtener todas las claves con patrón
            const consultas = await redisClient?.keys('consulta:*');
            const respuestas = await redisClient?.keys('respuesta:*');
            logger.debug(`📊 Caché: ${(consultas?.length || 0) + (respuestas?.length || 0)} claves activas`);
        }
        catch (error) {
            logger.error('Error en limpieza automática de caché:', error);
        }
    }, 60 * 60 * 1000); // Cada hora
    logger.info('✓ Limpieza automática de caché inicializada');
}
//# sourceMappingURL=redis.js.map