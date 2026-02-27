const { createClient } = require('@insforge/sdk');
const client = createClient({ baseUrl: 'https://w6x267sp.us-east.insforge.app', anonKey: 'ik_065cc96706290cd59a1103c714006c96' });
const orig = global.fetch;
global.fetch = async (url, opts) => {
    console.log('FETCH URL:', url);
    return orig(url, opts);
};
client.auth.signUp({ email: 'a@a.com', password: 'bbb' }).catch(() => { });
