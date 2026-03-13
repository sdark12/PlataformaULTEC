import pool from './src/config/database';

async function fixBranchesSchema() {
    const client = await pool.connect();
    try {
        console.log('Altering branches table...');
        await client.query('BEGIN');
        await client.query(`
            ALTER TABLE branches ADD COLUMN IF NOT EXISTS email VARCHAR(150);
            ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
        `);
        console.log('Columns added successfully.');
        
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'branches';
        `);
        console.log('Branches schema now:', res.rows);
        
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error altering table:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

fixBranchesSchema();
