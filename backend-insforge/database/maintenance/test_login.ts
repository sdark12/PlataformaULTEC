
import client from './src/config/insforge';

async function test() {
    console.log('Testing connectivity...');

    // 1. Check Table Existence
    const { count, error } = await client.database
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error('Table check error:', error.message);
    } else {
        console.log(`Profiles table exists. Count: ${count}`);
    }

    // 2. Test Login
    const email = 'admin@admin.com';
    const password = 'password123';
    console.log(`Testing login for ${email}...`);

    const { data, error: loginError } = await client.auth.signInWithPassword({
        email,
        password
    });

    if (loginError) {
        console.error('Login Failed:', loginError.message);
        if (loginError.message.includes('verify')) {
            console.log('ACTION REQUIRED: Please verify your email via InsForge Dashboard.');
        }
    } else {
        if (data && data.user) {
            console.log('Login SUCCESS!');
            console.log('User ID:', data.user.id);
            console.log('Token:', data.accessToken);
        } else {
            console.log('Login returned success but no user data?');
        }
    }
}

test();
