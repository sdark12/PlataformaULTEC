import client from './src/config/insforge';
import fs from 'fs';
import path from 'path';

async function run() {
    try {
        console.log("Applying unique constraint SQL via rpc if possible or executing statement...");
        const sql = fs.readFileSync(path.join(__dirname, 'add_unique_tuition_index.sql'), 'utf-8');

        // Let's try to query a raw SQL if admin privileges exist.
        // The safest way is to ask the user to run it via supabase dashboard if this fails, but let's try RPC.
        const { error } = await client.database.rpc('exec_sql', { sql_string: sql }).catch(() => ({ error: 'rpc_not_found' }));
        console.log("RPC Error:", error);
    } catch (err) {
        console.error(err);
    }
}
run();
