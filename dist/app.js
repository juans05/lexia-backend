/**
 * LexAI Perú - Backend Application
 *
 * Aplicación Express.js principal:
 * - Inicialización de middleware
 * - Rutas de la API
 * - Manejo de errores global
 * - Health checks
 *
 * Inicia con: npm run dev
 * Build con: npm run build
 * Producción: npm start
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config, { validarConfiguracion, imprimirConfiguracion } from './config/env.js';
import logger, { imprimirInfoLogger } from './config/logger.js';
import { inicializarPool, verificarConexion, cerrarPool, inicializarLimpiezaAutomaticaPool, } from './config/database.js';
import { inicializarRedis, cerrarRedis, inicializarLimpiezaAutomaticaCache, } from './config/redis.js';
import { inicializarLimpiezaAutomaticaSesiones } from './services/session.service.js';
import { inicializarLimpiezaAutomaticaAudit } from './services/audit.service.js';
import { inicializarLimpiezaLoginAttempts } from './middleware/auth.middleware.js';
import { MigrationRunner } from './database/migrations.js';
// Importar rutas
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
// Crear aplicación Express
const app = express();
// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================
// Validar configuración de entorno
try {
    validarConfiguracion();
    imprimirConfiguracion();
    imprimirInfoLogger();
}
catch (error) {
    logger.error('Error en configuración:', error);
    process.exit(1);
}
// ============================================================================
// MIDDLEWARE DE SEGURIDAD
// ============================================================================
// Helmet: Asegurar headers HTTP
app.use(helmet());
// CORS
if (config.security.corsEnabled) {
    app.use(cors({
        origin: config.security.corsOrigins,
        credentials: true,
        optionsSuccessStatus: 200,
    }));
    logger.info(`✓ CORS habilitado para: ${config.security.corsOrigins.join(', ')}`);
}
// Rate limiting global
if (config.security.rateLimitEnabled) {
    const limiter = rateLimit({
        windowMs: config.security.rateLimitWindowMs,
        max: config.security.rateLimitMaxRequests,
        message: 'Demasiadas solicitudes, intenta más tarde',
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(limiter);
    logger.info('✓ Rate limiting habilitado');
}
// ============================================================================
// MIDDLEWARE DE PARSING
// ============================================================================
// JSON parser
app.use(express.json({ limit: '1mb' }));
// URL encoded parser
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// ============================================================================
// LOGGING DE REQUESTS
// ============================================================================
app.use((req, res, next) => {
    const inicio = Date.now();
    // Interceptar respuesta para registrar
    const originalSend = res.send;
    res.send = function (data) {
        const tiempoMs = Date.now() - inicio;
        const statusCode = res.statusCode;
        logger.requestAPI(req.method, req.path, statusCode, tiempoMs);
        return originalSend.call(this, data);
    };
    next();
});
// ============================================================================
// RUTAS
// ============================================================================
// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});
// Status endpoint (con detalles en desarrollo)
app.get('/api/status', async (req, res) => {
    try {
        const conBD = await verificarConexion();
        res.status(200).json({
            status: conBD ? 'operacional' : 'degradado',
            servicio: 'lexai-peru-backend',
            versión: '0.1.0',
            ambiente: config.nodeEnv,
            baseDatos: conBD ? 'conectada' : 'desconectada',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'error',
            mensaje: 'Servicio no disponible',
        });
    }
});
// Rutas de autenticación
app.use('/api/auth', authRoutes);
// Rutas de usuarios
app.use('/api/users', usersRoutes);
// ============================================================================
// RUTAS NO ENCONTRADAS (404)
// ============================================================================
app.use((req, res) => {
    logger.warn(`Ruta no encontrada: ${req.method} ${req.path}`);
    res.status(404).json({
        error: 'No encontrado',
        ruta: req.path,
        metodo: req.method,
        codigo: 'NOT_FOUND',
    });
});
// ============================================================================
// MANEJO DE ERRORES GLOBAL
// ============================================================================
app.use((error, req, res, next) => {
    logger.errorConContexto('Error no manejado', error, {
        endpoint: req.path,
        metodo: req.method,
    });
    const statusCode = error.statusCode || 500;
    const mensaje = config.isDevelopment ? error.message : 'Error interno del servidor';
    res.status(statusCode).json({
        error: 'Error en servidor',
        mensaje,
        ...(config.isDevelopment && { stack: error.stack }),
    });
});
// ============================================================================
// INICIALIZACIÓN
// ============================================================================
let servidor = null;
export async function iniciarServidor() {
    try {
        logger.info('🚀 Iniciando servidor LexAI Perú...\n');
        // Paso 1: Inicializar conexión a PostgreSQL
        logger.info('📦 Inicializando base de datos...');
        const pool = inicializarPool();
        const bdConectada = await verificarConexion();
        if (!bdConectada) {
            throw new Error('No se pudo conectar a la base de datos');
        }
        // Paso 2: Ejecutar migraciones
        logger.info('\n📊 Ejecutando migraciones...');
        const migrationRunner = new MigrationRunner(pool);
        try {
            await migrationRunner.up();
        }
        catch (error) {
            logger.error('Error en migraciones:', error);
            // Continuar aunque fallen las migraciones (podrían estar ya ejecutadas)
        }
        // Paso 3: Inicializar Redis (opcional)
        logger.info('\n🔴 Inicializando Redis...');
        try {
            await inicializarRedis();
            inicializarLimpiezaAutomaticaCache();
        }
        catch (error) {
            logger.warn('Redis no disponible (continuando sin cache)');
        }
        // Paso 4: Inicializar trabajos de limpieza automática
        logger.info('\n🧹 Inicializando trabajos de mantenimiento...');
        inicializarLimpiezaAutomaticaSesiones();
        inicializarLimpiezaAutomaticaAudit();
        inicializarLimpiezaAutomaticaPool();
        inicializarLimpiezaLoginAttempts();
        // Paso 5: Iniciar servidor HTTP
        logger.info(`\n🌐 Iniciando servidor en puerto ${config.port}...\n`);
        servidor = app.listen(config.port, () => {
            logger.info(`✅ SERVIDOR OPERACIONAL`);
            logger.info(`📍 http://localhost:${config.port}`);
            logger.info(`📍 Ambiente: ${config.nodeEnv}`);
            logger.info(`📍 Base datos: ${config.database.url.replace(/:\/\/.*@/, '://*****@')}\n`);
        });
        // Logging de startup
        logger.info('═══════════════════════════════════════════════════════════');
        logger.info('LexAI Perú - Backend API');
        logger.info('Plataforma de Consultoría Legal');
        logger.info('═══════════════════════════════════════════════════════════\n');
    }
    catch (error) {
        logger.error('❌ Error durante inicialización:', error);
        process.exit(1);
    }
}
// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
async function detenerServidor() {
    logger.info('\n🛑 Deteniendo servidor...');
    if (servidor) {
        servidor.close(async () => {
            logger.info('✓ Servidor HTTP cerrado');
            try {
                await cerrarPool();
            }
            catch (error) {
                logger.error('Error al cerrar pool:', error);
            }
            try {
                await cerrarRedis();
            }
            catch (error) {
                logger.error('Error al cerrar Redis:', error);
            }
            logger.info('✓ Aplicación detenida correctamente\n');
            process.exit(0);
        });
        // Timeout para forzar shutdown si algo se queda colgado
        setTimeout(() => {
            logger.warn('⚠️  Forzando shutdown (timeout)');
            process.exit(1);
        }, 10000);
    }
    else {
        process.exit(0);
    }
}
// Capturar signals
process.on('SIGTERM', detenerServidor);
process.on('SIGINT', detenerServidor);
// Capturar excepciones no manejadas
process.on('uncaughtException', (error) => {
    logger.error('❌ Excepción no capturada:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Promesa rechazada no manejada:', {
        reason,
        promise,
    });
    process.exit(1);
});
// ============================================================================
// EXPORTAR Y EJECUTAR
// ============================================================================
export default app;
// Iniciar servidor
iniciarServidor();
//# sourceMappingURL=app.js.map