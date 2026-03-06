import client from './src/config/insforge';

async function testDeleteEnrollment() {
    const enrollmentId = 'b42b245f-83e1-4f9c-9cfa-01467c88463d';

    console.log(`Checking linked records for enrollment ${enrollmentId}...`);

    // First check for grades
    const { data: grades } = await client.database
        .from('grades')
        .select('*')
        .eq('enrollment_id', enrollmentId);

    console.log('Grades found:', grades?.length);

    // Check for attendances
    const { data: attendances } = await client.database
        .from('attendances')
        .select('*')
        .eq('enrollment_id', enrollmentId);

    console.log('Attendances found:', attendances?.length);

    console.log("Attempting enrollment delete...");
    const { data, error } = await client.database
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId)
        .select();

    if (error) {
        console.error("SUPABASE ERROR:");
        console.error(JSON.stringify(error, null, 2));
    } else {
        console.log("DELETE SUCCESS:", data);
    }
}

testDeleteEnrollment();
