# LexAI Perú - Backend Setup Guide

Guía completa para configurar y ejecutar el backend de LexAI Perú.

## Requisitos Previos

- Node.js 18+ (descargar de https://nodejs.org/)
- PostgreSQL 14+ (descargar de https://www.postgresql.org/)
- npm o yarn
- Git

## Instalación Paso a Paso

### 1. Clonar el repositorio y entrar al directorio

```bash
cd lexai-peru/backend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copiar `.env.example` a `.env` y rellenar valores:

```bash
cp .env.example .env
```

Editar `.env` con tus valores:

```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=lexai_peru
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=tu-secreto-jwt-de-minimo-32-caracteres
JWT_REFRESH_SECRET=tu-secreto-refresh-de-minimo-32-caracteres
```

### 4. Crear base de datos PostgreSQL

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos
CREATE DATABASE lexai_peru;
CREATE USER lexai_user WITH PASSWORD 'your_password';
ALTER ROLE lexai_user SET client_encoding TO 'utf8';
ALTER ROLE lexai_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE lexai_user SET default_transaction_deferrable TO on;
ALTER ROLE lexai_user SET default_time_zone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE lexai_peru TO lexai_user;
\q
```

O en una línea (Windows):

```bash
psql -U postgres -c "CREATE DATABASE lexai_peru;"
psql -U postgres -c "CREATE USER lexai_user WITH PASSWORD 'your_password';"
psql -U postgres -d lexai_peru -c "GRANT ALL PRIVILEGES ON DATABASE lexai_peru TO lexai_user;"
```

### 5. Ejecutar migraciones

Las migraciones se ejecutan automáticamente al iniciar el servidor, pero puedes ejecutarlas manualmente:

```bash
npm run migrate
```

### 6. Iniciar servidor en desarrollo

```bash
npm run dev
```

El servidor estará disponible en: http://localhost:3000

## Comandos Disponibles

```bash
# Desarrollo (hot reload con tsx)
npm run dev

# Build para producción
npm run build

# Iniciar en producción
npm start

# Ejecutar migraciones
npm run migrate

# Ejecutar linter
npm run lint

# Tests
npm run test
npm run test:watch
npm run test:coverage

# Docker
npm run docker:up      # Inicia PostgreSQL en Docker
npm run docker:down    # Detiene PostgreSQL
```

## Estructura del Proyecto

```
backend/
├── src/
│   ├── app.ts                 # Aplicación Express principal
│   ├── config/                # Configuración
│   │   ├── env.ts             # Variables de entorno
│   │   ├── database.ts        # Pool PostgreSQL
│   │   ├── redis.ts           # Cliente Redis
│   │   └── logger.ts          # Sistema de logging
│   ├── database/
│   │   ├── init.sql           # Schema PostgreSQL
│   │   ├── migrations.ts      # Migration runner
│   │   └── migrations/
│   │       └── 001_init_schema.sql
│   ├── controllers/           # Controladores (lógica de endpoints)
│   │   ├── auth.controller.ts
│   │   └── users.controller.ts
│   ├── middleware/            # Express middleware
│   │   └── auth.middleware.ts
│   ├── services/              # Lógica de negocio
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── session.service.ts
│   │   └── audit.service.ts
│   ├── routes/                # Definición de rutas
│   │   ├── auth.routes.ts
│   │   └── users.routes.ts
│   └── utilities/             # Funciones auxiliares
│       └── validators.ts      # Validadores específicos de Perú
├── dist/                      # Código compilado (generado)
├── logs/                      # Archivos de log
├── package.json
├── tsconfig.json
├── .env.example
└── SETUP.md
```

## Endpoints Disponibles

### Autenticación

```bash
# Registrar nuevo usuario
POST /api/auth/register
Content-Type: application/json
{
  "email": "usuario@example.com",
  "password": "MiContraseña123",
  "nombre": "Juan",
  "telefono": "+51912345678"
}

# Login
POST /api/auth/login
{
  "email": "usuario@example.com",
  "password": "MiContraseña123"
}

# Renovar token
POST /api/auth/refresh-token
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

# Logout
POST /api/auth/logout
Authorization: Bearer <access_token>
```

### Usuario

```bash
# Obtener perfil
GET /api/users/me
Authorization: Bearer <access_token>

# Actualizar perfil
PATCH /api/users/me
Authorization: Bearer <access_token>
{
  "nombre": "Juan Nuevo",
  "telefono": "+51987654321"
}

# Cambiar contraseña
POST /api/users/me/change-password
Authorization: Bearer <access_token>
{
  "passwordActual": "MiContraseña123",
  "passwordNueva": "MiNuevaContraseña456",
  "passwordConfirm": "MiNuevaContraseña456"
}

# Eliminar cuenta
DELETE /api/users/me
Authorization: Bearer <access_token>
```

### Sistema

```bash
# Health check
GET /api/health

# Status detallado
GET /api/status
```

## Debugging

### Logs

Los logs se muestran en la consola en desarrollo:

```bash
npm run dev
```

En producción se guardan en `logs/` en formato JSON.

### Base de Datos

Ver esquema en `src/database/init.sql`

Para inspeccionar la BD:

```bash
# Conectar a PostgreSQL
psql -U lexai_user -d lexai_peru

# Listar tablas
\dt

# Ver estructura de tabla
\d usuarios

# Hacer query
SELECT * FROM usuarios LIMIT 10;
```

### Variables de Entorno

Ver `.env.example` para descripción de cada variable.

Configuración crítica:
- `JWT_SECRET` debe tener >32 caracteres
- `DB_PASSWORD` debe ser segura
- `NODE_ENV` debe ser `production` en producción

## Troubleshooting

### Error: "Cannot find module"

```bash
# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

### Error: "Connection refused" (PostgreSQL)

```bash
# Verificar que PostgreSQL está corriendo
# Windows: Services > PostgreSQL
# Linux: sudo systemctl status postgresql
# macOS: brew services list | grep postgres

# Verificar credenciales en .env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
```

### Error: "Port 3000 already in use"

```bash
# Cambiar puerto en .env
PORT=3001

# O matar proceso usando puerto
# Windows: netstat -ano | findstr :3000
# Linux: lsof -i :3000
```

### Error en migraciones

```bash
# Verificar estado de migraciones
npm run migrate status

# Rollback si es necesario (manual en SQL)
# Ver tabla: SELECT * FROM _migraciones;
```

## Próximos Pasos

### Para Desenvolvimiento

1. **Implementar endpoints de consultas** (queries)
   - POST /api/consultas - Crear nueva consulta
   - GET /api/consultas - Historial de consultas
   - GET /api/consultas/:id - Detalles de consulta

2. **Implementar sistema de pagos**
   - Integración Mercado Pago
   - POST /api/pagos - Crear pago
   - GET /api/pagos - Historial de pagos

3. **Agregar email verification**
   - SendGrid integration
   - Verificación de email en registro
   - Reseteo de contraseña por email

4. **Tests**
   - Unit tests para servicios
   - Integration tests para endpoints
   - E2E tests

### Para Producción

1. **Certificado SSL/TLS**
   - Usar HTTPS
   - Configurar en reverse proxy (nginx/Apache)

2. **Base de Datos**
   - Backup automático
   - Read replicas para escalabilidad
   - Monitoreo de performance

3. **Monitoreo**
   - New Relic, DataDog, o similar
   - Alertas de errores
   - Métricas de performance

4. **Seguridad**
   - WAF (Web Application Firewall)
   - DDoS protection
   - Penetration testing

## Soporte

Para issues o preguntas:
1. Revisar logs en `logs/`
2. Verificar .env configuration
3. Revisar commits recientes en git
4. Contactar al equipo de desarrollo

## Referencias

- [Express.js Documentation](https://expressjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [JWT.io](https://jwt.io/)
- [Peruvian Legal Code](https://www.minjus.gob.pe/)
