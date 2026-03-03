import { createClient } from '@insforge/sdk';
import * as dotenv from 'dotenv';
dotenv.config();

const client = createClient({
    baseUrl: process.env.INSFORGE_URL,
    anonKey: process.env.INSFORGE_MASTER_KEY || process.env.INSFORGE_SERVICE_ROLE_KEY || process.env.INSFORGE_API_KEY
});

async function run() {
    const { data: profile } = await client.database.from('profiles').select('*').eq('email', 'rosadelia@ultec1.com').single();
    if (profile) {
        const studentId = 'be9ab7f0-9bfb-45bf-956b-cc68edd105a8';
        console.log('Mapping profile ID ' + profile.id + ' to student ' + studentId);

        const res = await client.database.from('students').update({ user_id: profile.id }).eq('id', studentId);
        console.log('Update result:', res);

        const res2 = await client.database.from('students').select('*').eq('id', studentId).single();
        console.log('Mapped student user_id is now:', res2.data?.user_id);
    }
}
run();
