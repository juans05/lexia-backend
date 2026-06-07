import { Pool } from 'pg';
import { ejecutarMigraciones } from './migrations.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://lexai:lexai_dev_password@localhost:5432/lexai_db';

// Strip Prisma-only query params that pg doesn't understand
const cleanUrl = DATABASE_URL.replace(/\?.*$/, '');

const pool = new Pool({ connectionString: cleanUrl });

const comando = process.argv[2] || 'up';

ejecutarMigraciones(pool, comando)
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
