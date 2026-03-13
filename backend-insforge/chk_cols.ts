import { Client } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const test = async () => {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432')
    });
    
    await client.connect();

    // Check students cols
    const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'students';
    `);
    console.log("Students:", res.rows.map(r => r.column_name));

    // Check enrollments cols
    const res2 = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'enrollments';
    `);
    console.log("Enrollments:", res2.rows.map(r => r.column_name));
    
    // Check schedules
    const res3 = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'schedules';
    `);
    console.log("Schedules:", res3.rows.map(r => r.column_name));

    await client.end();
};

test().catch(console.error);
