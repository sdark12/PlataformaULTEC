import { adminClient } from './src/config/insforge';

async function verify() {
    console.log("Fetching branches...");
    const { data, error } = await adminClient.database.from('branches').select('*');
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Branches:", JSON.stringify(data, null, 2));
    }
}

verify();
