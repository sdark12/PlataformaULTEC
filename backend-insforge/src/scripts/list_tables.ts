import { query } from '../config/database';

async function main() {
    try {
        const res = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        `);
        console.log('Tables in public schema:', res.rows.map(r => r.table_name));
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
