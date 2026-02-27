const { createClient } = require('@insforge/sdk');

async function testSDK() {
    console.log("Creating client...");
    const client = createClient({
        baseUrl: 'https://w6x267sp.us-east.insforge.app',
        anonKey: 'ik_065cc96706290cd59a1103c714006c96'
    });

    // override fetch to intercept
    const originalFetch = global.fetch;
    global.fetch = async (url, options) => {
        console.log("SDK FETCHING:", url, options.method);
        return originalFetch(url, options);
    };

    console.log("Calling signUp...");
    await client.auth.signUp({ email: 'test_intercept@example.com', password: 'password123' }).catch(e => console.error(e));
}
testSDK();
