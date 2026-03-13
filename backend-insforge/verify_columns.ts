import { adminClient } from './src/config/insforge';

async function verify() {
    console.log("Fetching first branch...");
    const { data, error } = await adminClient.database.from('branches').select('*').limit(1);
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Branch Schema Keys:", Object.keys(data[0]));
    }
}

verify();
