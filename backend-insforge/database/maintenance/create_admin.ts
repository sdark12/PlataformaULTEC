
import client from './src/config/insforge';

async function setup() {
    console.log('Setting up admin user and roles...');

    // 1. Create Roles
    const roles = [
        { name: 'admin', description: 'Administrator' },
        { name: 'instructor', description: 'Instructor' },
        { name: 'student', description: 'Student' }
    ];

    for (const role of roles) {
        const { error } = await client.database
            .from('roles')
            .upsert(role, { onConflict: 'name' });

        if (error) console.error(`Error creating role ${role.name}:`, error.message);
        else console.log(`Role ${role.name} ensure/created.`);
    }

    // 2. Create/Get Main Branch
    const branchData = {
        name: 'Sede Principal',
        address: 'Ciudad',
        phone: '555-0100',
        email: 'admin@ultec.edu'
    };

    let branchId: number;

    const { data: existingBranches, error: branchError } = await client.database
        .from('branches')
        .select('id')
        .eq('name', branchData.name); // Removed maybeSingle() to be safe, using array check

    if (existingBranches && existingBranches.length > 0) {
        branchId = existingBranches[0].id;
        console.log(`Branch '${branchData.name}' already exists (ID: ${branchId})`);
    } else {
        const { data: newBranch, error: createBranchError } = await client.database
            .from('branches')
            .insert(branchData)
            .select()
            .single();

        if (createBranchError) {
            console.error('Error creating branch:', createBranchError.message);
            return;
        }
        if (!newBranch) {
            console.error('Branch created but no data returned.');
            return;
        }
        branchId = newBranch.id;
        console.log(`Created branch '${branchData.name}' (ID: ${branchId})`);
    }

    // 3. Create/Get Admin User
    const email = 'admin@admin.com';
    const password = 'password123';
    let userId: string | null = null;

    console.log(`Attempting to sign up user ${email}...`);
    const { data: signUpData, error: signUpError } = await client.auth.signUp({
        email,
        password,
    });

    if (signUpError) {
        if (signUpError.message.includes('already registered')) {
            console.log('User already registered. Trying to sign in to get ID...');
            const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
                email,
                password
            });

            if (signInError) {
                console.error('Could not sign in existing user:', signInError.message);
                return;
            }
            if (signInData && signInData.user) {
                userId = signInData.user.id;
                console.log('Signed in successfully.');
            }
        } else {
            console.error('Error creating user:', signUpError.message);
            return;
        }
    } else if (signUpData && signUpData.user) {
        console.log('User created.');
        userId = signUpData.user.id;
    }

    if (userId) {
        await updateUserProfile(userId, branchId);
    } else {
        console.error('Could not determine user ID.');
    }
}

async function updateUserProfile(userId: string, branchId: number) {
    console.log(`Updating profile for user ${userId}...`);

    // Get Admin Role ID
    const { data: roleData, error: roleError } = await client.database
        .from('roles')
        .select('id')
        .eq('name', 'admin')
        .single();

    if (roleError || !roleData) {
        console.error('Admin role not found!');
        return;
    }

    // Update Profile
    const { error: updateError } = await client.database
        .from('profiles')
        .update({
            role: 'admin',
            role_id: roleData.id,
            branch_id: branchId,
            full_name: 'System Administrator'
        })
        .eq('id', userId);

    if (updateError) console.error('Error updating profile:', updateError.message);
    else console.log('Admin profile updated successfully.');
}

setup();
