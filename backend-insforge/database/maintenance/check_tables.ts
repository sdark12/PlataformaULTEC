
import client from './src/config/insforge';

async function check_tables() {
    console.log('Checking tables...');

    // Check roles
    const { data: roles, error: rolesError } = await client.database.from('roles').select('id').limit(1);
    if (rolesError) console.log('Roles table check failed:', rolesError.message);
    else console.log('Roles table exists.');

    // Check branches
    const { data: branches, error: branchesError } = await client.database.from('branches').select('id').limit(1);
    if (branchesError) console.log('Branches table check failed:', branchesError.message);
    else console.log('Branches table exists.');

    // Check courses
    const { data: courses, error: coursesError } = await client.database.from('courses').select('id').limit(1);
    if (coursesError) console.log('Courses table check failed:', coursesError.message);
    else console.log('Courses table exists.');
}

check_tables();
