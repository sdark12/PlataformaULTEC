import client from './src/config/insforge';

async function listTables() {
    console.log('Checking existing tables...');
    // We can't list tables directly via this SDK easily without a specific function, 
    // but we can try to select from expected tables and see if they error.

    const tables = ['roles', 'branches', 'profiles', 'courses', 'students', 'enrollments', 'financial_status', 'payments', 'invoices', 'invoice_items', 'attendance'];

    for (const table of tables) {
        const { error } = await client.database.from(table).select('id').limit(1);
        if (error) {
            console.log(`❌ Table '${table}' access error:`, error.message); // Likely "relation does not exist" or permission error
        } else {
            console.log(`✅ Table '${table}' exists.`);
        }
    }
}

listTables();
