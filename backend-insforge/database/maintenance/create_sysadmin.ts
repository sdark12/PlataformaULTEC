
import client from './src/config/insforge';

async function setup() {
    console.log('Setting up sysadmin user...');

    const email = 'sysadmin@ultec.edu';
    const password = 'password123';
    let userId: string | null = null;

    // 1. Sign Up User
    console.log(`Attempting to sign up user ${email}...`);
    try {
        const response = await client.auth.signUp({
            email,
            password,
        });

        const signUpData = response.data;
        const signUpError = response.error;

        if (signUpError) {
            console.error('Error creating user:', signUpError.message);
            // If manual verification needed despite setting, we might be stuck
            if (signUpError.message.includes('verification')) {
                console.log('Note: Backend demands verification.');
            }
            // Try logging in anyway just in case
            if (signUpError.message.includes('already')) {
                const login = await client.auth.signInWithPassword({ email, password });
                if (login.data?.user) userId = login.data.user.id;
            }
        } else if (signUpData && signUpData.user) {
            console.log('User created:', signUpData.user.id);
            userId = signUpData.user.id;
        }

        if (!userId) {
            console.error('Could not obtain user ID. Exiting.');
            return;
        }

        // 2. Update Profile to Admin
        console.log(`Updating profile for user ${userId} to role 'admin'...`);

        const updateData: any = {
            role: 'admin',
            full_name: 'System Administrator'
        };

        const { error: updateError } = await client.database
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating profile:', updateError.message);
        } else {
            console.log('Sysadmin profile updated successfully.');
        }

    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

setup();
