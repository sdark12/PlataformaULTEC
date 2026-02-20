
import client from './src/config/insforge';

async function setup() {
    console.log('Setting up admin user debug...');

    const timestamp = Date.now();
    const email = `sysadmin_${timestamp}@ultec.edu`;
    const password = 'password123';

    // 1. Sign Up User
    console.log(`Attempting to sign up user ${email}...`);
    try {
        const response = await client.auth.signUp({
            email,
            password,
        });

        console.log('SignUp Response:', JSON.stringify(response, null, 2));

        let userId = response.data?.user?.id;

        if (!userId && !response.error) {
            console.log('User ID missing but no error. Trying to sign in...');
            const login = await client.auth.signInWithPassword({ email, password });
            console.log('Login Response:', JSON.stringify(login, null, 2));
            userId = login.data?.user?.id;
        }

        if (!userId) {
            console.error('FAILED to get user ID.');
            return;
        }

        console.log(`User created/found: ${userId}`);

        // 2. Update Profile to Admin
        console.log(`Updating profile for user ${userId} to role 'admin'...`);

        const updateData: any = {
            role: 'admin',
            full_name: 'SysAdmin Debug'
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
