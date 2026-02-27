import fs from 'fs';
import path from 'path';
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
        const sql = fs.readFileSync(path.join(__dirname, '../admin_password_reset.sql'), 'utf-8');
        console.log('Executing SQL...');
        await pool.query(sql);
        console.log('Success! RPC provisioned.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}
run();
