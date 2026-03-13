import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const sql = `
-- Drop table if exists to start clean with profile references
DROP TABLE IF EXISTS audit_logs CASCADE;

-- AUDIT LOG (Updated to use UUID profiles)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100),
    entity_id VARCHAR(100), -- Changed to VARCHAR to support UUID or Serial IDs
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_branch ON audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_logs(user_id);

-- GANT PERMISSIONS
GRANT ALL ON TABLE audit_logs TO authenticated;
GRANT ALL ON TABLE audit_logs TO anon;
GRANT ALL ON TABLE audit_logs TO postgres;

-- RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
`;

async function main() {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432'),
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Insforge Database for Audit Logs update!');

        console.log('Running SQL for audit_logs...');
        await client.query(sql);
        console.log('audit_logs table created/updated successfully!');
    } catch (error) {
        console.error('Error executing SQL:', error);
    } finally {
        await client.end();
        console.log('Database connection closed.');
    }
}

main();
