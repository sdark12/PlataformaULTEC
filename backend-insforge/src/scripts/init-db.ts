import fs from 'fs';
import path from 'path';
import pool from '../config/database';

async function initDb() {
    const client = await pool.connect();
    try {
        console.log('Starting database initialization...');

        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const seedPath = path.join(__dirname, '../database/seed.sql');

        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        const seedSql = fs.readFileSync(seedPath, 'utf8');

        console.log('Applying schema...');
        await client.query('BEGIN');
        await client.query(schemaSql);
        await client.query('COMMIT');
        console.log('Schema applied successfully.');

        console.log('Applying seed data...');
        await client.query('BEGIN');
        await client.query(seedSql);
        await client.query('COMMIT');
        console.log('Seed data applied successfully.');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error during database initialization:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

initDb();
