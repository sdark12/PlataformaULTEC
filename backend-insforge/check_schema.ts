import client from './src/config/insforge';

async function checkSchema() {
    const { data: cols } = await client.database.rpc('exec_sql', { query: `SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'tuition_month';` });
    if (cols) { console.log(cols); }
    else {
        // Fallback since exec_sql might not exist, do a REST call if possible or just use API logic
        console.log("Fallback");
    }
    process.exit(0);
}

checkSchema();
