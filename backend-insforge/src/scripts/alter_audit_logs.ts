import { query } from '../config/database';

async function main() {
    try {
        console.log('CREATING audit_logs TABLE...');
        await query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                branch_id INTEGER REFERENCES branches(id),
                action VARCHAR(100) NOT NULL,
                entity VARCHAR(100),
                entity_id INTEGER,
                old_data JSONB,
                new_data JSONB,
                ip_address VARCHAR(45),
                metadata JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_audit_branch ON audit_logs(branch_id);
        `);
        console.log('Successfully created audit_logs table.');
        process.exit(0);
    } catch (error) {
        console.error('Error altering audit_logs table:', error);
        process.exit(1);
    }
}

main();
