import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';
import NodeCache from 'node-cache';
import { getEffectiveBranchId } from '../utils/branch.utils';

// Cache for 5 minutes by default
const dashboardCache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

// Helper to get local date range for Guatemala (UTC-6)
export const getTodayDateRangeGuatemala = () => {
    const now = new Date();
    // Guatemala offset: -6 hours
    const guatemalaOffsetMs = -6 * 60 * 60 * 1000;
    const guatDate = new Date(now.getTime() + guatemalaOffsetMs);

    const year = guatDate.getUTCFullYear();
    const month = String(guatDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(guatDate.getUTCDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    // Start of day in Guatemala is 06:00:00.000Z
    const startIso = new Date(`${todayStr}T06:00:00.000Z`).toISOString();
    // End of day in Guatemala is 05:59:59.999Z next day
    const endIso = new Date(new Date(`${todayStr}T06:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();

    return { todayStr, startIso, endIso };
};

export const getDashboardStats = async (req: Request, res: Response) => {
    const branchId = getEffectiveBranchId(req);
    const userRole = req.currentUser?.role;
    const userId = req.currentUser?.id;
    const isSecretary = userRole === 'secretary';
    const cacheKey = isSecretary ? `sec_${userId}` : (branchId ? `branch_${branchId}` : 'global');
    const db = (req as any).dbUserClient || adminClient || client;
    
    // Check if we have cached stats for this branch
    const cachedStats = dashboardCache.get(cacheKey);
    if (cachedStats) {
        return res.json(cachedStats);
    }

    try {
        // 1. Active Students
        let studentsQuery = db
            .from('students')
            .select('*', { count: 'exact', head: true });
        if (branchId) studentsQuery = studentsQuery.eq('branch_id', branchId);

        const { count: activeStudents, error: studentsError } = await studentsQuery;
        if (studentsError) console.error('Stats Students Error:', studentsError);

        // 2. Active Courses
        let coursesQuery = db
            .from('courses')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);
        if (branchId) coursesQuery = coursesQuery.eq('branch_id', branchId);

        const { count: activeCourses, error: coursesError } = await coursesQuery;
        if (coursesError) console.error('Stats Courses Error:', coursesError);

        // 3. Income: Daily for Secretary, Monthly for Admin
        let incomeValue = 0;
        if (isSecretary) {
            const { startIso, endIso } = getTodayDateRangeGuatemala();
            let myTodayQuery = db
                .from('payments')
                .select('amount')
                .eq('created_by', userId)
                .gte('payment_date', startIso)
                .lte('payment_date', endIso);

            const { data: myTodayPayments, error: myTodayError } = await myTodayQuery;
            if (!myTodayError && myTodayPayments) {
                incomeValue = myTodayPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
            }
        } else {
            const currentMonthStart = new Date();
            currentMonthStart.setDate(1);
            currentMonthStart.setHours(0, 0, 0, 0);

            let paymentsQuery = db
                .from('payments')
                .select(`
                    amount,
                    students (
                        branch_id
                    )
                `)
                .gte('payment_date', currentMonthStart.toISOString());
            if (branchId) paymentsQuery = paymentsQuery.eq('students.branch_id', branchId);

            const { data: payments, error: incomeError } = await paymentsQuery;

            if (!incomeError && payments) {
                incomeValue = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
            } else {
                console.error('Stats Income Error:', incomeError);
            }
        }

        // 4. Pending Payments Count
        let pendingQuery = db
            .from('financial_status')
            .select(`
                *,
                enrollments (
                    branch_id
                )
            `, { count: 'exact', head: true })
            .in('status', ['PENDING', 'OVERDUE']);
        if (branchId) pendingQuery = pendingQuery.eq('enrollments.branch_id', branchId);

        const { count: pendingPayments, error: pendingError } = await pendingQuery;
        if (pendingError) console.error('Stats Pending Error:', pendingError);

        const responsePayload = {
            active_students: activeStudents || 0,
            active_courses: activeCourses || 0,
            monthly_income: incomeValue,
            is_daily_income: isSecretary,
            pending_payments: pendingPayments || 0
        };

        dashboardCache.set(cacheKey, responsePayload, isSecretary ? 60 : 300);

        res.json(responsePayload);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving stats' });
    }
};

export const getFinancialReport = async (req: Request, res: Response) => {
    const branchId = getEffectiveBranchId(req);
    const userRole = req.currentUser?.role;
    const userId = req.currentUser?.id;
    const isSecretary = userRole === 'secretary';
    const { start_date, end_date, method } = req.query;
    const db = (req as any).dbUserClient || adminClient || client;

    try {
        let query = db
            .from('payments')
            .select(`
                id,
                payment_date,
                amount,
                discount,
                method,
                created_by,
                description,
                reference_number,
                students (
                    id,
                    full_name,
                    branch_id
                ),
                enrollments (
                    branch_id,
                    courses (name)
                )
            `)
            .order('payment_date', { ascending: false });

        if (branchId) {
            query = query.eq('students.branch_id', branchId);
        }

        if (isSecretary) {
            // SEGURIDAD ESTRICTA: La secretaria únicamente puede ver los cobros registrados por ella HOY
            const { startIso, endIso } = getTodayDateRangeGuatemala();
            query = query.gte('payment_date', startIso).lte('payment_date', endIso);
            if (userId) {
                query = query.eq('created_by', userId);
            }
        } else {
            if (start_date) {
                query = query.gte('payment_date', `${start_date}T00:00:00.000Z`);
            }
            if (end_date) {
                query = query.lte('payment_date', `${end_date}T23:59:59.999Z`);
            }
        }

        if (method) {
            query = query.eq('method', method as string);
        }

        const { data, error } = await query;

        if (error) throw error;

        const flatData = data.map((p: any) => ({
            id: p.id,
            payment_date: p.payment_date,
            amount: p.amount,
            discount: p.discount || 0,
            method: p.method,
            reference_number: p.reference_number,
            collector_name: isSecretary ? ((req.currentUser as any)?.full_name || (req.currentUser as any)?.name || 'Secretaría') : 'N/A',
            student_name: p.students?.full_name || 'N/A',
            course_name: p.enrollments?.courses?.name || p.description || 'General'
        }));

        res.json(flatData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving financial report' });
    }
};

export const getPendingPaymentsReport = async (req: Request, res: Response) => {
    const branchId = getEffectiveBranchId(req);
    const db = (req as any).dbUserClient || adminClient || client;
    // Ensure we count months correctly
    const currentDate = new Date();

    try {
        // 1. Fetch active enrollments with their courses and student details
        let enrollQuery = db
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
        let paymentsQuery = db
            .from('payments')
            .select(`
                enrollment_id,
                amount,
                discount,
                enrollments (branch_id)
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
    const branchId = getEffectiveBranchId(req);
    const db = (req as any).dbUserClient || adminClient || client;

    try {
        let query = db
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
        const { data: studentRecord } = await adminClient
            .from('students')
            .select('id, full_name, personal_code, academy_code, branch_id')
            .or(`id.eq.${userId},user_id.eq.${userId}`)
            .maybeSingle();

        if (!studentRecord) {
            return res.json({
                student_id: null,
                student_code: 'N/A',
                full_name: 'Estudiante',
                pending_assignments: 0,
                attendance_percentage: 100,
                has_attendance_records: false,
                average_grade: 0,
                total_courses: 0,
                recent_resources: [],
                latest_announcement: null
            });
        }

        const studentId = studentRecord.id;

        // 2. Get enrollments to find courses
        const { data: enrollments } = await adminClient
            .from('enrollments')
            .select('course_id, courses (id, name)')
            .eq('student_id', studentId)
            .eq('is_active', true);

        const courseIds = enrollments?.map((e: any) => e.course_id) || [];
        const totalCourses = courseIds.length;

        // 3. Pending assignments (not submitted by this student)
        let pendingAssignments = 0;
        if (courseIds.length > 0) {
            const { data: allAssignments } = await adminClient
                .from('assignments')
                .select('id')
                .in('course_id', courseIds)
                .gte('due_date', new Date().toISOString());

            const { data: submissions } = await adminClient
                .from('assignment_submissions')
                .select('assignment_id')
                .eq('student_id', studentId);

            const submittedIds = new Set(submissions?.map((s: any) => s.assignment_id) || []);
            pendingAssignments = allAssignments?.filter((a: any) => !submittedIds.has(a.id)).length || 0;
        }

        // 4. Attendance percentage
        const { data: attendanceRecords } = await adminClient
            .from('attendance')
            .select('status')
            .eq('student_id', studentId);

        let attendancePercentage = 100;
        let hasAttendanceRecords = false;
        if (attendanceRecords && attendanceRecords.length > 0) {
            hasAttendanceRecords = true;
            const totalRecords = attendanceRecords.length;
            const presentRecords = attendanceRecords.filter((r: any) => r.status === 'present' || r.status === 'late').length;
            attendancePercentage = Math.round((presentRecords / totalRecords) * 100);
        }

        // 5. Average grade
        const { data: grades } = await adminClient
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
            const { data: resources } = await adminClient
                .from('course_resources')
                .select(`
                    id,
                    title,
                    description,
                    file_url,
                    resource_type,
                    created_at,
                    course_id,
                    courses:course_id (id, name),
                    author:profiles!created_by(full_name)
                `)
                .in('course_id', courseIds)
                .order('created_at', { ascending: false })
                .limit(4);
            recentResources = resources || [];
        }

        // 7. Latest announcement
        const { data: announcements } = await adminClient
            .from('announcements')
            .select('id, title, content, created_at')
            .or('target_role.eq.all,target_role.eq.student')
            .order('created_at', { ascending: false })
            .limit(1);

        const computedStudentCode = studentRecord.personal_code || 
            studentRecord.academy_code || 
            `UT-${new Date().getFullYear()}-${studentId.slice(0, 4).toUpperCase()}`;

        res.json({
            student_id: studentId,
            student_code: computedStudentCode,
            full_name: studentRecord.full_name,
            pending_assignments: pendingAssignments,
            attendance_percentage: attendancePercentage,
            has_attendance_records: hasAttendanceRecords,
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
    const branchId = getEffectiveBranchId(req);
    const db = (req as any).dbUserClient || adminClient || client;

    try {
        // 1. Enrollments this month
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        let enrollThisMonthQuery = db
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', currentMonthStart.toISOString());
        if (branchId) enrollThisMonthQuery = enrollThisMonthQuery.eq('branch_id', branchId);

        const { count: enrollmentsThisMonth } = await enrollThisMonthQuery;

        // 2. Top delinquent students (with pending/overdue payments)
        let pendingQuery = db
            .from('financial_status')
            .select(`
                amount_due,
                amount_paid,
                month,
                enrollments!inner (
                    branch_id,
                    students (id, full_name)
                )
            `)
            .in('status', ['PENDING', 'OVERDUE'])
            .order('month', { ascending: true })
            .limit(50);
        if (branchId) pendingQuery = pendingQuery.eq('enrollments.branch_id', branchId);

        const { data: pendingStatuses } = await pendingQuery;

        // Group by student and sum amounts
        const studentDebtMap = new Map<string, { name: string; total: number; oldest_due: string }>();
        pendingStatuses?.forEach((item: any) => {
            const student = item.enrollments?.students;
            if (!student) return;
            const remaining = Number(item.amount_due || 0) - Number(item.amount_paid || 0);
            const existing = studentDebtMap.get(student.id);
            if (existing) {
                existing.total += remaining;
            } else {
                studentDebtMap.set(student.id, {
                    name: student.full_name,
                    total: remaining,
                    oldest_due: item.month
                });
            }
        });

        const delinquentStudents = Array.from(studentDebtMap.values())
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        // 3. Recent enrollments (last 5)
        let recentEnrollQuery = db
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
