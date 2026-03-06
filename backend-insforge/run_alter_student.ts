import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
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
        console.log("Connected to DB!");
        await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS personal_code VARCHAR(100);`);
        console.log("Added personal_code to students successfully.");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

run();
