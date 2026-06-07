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

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import logger from '../config/logger.js';

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
  expiresIn: number; // En segundos
}

/**
 * Servicio de Autenticación
 */
export class AuthService {
  // Configuración de tokens (puede venir del .env)
  private readonly SALT_ROUNDS = 10; // Para bcrypt
  private readonly ACCESS_TOKEN_EXPIRY = '24h'; // 24 horas
  private readonly REFRESH_TOKEN_EXPIRY = '7d'; // 7 días
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'lexai-secret-key-dev';
  private readonly JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET || 'lexai-refresh-secret-key-dev';

  /**
   * Hash una contraseña usando bcrypt
   *
   * @param password - Contraseña en texto plano
   * @returns Hash de la contraseña
   * @throws Error si el hash falla
   *
   * Nota: bcrypt es lento (seguro) - ~100ms por hash
   */
  async hashPassword(password: string): Promise<string> {
    try {
      // Validación básica
      if (!password || password.length < 8) {
        throw new Error('Contraseña debe tener al menos 8 caracteres');
      }

      const hash = await bcrypt.hash(password, this.SALT_ROUNDS);

      logger.debug('✓ Contraseña hasheada correctamente');
      return hash;
    } catch (error) {
      logger.error('Error al hashear contraseña:', error);
      throw error;
    }
  }

  /**
   * Verifica una contraseña contra su hash
   *
   * @param password - Contraseña en texto plano
   * @param hash - Hash almacenado en BD
   * @returns true si la contraseña es correcta
   *
   * Nota: Usa bcrypt.compare que es time-safe contra timing attacks
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const esValida = await bcrypt.compare(password, hash);
      return esValida;
    } catch (error) {
      logger.error('Error al verificar contraseña:', error);
      return false;
    }
  }

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
  async generateTokens(usuarioId: string, email: string): Promise<TokenPair> {
    try {
      // Access Token - Short-lived
      const accessToken = jwt.sign(
        { usuario_id: usuarioId, email } as TokenPayload,
        this.JWT_SECRET,
        { expiresIn: this.ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' }
      );

      // Refresh Token - Long-lived
      const refreshToken = jwt.sign(
        { usuario_id: usuarioId, email, type: 'refresh' } as TokenPayload,
        this.JWT_REFRESH_SECRET,
        { expiresIn: this.REFRESH_TOKEN_EXPIRY, algorithm: 'HS256' }
      );

      // Calcular expiración en segundos (24 horas)
      const expiresIn = 24 * 60 * 60;

      logger.debug(`✓ Tokens generados para usuario: ${usuarioId}`);

      return {
        accessToken,
        refreshToken,
        expiresIn,
      };
    } catch (error) {
      logger.error('Error al generar tokens:', error);
      throw error;
    }
  }

  /**
   * Verifica y decodifica un token JWT
   *
   * @param token - Token JWT
   * @param isRefreshToken - Si es un refresh token (usa otra secret key)
   * @returns Payload decodificado
   * @throws Error si el token es inválido o expirado
   */
  verifyToken(token: string, isRefreshToken: boolean = false): TokenPayload {
    try {
      const secret = isRefreshToken ? this.JWT_REFRESH_SECRET : this.JWT_SECRET;

      const decoded = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      });

      return decoded as TokenPayload;
    } catch (error) {
      const errorMsg =
        error instanceof jwt.TokenExpiredError
          ? 'Token expirado'
          : error instanceof jwt.JsonWebTokenError
            ? 'Token inválido'
            : 'Error al verificar token';

      logger.warn(`Token verification failed: ${errorMsg}`);

      throw new Error(errorMsg);
    }
  }

  /**
   * Genera un nuevo access token usando el refresh token
   *
   * @param refreshToken - Token de refresh válido
   * @returns Nuevo access token
   * @throws Error si el refresh token es inválido o expirado
   *
   * Caso de uso: El cliente envía su refresh token cuando el access token expira
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      // Validar refresh token
      const decoded = this.verifyToken(refreshToken, true);

      // Generar nuevo access token
      const newAccessToken = jwt.sign(
        { usuario_id: decoded.usuario_id, email: decoded.email } as TokenPayload,
        this.JWT_SECRET,
        { expiresIn: this.ACCESS_TOKEN_EXPIRY, algorithm: 'HS256' }
      );

      logger.debug(
        `✓ Access token renovado para usuario: ${decoded.usuario_id}`
      );

      return newAccessToken;
    } catch (error) {
      logger.error('Error al renovar access token:', error);
      throw error;
    }
  }

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
  generateVerificationToken(tipo: 'email_verificacion' | 'reseteo_contraseña'): string {
    try {
      // Generar 32 bytes aleatorios y convertir a hex
      const token = randomBytes(32).toString('hex');

      logger.debug(`✓ Token de ${tipo} generado`);

      return token;
    } catch (error) {
      logger.error(`Error al generar token de ${tipo}:`, error);
      throw error;
    }
  }

  /**
   * Hash de un token de verificación (para guardar en BD)
   *
   * @param token - Token en texto plano
   * @returns Token hasheado
   */
  async hashVerificationToken(token: string): Promise<string> {
    try {
      // Usar bcrypt para hashear el token
      const hash = await bcrypt.hash(token, 5); // Menos rounds que contraseña
      return hash;
    } catch (error) {
      logger.error('Error al hashear token de verificación:', error);
      throw error;
    }
  }

  /**
   * Verifica si un token de verificación es válido
   *
   * @param token - Token en texto plano
   * @param hash - Hash almacenado en BD
   * @returns true si coincide
   */
  async verifyVerificationToken(token: string, hash: string): Promise<boolean> {
    try {
      const esValido = await bcrypt.compare(token, hash);
      return esValido;
    } catch (error) {
      logger.error('Error al verificar token:', error);
      return false;
    }
  }

  /**
   * Genera un hash para almacenar refresh tokens en tabla de sesiones
   *
   * @param refreshToken - Token de refresh
   * @returns Hash para almacenar
   */
  async hashRefreshToken(refreshToken: string): Promise<string> {
    try {
      const hash = await bcrypt.hash(refreshToken, 8);
      return hash;
    } catch (error) {
      logger.error('Error al hashear refresh token:', error);
      throw error;
    }
  }
}

// Crear instancia global del servicio
export const authService = new AuthService();

/**
 * Helper: Extraer token del header Authorization
 *
 * @param authHeader - Valor del header Authorization
 * @returns Token sin "Bearer " prefix
 * @throws Error si el formato es inválido
 *
 * Formato esperado: "Bearer <token>"
 */
export function extractBearerToken(authHeader?: string): string {
  if (!authHeader || typeof authHeader !== 'string') {
    throw new Error('Authorization header missing or invalid');
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new Error('Invalid authorization header format. Expected: Bearer <token>');
  }

  return parts[1];
}

/**
 * Helper: Validar estructura básica de JWT sin verificar firma
 *
 * @param token - Token a validar
 * @returns true si tiene estructura válida
 */
export function isValidJWTStructure(token: string): boolean {
  try {
    const parts = token.split('.');
    return parts.length === 3; // JWT siempre tiene 3 partes (header.payload.signature)
  } catch {
    return false;
  }
}
