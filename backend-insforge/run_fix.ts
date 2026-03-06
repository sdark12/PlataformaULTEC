import { Pool } from 'pg';
import fs from 'fs';
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

async function runFix() {
    const client = await pool.connect();
    try {
        const sqlPath = path.join(__dirname, 'database', 'sql', 'fix_foreign_keys.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running fix on Insforge...');
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Fix completed successfully.');
    } catch (error) {
        console.error('Fix failed:', error);
        await client.query('ROLLBACK');
    } finally {
        client.release();
        pool.end();
    }
}

runFix();
