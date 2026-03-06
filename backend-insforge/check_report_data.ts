import client from './src/config/insforge';

async function checkData() {
    console.log("=== Checking Enrollments for Denzer ===");
    const { data: students } = await client.database.from('students').select('*').ilike('full_name', '%denzer%');
    console.log("Students:", students);

    if (students && students.length > 0) {
        const studentId = students[0].id;

        console.log("\n=== Enrollments ===");
        const { data: enrolls } = await client.database.from('enrollments').select('*, courses(name)').eq('student_id', studentId);
        console.log(enrolls);

        console.log("\n=== Payments ===");
        const { data: payments } = await client.database.from('payments').select('*').eq('student_id', studentId);
        console.log(payments);
    }
    process.exit(0);
}

checkData();
