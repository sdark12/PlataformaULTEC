import client from './src/config/insforge';

async function test() {
    console.log("Testing query");
    try {
        const { data, error } = await client.database
            .from('payments')
            .select(`
                payment_date,
                amount,
                method,
                created_by,
                enrollments!inner (
                    branch_id,
                    students (full_name),
                    courses (name)
                )
            `);

        if (error) {
            console.error("Supabase Error:", error);
        } else {
            console.log("Data count:", data?.length);
            if (data?.length > 0) {
                console.log("Sample Data:", JSON.stringify(data[0], null, 2));
            }
        }
    } catch (e) {
        console.error("Try Catch Error:", e);
    }
}

test();
