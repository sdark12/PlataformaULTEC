const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
});

async function checkSchema() {
    await client.connect();
    
    try {
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'branches';
        `);
        console.log("Branches table SCHEMA:", res.rows);

        // Intenta actualizar la fila 1 para ver si funciona a nivel de BD
        const updateRes = await client.query(`
            UPDATE branches SET name = 'Sede Central Test' WHERE id = 1 RETURNING *
        `);
        console.log("Update result:", updateRes.rows);

    } catch (err) {
        console.error("DB Error:", err);
    } finally {
        await client.end();
    }
}

checkSchema();
