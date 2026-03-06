import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function checkInvoices() {
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

        // Check recent invoices
        const res = await client.query(`
            SELECT i.id, i.invoice_number, i.created_at, COUNT(ii.id) as item_count
            FROM invoices i
            LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
            GROUP BY i.id, i.invoice_number, i.created_at
            ORDER BY i.created_at DESC
            LIMIT 10;
        `);

        console.log("Recent Invoices:", res.rows);

        // Check recent invoice items
        const resItems = await client.query(`
            SELECT * FROM invoice_items ORDER BY id DESC LIMIT 5;
        `);
        console.log("Recent Items:", resItems.rows);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

checkInvoices();
