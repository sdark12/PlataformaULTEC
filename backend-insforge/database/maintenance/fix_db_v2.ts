
import client from './src/config/insforge';

async function fix_database() {
    console.log('Inserting default roles...');

    // Attempt to insert roles
    // We already tried "admin", it might exist if table was partially created.
    // Let's try to upsert the roles.

    const roles = [
        { name: 'admin', description: 'Administrator' },
        { name: 'instructor', description: 'Instructor' },
        { name: 'student', description: 'Student' }
    ];

    for (const role of roles) {
        console.log(`Ensuring role: ${role.name}...`);
        const { error } = await client.database
            .from('roles')
            .upsert(role, { onConflict: 'name' });

        if (error) {
            console.error(`Error with role ${role.name}:`, error.message);
            if (error.message && error.message.includes('relation "roles" does not exist')) {
                console.log('CRITICAL: Roles table missing. YOU MUST RUN SQL IN DASHBOARD MANUALLY.');
                return;
            }
        } else {
            console.log(`Role ${role.name} OK.`);
        }
    }

    console.log('Inserting default branch...');
    const branch = {
        name: 'Sede Principal',
        address: 'Ciudad',
        email: 'admin@ultec.edu'
    };

    // Upsert branch? branch doesn't have unique constraint on name usually unless we added it via SQL.
    // Let's check existence first.
    const { data: existingBranches, error: branchCheckError } = await client.database
        .from('branches')
        .select('id')
        .eq('name', branch.name);

    if (branchCheckError) {
        console.error('Branch check error:', branchCheckError.message);
    } else if (existingBranches && existingBranches.length === 0) {
        const { error: insertBranch } = await client.database.from('branches').insert(branch);
        if (insertBranch) console.error('Branch insert error:', insertBranch.message);
        else console.log('Main Branch created.');
    } else {
        console.log('Main Branch already exists.');
    }

    // Now check for PROFILES table via simple select
    console.log('Checking profiles table...');
    const { count, error: profileError } = await client.database
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    if (profileError) {
        console.error('Profiles table error:', profileError.message);
        console.log('CRITICAL: Profiles table missing. YOU MUST RUN SQL IN DASHBOARD MANUALLY.');
    } else {
        console.log(`Profiles table OK. Count: ${count}`);
    }
}

fix_database();
