import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    ssl: { rejectUnauthorized: false }
});

async function createTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS course_resources (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            file_url TEXT NOT NULL,
            created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        await client.connect();
        await client.query(query);
        console.log('Tabla course_resources creada o ya existía.');
    } catch (error) {
        console.error('Error creando la tabla:', error);
    } finally {
        await client.end();
    }
}

createTable();
