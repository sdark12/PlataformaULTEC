import client from './src/config/insforge';

async function deleteOrphans() {
    console.log("Deleting orphan payments...");
    const { error: pError } = await client.database
        .from('payments')
        .delete()
        .is('student_id', null);
    if (pError) console.error("Error deleting payments:", pError);
    else console.log("Orphan payments deleted.");

    console.log("Deleting orphan invoices...");
    const { error: iError } = await client.database
        .from('invoices')
        .delete()
        .is('student_id', null);
    if (iError) console.error("Error deleting invoices:", iError);
    else console.log("Orphan invoices deleted.");

    process.exit(0);
}

deleteOrphans();
