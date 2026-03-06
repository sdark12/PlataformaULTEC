import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

async function testPayment() {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT),
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // Find a student and enrollment to test
        const res = await client.query(`
            SELECT e.student_id, e.id as enrollment_id, c.name, e.price 
            FROM enrollments e
            JOIN courses c ON e.course_id = c.id
            LIMIT 1
        `);

        if (res.rows.length === 0) return console.log("No enrollments found");

        const enroll = res.rows[0];
        console.log("Testing with:", enroll);

        // Simulate Controller Logic
        const amount = enroll.price;
        const discount = 0;
        const reqBody = {
            student_id: enroll.student_id,
            courses: [{
                enrollment_id: enroll.enrollment_id,
                amount: amount,
                discount: discount
            }],
            method: 'CASH',
            payment_type: 'TUITION',
            tuition_month: '2026-03'
        };

        const targetCourses = reqBody.courses;
        const totalAmount = targetCourses.reduce((sum, c) => sum + Number(c.amount), 0);
        let firstPaymentRecord = null;

        console.log("Target Courses Extracted:", targetCourses);
        // ... Logic follows payments.controller.ts

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

testPayment();
