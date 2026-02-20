
import client from './src/config/insforge';

async function verify() {
    console.log('Starting System Verification...');

    // 1. Check Connectivity
    const { count, error: tableError } = await client.database
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    if (tableError) {
        console.error('CRITICAL: Database connectivity failed or tables missing:', tableError.message);
        if (tableError.message.includes('relation "profiles" does not exist')) {
            console.log('Please run the provided SQL script in InsForge Dashboard to create tables.');
        }
        return;
    }
    console.log('Database connected. Profiles table exists.');

    // 2. Admin Login
    const email = 'admin@admin.com';
    const password = 'password123';
    console.log(`Attempting login as ${email}...`);

    const { data: auth, error: loginError } = await client.auth.signInWithPassword({
        email,
        password
    });


    if (loginError || !auth) {
        console.error('Login Failed:', loginError?.message || 'No auth data returned');
        if (loginError?.message.includes('verify')) {
            console.log('ACTION REQUIRED: Verify email in InsForge Dashboard > Users.');
        }
        return;
    }

    console.log('Login Successful!');
    const token = auth.accessToken;
    const userId = auth.user.id; // Corrected: user is inside auth.user object, not directly on data? 
    // Wait, let's check auth object structure. It's usually { user, session, weakPassword? }
    // Or just session with user?
    // Based on previous logs: data: { accessToken: ..., user: ... }

    // 3. Check Role
    const { data: profile, error: profileError } = await client.database
        .from('profiles')
        .select('role')
        .eq('id', userId) // userId is valid here
        .single();

    if (profileError) console.error('Profile fetch failed:', profileError.message);
    else console.log('User Role:', profile.role);

    // 4. Create Branch (if needed)
    console.log('Checking branches...');
    const { data: branches } = await client.database.from('branches').select('id, name');
    let branchId;
    if (branches && branches.length > 0) {
        console.log('Branch found:', branches[0].name);
        branchId = branches[0].id;
    } else {
        console.log('No branches found. Attempting to create one...');
        const { data: newBranch, error: createBranchError } = await client.database
            .from('branches')
            .insert([{ name: 'Test Branch', address: 'Test Address', email: 'test@example.com' }])
            .select()
            .single();

        if (createBranchError) {
            console.error('Failed to create branch:', createBranchError.message);
            return;
        }
        branchId = newBranch.id;
        console.log('Created branch:', branchId);
    }

    // 5. Create Course
    console.log('Creating Test Course...');
    const timestamp = Date.now();
    const { data: course, error: courseError } = await client.database
        .from('courses')
        .insert([{
            branch_id: branchId,
            name: `Test Course ${timestamp}`,
            description: 'Automated test course',
            monthly_fee: 100,
            is_active: true
        }])
        .select()
        .single();

    if (courseError) {
        console.error('Failed to create course:', courseError.message);
    } else {
        console.log('Course ID:', course.id);
    }

    console.log('Verification Complete!');
}

verify();
