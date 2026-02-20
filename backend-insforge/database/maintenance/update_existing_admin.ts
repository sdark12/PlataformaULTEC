
import client from './src/config/insforge';

async function updateAdmin() {
    console.log('Searching for existing admin profile...');
    const email = 'admin@admin.com';

    // Search in profiles table
    const { data: profiles, error } = await client.database
        .from('profiles')
        .select('id, email, role')
        .eq('email', email);

    if (error) {
        console.error('Error searching profile:', error.message);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log(`No profile found for ${email}. (Trigger might have failed or user not created)`);

        // Try sysadmin
        const sysEmail = 'sysadmin_1771463878184@ultec.edu'; // Use one from logs or variable
        // Actually better to just search for ANY profile to see if table works
        const { data: allProfiles } = await client.database.from('profiles').select('id, email').limit(5);
        console.log('Recent profiles:', JSON.stringify(allProfiles, null, 2));
        return;
    }

    const user = profiles[0];
    console.log(`Found user: ${user.id} (${user.email}) - Role: ${user.role}`);

    // Update to admin
    const { error: updateError } = await client.database
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', user.id);

    if (updateError) {
        console.error('Error updating role:', updateError.message);
    } else {
        console.log('Successfully updated role to admin.');
    }
}

updateAdmin();
