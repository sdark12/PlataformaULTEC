import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: { rejectUnauthorized: false },
});

async function run() {
    try {
        await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS start_date DATE;`);
        await pool.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS end_date DATE;`);
        console.log('Columns added successfully.');
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
run();
