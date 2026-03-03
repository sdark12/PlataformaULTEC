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
        console.log("Updating course...");
        const res = await pool.query(
            `UPDATE courses SET start_date = $1, end_date = $2 WHERE name = 'Programación 1'`,
            ['2026-01-01', '2026-11-30']
        );
        console.log("Rows updated:", res.rowCount);
    } catch (e) {
        console.error("PG ERROR:", e);
    } finally {
        await pool.end();
    }
}
run();
