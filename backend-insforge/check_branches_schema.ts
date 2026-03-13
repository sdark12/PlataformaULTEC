import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.INSFORGE_URL || '',
    process.env.INSFORGE_API_KEY || ''
);

async function checkSchema() {
    console.log("Checking schema...");
    
    // Check if branch id is a UUID instead of integer in the database
    const { data: bData, error: bError } = await supabase
        .from('branches')
        .select('*')
        .limit(1);
    
    if (bError) console.error("Branches error:", bError);
    else console.log("Branches data:", bData);
}

checkSchema();
