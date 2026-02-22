import client from './config/insforge';

async function checkGradesTable() {
    try {
        const { data, error } = await client.database
            .from('grades')
            .select('*')
            .limit(1);

        if (error) {
            console.log('Error or table does not exist:', error.message);
        } else {
            console.log('Grades table exists. Sample:', data[0] || 'No records yet');
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkGradesTable();
