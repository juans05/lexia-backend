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

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config, { validarConfiguracion, imprimirConfiguracion } from './config/env.js';
import logger, { imprimirInfoLogger } from './config/logger.js';
import {
  inicializarPool,
  verificarConexion,
  cerrarPool,
  inicializarLimpiezaAutomaticaPool,
} from './config/database.js';
import {
  inicializarRedis,
  cerrarRedis,
  inicializarLimpiezaAutomaticaCache,
} from './config/redis.js';
import { inicializarLimpiezaAutomaticaSesiones } from './services/session.service.js';
import { inicializarLimpiezaAutomaticaAudit } from './services/audit.service.js';
import { inicializarLimpiezaLoginAttempts } from './middleware/auth.middleware.js';
import { MigrationRunner } from './database/migrations.js';

// Importar rutas
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import abogadosRoutes from './routes/abogados.routes.js';
import adminRoutes from './routes/admin.routes.js';
import consultasRoutes from './routes/consultas.routes.js';

// Crear aplicación Express
const app: Express = express();

// ============================================================================
// CONFIGURACIÓN GLOBAL
// ============================================================================

// Validar configuración de entorno
try {
  validarConfiguracion();
  imprimirConfiguracion();
  imprimirInfoLogger();
} catch (error) {
  logger.error('Error en configuración:', error);
  process.exit(1);
}

// ============================================================================
// MIDDLEWARE DE SEGURIDAD
// ============================================================================

// CORS (DEBE IR ANTES QUE HELMET)
if (config.security.corsEnabled) {
  app.use(
    cors({
      origin: config.security.corsOrigins,
      credentials: true,
      optionsSuccessStatus: 200,
    })
  );

  logger.info(`✓ CORS habilitado para: ${config.security.corsOrigins.join(', ')}`);
}

// Helmet: Asegurar headers HTTP
app.use(helmet());

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

app.use((req: Request, res: Response, next: NextFunction) => {
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
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Status endpoint (con detalles en desarrollo)
app.get('/api/status', async (req: Request, res: Response) => {
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
  } catch (error) {
    res.status(503).json({
      status: 'error',
      mensaje: 'Servicio no disponible',
    });
  }
});

// Rate limit estricto para auth (5 intentos / 15 min por IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // no cuenta los requests exitosos
});

// Rate limit para registro (3 cuentas / hora por IP)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Límite de registros alcanzado. Intenta en una hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de usuarios
app.use('/api/users', usersRoutes);

// Módulo abogados
app.use('/api/abogados', abogadosRoutes);
app.use('/api/admin', adminRoutes);

// Módulo consultas
app.use('/api/consultas', consultasRoutes);

// ============================================================================
// RUTAS NO ENCONTRADAS (404)
// ============================================================================

app.use((req: Request, res: Response) => {
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

app.use((error: any, req: Request, res: Response, next: NextFunction) => {
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

let servidor: any = null;

export async function iniciarServidor(): Promise<void> {
  try {
    console.log('📍 STARTUP v2.0 - Server initializing...');
    logger.info('🚀 Iniciando servidor LexAI Perú...');

    // SOLO INICIAR SERVIDOR - Sin esperar nada
    logger.info(`🌐 Iniciando en puerto ${config.port}`);

    servidor = app.listen(config.port, () => {
      logger.info(`✅ SERVIDOR OPERACIONAL en puerto ${config.port}`);
    });

    // TODO lo demás en background - no bloquear
    setImmediate(async () => {
      try {
        logger.info('📦 Inicializando pool de PostgreSQL (background)...');
        const pool = inicializarPool();
        logger.info('✓ Pool inicializado');

        logger.info('🔍 Verificando conexión a BD...');
        await verificarConexion();
        logger.info('✓ BD verificada');

        logger.info('📊 Ejecutando migraciones...');
        const migrationRunner = new MigrationRunner(pool);
        await migrationRunner.up();
        logger.info('✓ Migraciones completadas');

        logger.info('🔴 Conectando a Redis...');
        await inicializarRedis();
        inicializarLimpiezaAutomaticaCache();
        logger.info('✓ Redis conectado');

        logger.info('🧹 Inicializando trabajos...');
        inicializarLimpiezaAutomaticaSesiones();
        inicializarLimpiezaAutomaticaAudit();
        inicializarLimpiezaAutomaticaPool();
        inicializarLimpiezaLoginAttempts();
        logger.info('✓ Todo inicializado correctamente');
      } catch (error) {
        logger.warn('⚠️  Error en inicialización en background:', error);
      }
    });
  } catch (error) {
    logger.error('❌ Error crítico:', error);
    process.exit(1);
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

async function detenerServidor(): Promise<void> {
  logger.info('\n🛑 Deteniendo servidor...');

  if (servidor) {
    servidor.close(async () => {
      logger.info('✓ Servidor HTTP cerrado');

      try {
        await cerrarPool();
      } catch (error) {
        logger.error('Error al cerrar pool:', error);
      }

      try {
        await cerrarRedis();
      } catch (error) {
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
  } else {
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
