import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runSQL() {
    const sqlPath = path.join(__dirname, '../../create_gamification_tables.sql');
    let sql = fs.readFileSync(sqlPath, 'utf8');

    // Add grants and reload schema cache at the end
    sql += `
-- GRANTS FOR REST API
GRANT ALL ON TABLE rewards TO authenticated;
GRANT ALL ON TABLE rewards TO anon;
GRANT ALL ON TABLE rewards TO postgres;

GRANT ALL ON TABLE merit_transactions TO authenticated;
GRANT ALL ON TABLE merit_transactions TO anon;
GRANT ALL ON TABLE merit_transactions TO postgres;

-- RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
`;

    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Insforge Database!');

        console.log('Running Gamification SQL...');
        await client.query(sql);
        console.log('SQL Executed Successfully! Rewards and Merit tables are ready, and schema cache reloaded.');
    } catch (error) {
        console.error('Error executing SQL:', error);
    } finally {
        await client.end();
        console.log('Database connection closed.');
    }
}

runSQL();
