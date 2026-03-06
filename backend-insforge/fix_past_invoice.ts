import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function fixPastInvoice() {
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

        // Find latest invoice without items
        const res = await client.query(`
            SELECT i.id, i.total_amount 
            FROM invoices i
            LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
            WHERE ii.id IS NULL
            ORDER BY i.created_at DESC
            LIMIT 1;
        `);

        if (res.rows.length > 0) {
            const inv = res.rows[0];
            await client.query(`
                INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
                VALUES ($1, 'Pago Consolidado (Recuperado)', 1, $2, $2)
            `, [inv.id, inv.total_amount]);
            console.log("Fixed past invoice:", inv.id);
        } else {
            console.log("No empty invoices found.");
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

fixPastInvoice();
