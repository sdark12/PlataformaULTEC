import client from './src/config/insforge';

async function testDeleteEnrollment() {
    const enrollmentId = 'b42b245f-83e1-4f9c-9efa-01467c88463d'; // Note the 'e' instead of 'c'

    console.log(`Checking invoices for enrollment ${enrollmentId}...`);

    const { data: invoices } = await client.database
        .from('invoices')
        .select('*')
        .eq('enrollment_id', enrollmentId);

    console.log('Invoices found:', invoices?.length);
    if (invoices?.length) {
        console.log("Invoice IDs:", invoices.map(i => i.id));
    }

    console.log("Attempting enrollment delete via controller simulation...");
    const db = client.database;

    // 1. Delete Financial Status
    await db.from('financial_status').delete().eq('enrollment_id', enrollmentId);

    // 2. Delete Payments
    await db.from('payments').delete().eq('enrollment_id', enrollmentId);

    // 3. Delete Attendance
    await db.from('attendances').delete().eq('enrollment_id', enrollmentId);

    // 4. Delete Grades
    await db.from('grades').delete().eq('enrollment_id', enrollmentId);

    // 5. Delete Assignment Submissions
    await db.from('assignment_submissions').delete().eq('enrollment_id', enrollmentId);

    // Delete Invoice Items? (need to find them first)
    if (invoices?.length) {
        for (const inv of invoices) {
            await db.from('invoice_items').delete().eq('invoice_id', inv.id);
        }
        await db.from('invoices').delete().eq('enrollment_id', enrollmentId);
    }

    // 6. Finally delete the enrollment
    const { data, error } = await db
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId)
        .select();

    if (error) {
        console.error("SUPABASE ERROR:");
        console.error(JSON.stringify(error, null, 2));
    } else {
        console.log("DELETE SUCCESS:", data);
    }
}

testDeleteEnrollment();
