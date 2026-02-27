async function testAdminAPI() {
    const url = 'https://w6x267sp.us-east.insforge.app/auth/v1/admin/users/6e155208-a545-4aca-81d1-84f639dacc67';
    const anonKey = 'ik_065cc96706290cd59a1103c714006c96';

    try {
        console.log("Testing raw admin API request...");
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${anonKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password: 'newpassword123' })
        });

        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Response:', data);
    } catch (e: any) {
        console.error('Failed!', e);
    }
}
testAdminAPI();
