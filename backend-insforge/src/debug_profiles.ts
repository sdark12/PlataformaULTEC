import client from './config/insforge';

async function checkProfiles() {
    console.log('Fetching recent profiles...');
    const { data, error } = await client.database
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching profiles:', error);
    } else {
        console.log('Recent profiles:', JSON.stringify(data, null, 2));
    }
}

checkProfiles();
