import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';
import NodeCache from 'node-cache';

// Cache for 5 minutes by default
const dashboardCache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

export const getDashboardStats = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    const cacheKey = branchId || 'global';
    
    // Check if we have cached stats for this branch
    const cachedStats = dashboardCache.get(cacheKey);
    if (cachedStats) {
        return res.json(cachedStats);
    }

    try {
        // 1. Active Students
        let studentsQuery = client.database
            .from('students')
            .select('*', { count: 'exact', head: true });
        if (branchId) studentsQuery = studentsQuery.eq('branch_id', branchId);

        const { count: activeStudents, error: studentsError } = await studentsQuery;
        if (studentsError) console.error('Stats Students Error:', studentsError);

        // 2. Active Courses
        let coursesQuery = client.database
            .from('courses')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);
        if (branchId) coursesQuery = coursesQuery.eq('branch_id', branchId);

        const { count: activeCourses, error: coursesError } = await coursesQuery;
        if (coursesError) console.error('Stats Courses Error:', coursesError);

        // 3. Monthly Income (Current Month)
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        let paymentsQuery = client.database
            .from('payments')
            .select(`
                amount,
                enrollments!inner (
                    branch_id
                )
            `)
            .gte('payment_date', currentMonthStart.toISOString());
        if (branchId) paymentsQuery = paymentsQuery.eq('enrollments.branch_id', branchId);

        const { data: payments, error: incomeError } = await paymentsQuery;

        let monthlyIncome = 0;
        if (!incomeError && payments) {
            monthlyIncome = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
        } else {
            console.error('Stats Income Error:', incomeError);
        }

        // 4. Pending Payments Count
        let pendingQuery = client.database
            .from('financial_status')
            .select(`
                *,
                enrollments!inner (
                    branch_id
                )
            `, { count: 'exact', head: true })
            .eq('status', 'PENDING');
        if (branchId) pendingQuery = pendingQuery.eq('enrollments.branch_id', branchId);

        const { count: pendingPayments, error: pendingError } = await pendingQuery;
        if (pendingError) console.error('Stats Pending Error:', pendingError);

        const responsePayload = {
            active_students: activeStudents || 0,
            active_courses: activeCourses || 0,
            monthly_income: monthlyIncome,
            pending_payments: pendingPayments || 0
        };

        dashboardCache.set(cacheKey, responsePayload);

        res.json(responsePayload);

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
            .order('payment_date', { ascending: false });

        if (branchId) {
            query = query.eq('enrollments.branch_id', branchId);
        }
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
        let enrollQuery = client.database
            .from('enrollments')
            .select(`
                id,
                student_id,
                course_id,
                enrollment_date,
                students!inner (full_name),
                courses!inner (name, monthly_fee, duration_months, start_date, end_date)
            `)
            .eq('is_active', true);
        if (branchId) enrollQuery = enrollQuery.eq('branch_id', branchId);

        const { data: enrollments, error: enrollError } = await enrollQuery;
        if (enrollError) throw enrollError;

        // 2. Fetch all successful TUITION payments for this branch
        let paymentsQuery = client.database
            .from('payments')
            .select(`
                enrollment_id,
                amount,
                discount,
                enrollments!inner (branch_id)
            `)
            .eq('payment_type', 'TUITION'); // IMPORTANT! Only count TUITION payments to clear debt
        if (branchId) paymentsQuery = paymentsQuery.eq('enrollments.branch_id', branchId);

        const { data: payments, error: paymentsError } = await paymentsQuery;
        if (paymentsError) throw paymentsError;

        // Group payments by enrollment
        const paymentsByEnrollment: Record<number, number> = {};
        payments?.forEach((p: any) => {
            if (!paymentsByEnrollment[p.enrollment_id]) {
                paymentsByEnrollment[p.enrollment_id] = 0;
            }
            // Agregamos amount + discount para que los descuentos reduzcan la mora
            const paidValue = Number(p.amount || 0) + Number(p.discount || 0);
            paymentsByEnrollment[p.enrollment_id] += paidValue;
        });

        console.log("=== DEBUG PENDING REPORT ===");
        console.log("Payments fetched for branch:", branchId, "Count:", payments?.length);
        console.log("PaymentsByEnrollment mapping:", paymentsByEnrollment);

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

export const getStudentReports = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    const db = req.dbUserClient || client;

    try {
        let query = db.database
            .from('students')
            .select(`
                *,
                enrollments (
                    id,
                    is_active,
                    courses ( name ),
                    course_schedules ( grade, day_of_week, start_time, end_time )
                )
            `)
            .order('full_name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Transform results for easier frontend consumption
        const formattedData = data.map((student: any) => {
            const activeEnrollments = (student.enrollments || []).filter((e: any) => e.is_active);
            return {
                id: student.id,
                full_name: student.full_name,
                identification_document: student.identification_document,
                phone: student.phone,
                previous_school: student.previous_school,
                personal_code: student.personal_code,
                enrollments: activeEnrollments.map((e: any) => ({
                    course_name: e.courses?.name || 'N/A',
                    grade: e.course_schedules?.grade || 'N/A',
                    day_of_week: e.course_schedules?.day_of_week || 'N/A',
                    start_time: e.course_schedules?.start_time || '',
                    end_time: e.course_schedules?.end_time || ''
                }))
            };
        });

        res.json(formattedData);
    } catch (error) {
        console.error('Error fetching student reports:', error);
        res.status(500).json({ message: 'Error retrieving student reports' });
    }
};

// ==========================================
// STUDENT DASHBOARD STATS
// ==========================================
export const getStudentDashboardStats = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        // 1. Find student record
        const { data: studentRecord } = await adminClient.database
            .from('students')
            .select('id')
            .or(`id.eq.${userId},user_id.eq.${userId}`)
            .maybeSingle();

        if (!studentRecord) {
            return res.json({
                pending_assignments: 0,
                attendance_percentage: 0,
                average_grade: 0,
                total_courses: 0,
                recent_resources: [],
                latest_announcement: null
            });
        }

        const studentId = studentRecord.id;

        // 2. Get enrollments to find courses
        const { data: enrollments } = await adminClient.database
            .from('enrollments')
            .select('course_id, courses (id, name)')
            .eq('student_id', studentId)
            .eq('is_active', true);

        const courseIds = enrollments?.map((e: any) => e.course_id) || [];
        const totalCourses = courseIds.length;

        // 3. Pending assignments (not submitted by this student)
        let pendingAssignments = 0;
        if (courseIds.length > 0) {
            const { data: allAssignments } = await adminClient.database
                .from('assignments')
                .select('id')
                .in('course_id', courseIds)
                .gte('due_date', new Date().toISOString());

            const { data: submissions } = await adminClient.database
                .from('assignment_submissions')
                .select('assignment_id')
                .eq('student_id', studentId);

            const submittedIds = new Set(submissions?.map((s: any) => s.assignment_id) || []);
            pendingAssignments = allAssignments?.filter((a: any) => !submittedIds.has(a.id)).length || 0;
        }

        // 4. Attendance percentage
        const { data: attendanceRecords } = await adminClient.database
            .from('attendance')
            .select('status')
            .eq('student_id', studentId);

        let attendancePercentage = 0;
        if (attendanceRecords && attendanceRecords.length > 0) {
            const totalRecords = attendanceRecords.length;
            const presentRecords = attendanceRecords.filter((r: any) => r.status === 'present' || r.status === 'late').length;
            attendancePercentage = Math.round((presentRecords / totalRecords) * 100);
        }

        // 5. Average grade
        const { data: grades } = await adminClient.database
            .from('grades')
            .select('score')
            .eq('student_id', studentId);

        let averageGrade = 0;
        if (grades && grades.length > 0) {
            const totalScore = grades.reduce((sum: number, g: any) => sum + Number(g.score), 0);
            averageGrade = Math.round((totalScore / grades.length) * 10) / 10;
        }

        // 6. Recent resources from enrolled courses
        let recentResources: any[] = [];
        if (courseIds.length > 0) {
            const { data: resources } = await adminClient.database
                .from('course_resources')
                .select('id, title, resource_type, created_at, course_id, courses (name)')
                .in('course_id', courseIds)
                .order('created_at', { ascending: false })
                .limit(3);
            recentResources = resources || [];
        }

        // 7. Latest announcement
        const { data: announcements } = await adminClient.database
            .from('announcements')
            .select('id, title, content, created_at')
            .or('target_role.eq.all,target_role.eq.student')
            .order('created_at', { ascending: false })
            .limit(1);

        res.json({
            pending_assignments: pendingAssignments,
            attendance_percentage: attendancePercentage,
            average_grade: averageGrade,
            total_courses: totalCourses,
            recent_resources: recentResources,
            latest_announcement: announcements?.[0] || null
        });

    } catch (error) {
        console.error('Error getting student dashboard stats:', error);
        res.status(500).json({ message: 'Error retrieving student stats' });
    }
};

// ==========================================
// ADMIN DASHBOARD EXTENDED
// ==========================================
export const getAdminDashboardExtended = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    const db = req.dbUserClient || client;

    try {
        // 1. Enrollments this month
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        let enrollThisMonthQuery = db.database
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', currentMonthStart.toISOString());
        if (branchId) enrollThisMonthQuery = enrollThisMonthQuery.eq('branch_id', branchId);

        const { count: enrollmentsThisMonth } = await enrollThisMonthQuery;

        // 2. Top delinquent students (with pending payments)
        let pendingQuery = db.database
            .from('financial_status')
            .select(`
                amount_due,
                due_date,
                enrollments!inner (
                    branch_id,
                    students (id, full_name)
                )
            `)
            .eq('status', 'PENDING')
            .order('due_date', { ascending: true })
            .limit(20);
        if (branchId) pendingQuery = pendingQuery.eq('enrollments.branch_id', branchId);

        const { data: pendingStatuses } = await pendingQuery;

        // Group by student and sum amounts
        const studentDebtMap = new Map<string, { name: string; total: number; oldest_due: string }>();
        pendingStatuses?.forEach((item: any) => {
            const student = item.enrollments?.students;
            if (!student) return;
            const existing = studentDebtMap.get(student.id);
            if (existing) {
                existing.total += Number(item.amount_due);
            } else {
                studentDebtMap.set(student.id, {
                    name: student.full_name,
                    total: Number(item.amount_due),
                    oldest_due: item.due_date
                });
            }
        });

        const delinquentStudents = Array.from(studentDebtMap.values())
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        // 3. Recent enrollments (last 5)
        let recentEnrollQuery = db.database
            .from('enrollments')
            .select('created_at, students (full_name), courses (name)')
            .order('created_at', { ascending: false })
            .limit(5);
        if (branchId) recentEnrollQuery = recentEnrollQuery.eq('branch_id', branchId);

        const { data: recentEnrollments } = await recentEnrollQuery;

        res.json({
            enrollments_this_month: enrollmentsThisMonth || 0,
            delinquent_students: delinquentStudents,
            recent_enrollments: recentEnrollments || []
        });

    } catch (error) {
        console.error('Error getting admin extended dashboard:', error);
        res.status(500).json({ message: 'Error retrieving extended stats' });
    }
};
