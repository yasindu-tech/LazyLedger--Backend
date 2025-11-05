import dotenv from 'dotenv';
dotenv.config();
import pkg from 'pg';
const { Pool } = pkg;
const poolConfig = {
    connectionString: process.env.DATABASE_URL,
};

// If the DATABASE_URL requires SSL (for example Render Postgres), enable ssl with
// rejectUnauthorized=false so local dev can connect. You can also set PGSSLMODE=require
// in your environment to force SSL.
if (process.env.DATABASE_URL) {
    const needsSSL = process.env.PGSSLMODE === 'require' || process.env.DATABASE_URL.includes('render.com');
    if (needsSSL) {
        poolConfig.ssl = { rejectUnauthorized: false };
    }
}

const pool = new Pool(poolConfig);

pool.connect()
    .then(() => console.log('Connected to the database'))
    .catch(err => console.error('Database connection error:', err));

export default pool;
