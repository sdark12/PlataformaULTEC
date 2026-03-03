import { createClient } from '@insforge/sdk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const testAuth = async () => {
    // A fake test using the anon key to just verify the method syntax
    const verifyClient = createClient({
        baseUrl: process.env.INSFORGE_URL || 'https://w6x267sp.us-east.insforge.app',
        anonKey: process.env.INSFORGE_API_KEY || 'ik_065cc96706290cd59a1103c714006c96'
    });

    // We expect this to fail because we have no token, but it proves auth.getUser exists
    try {
        const res = await verifyClient.auth.getUser();
        console.log('getUser Result:', res);
    } catch (e) {
        console.error('Error:', e);
    }
};

testAuth();
