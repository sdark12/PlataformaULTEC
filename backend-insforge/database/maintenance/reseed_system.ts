import { createClient } from '@insforge/sdk';
import * as dotenv from 'dotenv';
dotenv.config();

const client = createClient({
    baseUrl: process.env.INSFORGE_URL || '',
    anonKey: process.env.INSFORGE_API_KEY || ''
});

const ADMIN_EMAIL = 'admin@admin.com';
const ADMIN_PASSWORD = 'password123';

async function seedSystem() {
    console.log('Seeding System...');

    // 1. Get the Branch ID (assuming created by SQL script)
    const { data: branch, error: branchError } = await client.database
        .from('branches')
        .select('id')
        .eq('name', 'Sede Central')
        .single();

    if (branchError || !branch) {
        console.error('Error finding branch:', branchError);
        return;
    }
    console.log('Found Branch:', branch.id);

    // 2. Create Admin User
    console.log('Creating Admin User...');
    const { data: authUser, error: authError } = await client.auth.signUp({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
    });

    if (authError) {
        console.log('User might already exist:', authError.message);
        // Try sign in to get ID
        const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });

        if (loginError) {
            console.error('CRITICAL: Cannot access admin user', loginError);
            return;
        }

        // Check if profile exists
        if (loginData?.user) {
            await ensureProfile(loginData.user.id, branch.id);
        }
    } else if (authUser?.user) {
        console.log('Admin User Created:', authUser.user.id);
        await ensureProfile(authUser.user.id, branch.id);
    }
}

async function ensureProfile(userId: string, branchId: string) {
    console.log('Ensuring Profile for:', userId);

    // Check if profile exists
    const { data: existingProfile } = await client.database
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (existingProfile) {
        console.log('Profile already exists, updating...');
        const { error } = await client.database
            .from('profiles')
            .update({ role: 'admin', branch_id: branchId, full_name: 'System Admin' })
            .eq('id', userId);
        if (error) console.error('Error updating profile:', error);
        else console.log('Profile updated to Admin.');
    } else {
        console.log('Creating new profile...');
        const { error } = await client.database
            .from('profiles')
            .insert([{
                id: userId,
                role: 'admin',
                branch_id: branchId,
                full_name: 'System Admin',
                email: ADMIN_EMAIL
            }]);
        if (error) console.error('Error creating profile:', error);
        else console.log('Profile created.');
    }
}

seedSystem().catch(console.error);
