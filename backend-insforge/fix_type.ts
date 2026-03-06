import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function fixTable() {
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
        await client.query(`
            ALTER TABLE invoice_items 
            ALTER COLUMN invoice_id TYPE UUID USING invoice_id::text::uuid;
        `);
        console.log("Success: Changed invoice_id to UUID");

        // Also reload schema for PostgREST
        await client.query(`NOTIFY pgrst, 'reload schema';`);
        console.log("Schema reloaded.");
    } catch (err) {
        console.error("Error migrating:", err);
    } finally {
        await client.end();
    }
}

fixTable();
