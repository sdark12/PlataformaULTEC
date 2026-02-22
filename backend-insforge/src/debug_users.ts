import client from './config/insforge';

async function checkUserStructure() {
    try {
        const { data, error } = await client.database
            .from('users')
            .select('*')
            .limit(1);

        if (error) throw error;

        console.log('Sample User:', JSON.stringify(data[0], null, 2));
    } catch (err) {
        console.error('Error checking structure:', err);
    }
}

checkUserStructure();
