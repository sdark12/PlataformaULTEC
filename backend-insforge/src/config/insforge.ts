import { createClient } from '@insforge/sdk';
import dotenv from 'dotenv';

dotenv.config();

const client = createClient({
    baseUrl: process.env.INSFORGE_URL || 'https://w6x267sp.us-east.insforge.app',
    anonKey: process.env.INSFORGE_API_KEY || 'ik_065cc96706290cd59a1103c714006c96'
});

export const adminClient = createClient({
    baseUrl: process.env.INSFORGE_URL || 'https://w6x267sp.us-east.insforge.app',
    anonKey: process.env.INSFORGE_SERVICE_ROLE_KEY || process.env.INSFORGE_MASTER_KEY || process.env.INSFORGE_API_KEY || ''
});

export default client;
