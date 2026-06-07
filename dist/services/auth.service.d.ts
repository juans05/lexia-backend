/**
 * LexAI Perú - Authentication Service
 *
 * Servicio que maneja toda la lógica de autenticación:
 * - Hash y verificación de contraseñas con bcrypt
 * - Generación y validación de JWT tokens
 * - Gestión de refresh tokens
 * - Expiración y revocación de sesiones
 *
 * Tokens:
 * - Access Token: 24 horas (corta duración)
 * - Refresh Token: 7 días (larga duración)
 */
/**
 * Interface para payload del JWT
 */
export interface TokenPayload {
    usuario_id: string;
    email: string;
    iat?: number;
    exp?: number;
}
/**
 * Interface para tokens generados
 */
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
/**
 * Servicio de Autenticación
 */
export declare class AuthService {
    private readonly SALT_ROUNDS;
    private readonly ACCESS_TOKEN_EXPIRY;
    private readonly REFRESH_TOKEN_EXPIRY;
    private readonly JWT_SECRET;
    private readonly JWT_REFRESH_SECRET;
    /**
     * Hash una contraseña usando bcrypt
     *
     * @param password - Contraseña en texto plano
     * @returns Hash de la contraseña
     * @throws Error si el hash falla
     *
     * Nota: bcrypt es lento (seguro) - ~100ms por hash
     */
    hashPassword(password: string): Promise<string>;
    /**
     * Verifica una contraseña contra su hash
     *
     * @param password - Contraseña en texto plano
     * @param hash - Hash almacenado en BD
     * @returns true si la contraseña es correcta
     *
     * Nota: Usa bcrypt.compare que es time-safe contra timing attacks
     */
    verifyPassword(password: string, hash: string): Promise<boolean>;
    /**
     * Genera un par de tokens (access + refresh)
     *
     * @param usuarioId - ID del usuario en UUID
     * @param email - Email del usuario
     * @returns Objeto con access token, refresh token y expiración
     *
     * Estrategia de tokens:
     * - Access Token: Corto (24h), enviado en cada request
     * - Refresh Token: Largo (7d), almacenado seguro para renovar access
     */
    generateTokens(usuarioId: string, email: string): Promise<TokenPair>;
    /**
     * Verifica y decodifica un token JWT
     *
     * @param token - Token JWT
     * @param isRefreshToken - Si es un refresh token (usa otra secret key)
     * @returns Payload decodificado
     * @throws Error si el token es inválido o expirado
     */
    verifyToken(token: string, isRefreshToken?: boolean): TokenPayload;
    /**
     * Genera un nuevo access token usando el refresh token
     *
     * @param refreshToken - Token de refresh válido
     * @returns Nuevo access token
     * @throws Error si el refresh token es inválido o expirado
     *
     * Caso de uso: El cliente envía su refresh token cuando el access token expira
     */
    refreshAccessToken(refreshToken: string): Promise<string>;
    /**
     * Genera un token de verificación para email o reseteo de contraseña
     *
     * @param tipo - 'email_verificacion' o 'reseteo_contraseña'
     * @returns Token en texto plano (se debe hashear antes de guardar en BD)
     *
     * El token es:
     * - Aleatorio (32 bytes = 64 caracteres hex)
     * - Sin expiración incorporada (la BD maneja la expiración)
     * - Debe ser hasheado antes de guardar
     */
    generateVerificationToken(tipo: 'email_verificacion' | 'reseteo_contraseña'): string;
    /**
     * Hash de un token de verificación (para guardar en BD)
     *
     * @param token - Token en texto plano
     * @returns Token hasheado
     */
    hashVerificationToken(token: string): Promise<string>;
    /**
     * Verifica si un token de verificación es válido
     *
     * @param token - Token en texto plano
     * @param hash - Hash almacenado en BD
     * @returns true si coincide
     */
    verifyVerificationToken(token: string, hash: string): Promise<boolean>;
    /**
     * Genera un hash para almacenar refresh tokens en tabla de sesiones
     *
     * @param refreshToken - Token de refresh
     * @returns Hash para almacenar
     */
    hashRefreshToken(refreshToken: string): Promise<string>;
}
export declare const authService: AuthService;
/**
 * Helper: Extraer token del header Authorization
 *
 * @param authHeader - Valor del header Authorization
 * @returns Token sin "Bearer " prefix
 * @throws Error si el formato es inválido
 *
 * Formato esperado: "Bearer <token>"
 */
export declare function extractBearerToken(authHeader?: string): string;
/**
 * Helper: Validar estructura básica de JWT sin verificar firma
 *
 * @param token - Token a validar
 * @returns true si tiene estructura válida
 */
export declare function isValidJWTStructure(token: string): boolean;
//# sourceMappingURL=auth.service.d.ts.map