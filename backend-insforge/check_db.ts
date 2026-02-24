import client from './src/config/insforge';

async function checkConstraints() {
    console.log("Fetching an existing payment...");
    const { data: payments } = await client.database.from('payments').select('*').limit(1);

    if (payments && payments.length > 0) {
        const p = payments[0];
        console.log("Trying to insert duplicate for enrollment_id", p.enrollment_id, "month", p.tuition_month);
        const { data: newP, error: insertErr } = await client.database.from('payments').insert([{
            enrollment_id: p.enrollment_id,
            amount: p.amount,
            method: p.method,
            tuition_month: p.tuition_month,
            payment_type: 'TUITION'
        }]).select();

        console.log("Insert result error:", insertErr ? insertErr.message : 'Success');
        if (!insertErr && newP) {
            await client.database.from('payments').delete().eq('id', newP[0].id);
            console.log("Success - deleted temporary row.");
        }
    } else {
        console.log("No payments to duplicate.");
    }
}
checkConstraints();
