import client from './src/config/insforge';

async function testUpdate() {
    const id = '6e15181d-184f-639d-acc6-7d1a2b3c4d5e'; // I'll search for the right ID first, wait. I'll just find Rosa

    const { data: profiles } = await client.database
        .from('profiles')
        .select('*')
        .ilike('full_name', '%rosa%');

    if (!profiles || profiles.length === 0) {
        console.log("Rosa not found");
        return;
    }

    const targetUserId = profiles[0].id;
    console.log("Found Rosa user:", targetUserId);

    const updatePayload = {
        full_name: "rosa delia",
        email: "rosadelia@ultec1.com",
        role: "student",
        active: true
    };

    console.log("Attempting profile update...");
    const { data, error } = await client.database
        .from('profiles')
        .update(updatePayload)
        .eq('id', targetUserId)
        .select('*')
        .single();

    if (error) {
        console.error("SUPABASE ERROR:");
        console.error(JSON.stringify(error, null, 2));
    } else {
        console.log("UPDATE SUCCESS:", data);

        // Next, try the linking logic
        console.log("Attempting student unlink logic...");
        const { error: unlinkError } = await client.database
            .from('students')
            .update({ user_id: null })
            .eq('user_id', targetUserId);

        if (unlinkError) {
            console.error("UNLINK ERROR:", JSON.stringify(unlinkError, null, 2));
        } else {
            console.log("UNLINK SUCCESS");
        }
    }
}

testUpdate();
