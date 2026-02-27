import fs from 'fs';
import path from 'path';
import pool from './src/config/database';

async function run() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, 'create_notifications_table.sql'), 'utf-8');
        await pool.query(sql);
        console.log('Notifications table created successfully.');
    } catch (err) {
        console.error('Error creating notifications table:', err);
    } finally {
        pool.end();
    }
}

run();
