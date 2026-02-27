import client from './config/insforge';

async function testCreateUser() {
    console.log('Testing create user...');
    const email = `testuser_${Date.now()}@example.com`;
    const password = 'Password123!';

    const { data: authData, error: authError } = await client.auth.signUp({
        email,
        password
    });

    console.log('Auth signUp result:', { authData, authError });

    if (authError || !authData?.user) {
        console.error('Failed to create auth user');
        return;
    }

    const profilePayload = {
        id: authData.user.id,
        email,
        full_name: 'Test Setup User',
        role: 'student',
        phone: '123456789',
        active: true
    };

    const profileResult = await client.database
        .from('profiles')
        .insert([profilePayload])
        .select()
        .single();

    console.log('Profile insert result:', profileResult);
}

testCreateUser();
