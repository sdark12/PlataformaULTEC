import client from './config/insforge';

async function checkProfile() {
    try {
        const { data, error } = await client.database
            .from('profiles')
            .select('*');

        console.log("Profiles:");
        console.log(JSON.stringify(data, null, 2));
        if (error) console.error(error);
    } catch (e) {
        console.error(e);
    }
}
checkProfile();
