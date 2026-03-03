import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'insforge',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        await client.query(`
            ALTER TABLE assignment_submissions 
            ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(1000);
        `);
        console.log('Successfully added attachment_url to assignment_submissions');
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

run();
