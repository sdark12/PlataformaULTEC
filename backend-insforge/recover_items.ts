import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function recoverRealItems() {
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

        // Find empty invoices
        const res = await client.query(`
            SELECT i.id, i.invoice_number, i.total_amount, i.student_id, i.created_at
            FROM invoices i
            LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
            WHERE ii.id IS NULL
            ORDER BY i.created_at DESC
        `);

        for (const inv of res.rows) {
            console.log("Analyzing empty invoice:", inv.invoice_number, inv.created_at);
            // Find payments created around the same exact time for the same student
            const timeStr = new Date(inv.created_at).toISOString();

            // Allow 5 seconds window
            const pRes = await client.query(`
                SELECT p.id, p.amount, p.description, p.payment_type, p.tuition_month, c.name as course_name
                FROM payments p
                LEFT JOIN enrollments e ON p.enrollment_id = e.id
                LEFT JOIN courses c ON e.course_id = c.id
                WHERE p.student_id = $1 
                  AND p.created_at >= $2::timestamp - interval '5 seconds'
                  AND p.created_at <= $2::timestamp + interval '5 seconds'
            `, [inv.student_id, timeStr]);

            if (pRes.rows.length > 0) {
                console.log(`Found ${pRes.rows.length} payments for ${inv.invoice_number}`);
                for (const payment of pRes.rows) {
                    let desc = payment.description;
                    if (!desc || desc === 'Pago Consolidado') {
                        if (payment.payment_type === 'TUITION') desc = payment.tuition_month ? `Colegiatura de ${payment.tuition_month} - ${payment.course_name}` : `Colegiatura - ${payment.course_name}`;
                        else if (payment.payment_type === 'ENROLLMENT') desc = `Inscripción - ${payment.course_name}`;
                        else desc = `Pago - ${payment.course_name || payment.payment_type}`;
                    }

                    await client.query(`
                        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
                        VALUES ($1, $2, 1, $3, $3)
                    `, [inv.id, desc, payment.amount]);
                    console.log(`Inserted item: ${desc} Q.${payment.amount}`);
                }
            } else {
                await client.query(`
                    INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price)
                    VALUES ($1, 'Pago Consolidado (Recuperado)', 1, $2, $2)
                `, [inv.id, inv.total_amount]);
                console.log(`Inserted fallback item for ${inv.invoice_number}`);
            }
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

recoverRealItems();
