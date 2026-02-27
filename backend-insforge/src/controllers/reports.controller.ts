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
    const { start_date, end_date, method } = req.query;

    try {
        let query = client.database
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
            `)
            .eq('enrollments.branch_id', branchId)
            .order('payment_date', { ascending: false });

        if (start_date) {
            query = query.gte('payment_date', `${start_date}T00:00:00.000Z`);
        }
        if (end_date) {
            query = query.lte('payment_date', `${end_date}T23:59:59.999Z`);
        }
        if (method) {
            query = query.eq('method', method as string);
        }

        const { data, error } = await query;

        if (error) throw error;

        const flatData = data.map((p: any) => ({
            payment_date: p.payment_date,
            amount: p.amount,
            method: p.method,
            collector_name: 'N/A',
            student_name: p.enrollments?.students?.full_name,
            course_name: p.enrollments?.courses?.name
        }));

        res.json(flatData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving financial report' });
    }
};

export const getPendingPaymentsReport = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    // Ensure we count months correctly
    const currentDate = new Date();

    try {
        // 1. Fetch active enrollments with their courses and student details
        const { data: enrollments, error: enrollError } = await client.database
            .from('enrollments')
            .select(`
                id,
                student_id,
                course_id,
                enrollment_date,
                students!inner (full_name),
                courses!inner (name, monthly_fee, duration_months, start_date, end_date)
            `)
            .eq('branch_id', branchId)
            .eq('is_active', true);

        if (enrollError) throw enrollError;

        // 2. Fetch all successful TUITION payments for this branch
        const { data: payments, error: paymentsError } = await client.database
            .from('payments')
            .select(`
                enrollment_id,
                amount,
                enrollments!inner (branch_id)
            `)
            .eq('enrollments.branch_id', branchId)
            .eq('payment_type', 'TUITION'); // IMPORTANT! Only count TUITION payments to clear debt

        if (paymentsError) throw paymentsError;

        // Group payments by enrollment
        const paymentsByEnrollment: Record<number, number> = {};
        payments?.forEach((p: any) => {
            if (!paymentsByEnrollment[p.enrollment_id]) {
                paymentsByEnrollment[p.enrollment_id] = 0;
            }
            paymentsByEnrollment[p.enrollment_id] += Number(p.amount);
        });

        // 3. Calculate pending debt
        const pendingData: any[] = [];

        enrollments?.forEach((enrollment: any) => {
            const enrollmentDate = new Date(enrollment.enrollment_date);
            const monthlyFee = Number(enrollment.courses.monthly_fee);

            // Si el curso creado antes de la migración no tiene duration_months, usar 11 por defecto
            const durationMonths = enrollment.courses.duration_months || 11;

            // Si el curso tiene fecha de inicio (start_date), usarla preferiblemente
            const baseDateForCalculation = enrollment.courses.start_date
                ? new Date(enrollment.courses.start_date)
                : enrollmentDate;

            let monthsElapsed = 0;
            if (currentDate > baseDateForCalculation) {
                // Approximate months elapsed (can be more precise depending on business rules)
                const yearsDiff = currentDate.getFullYear() - baseDateForCalculation.getFullYear();
                const monthsDiff = currentDate.getMonth() - baseDateForCalculation.getMonth();
                monthsElapsed = (yearsDiff * 12) + monthsDiff + 1; // +1 to include the current month if partial
            } else {
                monthsElapsed = 1; // At least one month is charged when starting
            }

            // Cap the months to the course duration
            const effectiveMonths = Math.min(monthsElapsed, durationMonths);

            const totalDue = effectiveMonths * monthlyFee;
            const totalPaid = paymentsByEnrollment[enrollment.id] || 0;
            const pendingAmount = totalDue - totalPaid;

            if (pendingAmount > 0) {
                pendingData.push({
                    student_name: enrollment.students.full_name,
                    course_name: enrollment.courses.name,
                    monthly_fee: monthlyFee,
                    months_overdue: Math.ceil(pendingAmount / monthlyFee),
                    pending_amount: pendingAmount
                });
            }
        });

        res.json(pendingData);

    } catch (error) {
        console.error('Error calculating pending payments:', error);
        res.status(500).json({ message: 'Error retrieving pending payments report' });
    }
};

