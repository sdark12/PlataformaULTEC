import { Request, Response } from 'express';
import { adminClient } from '../config/insforge';
import { getSettingBool, getSetting, getSettingNumber } from './settings.controller';

/**
 * Helper: Calculate how many grade units a student can see per course
 * based on their tuition payment status (same logic as grades.controller).
 */
const calculateAllowedUnitsForParent = async (studentId: string, courseIds: number[]): Promise<Map<number, number>> => {
    const allowedMap = new Map<number, number>();
    const TOTAL_UNITS = (await getSettingNumber('total_grade_units')) || 4;

    if (courseIds.length === 0) return allowedMap;

    const { data: enrollments } = await adminClient
        .from('enrollments')
        .select('id, course_id, enrollment_date, courses (monthly_fee, duration_months, start_date)')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .in('course_id', courseIds);

    if (!enrollments || enrollments.length === 0) {
        courseIds.forEach(cid => allowedMap.set(cid, TOTAL_UNITS));
        return allowedMap;
    }

    const enrollmentIds = enrollments.map((e: any) => e.id);

    const { data: payments } = await adminClient
        .from('payments')
        .select('enrollment_id, amount, discount')
        .in('enrollment_id', enrollmentIds)
        .eq('payment_type', 'TUITION');

    const paidPerEnrollment: Record<string, number> = {};
    payments?.forEach((p: any) => {
        const key = String(p.enrollment_id);
        paidPerEnrollment[key] = (paidPerEnrollment[key] || 0) + Number(p.amount || 0) + Number(p.discount || 0);
    });

    const currentDate = new Date();
    const cutoffsStr = await getSetting('grade_unit_cutoff_months');
    const cutoffs = cutoffsStr.split(',').map(n => Number(n)).filter(n => !isNaN(n));

    enrollments.forEach((enrollment: any) => {
        const monthlyFee = Number(enrollment.courses?.monthly_fee || 0);
        const durationMonths = enrollment.courses?.duration_months || 11;

        const baseDate = enrollment.courses?.start_date
            ? new Date(enrollment.courses.start_date)
            : new Date(enrollment.enrollment_date);

        let monthsElapsed = 0;
        if (currentDate > baseDate) {
            const yearsDiff = currentDate.getFullYear() - baseDate.getFullYear();
            const monthsDiff = currentDate.getMonth() - baseDate.getMonth();
            monthsElapsed = (yearsDiff * 12) + monthsDiff + 1;
        } else {
            monthsElapsed = 1;
        }
        const effectiveMonths = Math.min(monthsElapsed, durationMonths);

        const totalDue = effectiveMonths * monthlyFee;
        const totalPaid = paidPerEnrollment[String(enrollment.id)] || 0;
        const monthsCovered = monthlyFee > 0 ? Math.floor(totalPaid / monthlyFee) : durationMonths;

        if (monthlyFee === 0) {
            // Free course → show all units
            allowedMap.set(enrollment.course_id, TOTAL_UNITS);
        } else if (cutoffs.length > 0) {
            // Use cutoff thresholds to determine visibility
            let unitsAllowed = 0;
            for (let i = 0; i < cutoffs.length; i++) {
                if (monthsCovered >= cutoffs[i]) {
                    unitsAllowed = i + 1;
                } else {
                    break;
                }
            }
            allowedMap.set(enrollment.course_id, Math.min(Math.max(unitsAllowed, 0), TOTAL_UNITS));
        } else {
            // No cutoffs configured — use proportional fallback
            if (totalPaid >= totalDue) {
                allowedMap.set(enrollment.course_id, TOTAL_UNITS);
            } else {
                const monthsPerUnit = durationMonths / TOTAL_UNITS;
                const unitsAllowed = Math.floor(monthsCovered / monthsPerUnit);
                allowedMap.set(enrollment.course_id, Math.min(Math.max(unitsAllowed, 0), TOTAL_UNITS));
            }
        }
    });

    return allowedMap;
};

// Admin: Get all parent-student links (with optional filter by parent_user_id or student_id)
export const getParentLinks = async (req: Request, res: Response) => {
    try {
        const { parent_user_id, student_id } = req.query;
        let query = adminClient
            .from('parent_student_links')
            .select(`
                id,
                parent_user_id,
                student_id,
                relationship,
                created_at,
                profiles!parent_user_id ( id, full_name, email ),
                students ( id, full_name, personal_code, academy_code )
            `)
            .order('created_at', { ascending: false });

        if (parent_user_id) {
            query = query.eq('parent_user_id', parent_user_id);
        }
        if (student_id) {
            query = query.eq('student_id', student_id);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching parent links:', error);
        res.status(500).json({ message: 'Error retrieving parent links' });
    }
};

// Admin: Create a parent-student link
export const createParentLink = async (req: Request, res: Response) => {
    const { parent_user_id, student_id, relationship } = req.body;

    if (!parent_user_id || !student_id) {
        return res.status(400).json({ message: 'parent_user_id and student_id are required' });
    }

    try {
        const { data, error } = await adminClient
            .from('parent_student_links')
            .insert({
                parent_user_id,
                student_id,
                relationship: relationship || 'parent',
                created_by: req.currentUser?.id
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error: any) {
        if (error?.code === '23505') {
            return res.status(409).json({ message: 'Este vínculo ya existe' });
        }
        console.error('Error creating parent link:', error);
        res.status(500).json({ message: 'Error creating parent link' });
    }
};

// Admin: Synchronize all student links for a parent (add new, update, remove unselected)
export const syncParentLinks = async (req: Request, res: Response) => {
    const { parent_user_id, student_links } = req.body;

    if (!parent_user_id) {
        return res.status(400).json({ message: 'parent_user_id es obligatorio' });
    }

    try {
        // 1. Fetch parent profile for cascade update
        const { data: parentProfile } = await adminClient
            .from('profiles')
            .select('full_name, email, phone')
            .eq('id', parent_user_id)
            .maybeSingle();

        // 2. Fetch existing links
        const { data: currentLinks } = await adminClient
            .from('parent_student_links')
            .select('id, student_id, relationship')
            .eq('parent_user_id', parent_user_id);

        const currentMap = new Map((currentLinks || []).map((l: any) => [l.student_id, l]));
        const incomingStudentIds = new Set((student_links || []).map((l: any) => l.student_id));

        // Delete links not in incoming
        const toDeleteIds: string[] = [];
        for (const [stId, link] of currentMap.entries()) {
            if (!incomingStudentIds.has(stId)) {
                toDeleteIds.push(link.id);
            }
        }

        if (toDeleteIds.length > 0) {
            await adminClient
                .from('parent_student_links')
                .delete()
                .in('id', toDeleteIds);
        }

        // Insert or update incoming links
        for (const item of (student_links || [])) {
            if (!item.student_id) continue;
            const existing = currentMap.get(item.student_id);
            const rel = item.relationship || 'parent';
            if (existing) {
                if (existing.relationship !== rel) {
                    await adminClient
                        .from('parent_student_links')
                        .update({ relationship: rel })
                        .eq('id', existing.id);
                }
            } else {
                await adminClient
                    .from('parent_student_links')
                    .insert({
                        parent_user_id,
                        student_id: item.student_id,
                        relationship: rel,
                        created_by: req.currentUser?.id
                    });
            }
        }

        // 3. Cascade update guardian contact details on students table
        if (parentProfile && incomingStudentIds.size > 0) {
            const studentIdsArray = Array.from(incomingStudentIds);
            const studentUpdates: any = {};
            if (parentProfile.full_name) studentUpdates.guardian_name = parentProfile.full_name;
            if (parentProfile.phone) studentUpdates.guardian_phone = parentProfile.phone;
            if (parentProfile.email) studentUpdates.guardian_email = parentProfile.email;

            if (Object.keys(studentUpdates).length > 0) {
                await adminClient
                    .from('students')
                    .update(studentUpdates)
                    .in('id', studentIdsArray);
            }
        }

        // 4. Return refreshed links
        const { data: updatedLinks } = await adminClient
            .from('parent_student_links')
            .select(`
                id,
                parent_user_id,
                student_id,
                relationship,
                students (
                    id,
                    full_name,
                    personal_code,
                    academy_code
                )
            `)
            .eq('parent_user_id', parent_user_id);

        res.json({ message: 'Vínculos familiares actualizados exitosamente', links: updatedLinks || [] });
    } catch (error) {
        console.error('Error syncing parent links:', error);
        res.status(500).json({ message: 'Error al sincronizar vínculos familiares' });
    }
};

// Admin: Delete a parent-student link
export const deleteParentLink = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { error } = await adminClient
            .from('parent_student_links')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Link deleted' });
    } catch (error) {
        console.error('Error deleting parent link:', error);
        res.status(500).json({ message: 'Error deleting link' });
    }
};

// Parent: Get my linked students
export const getMyStudents = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const { data, error } = await adminClient
            .from('parent_student_links')
            .select(`
                student_id,
                relationship,
                students (
                    id,
                    full_name,
                    personal_code
                )
            `)
            .eq('parent_user_id', userId);

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching parent students:', error);
        res.status(500).json({ message: 'Error retrieving students' });
    }
};

// Parent: Get child's dashboard summary
export const getChildDashboard = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;
    const { studentId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        // Verify parent has access to this student
        const { data: link } = await adminClient
            .from('parent_student_links')
            .select('id')
            .eq('parent_user_id', userId)
            .eq('student_id', studentId)
            .maybeSingle();

        if (!link) {
            return res.status(403).json({ message: 'No tiene acceso a este estudiante' });
        }

        // Attendance — full records for calendar
        const { data: attendance } = await adminClient
            .from('attendance')
            .select('id, status, created_at, date')
            .eq('student_id', studentId)
            .order('date', { ascending: true });

        let attendancePercentage = 0;
        if (attendance && attendance.length > 0) {
            const present = attendance.filter((a: any) =>
                a.status === 'present' || a.status === 'PRESENT' ||
                a.status === 'late' || a.status === 'LATE'
            ).length;
            attendancePercentage = Math.round((present / attendance.length) * 100);
        }

        // Map attendance records for client calendar
        const attendanceRecords = attendance?.map((a: any) => ({
            date: a.date || a.created_at?.split('T')[0],
            status: a.status.toUpperCase()
        })) || [];

        // Grades
        const { data: grades } = await adminClient
            .from('grades')
            .select('score')
            .eq('student_id', studentId);

        let averageGrade = 0;
        if (grades && grades.length > 0) {
            const total = grades.reduce((s: number, g: any) => s + Number(g.score), 0);
            averageGrade = Math.round((total / grades.length) * 10) / 10;
        }

        // Enrollments with full course details for debt calculation
        const { data: enrollments } = await adminClient
            .from('enrollments')
            .select('id, course_id, enrollment_date, courses (name, monthly_fee, duration_months, start_date, end_date)')
            .eq('student_id', studentId)
            .eq('is_active', true);

        // Fetch ALL payments for this student (all types)
        const enrollmentIds = enrollments?.map((e: any) => e.id) || [];
        let totalPendingAmount = 0;
        let totalSaldoAFavor = 0;
        let inscriptionPaid = false;
        const courseBreakdown: any[] = [];
        let allPayments: any[] = [];

        if (enrollmentIds.length > 0) {
            const { data: payments } = await adminClient
                .from('payments')
                .select('id, enrollment_id, amount, discount, payment_date, payment_type, method, tuition_month, description, enrollments (courses (name))')
                .in('enrollment_id', enrollmentIds)
                .order('payment_date', { ascending: false });

            // Check inscription status
            inscriptionPaid = payments?.some((p: any) => p.payment_type === 'ENROLLMENT') || false;

            // Build full payment history
            allPayments = payments?.map((p: any) => ({
                id: p.id,
                amount: p.amount,
                discount: p.discount,
                payment_date: p.payment_date,
                payment_type: p.payment_type,
                method: p.method,
                // receipt_number removed as it does not exist in db
                tuition_month: p.tuition_month,
                description: p.description,
                course_name: p.enrollments?.courses?.name || 'N/A'
            })) || [];

            // Group TUITION payments by enrollment for balance calculation
            const tuitionPaymentsByEnrollment: Record<string, number> = {};
            payments?.filter((p: any) => p.payment_type === 'TUITION').forEach((p: any) => {
                if (!tuitionPaymentsByEnrollment[p.enrollment_id]) {
                    tuitionPaymentsByEnrollment[p.enrollment_id] = 0;
                }
                const paidValue = Number(p.amount || 0) + Number(p.discount || 0);
                tuitionPaymentsByEnrollment[p.enrollment_id] += paidValue;
            });

            // Calculate pending debt per course (same logic as admin report)
            const currentDate = new Date();

            enrollments?.forEach((enrollment: any) => {
                const enrollmentDate = new Date(enrollment.enrollment_date);
                const monthlyFee = Number(enrollment.courses.monthly_fee);
                const durationMonths = enrollment.courses.duration_months || 11;

                const baseDateForCalculation = enrollment.courses.start_date
                    ? new Date(enrollment.courses.start_date)
                    : enrollmentDate;

                let monthsElapsed = 0;
                if (currentDate > baseDateForCalculation) {
                    const yearsDiff = currentDate.getFullYear() - baseDateForCalculation.getFullYear();
                    const monthsDiff = currentDate.getMonth() - baseDateForCalculation.getMonth();
                    monthsElapsed = (yearsDiff * 12) + monthsDiff + 1;
                } else {
                    monthsElapsed = 1;
                }

                const effectiveMonths = Math.min(monthsElapsed, durationMonths);
                const totalDue = effectiveMonths * monthlyFee;
                const totalPaid = tuitionPaymentsByEnrollment[enrollment.id] || 0;
                const balance = totalDue - totalPaid;
                const pendingAmount = Math.max(balance, 0);
                const saldoAFavor = balance < 0 ? Math.abs(balance) : 0;

                totalPendingAmount += pendingAmount;
                totalSaldoAFavor += saldoAFavor;

                courseBreakdown.push({
                    course_name: enrollment.courses.name,
                    monthly_fee: monthlyFee,
                    months_charged: effectiveMonths,
                    total_due: totalDue,
                    total_paid: totalPaid,
                    pending_amount: pendingAmount,
                    saldo_a_favor: saldoAFavor
                });
            });
        }

        res.json({
            attendance_percentage: attendancePercentage,
            attendance_records: attendanceRecords,
            average_grade: averageGrade,
            total_courses: enrollments?.length || 0,
            courses: enrollments?.map((e: any) => e.courses?.name).filter(Boolean) || [],
            pending_payment: totalPendingAmount,
            saldo_a_favor: totalSaldoAFavor,
            inscription_paid: inscriptionPaid,
            course_breakdown: courseBreakdown,
            payment_history: allPayments
        });
    } catch (error) {
        console.error('Error getting child dashboard:', error);
        res.status(500).json({ message: 'Error retrieving child data' });
    }
};

// Parent: Get full payment history for a child
export const getChildPayments = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;
    const { studentId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        // Verify parent has access
        const { data: link } = await adminClient
            .from('parent_student_links')
            .select('id')
            .eq('parent_user_id', userId)
            .eq('student_id', studentId)
            .maybeSingle();

        if (!link) {
            return res.status(403).json({ message: 'No tiene acceso a este estudiante' });
        }

        // Get student's enrollment IDs
        const { data: enrollments } = await adminClient
            .from('enrollments')
            .select('id')
            .eq('student_id', studentId);

        const enrollmentIds = enrollments?.map((e: any) => e.id) || [];

        if (enrollmentIds.length === 0) {
            return res.json([]);
        }

        const { data: payments, error } = await adminClient
            .from('payments')
            .select('id, amount, discount, payment_date, payment_type, method, tuition_month, description, enrollments (courses (name))')
            .in('enrollment_id', enrollmentIds)
            .order('payment_date', { ascending: false });

        if (error) throw error;

        const result = payments?.map((p: any) => ({
            id: p.id,
            amount: p.amount,
            discount: p.discount,
            payment_date: p.payment_date,
            payment_type: p.payment_type,
            method: p.method,
            // receipt_number removed
            tuition_month: p.tuition_month,
            description: p.description,
            course_name: p.enrollments?.courses?.name || 'N/A'
        })) || [];

        res.json(result);
    } catch (error) {
        console.error('Error getting child payments:', error);
        res.status(500).json({ message: 'Error retrieving payment history' });
    }
};

// Parent: Get child's report card (grades) — with payment restriction
export const getChildGrades = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;
    const { studentId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        // Verify parent access
        const { data: link } = await adminClient
            .from('parent_student_links')
            .select('id')
            .eq('parent_user_id', userId)
            .eq('student_id', studentId)
            .maybeSingle();

        if (!link) {
            return res.status(403).json({ message: 'No tiene acceso a este estudiante' });
        }

        // Get all grades across courses
        const { data: gradesData, error: gradesError } = await adminClient
            .from('grades')
            .select(`
                score,
                unit_name,
                remarks,
                courses (id, name)
            `)
            .eq('student_id', studentId);

        if (gradesError) throw gradesError;

        // Group grades by course
        const coursesMap = new Map();

        gradesData?.forEach((g: any) => {
            const courseId = g.courses?.id;
            const courseName = g.courses?.name;
            if (!courseId) return;

            if (!coursesMap.has(courseId)) {
                coursesMap.set(courseId, {
                    course_id: courseId,
                    course_name: courseName,
                    units: [],
                    average: 0
                });
            }

            coursesMap.get(courseId).units.push({
                unit_name: g.unit_name,
                score: g.score,
                remarks: g.remarks
            });
        });

        // Calculate payment-based restrictions
        const courseIds = Array.from(coursesMap.keys());
        const restrictByPayment = await getSettingBool('restrict_grades_by_payment');
        let allowedUnitsMap = new Map<number, number>();
        
        if (restrictByPayment) {
            allowedUnitsMap = await calculateAllowedUnitsForParent(String(studentId), courseIds);
        }

        const unitNamesStr = await getSetting('grade_unit_names');
        const configuredUnits = unitNamesStr ? unitNamesStr.split(',').map(s => s.trim()).filter(Boolean) : ['Unidad 1', 'Unidad 2', 'Unidad 3', 'Unidad 4'];
        const unitOrder = [...configuredUnits, 'Recuperación'];

        const reportCard: any[] = [];
        let totalScoreSum = 0;
        let totalCoursesGraded = 0;

        coursesMap.forEach((course) => {
            // Sort units in order
            course.units.sort((a: any, b: any) => {
                const ai = unitOrder.indexOf(a.unit_name);
                const bi = unitOrder.indexOf(b.unit_name);
                return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            });

            // Filter out deprecated 'Examen Final' and 'Proyecto' if any legacy records exist
            course.units = course.units.filter((u: any) => !['Examen Final', 'Proyecto'].includes(u.unit_name));

            const allowedCount = allowedUnitsMap.get(course.course_id) ?? course.units.length;
            let paymentRestricted = false;

            const processedUnits = course.units.map((unit: any, idx: number) => {
                if (idx >= allowedCount) {
                    paymentRestricted = true;
                    return {
                        unit_name: unit.unit_name,
                        score: null,
                        remarks: null,
                        restricted: true
                    };
                }
                return { ...unit, restricted: false };
            });

            // Separate ordinary bimestres from extraordinary Recuperación
            const ordinaryUnits = processedUnits.filter((u: any) => !u.restricted && u.score !== null && u.unit_name !== 'Recuperación');
            const recupUnit = processedUnits.find((u: any) => !u.restricted && u.score !== null && u.unit_name === 'Recuperación');

            const ordinarySum = ordinaryUnits.reduce((acc: number, curr: any) => acc + Number(curr.score), 0);
            const ordinaryAvg = ordinaryUnits.length > 0 ? Number((ordinarySum / ordinaryUnits.length).toFixed(2)) : 0;

            let finalAvg = ordinaryAvg;
            let status = ordinaryAvg >= 60 ? 'APROBADO' : 'REPROBADO';

            if (ordinaryAvg < 60 && recupUnit && Number(recupUnit.score) >= 60) {
                finalAvg = 60; // Aprobado con nota oficial de 60 en Recuperación
                status = 'APROBADO_RECUPERACION';
            }

            course.average = finalAvg;
            course.ordinary_average = ordinaryAvg;
            course.recuperation_score = recupUnit ? Number(recupUnit.score) : null;
            course.status = status;

            if (ordinaryUnits.length > 0) {
                totalScoreSum += finalAvg;
                totalCoursesGraded++;
            }

            reportCard.push({
                course_name: course.course_name,
                units: processedUnits,
                average: course.average,
                ordinary_average: course.ordinary_average,
                recuperation_score: course.recuperation_score,
                status: course.status,
                payment_restricted: paymentRestricted
            });
        });

        const generalAverage = totalCoursesGraded > 0 ? Number((totalScoreSum / totalCoursesGraded).toFixed(2)) : 0;

        res.json({
            general_average: generalAverage,
            courses: reportCard
        });
    } catch (error) {
        console.error('Error getting child grades:', error);
        res.status(500).json({ message: 'Error retrieving grades' });
    }
};

// Parent: Get child's assignments with submission status
export const getChildAssignments = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;
    const { studentId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        // Verify parent access
        const { data: link } = await adminClient
            .from('parent_student_links')
            .select('id')
            .eq('parent_user_id', userId)
            .eq('student_id', studentId)
            .maybeSingle();

        if (!link) {
            return res.status(403).json({ message: 'No tiene acceso a este estudiante' });
        }

        // Get active enrollments
        const { data: enrollments, error: enrollError } = await adminClient
            .from('enrollments')
            .select('id, course_id, schedule_id, courses(name)')
            .eq('student_id', studentId)
            .eq('is_active', true);

        if (enrollError) throw enrollError;
        if (!enrollments || enrollments.length === 0) return res.json([]);

        const courseIds = enrollments.map((e: any) => e.course_id);

        // Get all assignments for those courses
        const { data: assignments, error: assignError } = await adminClient
            .from('assignments')
            .select('*')
            .in('course_id', courseIds)
            .order('due_date', { ascending: true });

        if (assignError) throw assignError;

        // Get all submissions for this student
        const { data: submissions, error: subError } = await adminClient
            .from('assignment_submissions')
            .select('*')
            .eq('student_id', studentId);

        if (subError) throw subError;

        // Merge everything
        const merged = assignments
            ?.filter((a: any) => {
                const enr = enrollments.find((e: any) => e.course_id === a.course_id);
                return !a.schedule_id || a.schedule_id === enr?.schedule_id;
            })
            .map((a: any) => {
                const sub = submissions?.find((s: any) => s.assignment_id === a.id);
                const enr = enrollments.find((e: any) => e.course_id === a.course_id);
                return {
                    assignment_id: a.id,
                    title: a.title,
                    description: a.description,
                    assignment_type: a.assignment_type,
                    due_date: a.due_date,
                    max_score: a.max_score,
                    course_name: Array.isArray(enr?.courses) ? enr?.courses[0]?.name : (enr?.courses as any)?.name || '',
                    status: sub?.status || 'PENDING',
                    submission_date: sub?.submission_date || null,
                    score: sub?.score ?? null,
                    feedback: sub?.feedback || '',
                    attachment_url: sub?.attachment_url || null,
                    guide_url: a.attachment_url || null
                };
            }) || [];

        res.json(merged);
    } catch (error) {
        console.error('Error getting child assignments:', error);
        res.status(500).json({ message: 'Error retrieving assignments' });
    }
};

// Parent: Get child's discipline incidents
export const getChildDiscipline = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;
    const { studentId } = req.params;

    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        // Verify parent access
        const { data: link } = await adminClient
            .from('parent_student_links')
            .select('id')
            .eq('parent_user_id', userId)
            .eq('student_id', studentId)
            .maybeSingle();

        if (!link) {
            return res.status(403).json({ message: 'No tiene acceso a este estudiante' });
        }

        const { data, error } = await adminClient
            .from('discipline_incidents')
            .select(`
                id,
                incident_type,
                severity,
                title,
                description,
                action_taken,
                incident_date,
                parent_notified,
                resolved,
                resolution_notes,
                resolved_at,
                courses ( name ),
                reporter:profiles!reported_by ( full_name )
            `)
            .eq('student_id', studentId)
            .order('incident_date', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error getting child discipline:', error);
        res.status(500).json({ message: 'Error retrieving discipline incidents' });
    }
};
