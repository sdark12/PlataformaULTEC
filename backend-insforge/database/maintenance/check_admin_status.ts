import { createClient } from '@insforge/sdk';
import * as dotenv from 'dotenv';
dotenv.config();

const client = createClient({
    baseUrl: 'https://w6x267sp.us-east.insforge.app',
    anonKey: 'ik_065cc96706290cd59a1103c714006c96'
});

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = 'password123';

async function checkAdmin() {
    console.log('--- Checking Admin User & Profile ---');

    console.log('1. Attempting Login...');
    const { data: auth, error: authError } = await client.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
    });

    if (authError || !auth?.user) {
        console.error('ERROR: Could not login.', authError?.message);
        return;
    }
    console.log('Login OK. User ID:', auth.user.id);

    // Debug: Print keys to find the token
    console.log('Auth Response Keys:', Object.keys(auth));
    if ((auth as any).session) console.log('Session found in auth.session');

    // Try to find the token
    // Try to find the token
    const token = (auth as any).accessToken;

    console.log('2. Trying to fetch Profile directly (as Authenticated)...');

    if (token) {
        const authClient = createClient({
            baseUrl: 'https://w6x267sp.us-east.insforge.app',
            anonKey: 'ik_065cc96706290cd59a1103c714006c96',
            edgeFunctionToken: token
        });

        const { data: profile, error: profileError } = await authClient.database
            .from('profiles')
            .select('*')
            .eq('id', auth.user.id)
            .single();

        if (profileError) {
            console.error('ERROR: Could not fetch profile with RLS.', profileError);
        } else {
            console.log('Profile (RLS Check):', profile);
        }

        console.log('3. Trying to fetch ALL Branches (for context)...');
        const { data: branches, error: branchError } = await authClient.database
            .from('branches')
            .select('*');

        if (branchError) {
            console.error('ERROR: Could not fetch branches.', branchError);
        }
        if (branches) {
            console.log('Branches found:', branches);
        }
    } else {
        console.error('ERROR: No session token received.');
    }
}

checkAdmin();
