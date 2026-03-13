import { createClient } from '@insforge/sdk';
import dotenv from 'dotenv';
dotenv.config();

// Let's first log in as admin to get a real token.
// The SDK auth.signIn is not standard Supabase, it might be.
const supabase = require('@supabase/supabase-js').createClient(
    process.env.INSFORGE_URL,
    process.env.INSFORGE_API_KEY
);

async function test() {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@admin.com',
        password: 'password123'
    });
    
    if (authError || !authData.session) {
        console.error("Login failed:", authError);
        return;
    }

    const token = authData.session.access_token;
    console.log("Got token.");

    const verifyClient = createClient({
        baseUrl: process.env.INSFORGE_URL || '',
        anonKey: process.env.INSFORGE_API_KEY || '',
        edgeFunctionToken: token
    });

    console.log("Updating branch with dbUserClient...");
    const { data, error } = await verifyClient.database
        .from('branches')
        .update({ name: 'Sede Central (Auth Test)' })
        .eq('id', '739adc0f-7dd8-4509-9eed-0e1d3c2b2ba0')
        .select()
        .single();

    if (error) {
        console.error("Error with User Client:", JSON.stringify(error, null, 2));
    } else {
        console.log("Success with User Client:", data);
    }
}

test();
