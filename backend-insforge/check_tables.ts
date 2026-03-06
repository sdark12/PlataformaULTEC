import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT),
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);
        console.log("Tables:", res.rows.map(r => r.table_name));
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

check();
