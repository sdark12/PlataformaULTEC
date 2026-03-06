import client from './src/config/insforge';

async function checkNullStudents() {
    const { data, error } = await client.database
        .from('payments')
        .select('*')
        .is('student_id', null);

    console.log("Payments with null student_id:", data?.length);
    if (data && data.length > 0) {
        console.log("Example:", data[0]);
    }
    process.exit(0);
}

checkNullStudents();
