import client from './src/config/insforge';

async function check() {
    const { data: cols, error: err } = await client.database
        .from('assignments')
        .select('*')
        .limit(1);

    if (err) {
        console.error("Error fetching assignments:", err);
    } else {
        console.log("Assignments table first row:", cols);
    }
    process.exit(0);
}

check();
