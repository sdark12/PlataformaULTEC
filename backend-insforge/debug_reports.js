require('dotenv').config();

const URL = process.env.INSFORGE_URL || '';
const KEY = process.env.INSFORGE_API_KEY || '';

async function test() {
    console.log('Fetching payments via InsForge REST...');
    try {
        const response = await fetch(`${URL}/rest/v1/payments?select=*`, {
            headers: {
                'apikey': KEY,
                'Authorization': `Bearer ${KEY}`
            }
        });
        const payments = await response.json();
        console.log('Total raw Payments Count:', payments.length);
        if (payments.length) console.log('Sample Payment:', payments[0]);

        console.log('\nTesting join...');
        const joinResponse = await fetch(`${URL}/rest/v1/payments?select=payment_date,amount,method,enrollments!inner(branch_id,students(full_name),courses(name))`, {
            headers: {
                'apikey': KEY,
                'Authorization': `Bearer ${KEY}`
            }
        });
        const joinData = await joinResponse.json();
        console.log('Joined Payments Count:', joinData.length);
        if (joinData.length) {
            console.log('Sample Joined:', JSON.stringify(joinData[0], null, 2));
        } else {
            console.error('Join Error or Empty:', joinData);
        }
    } catch (e) {
        console.error(e);
    }
}

test();
