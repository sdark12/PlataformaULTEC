import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const client = createClient(supabaseUrl, supabaseKey);

async function check() {
    try {
        const { data: inv } = await client.from('invoices').select('id').limit(1);
        console.log("Invoice ID Type:", typeof inv?.[0]?.id, inv?.[0]?.id);

        const { data: itm } = await client.from('invoice_items').select('invoice_id').limit(1);
        console.log("Invoice Item invoice_id:", typeof itm?.[0]?.invoice_id, itm?.[0]?.invoice_id);
    } catch (err) {
        console.error(err);
    }
}

check();
