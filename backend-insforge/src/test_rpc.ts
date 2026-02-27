const { createClient } = require('@insforge/sdk');

async function testRPC() {
    const adminClient = createClient({
        baseUrl: process.env.INSFORGE_URL || 'https://w6x267sp.us-east.insforge.app',
        anonKey: process.env.INSFORGE_API_KEY || 'ik_065cc96706290cd59a1103c714006c96'
    });

    console.log("Calling RPC...");
    const { data, error } = await adminClient.database.rpc('admin_change_user_password', {
        target_user_id: '6e155208-a545-4aca-81d1-84f639dacc67',
        new_password: 'newpassword123'
    });

    if (error) {
        console.error('RPC Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('RPC Success:', data);
    }
}
testRPC();
