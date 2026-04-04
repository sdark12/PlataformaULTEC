import { createClient } from '@insforge/sdk';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.INSFORGE_URL || !process.env.INSFORGE_API_KEY) {
    console.error('FATAL: INSFORGE_URL and INSFORGE_API_KEY environment variables are required.');
    process.exit(1);
}

const client = createClient({
    baseUrl: process.env.INSFORGE_URL,
    anonKey: process.env.INSFORGE_API_KEY
});

export const adminClient = createClient({
    baseUrl: process.env.INSFORGE_URL,
    anonKey: process.env.INSFORGE_SERVICE_ROLE_KEY || process.env.INSFORGE_MASTER_KEY || process.env.INSFORGE_API_KEY
});

export default client;
