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
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'invoice_items';
        `);
        console.log("Columns:", res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

check();
