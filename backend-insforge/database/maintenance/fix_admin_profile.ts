
import client from './src/config/insforge';

async function fix_profile() {
    console.log('Fixing Admin Profile...');

    const email = 'admin@admin.com';

    // 1. Sign in to get User ID
    const { data: auth, error: loginError } = await client.auth.signInWithPassword({
        email,
        password: 'password123'
    });

    if (loginError || !auth?.user) {
        console.error('Login failed:', loginError?.message || 'No user data');
        return;
    }

    const userId = auth.user.id;
    console.log(`User ID: ${userId}`);

    // 2. Get Admin Role ID
    const { data: roleData } = await client.database
        .from('roles')
        .select('id')
        .eq('name', 'admin')
        .single();

    const roleId = roleData?.id;

    // 3. Get Branch ID
    const { data: branchData } = await client.database
        .from('branches')
        .select('id')
        .single();

    const branchId = branchData?.id;

    // 4. Upsert Profile
    const { error: upsertError } = await client.database
        .from('profiles')
        .upsert({
            id: userId,
            email: email,
            full_name: 'System Administrator',
            role: 'admin',
            role_id: roleId,
            branch_id: branchId,
            is_active: true
        });

    if (upsertError) {
        console.error('Profile fix failed:', upsertError.message);
    } else {
        console.log('Admin Profile fixed successfully.');
    }
}

fix_profile();
