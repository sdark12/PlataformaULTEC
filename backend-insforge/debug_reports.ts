import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_KEY || '');

async function test() {
    console.log('Fetching payments...');

    // First let's check what payments are in the system
    const { data: payments, error: payErr } = await client
        .from('payments')
        .select('*');

    console.log('Total raw Payments Count:', payments?.length);
    if (payments?.length) console.log('Sample Payment:', payments[0]);

    // Now let's try the join from reports
    const { data: reportData, error: repErr } = await client
        .from('payments')
        .select(`
            payment_date,
            amount,
            method,
            enrollments!inner (
                branch_id,
                students (full_name),
                courses (name)
            )
        `);

    console.log('Reports Join Count:', reportData?.length);
    if (repErr) console.log('Reports Error:', repErr.message);
    if (reportData?.length) console.log('Sample Joined Data:', JSON.stringify(reportData[0], null, 2));
}

test();
