import client from './config/insforge';

async function checkPaymentStructure() {
    try {
        const { data, error } = await client.database
            .from('payments')
            .select('*')
            .limit(1);

        if (error) throw error;

        console.log('Sample Payment:', JSON.stringify(data[0], null, 2));
    } catch (err) {
        console.error('Error checking structure:', err);
    }
}

checkPaymentStructure();
