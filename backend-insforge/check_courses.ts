import client from './src/config/insforge';

async function checkCourses() {
    const { data: courses } = await client.database.from('courses').select('id, name, start_date').in('id', ['9010f625-f4dd-4c26-ae21-141b0e7db01e', '2e74421e-5fe3-4a45-8915-5480b939b276']);
    console.log(courses);
    process.exit(0);
}

checkCourses();
