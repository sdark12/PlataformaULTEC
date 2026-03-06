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
        const res = await client.query('SELECT * FROM invoice_items ORDER BY id DESC LIMIT 5;');
        console.log("Recent Invoice Items:", res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

check();
