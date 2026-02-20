import { Request, Response } from 'express';
import client from '../config/insforge';

export const getDashboardStats = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;

    try {
        // 1. Active Students
        const { count: activeStudents, error: studentsError } = await client.database
            .from('students')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', branchId)
            // .eq('status', 'ACTIVE') // Assuming status column exists
            ;

        if (studentsError) console.error('Stats Students Error:', studentsError);

        // 2. Active Courses
        const { count: activeCourses, error: coursesError } = await client.database
            .from('courses')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', branchId)
            .eq('is_active', true);

        if (coursesError) console.error('Stats Courses Error:', coursesError);

        // 3. Monthly Income (Current Month)
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        // Fetch payments for this branch this month
        // We need to join with enrollments to filter by branch
        const { data: payments, error: incomeError } = await client.database
            .from('payments')
            .select(`
                amount,
                enrollments!inner (
                    branch_id
                )
            `)
            .eq('enrollments.branch_id', branchId)
            .gte('payment_date', currentMonthStart.toISOString());

        let monthlyIncome = 0;
        if (!incomeError && payments) {
            monthlyIncome = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        } else {
            console.error('Stats Income Error:', incomeError);
        }

        // 4. Pending Payments Count
        // Join financial_status with enrollments
        const { count: pendingPayments, error: pendingError } = await client.database
            .from('financial_status')
            .select(`
                *,
                enrollments!inner (
                    branch_id
                )
            `, { count: 'exact', head: true })
            .eq('enrollments.branch_id', branchId)
            .eq('status', 'PENDING');

        if (pendingError) console.error('Stats Pending Error:', pendingError);


        res.json({
            active_students: activeStudents || 0,
            active_courses: activeCourses || 0,
            monthly_income: monthlyIncome,
            pending_payments: pendingPayments || 0
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving stats' });
    }
};

export const getFinancialReport = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    const { start_date, end_date } = req.query;

    try {
        let query = client.database
            .from('payments')
            .select(`
                payment_date,
                amount,
                method,
                enrollments!inner (
                    branch_id,
                    students (full_name),
                    courses (name)
                )
            `)
            .eq('enrollments.branch_id', branchId)
            .order('payment_date', { ascending: false });

        if (start_date) {
            query = query.gte('payment_date', start_date as string);
        }
        if (end_date) {
            query = query.lte('payment_date', end_date as string);
        }

        const { data, error } = await query;

        if (error) throw error;

        const flatData = data.map((p: any) => ({
            payment_date: p.payment_date,
            amount: p.amount,
            method: p.method,
            student_name: p.enrollments?.students?.full_name,
            course_name: p.enrollments?.courses?.name
        }));

        res.json(flatData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving financial report' });
    }
};
