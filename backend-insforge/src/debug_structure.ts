import client from './config/insforge';

async function checkStudentStructure() {
    try {
        const { data, error } = await client.database
            .from('students')
            .select('*')
            .limit(1);

        if (error) throw error;

        console.log('Sample Student:', JSON.stringify(data[0], null, 2));
        if (data[0]) {
            console.log('ID Type:', typeof data[0].id);
        }
    } catch (err) {
        console.error('Error checking structure:', err);
    }
}

checkStudentStructure();
