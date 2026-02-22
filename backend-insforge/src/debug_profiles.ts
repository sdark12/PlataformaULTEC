import client from './config/insforge';

async function checkProfileStructure() {
    try {
        const { data, error } = await client.database
            .from('profiles')
            .select('*')
            .limit(1);

        if (error) throw error;

        console.log('Sample Profile:', JSON.stringify(data[0], null, 2));
    } catch (err) {
        console.error('Error checking structure:', err);
    }
}

checkProfileStructure();
