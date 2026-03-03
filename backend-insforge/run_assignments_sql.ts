import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'plataforma_ultec',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function run() {
    try {
        const sqlPath = path.join(__dirname, 'database', 'sql', 'create_assignments_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        await pool.query(sql);
        console.log('Assignments tables created successfully.');
    } catch (err) {
        console.error('Error creating assignments tables:', err);
    } finally {
        pool.end();
    }
}

run();
