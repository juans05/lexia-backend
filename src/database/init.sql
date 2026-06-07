-- ============================================================================
-- LexAI Perú - Database Schema Initialization
-- PostgreSQL 14+
-- Versión: 1.0.0
-- ============================================================================

-- ============================================================================
-- EXTENSIONES NECESARIAS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLA: usuarios
-- Almacena información de usuarios de la plataforma
-- ============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
    usuario_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Información de cuenta
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- Información personal
    nombre VARCHAR(255) NOT NULL,
    apellido VARCHAR(255),
    telefono VARCHAR(20),  -- Formato: +51XXXXXXXXX para Perú

    -- Información de negocio (para PYMES)
    es_empresa BOOLEAN DEFAULT FALSE,
    nombre_empresa VARCHAR(255),
    ruc VARCHAR(20),  -- Formato: 20-dígitos para Perú

    -- Estado de cuenta
    es_activo BOOLEAN DEFAULT TRUE,
    email_verificado BOOLEAN DEFAULT FALSE,
    telefono_verificado BOOLEAN DEFAULT FALSE,

    -- Timestamps
    fecha_registro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_ultima_actividad TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Índices de búsqueda
    CONSTRAINT email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT telefono_peru CHECK (telefono IS NULL OR telefono ~ '^\+51[0-9]{9}$')
);

-- Índices para usuarios
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_ruc ON usuarios(ruc) WHERE ruc IS NOT NULL;
CREATE INDEX idx_usuarios_fecha_registro ON usuarios(fecha_registro DESC);
CREATE INDEX idx_usuarios_es_activo ON usuarios(es_activo);

-- ============================================================================
-- TABLA: contador_consultas_gratis
-- Rastrea las consultas gratuitas mensuales por usuario
-- ============================================================================
CREATE TABLE IF NOT EXISTS contador_consultas_gratis (
    contador_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,

    -- Límites y contadores
    limite_mensual INT DEFAULT 3,
    consultas_utilizadas INT DEFAULT 0,

    -- Período de facturación
    mes_ano VARCHAR(7) NOT NULL,  -- Formato: 'YYYY-MM'

    -- Timestamps
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_reinicio TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Constraint para asegurar unicidad por usuario y mes
    UNIQUE(usuario_id, mes_ano)
);

-- Índices para contador de consultas
CREATE INDEX idx_contador_usuario ON contador_consultas_gratis(usuario_id);
CREATE INDEX idx_contador_mes ON contador_consultas_gratis(mes_ano);

-- ============================================================================
-- TABLA: consultas
-- Almacena todas las consultas legales realizadas
-- ============================================================================
CREATE TABLE IF NOT EXISTS consultas (
    consulta_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,

    -- Contenido de la consulta
    pregunta TEXT NOT NULL,
    respuesta TEXT,

    -- Categorización legal
    categoria_legal VARCHAR(100),  -- 'laboral', 'civil', 'mercantil', 'tributario'
    subcategoria VARCHAR(100),     -- ej: 'despido', 'arrendamiento', 'empresa'

    -- Procesamiento
    es_gratis BOOLEAN DEFAULT FALSE,
    tokens_utilizados INT,

    -- Estado
    estado VARCHAR(50) DEFAULT 'pendiente',  -- 'pendiente', 'procesando', 'completada', 'error'
    mensaje_error TEXT,

    -- Interacción
    satisfaccion_usuario INT,  -- Escala 1-5
    comentario_usuario TEXT,

    -- Timestamps
    fecha_consulta TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_completada TIMESTAMPTZ,

    -- Índices
    CONSTRAINT categoria_valida CHECK (
        categoria_legal IN ('laboral', 'civil', 'mercantil', 'tributario')
        OR categoria_legal IS NULL
    ),
    CONSTRAINT satisfaccion_valida CHECK (
        satisfaccion_usuario IS NULL
        OR (satisfaccion_usuario >= 1 AND satisfaccion_usuario <= 5)
    )
);

-- Índices para consultas
CREATE INDEX idx_consultas_usuario ON consultas(usuario_id);
CREATE INDEX idx_consultas_fecha ON consultas(fecha_consulta DESC);
CREATE INDEX idx_consultas_categoria ON consultas(categoria_legal);
CREATE INDEX idx_consultas_estado ON consultas(estado);

-- ============================================================================
-- TABLA: pagos
-- Registra todas las transacciones de pago
-- ============================================================================
CREATE TABLE IF NOT EXISTS pagos (
    pago_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,

    -- Información de pago
    monto_soles DECIMAL(10, 2) NOT NULL,
    monto_usd DECIMAL(10, 2),
    moneda VARCHAR(3) DEFAULT 'PEN',

    -- Detalles de la transacción
    tipo_pago VARCHAR(50),  -- 'consulta_individual', 'suscripcion', 'abogado'
    referencia_externa VARCHAR(255),  -- ID de Mercado Pago o Stripe
    metodo_pago VARCHAR(100),  -- 'mercado_pago', 'stripe', 'tarjeta', 'yape', 'plin'

    -- Estado de pago
    estado VARCHAR(50) DEFAULT 'pendiente',  -- 'pendiente', 'completado', 'fallido', 'reembolso'
    detalles_estado JSONB,  -- JSON con respuesta de proveedor de pago

    -- Relaciones
    consulta_id UUID REFERENCES consultas(consulta_id) ON DELETE SET NULL,
    numero_suscripcion VARCHAR(100),

    -- Metadata
    metadata JSONB,  -- JSON flexible para datos adicionales

    -- Timestamps
    fecha_pago TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_completado TIMESTAMPTZ,
    fecha_reembolso TIMESTAMPTZ,

    -- Índices
    CONSTRAINT monto_positivo CHECK (monto_soles > 0)
);

-- Índices para pagos
CREATE INDEX idx_pagos_usuario ON pagos(usuario_id);
CREATE INDEX idx_pagos_fecha ON pagos(fecha_pago DESC);
CREATE INDEX idx_pagos_estado ON pagos(estado);
CREATE INDEX idx_pagos_referencia ON pagos(referencia_externa);
CREATE INDEX idx_pagos_consulta ON pagos(consulta_id) WHERE consulta_id IS NOT NULL;

-- ============================================================================
-- TABLA: sesiones
-- Gestiona sesiones de usuario para autenticación
-- ============================================================================
CREATE TABLE IF NOT EXISTS sesiones (
    sesion_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,

    -- Información de sesión
    refresh_token_hash VARCHAR(500) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,

    -- Metadata de dispositivo
    tipo_dispositivo VARCHAR(50),  -- 'web', 'mobile', 'app'

    -- Timestamps
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMPTZ NOT NULL,
    fecha_ultimo_uso TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Estado
    es_valida BOOLEAN DEFAULT TRUE,

    -- Índices
    CONSTRAINT expiracion_valida CHECK (fecha_expiracion > fecha_creacion)
);

-- Índices para sesiones
CREATE INDEX idx_sesiones_usuario ON sesiones(usuario_id);
CREATE INDEX idx_sesiones_fecha_expiracion ON sesiones(fecha_expiracion);
CREATE INDEX idx_sesiones_validas ON sesiones(es_valida) WHERE es_valida = TRUE;

-- ============================================================================
-- TABLA: auditoría_logs
-- Registra eventos importantes para auditoría y seguridad
-- ============================================================================
CREATE TABLE IF NOT EXISTS auditoría_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(usuario_id) ON DELETE SET NULL,

    -- Tipo de evento
    tipo_evento VARCHAR(100) NOT NULL,  -- 'login', 'logout', 'consulta', 'pago', 'cambio_contraseña'
    accion VARCHAR(100),

    -- Detalles del evento
    detalles JSONB,
    resultado VARCHAR(50),  -- 'exitoso', 'fallido'
    mensaje_error TEXT,

    -- Información de contexto
    ip_address INET,
    user_agent TEXT,
    endpoint VARCHAR(255),

    -- Timestamps
    fecha_evento TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Índices
    CONSTRAINT tipo_evento_valido CHECK (
        tipo_evento IN (
            'login', 'logout', 'consulta', 'pago', 'cambio_contraseña',
            'cambio_email', 'reseteo_contraseña', 'eliminacion_cuenta',
            'error_sistema'
        )
    )
);

-- Índices para auditoría
CREATE INDEX idx_auditoria_usuario ON auditoría_logs(usuario_id);
CREATE INDEX idx_auditoria_fecha ON auditoría_logs(fecha_evento DESC);
CREATE INDEX idx_auditoria_tipo ON auditoría_logs(tipo_evento);

-- ============================================================================
-- TABLA: tokens_verificacion
-- Almacena tokens para verificación de email y reseteo de contraseña
-- ============================================================================
CREATE TABLE IF NOT EXISTS tokens_verificacion (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(usuario_id) ON DELETE CASCADE,

    -- Tipo de token
    tipo_token VARCHAR(50) NOT NULL,  -- 'email_verificacion', 'reseteo_contraseña'

    -- Token hasheado
    token_hash VARCHAR(500) NOT NULL UNIQUE,

    -- Estado
    utilizado BOOLEAN DEFAULT FALSE,
    fecha_utilizacion TIMESTAMPTZ,

    -- Timestamps
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMPTZ NOT NULL,

    -- Índices
    CONSTRAINT tipo_token_valido CHECK (
        tipo_token IN ('email_verificacion', 'reseteo_contraseña')
    ),
    CONSTRAINT expiracion_valida CHECK (fecha_expiracion > fecha_creacion)
);

-- Índices para tokens
CREATE INDEX idx_tokens_usuario ON tokens_verificacion(usuario_id);
CREATE INDEX idx_tokens_tipo ON tokens_verificacion(tipo_token);
CREATE INDEX idx_tokens_hash ON tokens_verificacion(token_hash);
CREATE INDEX idx_tokens_fecha_expiracion ON tokens_verificacion(fecha_expiracion);

-- ============================================================================
-- TABLA: estadísticas_usuario
-- Estadísticas de uso agregadas por usuario
-- ============================================================================
CREATE TABLE IF NOT EXISTS estadísticas_usuario (
    estadistica_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(usuario_id) ON DELETE CASCADE,

    -- Contadores
    total_consultas INT DEFAULT 0,
    total_consultas_gratis INT DEFAULT 0,
    total_consultas_pagadas INT DEFAULT 0,

    -- Financiero (en soles)
    total_gastado_soles DECIMAL(12, 2) DEFAULT 0,
    gasto_mes_actual_soles DECIMAL(12, 2) DEFAULT 0,

    -- Categorías
    consultas_laboral INT DEFAULT 0,
    consultas_civil INT DEFAULT 0,
    consultas_mercantil INT DEFAULT 0,
    consultas_tributario INT DEFAULT 0,

    -- Satisfacción
    rating_promedio DECIMAL(3, 2),

    -- Timestamps
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT gastado_positivo CHECK (total_gastado_soles >= 0),
    CONSTRAINT rating_valido CHECK (
        rating_promedio IS NULL
        OR (rating_promedio >= 1 AND rating_promedio <= 5)
    )
);

-- Índices para estadísticas
CREATE INDEX idx_estadisticas_usuario ON estadísticas_usuario(usuario_id);

-- ============================================================================
-- VISTAS ÚTILES
-- ============================================================================

-- Vista: Usuarios activos con estadísticas
CREATE OR REPLACE VIEW v_usuarios_activos_stats AS
SELECT
    u.usuario_id,
    u.email,
    u.nombre,
    u.es_empresa,
    u.fecha_registro,
    COALESCE(e.total_consultas, 0) as total_consultas,
    COALESCE(e.total_gastado_soles, 0) as total_gastado_soles,
    COALESCE(e.rating_promedio, 0) as rating_promedio,
    COALESCE(cc.consultas_utilizadas, 0) as consultas_gratis_utilizadas
FROM usuarios u
LEFT JOIN estadísticas_usuario e ON u.usuario_id = e.usuario_id
LEFT JOIN contador_consultas_gratis cc ON u.usuario_id = cc.usuario_id
    AND cc.mes_ano = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
WHERE u.es_activo = TRUE;

-- Vista: Consultas pendientes de procesamiento
CREATE OR REPLACE VIEW v_consultas_pendientes AS
SELECT
    c.consulta_id,
    c.usuario_id,
    u.email,
    u.nombre,
    c.pregunta,
    c.categoria_legal,
    c.fecha_consulta,
    c.es_gratis
FROM consultas c
JOIN usuarios u ON c.usuario_id = u.usuario_id
WHERE c.estado = 'pendiente'
ORDER BY c.fecha_consulta ASC;

-- Vista: Ingresos diarios agregados
CREATE OR REPLACE VIEW v_ingresos_diarios AS
SELECT
    DATE(p.fecha_pago) as fecha,
    COUNT(*) as total_transacciones,
    SUM(p.monto_soles) as total_soles,
    SUM(p.monto_usd) as total_usd,
    COUNT(DISTINCT p.usuario_id) as usuarios_unicos
FROM pagos p
WHERE p.estado = 'completado'
GROUP BY DATE(p.fecha_pago)
ORDER BY fecha DESC;

-- ============================================================================
-- FUNCIONES DE UTILIDAD
-- ============================================================================

-- Función: Actualizar estadísticas de usuario
CREATE OR REPLACE FUNCTION actualizar_estadisticas_usuario(
    p_usuario_id UUID
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO estadísticas_usuario (
        usuario_id,
        total_consultas,
        total_consultas_gratis,
        total_consultas_pagadas,
        total_gastado_soles,
        gasto_mes_actual_soles,
        consultas_laboral,
        consultas_civil,
        consultas_mercantil,
        consultas_tributario,
        rating_promedio
    )
    SELECT
        p_usuario_id,
        COUNT(DISTINCT CASE WHEN c.estado = 'completada' THEN c.consulta_id END),
        COUNT(DISTINCT CASE WHEN c.es_gratis = TRUE AND c.estado = 'completada' THEN c.consulta_id END),
        COUNT(DISTINCT CASE WHEN c.es_gratis = FALSE AND c.estado = 'completada' THEN c.consulta_id END),
        COALESCE(SUM(CASE WHEN pag.estado = 'completado' THEN pag.monto_soles ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN pag.estado = 'completado' AND DATE_TRUNC('month', pag.fecha_pago) = DATE_TRUNC('month', CURRENT_DATE) THEN pag.monto_soles ELSE 0 END), 0),
        COUNT(DISTINCT CASE WHEN c.categoria_legal = 'laboral' AND c.estado = 'completada' THEN c.consulta_id END),
        COUNT(DISTINCT CASE WHEN c.categoria_legal = 'civil' AND c.estado = 'completada' THEN c.consulta_id END),
        COUNT(DISTINCT CASE WHEN c.categoria_legal = 'mercantil' AND c.estado = 'completada' THEN c.consulta_id END),
        COUNT(DISTINCT CASE WHEN c.categoria_legal = 'tributario' AND c.estado = 'completada' THEN c.consulta_id END),
        AVG(CASE WHEN c.satisfaccion_usuario IS NOT NULL THEN c.satisfaccion_usuario END)
    FROM usuarios u
    LEFT JOIN consultas c ON u.usuario_id = c.usuario_id
    LEFT JOIN pagos pag ON u.usuario_id = pag.usuario_id
    WHERE u.usuario_id = p_usuario_id
    ON CONFLICT (usuario_id) DO UPDATE SET
        total_consultas = EXCLUDED.total_consultas,
        total_consultas_gratis = EXCLUDED.total_consultas_gratis,
        total_consultas_pagadas = EXCLUDED.total_consultas_pagadas,
        total_gastado_soles = EXCLUDED.total_gastado_soles,
        gasto_mes_actual_soles = EXCLUDED.gasto_mes_actual_soles,
        consultas_laboral = EXCLUDED.consultas_laboral,
        consultas_civil = EXCLUDED.consultas_civil,
        consultas_mercantil = EXCLUDED.consultas_mercantil,
        consultas_tributario = EXCLUDED.consultas_tributario,
        rating_promedio = EXCLUDED.rating_promedio,
        fecha_actualizacion = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Función: Actualizar fecha de última actividad
CREATE OR REPLACE FUNCTION actualizar_ultima_actividad()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE usuarios SET fecha_ultima_actividad = CURRENT_TIMESTAMP
    WHERE usuario_id = NEW.usuario_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Actualizar última actividad en consultas
CREATE TRIGGER tr_actualizar_actividad_en_consulta
AFTER INSERT ON consultas
FOR EACH ROW
EXECUTE FUNCTION actualizar_ultima_actividad();

-- Trigger: Actualizar última actividad en pagos
CREATE TRIGGER tr_actualizar_actividad_en_pago
AFTER INSERT ON pagos
FOR EACH ROW
EXECUTE FUNCTION actualizar_ultima_actividad();

-- ============================================================================
-- COMMENTS Y DOCUMENTACIÓN
-- ============================================================================

COMMENT ON TABLE usuarios IS 'Tabla principal de usuarios de LexAI Perú. Almacena información de perfil e identificación.';
COMMENT ON TABLE consultas IS 'Historial completo de consultas legales realizadas por usuarios. Base para análisis de satisfacción y categorización.';
COMMENT ON TABLE pagos IS 'Registro de todas las transacciones financieras. Crítico para auditoría financiera y reconciliación.';
COMMENT ON TABLE sesiones IS 'Gestión de sesiones autenticadas. Permite múltiples sesiones por usuario y revocación de tokens.';
COMMENT ON TABLE auditoría_logs IS 'Log de auditoría de eventos importantes para cumplimiento normativo LPDP.';

-- ============================================================================
-- PERMISOS Y SEGURIDAD
-- ============================================================================

-- Las tablas de datos sensibles deben tener row-level security (RLS) habilitado
-- Esto se configura en la aplicación Node.js mediante la variable SESSION AUTH
-- Ver: services/database.ts

COMMENT ON COLUMN usuarios.password_hash IS 'Hash bcrypt de la contraseña. NUNCA almacenar contraseña en texto plano.';
COMMENT ON COLUMN usuarios.telefono IS 'Teléfono en formato internacional +51XXXXXXXXX para Perú (9 dígitos después del prefijo).';
COMMENT ON COLUMN pagos.detalles_estado IS 'JSON con respuesta completa de proveedor de pago para debugging.';

-- FIN DEL SCHEMA
