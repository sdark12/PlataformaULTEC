import client from './src/config/insforge';

async function check() {
    console.log("Checking Payments...");
    const { data, error } = await client.database
        .from('payments')
        .select(`
                id,
                amount,
                payment_date,
                method,
                reference_number,
                description,
                tuition_month,
                payment_type,
                discount,
                students!inner (
                    full_name,
                    branch_id
                )
            `)
        .limit(1);
    console.log("Payments Error:", error?.message || "No error");

    console.log("Checking Enrollments...");
    const { data: d2, error: e2 } = await client.database
        .from('enrollments')
        .select(`
                id,
                student_id,
                enrollment_date,
                is_active,
                schedule_id,
                students (full_name),
                courses (name),
                course_schedules (grade, day_of_week, start_time, end_time)
            `)
        .limit(1);
    console.log("Enrollments Error:", e2?.message || "No error");
    process.exit(0);
}

check();
