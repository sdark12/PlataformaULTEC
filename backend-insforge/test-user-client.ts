import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient(
    process.env.INSFORGE_URL || '',
    process.env.INSFORGE_API_KEY || ''
);

async function testWithUser() {
    // Authenticate with the user's password
    const { data: authData, error: authErr } = await client.auth.signInWithPassword({
        email: 'admin@admin.com',
        password: 'password123'
    });

    if (authErr) {
        console.error("Auth error:", authErr);
        return;
    }

    console.log("Logged in. Token:", authData.session.access_token.substring(0, 20) + "...");

    // Test students query
    const { data: students, error: err1 } = await client
        .from('students')
        .select('*', { count: 'exact' })
        .order('full_name')
        .range(0, 10);
        
    if (err1) {
        console.error("Students Query Error:", err1);
    } else {
        console.log("Students Query OK. Count:", students?.length);
    }

    // Test parent links
    const { data: links, error: err2 } = await client
        .from('parent_student_links')
        .select(`
            id,
            parent_user_id,
            student_id,
            relationship,
            created_at,
            profiles!parent_user_id ( id, full_name, email ),
            students ( id, full_name, personal_code )
        `)
        .order('created_at', { ascending: false });

    if (err2) {
        console.error("Parents Links Query Error:", err2);
    } else {
        console.log("Parents Links Query OK. Count:", links?.length);
    }
}

testWithUser();
