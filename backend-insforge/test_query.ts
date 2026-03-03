import client from './src/config/insforge';

async function test() {
    console.log("Testing user linkage for Rosa Delia...");
    try {
        const { data: students, error: err1 } = await client.database
            .from('students')
            .select('*')
            .ilike('full_name', '%rosa%');

        console.log("Students matching 'rosa':", students?.map(s => ({ id: s.id, name: s.full_name, user_id: s.user_id })));

        const { data: profiles, error: err2 } = await client.database
            .from('profiles')
            .select('id, full_name, email')
            .ilike('full_name', '%rosa%');

        console.log("Profiles matching 'rosa':", profiles);

        if (err1 || err2) console.error("Errors:", err1, err2);
    } catch (e) {
        console.error("Try Catch Error:", e);
    }
}

test();
