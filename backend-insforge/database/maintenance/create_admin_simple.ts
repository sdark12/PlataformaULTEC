
import client from './src/config/insforge';

async function setup() {
    console.log('Setting up admin user...');

    const email = 'admin@admin.com';
    const password = 'password123';
    let userId: string | null = null;
    let createdNew = false; // Add variable

    // 1. Sign Up User
    console.log(`Attempting to sign up user ${email}...`);
    try {
        const response = await client.auth.signUp({
            email,
            password,
        });

        const signUpData = response.data;
        const signUpError = response.error;

        // console.log('Response:', JSON.stringify(response, null, 2));

        if (signUpError) {
            if (signUpError.message && (signUpError.message.includes('already registered') || signUpError.message.includes('User already exists'))) {
                console.log('User already registered. Signing in...');
                const signInResponse = await client.auth.signInWithPassword({
                    email,
                    password
                });

                if (signInResponse.error) {
                    console.error('Could not sign in existing user:', signInResponse.error.message);
                    return;
                }

                if (signInResponse.data && signInResponse.data.user) {
                    userId = signInResponse.data.user.id;
                    console.log('Signed in successfully. User ID:', userId);
                }
            } else {
                console.error('Error creating user:', signUpError.message);
                return;
            }
        } else if (signUpData && signUpData.user) {
            console.log('User created.');
            userId = signUpData.user.id;
            createdNew = true;
        }

        if (!userId) {
            console.error('Could not determine user ID.');
            return;
        }

        // 2. Update Profile to Admin
        console.log(`Updating profile for user ${userId} to role 'admin'...`);

        const updateData: any = {
            role: 'admin',
            full_name: 'SysAdmin'
        };

        const { error: updateError } = await client.database
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating profile:', updateError.message);
        } else {
            console.log('Admin profile updated successfully.');
        }

    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

setup();
