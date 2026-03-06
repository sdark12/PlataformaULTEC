import pool from './src/config/database';

async function alterTable() {
    const client = await pool.connect();
    try {
        console.log('Altering assignments table...');
        await client.query('BEGIN');
        await client.query(`
            ALTER TABLE assignments ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES course_schedules(id) ON DELETE SET NULL;
        `);
        await client.query('COMMIT');
        console.log('Table assignments altered successfully.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error altering table:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

alterTable();
