import { adminClient } from './src/config/insforge';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'database', 'sql', 'migrate_schedules_unified_payments.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration via Insforge SDK...');
        const { data, error } = await adminClient.rpc('execute_sql', { query: sql });

        if (error) {
            console.error('RPC Error:', error);
            // Fallback or detailed error might require looking at supabase direct connection
        } else {
            console.log('Migration completed successfully.', data);
        }
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

runMigration();
