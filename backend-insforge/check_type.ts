import { Pool } from 'pg';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: { rejectUnauthorized: false }
});

async function check() {
    const client = await pool.connect();
    try {
        const res = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'enrollments'`);
        console.log('Enrollments columns:', res.rows);
        const res2 = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payments'`);
        console.log('Payments columns:', res2.rows);
    } finally {
        client.release();
        pool.end();
    }
}
check();
