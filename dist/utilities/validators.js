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
export function esTeléfonoPeruanoValido(telefono) {
    // Regex: +51 seguido de exactamente 9 dígitos
    const regex = /^\+51[0-9]{9}$/;
    return regex.test(telefono);
}
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
export function normalizarTeléfonoPeruano(telefono) {
    if (!telefono) {
        return null;
    }
    // Remover espacios, guiones, paréntesis
    let limpio = telefono.replace(/[\s\-()]/g, '');
    // Si ya tiene +51, validar directamente
    if (limpio.startsWith('+51')) {
        return esTeléfonoPeruanoValido(limpio) ? limpio : null;
    }
    // Si empieza con 51 (sin +), agregar +
    if (limpio.startsWith('51') && limpio.length === 11) {
        limpio = '+' + limpio;
        return esTeléfonoPeruanoValido(limpio) ? limpio : null;
    }
    // Si empieza con 0, removerlo y agregar +51
    if (limpio.startsWith('0') && limpio.length === 10) {
        limpio = '+51' + limpio.substring(1);
        return esTeléfonoPeruanoValido(limpio) ? limpio : null;
    }
    // Si son 9 dígitos, agregar +51
    if (/^[0-9]{9}$/.test(limpio)) {
        limpio = '+51' + limpio;
        return esTeléfonoPeruanoValido(limpio) ? limpio : null;
    }
    return null;
}
/**
 * Validar RUC (Registro Único de Contribuyente) peruano
 *
 * El RUC tiene 20 dígitos (SSSSSSSSSSSSSSSSSSSS)
 * Formato: 2 dígitos tipo documento + 8 dígitos número + 10 dígitos adicionales
 *
 * @param ruc - RUC a validar
 * @returns true si es válido
 */
export function esRUCValido(ruc) {
    if (!ruc) {
        return false;
    }
    // Debe tener exactamente 20 dígitos
    const regex = /^[0-9]{20}$/;
    if (!regex.test(ruc)) {
        return false;
    }
    // El RUC debe comenzar con 10, 15, 16, 17 o 20 (tipos de documento)
    const tipoDocumento = ruc.substring(0, 2);
    const tiposValidos = ['10', '15', '16', '17', '20'];
    return tiposValidos.includes(tipoDocumento);
}
/**
 * Validar DNI (Documento Nacional de Identidad) peruano
 *
 * El DNI tiene 8 dígitos
 *
 * @param dni - DNI a validar
 * @returns true si es válido
 */
export function esDNIValido(dni) {
    if (!dni) {
        return false;
    }
    const regex = /^[0-9]{8}$/;
    return regex.test(dni);
}
/**
 * Validar email
 *
 * @param email - Email a validar
 * @returns true si es válido
 */
export function esEmailValido(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}
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
export function validarContrasena(password) {
    const errores = [];
    if (!password) {
        return { valido: false, errores: ['Contraseña es requerida'] };
    }
    if (password.length < 8) {
        errores.push('Debe tener al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
        errores.push('Debe contener al menos una mayúscula (A-Z)');
    }
    if (!/[a-z]/.test(password)) {
        errores.push('Debe contener al menos una minúscula (a-z)');
    }
    if (!/[0-9]/.test(password)) {
        errores.push('Debe contener al menos un número (0-9)');
    }
    // Opcional: evitar caracteres especiales comúnmente problemáticos
    if (/[<>\\/"'`]/.test(password)) {
        errores.push('No se permiten caracteres especiales: < > \\ / " \' `');
    }
    return {
        valido: errores.length === 0,
        errores,
    };
}
/**
 * Validar nombre (no vacío, no muy corto, no números)
 *
 * @param nombre - Nombre a validar
 * @returns true si es válido
 */
export function esNombreValido(nombre) {
    if (!nombre || nombre.trim().length < 3) {
        return false;
    }
    // Permitir letras, espacios, acentos, guiones
    const regex = /^[a-záéíóúñA-ZÁÉÍÓÚÑ\s\-']+$/;
    return regex.test(nombre);
}
/**
 * Validar que dos valores sean iguales (contraseñas, etc)
 *
 * @param valor1 - Primer valor
 * @param valor2 - Segundo valor
 * @returns true si coinciden
 */
export function sonIguales(valor1, valor2) {
    return valor1 === valor2;
}
/**
 * Sanitizar entrada de usuario (prevenir XSS)
 *
 * @param input - Texto a sanitizar
 * @returns Texto sanitizado
 */
export function sanitizar(input) {
    if (!input) {
        return '';
    }
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}
/**
 * Validar que es una URL válida
 *
 * @param url - URL a validar
 * @returns true si es válida
 */
export function esURLValida(url) {
    try {
        new URL(url);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Validar UUID v4
 *
 * @param uuid - UUID a validar
 * @returns true si es válido
 */
export function esUUIDValido(uuid) {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
}
/**
 * Extraer dominio de email
 *
 * @param email - Email
 * @returns Dominio (ej: "example.com") o null
 */
export function extraerDominioEmail(email) {
    const partes = email.split('@');
    if (partes.length !== 2) {
        return null;
    }
    return partes[1];
}
/**
 * Detectar si un email es temporal/desechable
 *
 * @param email - Email a validar
 * @returns true si es probable que sea temporal
 */
export function esEmailTemporal(email) {
    const dominio = extraerDominioEmail(email);
    if (!dominio) {
        return false;
    }
    // Lista de proveedores de email temporal conocidos
    const proveedoresTemporales = [
        'tempmail',
        'guerrillamail',
        'mailinator',
        '10minutemail',
        'temp-mail',
        'throwaway',
        'yopmail',
        'mailnesia',
    ];
    return proveedoresTemporales.some((proveedor) => dominio.includes(proveedor));
}
//# sourceMappingURL=validators.js.map