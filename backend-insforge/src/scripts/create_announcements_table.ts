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
        CREATE TABLE IF NOT EXISTS announcements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            target_role VARCHAR(50) DEFAULT 'all',
            target_course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
            created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        await client.connect();
        await client.query(query);
        console.log('Tabla announcements creada o ya existía.');
    } catch (error) {
        console.error('Error creando la tabla announcements:', error);
    } finally {
        await client.end();
    }
}

createTable();
