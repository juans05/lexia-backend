/**
 * LexAI Perú - Validation Utilities
 *
 * Funciones de validación específicas para Perú:
 * - Validar teléfonos peruanos
 * - Validar RUC
 * - Validar DNI
 * - Validar email
 * - Validar contraseña
 */
/**
 * Validar teléfono peruano
 *
 * Formato: +51XXXXXXXXX (9 dígitos después del +51)
 * Ejemplos: +51912345678, +51987654321
 *
 * @param telefono - Teléfono a validar
 * @returns true si es válido
 */
export declare function esTeléfonoPeruanoValido(telefono: string): boolean;
/**
 * Normalizar teléfono peruano
 *
 * Convierte variaciones como:
 * - "912345678" -> "+51912345678"
 * - "01 912345678" -> "+51912345678"
 * - "+51912345678" -> "+51912345678"
 *
 * @param telefono - Teléfono a normalizar
 * @returns Teléfono normalizado o null si no es válido
 */
export declare function normalizarTeléfonoPeruano(telefono: string): string | null;
/**
 * Validar RUC (Registro Único de Contribuyente) peruano
 *
 * El RUC tiene 20 dígitos (SSSSSSSSSSSSSSSSSSSS)
 * Formato: 2 dígitos tipo documento + 8 dígitos número + 10 dígitos adicionales
 *
 * @param ruc - RUC a validar
 * @returns true si es válido
 */
export declare function esRUCValido(ruc: string): boolean;
/**
 * Validar DNI (Documento Nacional de Identidad) peruano
 *
 * El DNI tiene 8 dígitos
 *
 * @param dni - DNI a validar
 * @returns true si es válido
 */
export declare function esDNIValido(dni: string): boolean;
/**
 * Validar email
 *
 * @param email - Email a validar
 * @returns true si es válido
 */
export declare function esEmailValido(email: string): boolean;
/**
 * Validar contraseña
 *
 * Requerimientos:
 * - Mínimo 8 caracteres
 * - Al menos una mayúscula
 * - Al menos una minúscula
 * - Al menos un número
 *
 * @param password - Contraseña a validar
 * @returns { valido: boolean, errores: string[] }
 */
export declare function validarContrasena(password: string): {
    valido: boolean;
    errores: string[];
};
/**
 * Validar nombre (no vacío, no muy corto, no números)
 *
 * @param nombre - Nombre a validar
 * @returns true si es válido
 */
export declare function esNombreValido(nombre: string): boolean;
/**
 * Validar que dos valores sean iguales (contraseñas, etc)
 *
 * @param valor1 - Primer valor
 * @param valor2 - Segundo valor
 * @returns true si coinciden
 */
export declare function sonIguales(valor1: string, valor2: string): boolean;
/**
 * Sanitizar entrada de usuario (prevenir XSS)
 *
 * @param input - Texto a sanitizar
 * @returns Texto sanitizado
 */
export declare function sanitizar(input: string): string;
/**
 * Validar que es una URL válida
 *
 * @param url - URL a validar
 * @returns true si es válida
 */
export declare function esURLValida(url: string): boolean;
/**
 * Validar UUID v4
 *
 * @param uuid - UUID a validar
 * @returns true si es válido
 */
export declare function esUUIDValido(uuid: string): boolean;
/**
 * Extraer dominio de email
 *
 * @param email - Email
 * @returns Dominio (ej: "example.com") o null
 */
export declare function extraerDominioEmail(email: string): string | null;
/**
 * Detectar si un email es temporal/desechable
 *
 * @param email - Email a validar
 * @returns true si es probable que sea temporal
 */
export declare function esEmailTemporal(email: string): boolean;
//# sourceMappingURL=validators.d.ts.map