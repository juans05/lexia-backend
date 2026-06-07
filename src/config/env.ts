/**
 * LexAI Perú - Environment Configuration
 *
 * Carga y valida variables de entorno.
 * Centraliza toda la configuración en un objeto tipado.
 *
 * Archivo .env requerido en raíz del proyecto:
 *
 * # NODE
 * NODE_ENV=development
 * PORT=3000
 *
 * # DATABASE
 * DATABASE_URL=postgresql://user:password@host:5432/dbname
 * DB_POOL_MAX=20
 * DB_POOL_IDLE_TIMEOUT=30000
 *
 * # REDIS (Optional)
 * REDIS_HOST=localhost
 * REDIS_PORT=6379
 * REDIS_PASSWORD=optional_password
 *
 * # JWT
 * JWT_SECRET=your-super-secret-jwt-key-min-32-chars
 * JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
 *
 * # API
 * API_BASE_URL=http://localhost:3000
 * FRONTEND_URL=http://localhost:3000
 *
 * # SERVICIOS EXTERNOS
 * CLAUDE_API_KEY=sk-ant-xxxxx
 * MERCADO_PAGO_ACCESS_TOKEN=APP_USR_XXXX
 *
 * # EMAIL
 * SENDGRID_API_KEY=SG.xxxxx
 * SENDGRID_FROM_EMAIL=noreply@lexai-peru.com
 *
 * # LOGGING
 * LOG_LEVEL=debug
 */

import dotenv from 'dotenv';

// Cargar variables del archivo .env
dotenv.config();

/**
 * Validar que una variable de entorno existe
 */
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];

  if (value !== undefined) return value;
  if (defaultValue !== undefined) return defaultValue;

  throw new Error(
    `Variable de entorno requerida no encontrada: ${key}. Verifique archivo .env`
  );
}

/**
 * Validar que una variable es un número
 */
function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];

  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Variable de entorno requerida (número) no encontrada: ${key}`);
  }

  const numValue = parseInt(value, 10);

  if (isNaN(numValue)) {
    throw new Error(`Variable de entorno ${key} debe ser un número válido`);
  }

  return numValue;
}

/**
 * Validar que una variable es booleana
 */
function getEnvBoolean(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];

  if (!value) {
    return defaultValue;
  }

  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Objeto de configuración validado
 */
export const config = {
  // Entorno
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',

  // API
  port: getEnvNumber('PORT', 3000),
  apiBaseUrl: getEnvVar('API_BASE_URL', 'http://localhost:3000'),
  frontendUrl: getEnvVar(
    'FRONTEND_URL',
    'http://localhost:3000'
  ),

  // Base de Datos
  database: {
    url: getEnvVar('DATABASE_URL', 'postgresql://lexai:lexai_dev_password@localhost:5432/lexai_db'),
    poolMax: getEnvNumber('DB_POOL_MAX', 20),
    poolIdleTimeout: getEnvNumber('DB_POOL_IDLE_TIMEOUT', 30000),
  },

  // Redis (opcional)
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: getEnvNumber('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD,
    enabled: getEnvBoolean('REDIS_ENABLED', false),
  },

  // JWT
  jwt: {
    secret: getEnvVar('JWT_SECRET'),
    refreshSecret: getEnvVar('JWT_REFRESH_SECRET'),
    accessTokenExpiry: '24h',
    refreshTokenExpiry: '7d',
  },

  // Servicios Externos
  services: {
    claude: {
      apiKey: getEnvVar('CLAUDE_API_KEY', ''),
      enabled: getEnvBoolean('CLAUDE_ENABLED', true),
    },
    mercadoPago: {
      accessToken: getEnvVar('MERCADO_PAGO_ACCESS_TOKEN', ''),
      enabled: getEnvBoolean('MERCADO_PAGO_ENABLED', false),
    },
    sendGrid: {
      apiKey: getEnvVar('SENDGRID_API_KEY', ''),
      fromEmail: getEnvVar('SENDGRID_FROM_EMAIL', 'noreply@lexai-peru.com'),
      enabled: getEnvBoolean('SENDGRID_ENABLED', false),
    },
    resend: {
      apiKey: getEnvVar('RESEND_API_KEY', ''),
      fromEmail: getEnvVar('RESEND_FROM_EMAIL', 'onboarding@resend.dev'),
    },
  },

  // Logging
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
    format: getEnvVar('LOG_FORMAT', 'combined'),
  },

  // Seguridad
  security: {
    corsEnabled: getEnvBoolean('CORS_ENABLED', true),
    corsOrigins: (() => {
      const origins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim());
      const frontendUrl = getEnvVar('FRONTEND_URL', 'http://localhost:3000').trim();

      // Asegurar que frontendUrl esté incluido
      if (!origins.includes(frontendUrl)) {
        origins.push(frontendUrl);
      }

      return origins;
    })(),
    rateLimitEnabled: getEnvBoolean('RATE_LIMIT_ENABLED', true),
    rateLimitWindowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 min
    rateLimitMaxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
  },

  // Business Rules
  business: {
    consultasGratuitasMensuales: getEnvNumber('CONSULTAS_GRATUITAS_MENSUALES', 3),
    precioConsultaSoles: getEnvNumber('PRECIO_CONSULTA_SOLES', 5),
    comisionLexAi: getEnvNumber('COMISION_LEXAI', 70), // Porcentaje
  },
};

/**
 * Validar configuración crítica en startup
 */
export function validarConfiguracion(): void {
  const errores: string[] = [];

  // Validar JWT secrets
  if (config.jwt.secret.length < 32) {
    errores.push('JWT_SECRET debe tener al menos 32 caracteres');
  }

  if (config.jwt.refreshSecret.length < 32) {
    errores.push('JWT_REFRESH_SECRET debe tener al menos 32 caracteres');
  }

  // Validar URLs
  try {
    new URL(config.apiBaseUrl);
  } catch {
    errores.push('API_BASE_URL debe ser una URL válida');
  }

  try {
    new URL(config.frontendUrl);
  } catch {
    errores.push('FRONTEND_URL debe ser una URL válida');
  }

  // Validar puerto
  if (config.port < 1 || config.port > 65535) {
    errores.push('PORT debe estar entre 1 y 65535');
  }

  if (errores.length > 0) {
    console.error('❌ Errores en configuración:');
    errores.forEach((error) => console.error(`   - ${error}`));
    process.exit(1);
  }

  console.log('✓ Configuración validada correctamente');
}

/**
 * Imprimir configuración (sin secretos)
 */
export function imprimirConfiguracion(): void {
  const configPublica = {
    nodeEnv: config.nodeEnv,
    port: config.port,
    apiBaseUrl: config.apiBaseUrl,
    database: {
      url: config.database.url.replace(/:\/\/.*@/, '://*****@'),  // ocultar credenciales en logs
    },
    jwtExpiry: config.jwt.accessTokenExpiry,
    corsEnabled: config.security.corsEnabled,
    consultasGratuitas: config.business.consultasGratuitasMensuales,
  };

  console.log('📋 Configuración Activa:');
  console.log(JSON.stringify(configPublica, null, 2));
}

export default config;
