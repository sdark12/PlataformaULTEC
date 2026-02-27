import client from './config/insforge';

async function listProfiles() {
    const { data } = await client.database
        .from('profiles')
        .select('*');
    console.log(JSON.stringify(data, null, 2));
}

listProfiles();
