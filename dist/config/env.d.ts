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
/**
 * Objeto de configuración validado
 */
export declare const config: {
    nodeEnv: string;
    isProduction: boolean;
    isDevelopment: boolean;
    port: number;
    apiBaseUrl: string;
    frontendUrl: string;
    database: {
        url: string;
        poolMax: number;
        poolIdleTimeout: number;
    };
    redis: {
        host: string;
        port: number;
        password: string | undefined;
        enabled: boolean;
    };
    jwt: {
        secret: string;
        refreshSecret: string;
        accessTokenExpiry: string;
        refreshTokenExpiry: string;
    };
    services: {
        claude: {
            apiKey: string;
            enabled: boolean;
        };
        mercadoPago: {
            accessToken: string;
            enabled: boolean;
        };
        sendGrid: {
            apiKey: string;
            fromEmail: string;
            enabled: boolean;
        };
        resend: {
            apiKey: string;
            fromEmail: string;
        };
    };
    logging: {
        level: string;
        format: string;
    };
    security: {
        corsEnabled: boolean;
        corsOrigins: string[];
        rateLimitEnabled: boolean;
        rateLimitWindowMs: number;
        rateLimitMaxRequests: number;
    };
    business: {
        consultasGratuitasMensuales: number;
        precioConsultaSoles: number;
        comisionLexAi: number;
    };
};
/**
 * Validar configuración crítica en startup
 */
export declare function validarConfiguracion(): void;
/**
 * Imprimir configuración (sin secretos)
 */
export declare function imprimirConfiguracion(): void;
export default config;
//# sourceMappingURL=env.d.ts.map