import pool from './src/config/database';

async function alterTable() {
    const client = await pool.connect();
    try {
        console.log('Altering payments table...');
        await client.query('BEGIN');
        await client.query(`
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS description TEXT;
            ALTER TABLE payments ADD COLUMN IF NOT EXISTS tuition_month VARCHAR(50);
        `);
        await client.query('COMMIT');
        console.log('Table altered successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error altering table:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

alterTable();
