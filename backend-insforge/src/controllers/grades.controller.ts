import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';
import { getSettingBool, getSetting, getSettingNumber } from './settings.controller';

export const getGrades = async (req: Request, res: Response) => {
    const { course_id, unit_name, schedule_id } = req.query;
    const branchId = req.currentUser?.branch_id;

    if (!course_id || !unit_name) {
        return res.status(400).json({ message: 'course_id and unit_name are required' });
    }

    try {
        const db = (req as any).dbUserClient || adminClient || client;

        // 1. Fetch all active enrolled students
        let enrollmentsQuery = db
            .from('enrollments')
            .select(`
                student_id,
                schedule_id,
                students!inner (
                    id,
                    full_name,
                    branch_id
                )
            `)
            .eq('course_id', course_id)
            .eq('is_active', true);

        if (branchId) {
            enrollmentsQuery = enrollmentsQuery.eq('students.branch_id', branchId);
        }

        if (schedule_id) {
            enrollmentsQuery = enrollmentsQuery.eq('schedule_id', schedule_id);
        }

        const { data: enrollments, error: enrollError } = await enrollmentsQuery;

        if (enrollError) throw enrollError;

        // 2. Fetch existing grades
        const { data: gradesData, error: gradesError } = await db
            .from('grades')
            .select('student_id, score, remarks')
            .eq('course_id', course_id)
            .eq('unit_name', unit_name);

        if (gradesError) throw gradesError;

        // Map for quick lookup
        const gradesMap = new Map();
        if (gradesData) {
            gradesData.forEach((record: any) => {
                gradesMap.set(record.student_id, record);
            });
        }

        // If unit_name is 'Recuperación', fetch ordinary grades so we can flag recovery eligibility
        const studentOrdinaryMap = new Map<string, { ordinary_average: number | null, is_eligible_recovery: boolean }>();
        if (unit_name === 'Recuperación') {
            const unitNamesStr = await getSetting('grade_unit_names');
            const configuredUnits = unitNamesStr ? unitNamesStr.split(',').map(s => s.trim()).filter(Boolean) : ['Bimestre 1', 'Bimestre 2', 'Bimestre 3', 'Bimestre 4'];

            const { data: allOrdinaryGrades } = await db
                .from('grades')
                .select('student_id, score')
                .eq('course_id', course_id)
                .in('unit_name', configuredUnits);

            const scoresPerStudent = new Map<string, number[]>();
            allOrdinaryGrades?.forEach((g: any) => {
                if (g.score !== null && g.score !== undefined && g.score !== '') {
                    const list = scoresPerStudent.get(g.student_id) || [];
                    list.push(Number(g.score));
                    scoresPerStudent.set(g.student_id, list);
                }
            });

            enrollments?.forEach((e: any) => {
                const sScores = scoresPerStudent.get(e.student_id) || [];
                const avg = sScores.length > 0 ? Number((sScores.reduce((a, b) => a + b, 0) / sScores.length).toFixed(1)) : null;
                studentOrdinaryMap.set(e.student_id, {
                    ordinary_average: avg,
                    is_eligible_recovery: avg !== null && avg < 60
                });
            });
        }

        // 3. Merge data
        const mergedData = enrollments?.map((enrollment: any) => {
            const studentId = enrollment.student_id;
            const existingRecord = gradesMap.get(studentId);
            const ordInfo = studentOrdinaryMap.get(studentId);

            return {
                student_id: studentId,
                student_name: enrollment.students.full_name,
                unit_name: unit_name,
                score: existingRecord ? existingRecord.score : '',
                remarks: existingRecord ? existingRecord.remarks : '',
                ordinary_average: ordInfo?.ordinary_average ?? null,
                is_eligible_recovery: ordInfo?.is_eligible_recovery ?? null
            };
        }) || [];

        // Sort alphabetically
        mergedData.sort((a: any, b: any) => a.student_name.localeCompare(b.student_name));

        res.json(mergedData);
    } catch (error) {
        console.error('Error retrieving grades:', error);
        res.status(500).json({ message: 'Error retrieving grades' });
    }
};

// Helper: Handle automatic merit allocation for excellent/good grades
const handleGradeMerits = async (records: any[], creatorUserId: string | undefined) => {
    try {
        const autoEnabled = await getSettingBool('merit_enable_auto_grades');
        if (!autoEnabled) return;

        const pointsExcellent = await getSettingNumber('merit_points_grade_excellent');
        const pointsGood = await getSettingNumber('merit_points_grade_good');

        for (const r of records) {
            const score = Number(r.score);
            let pointsAwarded = 0;
            let levelLabel = '';

            if (score >= 90) {
                pointsAwarded = pointsExcellent;
                levelLabel = 'Excelente';
            } else if (score >= 80) {
                pointsAwarded = pointsGood;
                levelLabel = 'Bueno';
            }

            if (pointsAwarded > 0) {
                // Upsert merit transaction
                await adminClient
                    .from('merit_transactions')
                    .upsert({
                        student_id: r.student_id,
                        points: pointsAwarded,
                        transaction_type: 'grade',
                        description: `Nota Sobresaliente (${levelLabel}: ${score} pts) - Unidad: ${r.unit_name}`,
                        reference_id: r.id,
                        created_by: creatorUserId || null
                    }, { onConflict: 'student_id, reference_id, transaction_type' });
            } else {
                // Delete transaction if score is below 80 but previously got points
                await adminClient
                    .from('merit_transactions')
                    .delete()
                    .eq('student_id', r.student_id)
                    .eq('reference_id', r.id)
                    .eq('transaction_type', 'grade');
            }
        }
    } catch (err) {
        console.error('Error handling grade merits:', err);
    }
};

export const saveGrades = async (req: Request, res: Response) => {
    const { course_id, unit_name, students } = req.body;
    const userId = req.currentUser?.id;

    if (!course_id || !unit_name || !students) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const db = (req as any).dbUserClient || adminClient || client;

        const upsertData = students.map((s: any) => ({
            course_id,
            student_id: s.student_id,
            unit_name,
            score: Number(s.score) || 0,
            remarks: s.remarks,
            created_by: userId
        }));

        const { data, error } = await db
            .from('grades')
            .upsert(upsertData, { onConflict: 'course_id, student_id, unit_name' })
            .select('id, student_id, score, unit_name');

        if (error) throw error;

        // Process automatic grade merits in background
        if (data && data.length > 0) {
            handleGradeMerits(data, userId).catch(err =>
                console.error('Failed to trigger background grade merits:', err)
            );
        }

        res.json({ message: 'Grades saved successfully' });
    } catch (error) {
        console.error('Error saving grades:', error);
        res.status(500).json({ message: 'Error saving grades' });
    }
};

/**
 * Helper: Calculate how many grade units a student can see per course
 * based on their tuition payment status.
 *
 * Logic:
 *  - For each enrollment, determine months elapsed since course start.
 *  - Determine months actually paid (TUITION payments).
 *  - 4 units spread across the total course duration (default 11 months).
 *  - Allowed units = floor(monthsPaid / monthsPerUnit), capped at total units (4).
 *  - If fully paid (no pending), show all.
 *  - Returns a Map<courseId, number> with max allowed units per course.
 */
const calculateAllowedUnits = async (studentId: string, courseIds: number[]): Promise<Map<number, number>> => {
    const allowedMap = new Map<number, number>();
    const TOTAL_UNITS = (await getSettingNumber('total_grade_units')) || 4;

    if (courseIds.length === 0) return allowedMap;

    // Get enrollments for these courses
    const { data: enrollments } = await adminClient
        .from('enrollments')
        .select('id, course_id, enrollment_date, courses (monthly_fee, duration_months, start_date)')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .in('course_id', courseIds);

    if (!enrollments || enrollments.length === 0) {
        // No enrollments found — allow all by default
        courseIds.forEach(cid => allowedMap.set(cid, TOTAL_UNITS));
        return allowedMap;
    }

    const enrollmentIds = enrollments.map((e: any) => e.id);

    // Get TUITION payments for these enrollments
    const { data: payments } = await adminClient
        .from('payments')
        .select('enrollment_id, amount, discount')
        .in('enrollment_id', enrollmentIds)
        .eq('payment_type', 'TUITION');

    // Sum paid per enrollment
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

        // Months elapsed since course start
        let monthsElapsed = 0;
        if (currentDate > baseDate) {
            const yearsDiff = currentDate.getFullYear() - baseDate.getFullYear();
            const monthsDiff = currentDate.getMonth() - baseDate.getMonth();
            monthsElapsed = (yearsDiff * 12) + monthsDiff + 1;
        } else {
            monthsElapsed = 1;
        }
        const effectiveMonths = Math.min(monthsElapsed, durationMonths);

        // Total due vs total paid
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

export const getStudentReportCard = async (req: Request, res: Response) => {
    let { student_id } = req.params;
    const callerRole = req.currentUser?.role;

    try {
        let studentQuery = adminClient
            .from('students')
            .select('full_name, id, user_id, personal_code, identification_document, academy_code');

        const { data: studentRecord, error: findError } = await studentQuery
            .or(`id.eq.${student_id},user_id.eq.${student_id}`)
            .maybeSingle();

        if (findError) throw findError;
        
        if (!studentRecord) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }

        const actualStudentId = studentRecord.id;

        // 1. Fetch all enrollments for this student (past and present)
        const { data: enrollmentsData, error: enrollError } = await adminClient
            .from('enrollments')
            .select(`
                id,
                course_id,
                enrollment_date,
                is_active,
                academic_status,
                schedule_id,
                courses (id, name, description, start_date, end_date),
                course_schedules (id, grade, day_of_week, start_time, end_time)
            `)
            .eq('student_id', actualStudentId)
            .order('enrollment_date', { ascending: true });

        if (enrollError) throw enrollError;

        // 2. Initialize map with enrolled courses so courses without grades yet are also included
        const coursesMap = new Map();

        enrollmentsData?.forEach((en: any) => {
            const courseId = en.course_id;
            const courseName = en.courses?.name || 'Curso sin nombre';
            if (!courseId) return;

            const yearMatch = courseName.match(/\b(20\d{2})\b/);
            const cycleYear = yearMatch ? yearMatch[1] : (en.enrollment_date ? new Date(en.enrollment_date).getFullYear().toString() : new Date().getFullYear().toString());

            coursesMap.set(courseId, {
                course_id: courseId,
                course_name: courseName,
                enrollment_id: en.id,
                is_active: en.is_active,
                academic_status: en.academic_status || (en.is_active ? 'ACTIVE' : 'INACTIVE'),
                schedule_grade: en.course_schedules?.grade || null,
                cycle_year: cycleYear,
                enrollment_date: en.enrollment_date,
                units: [],
                average: 0
            });
        });

        // 3. Get all grades across courses
        const { data: gradesData, error: gradesError } = await adminClient
            .from('grades')
            .select(`
                 score,
                 unit_name,
                 remarks,
                 course_id,
                 courses (id, name)
             `)
            .eq('student_id', actualStudentId);

        if (gradesError) throw gradesError;

        gradesData?.forEach((g: any) => {
            const courseId = g.course_id || g.courses?.id;
            const courseName = g.courses?.name || 'Curso';
            if (!courseId) return;

            if (!coursesMap.has(courseId)) {
                const yearMatch = courseName.match(/\b(20\d{2})\b/);
                const cycleYear = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
                coursesMap.set(courseId, {
                    course_id: courseId,
                    course_name: courseName,
                    enrollment_id: null,
                    is_active: false,
                    academic_status: 'COMPLETED',
                    schedule_grade: null,
                    cycle_year: cycleYear,
                    enrollment_date: null,
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

        // If caller is admin/superadmin/instructor/secretary, skip payment restriction
        const isStaff = callerRole && ['admin', 'superadmin', 'instructor', 'secretary'].includes(callerRole);
        const restrictByPayment = await getSettingBool('restrict_grades_by_payment');

        // Calculate payment-based restrictions for students/parents
        let allowedUnitsMap = new Map<number, number>();
        if (!isStaff && restrictByPayment) {
            const courseIds = Array.from(coursesMap.keys());
            allowedUnitsMap = await calculateAllowedUnits(actualStudentId, courseIds);
        }

        // Sort units by configured names and apply restriction
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

            const allowedCount = isStaff ? course.units.length : (allowedUnitsMap.get(course.course_id) ?? course.units.length);
            let paymentRestricted = false;

            // Apply restriction: mark units beyond allowed as restricted
            const processedUnits = course.units.map((unit: any, idx: number) => {
                if (!isStaff && idx >= allowedCount) {
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
                course_id: course.course_id,
                course_name: course.course_name,
                enrollment_id: course.enrollment_id,
                is_active: course.is_active,
                academic_status: course.academic_status,
                schedule_grade: course.schedule_grade,
                cycle_year: course.cycle_year,
                enrollment_date: course.enrollment_date,
                units: processedUnits,
                average: course.average,
                ordinary_average: course.ordinary_average,
                recuperation_score: course.recuperation_score,
                status: course.status,
                payment_restricted: paymentRestricted
            });
        });

        const generalAverage = totalCoursesGraded > 0 ? Number((totalScoreSum / totalCoursesGraded).toFixed(2)) : 0;

        const availableCycles = Array.from(
            new Set(
                reportCard.map((c: any) => c.cycle_year).filter(Boolean)
            )
        ).sort((a: any, b: any) => b.localeCompare(a));

        res.json({
            student: studentRecord,
            general_average: generalAverage,
            courses: reportCard,
            available_cycles: availableCycles
        });

    } catch (error) {
        console.error('Error retrieving report card:', error);
        res.status(500).json({ message: 'Error retrieving report card' });
    }
};

export const getCourseGradebook = async (req: Request, res: Response) => {
    const { course_id } = req.params;
    const { schedule_id } = req.query;
    const branchId = req.currentUser?.branch_id;

    try {
        const db = (req as any).dbUserClient || adminClient || client;

        // 1. Fetch course details
        const { data: course, error: courseError } = await db
            .from('courses')
            .select('name')
            .eq('id', course_id)
            .single();

        if (courseError) throw courseError;

        // 2. Fetch all enrolled students
        let enrollmentsQuery = db
            .from('enrollments')
            .select(`
                student_id,
                schedule_id,
                students!inner (
                    id,
                    full_name,
                    branch_id
                )
            `)
            .eq('course_id', course_id)
            .eq('is_active', true);

        if (branchId) {
            enrollmentsQuery = enrollmentsQuery.eq('students.branch_id', branchId);
        }

        if (schedule_id) {
            enrollmentsQuery = enrollmentsQuery.eq('schedule_id', schedule_id);
        }

        const { data: enrollments, error: enrollError } = await enrollmentsQuery;

        if (enrollError) throw enrollError;

        // 3. Fetch all grades for this course
        const { data: gradesData, error: gradesError } = await db
            .from('grades')
            .select('student_id, unit_name, score, remarks')
            .eq('course_id', course_id);

        if (gradesError) throw gradesError;

        // 4. Organize grades by student
        const studentGradesMap = new Map();

        // Initialize map with enrolled students
        enrollments?.forEach((e: any) => {
            studentGradesMap.set(e.student_id, {
                student_id: e.student_id,
                student_name: e.students.full_name,
                units: {},
                average: 0
            });
        });

        // Populate grades
        const allUnitsSet = new Set<string>(); // Keep track of all units ever graded in this course

        gradesData?.forEach((g: any) => {
            if (studentGradesMap.has(g.student_id)) {
                const studentRecord = studentGradesMap.get(g.student_id);
                studentRecord.units[g.unit_name] = {
                    score: g.score,
                    remarks: g.remarks
                };
                allUnitsSet.add(g.unit_name);
            }
        });

        const unitNamesStr = await getSetting('grade_unit_names');
        const configuredUnits = unitNamesStr 
            ? unitNamesStr.split(',').map(s => s.trim()).filter(Boolean) 
            : ['Bimestre 1', 'Bimestre 2', 'Bimestre 3', 'Bimestre 4'];

        // Calculate averages and recovery for each student
        const gradebook: any[] = [];

        studentGradesMap.forEach((student) => {
            let ordinarySum = 0;
            let ordinaryCount = 0;

            configuredUnits.forEach((uName: string) => {
                const uData = student.units[uName];
                if (uData && uData.score !== null && uData.score !== undefined && uData.score !== '') {
                    ordinarySum += Number(uData.score);
                    ordinaryCount++;
                }
            });

            const ordinaryAverage = ordinaryCount > 0 ? Number((ordinarySum / ordinaryCount).toFixed(2)) : null;

            const recupData = student.units['Recuperación'];
            const recupScore = (recupData && recupData.score !== null && recupData.score !== undefined && recupData.score !== '') 
                ? Number(recupData.score) 
                : null;

            let finalScore = ordinaryAverage;
            let status = 'PENDIENTE';
            let statusLabel = 'Pendiente';

            if (ordinaryAverage !== null) {
                if (ordinaryAverage >= 60) {
                    finalScore = ordinaryAverage;
                    status = 'APROBADO';
                    statusLabel = 'Aprobado';
                } else {
                    // Promedio ordinario menor a 60
                    if (recupScore !== null) {
                        if (recupScore >= 60) {
                            finalScore = 60; // Nota oficial al aprobar en recuperación
                            status = 'APROBADO_RECUPERACION';
                            statusLabel = 'Aprobado (Recup.)';
                        } else {
                            finalScore = ordinaryAverage;
                            status = 'REPROBADO';
                            statusLabel = 'Reprobado';
                        }
                    } else {
                        if (ordinaryCount === configuredUnits.length) {
                            status = 'REQUIERE_RECUPERACION';
                            statusLabel = 'En Recuperación';
                        } else {
                            status = 'EN_RIESGO';
                            statusLabel = 'En Riesgo';
                        }
                    }
                }
            }

            student.ordinary_average = ordinaryAverage;
            student.recuperation_score = recupScore;
            student.final_score = finalScore;
            student.status = status;
            student.status_label = statusLabel;
            student.average = finalScore !== null ? finalScore : 0; // Para retrocompatibilidad

            gradebook.push(student);
        });

        // Sort alphabetically
        gradebook.sort((a, b) => a.student_name.localeCompare(b.student_name));

        res.json({
            course_name: course.name,
            units: configuredUnits,
            has_recuperation: true,
            students: gradebook
        });

    } catch (error) {
        console.error('Error retrieving course gradebook:', error);
        res.status(500).json({ message: 'Error retrieving course gradebook' });
    }
};

// ==========================================
// DOCUMENT AUTHORIZATION CONTROLLER (Supabase adminClient)
// ==========================================

/**
 * Student or Secretary requests authorization to download / print a report card, certificate, or document
 */
export const requestDocumentAuthorization = async (req: Request, res: Response) => {
    try {
        const caller = req.currentUser;
        const student_id = req.body.student_id || caller?.id;
        const document_type = req.body.document_type || 'REPORT_CARD';
        const reason = req.body.reason || '';
        const course_id = req.body.course_id || null;
        const cycle_name = req.body.cycle_name || null;

        if (!student_id) {
            return res.status(400).json({ message: 'student_id es requerido' });
        }

        // Resolve student
        const { data: studentRecord } = await adminClient
            .from('students')
            .select('id, full_name, user_id, personal_code')
            .or(`id.eq.${student_id},user_id.eq.${student_id}`)
            .maybeSingle();

        const actualStudentId = studentRecord?.id || student_id;
        const studentName = studentRecord?.full_name || caller?.email || 'Estudiante';

        // Check if there is already a recent request for this document and course
        let findQuery = adminClient
            .from('document_authorizations')
            .select('*')
            .eq('student_id', actualStudentId)
            .eq('document_type', document_type);

        if (course_id) {
            findQuery = findQuery.eq('course_id', course_id);
        }

        const { data: existingRecords, error: findErr } = await findQuery
            .order('requested_at', { ascending: false })
            .limit(1);

        if (findErr) throw findErr;

        let record;
        if (existingRecords && existingRecords.length > 0 && existingRecords[0].status === 'PENDING') {
            const { data: updated, error: updateErr } = await adminClient
                .from('document_authorizations')
                .update({
                    reason,
                    course_id: course_id || existingRecords[0].course_id || null,
                    cycle_name: cycle_name || existingRecords[0].cycle_name || null,
                    requested_at: new Date().toISOString(),
                    requested_by: caller?.id || null
                })
                .eq('id', existingRecords[0].id)
                .select()
                .single();

            if (updateErr) throw updateErr;
            record = updated;
        } else {
            const { data: inserted, error: insertErr } = await adminClient
                .from('document_authorizations')
                .insert([{
                    student_id: actualStudentId,
                    document_type,
                    status: 'PENDING',
                    reason,
                    course_id: course_id || null,
                    cycle_name: cycle_name || null,
                    requested_by: caller?.id || null,
                    requested_at: new Date().toISOString(),
                    download_count: 0,
                    max_downloads: 3
                }])
                .select()
                .single();

            if (insertErr) throw insertErr;
            record = inserted;
        }

        // Notify admins and secretaries
        try {
            const { data: staffProfiles } = await adminClient
                .from('profiles')
                .select('id')
                .in('role', ['admin', 'superadmin']);

            if (staffProfiles && staffProfiles.length > 0) {
                const docLabels: Record<string, string> = {
                    REPORT_CARD: 'Boleta Oficial de Calificaciones',
                    GRADES_CERTIFICATE: 'Constancia Oficial de Notas',
                    CERTIFICATE: 'Constancia Oficial',
                    STUDENT_DELETION: 'Baja Definitiva de Estudiante'
                };
                const docLabel = docLabels[document_type] || 'Documento Oficial';
                const cycleDetail = cycle_name ? ` (${cycle_name})` : '';

                const notificationsToInsert = staffProfiles.map((staff: any) => ({
                    user_id: staff.id,
                    title: `Solicitud de ${docLabel}`,
                    message: `${caller?.role === 'secretary' ? 'Secretaría' : 'El alumno ' + studentName} ha solicitado emisión institucional de: ${docLabel}${cycleDetail}.`,
                    type: 'SYSTEM',
                    is_read: false
                }));
                await adminClient.from('notifications').insert(notificationsToInsert);
            }
        } catch (notifErr) {
            console.error('Error creating admin notification for document request:', notifErr);
        }

        return res.json({
            success: true,
            message: 'Solicitud de autorización enviada a la administración',
            request: record,
            status: 'PENDING'
        });
    } catch (error: any) {
        console.error('Error in requestDocumentAuthorization:', error);
        return res.status(500).json({ message: error.message || 'Error al procesar solicitud de autorización' });
    }
};

/**
 * Get the current authorization status for a student's document
 */
export const getDocumentAuthorizationStatus = async (req: Request, res: Response) => {
    try {
        const { student_id } = req.params;
        const document_type = (req.query.document_type as string) || 'REPORT_CARD';
        const course_id = (req.query.course_id as string) || null;

        // Resolve student
        const { data: studentRecord } = await adminClient
            .from('students')
            .select('id, full_name, user_id')
            .or(`id.eq.${student_id},user_id.eq.${student_id}`)
            .maybeSingle();

        const actualStudentId = studentRecord?.id || student_id;

        let query = adminClient
            .from('document_authorizations')
            .select('*')
            .in('student_id', [actualStudentId, student_id])
            .eq('document_type', document_type);

        if (course_id && course_id !== 'ALL') {
            query = query.eq('course_id', course_id);
        }

        const { data: records, error: fetchErr } = await query
            .order('requested_at', { ascending: false })
            .limit(1);

        if (fetchErr) throw fetchErr;

        if (!records || records.length === 0) {
            return res.json({ 
                status: 'NONE', 
                request: null,
                download_count: 0,
                max_downloads: 3,
                remaining_downloads: 3,
                is_blocked: false
            });
        }

        const currentRecord = records[0];
        const downloadCount = currentRecord.download_count || 0;
        const maxDownloads = currentRecord.max_downloads || 3;
        const isConsumed = currentRecord.status === 'CONSUMED' || (currentRecord.status === 'APPROVED' && downloadCount >= maxDownloads);
        const effectiveStatus = isConsumed ? 'CONSUMED' : currentRecord.status;
        const remainingDownloads = Math.max(0, maxDownloads - downloadCount);

        return res.json({
            status: effectiveStatus,
            request: currentRecord,
            download_count: downloadCount,
            max_downloads: maxDownloads,
            remaining_downloads: remainingDownloads,
            is_blocked: isConsumed
        });
    } catch (error: any) {
        console.error('Error in getDocumentAuthorizationStatus:', error);
        return res.status(500).json({ message: 'Error retrieving authorization status' });
    }
};

/**
 * Retrieve all authorization requests made for or by a specific student (for student "Mis Trámites" view)
 */
export const getStudentDocumentAuthorizations = async (req: Request, res: Response) => {
    try {
        const { student_id } = req.params;
        const caller = req.currentUser;

        // Resolve student
        const { data: studentRecord } = await adminClient
            .from('students')
            .select('id, full_name, user_id')
            .or(`id.eq.${student_id},user_id.eq.${student_id}`)
            .maybeSingle();

        const actualStudentId = studentRecord?.id || student_id;

        // Security check: if student, can only view own authorizations
        if (caller?.role === 'student' && studentRecord?.user_id && caller.id !== studentRecord.user_id && caller.id !== student_id) {
            return res.status(403).json({ message: 'No tienes permiso para ver estas solicitudes' });
        }

        const { data: records, error } = await adminClient
            .from('document_authorizations')
            .select('*')
            .in('student_id', [actualStudentId, student_id])
            .order('requested_at', { ascending: false });

        if (error) throw error;

        // Hydrate course and delivered_by names
        const courseIds = [...new Set((records || []).map((r: any) => r.course_id).filter(Boolean))];
        const profileIds = [...new Set((records || []).map((r: any) => r.delivered_by).filter(Boolean))];

        const [coursesRes, profilesRes] = await Promise.all([
            courseIds.length > 0 ? adminClient.from('courses').select('id, name').in('id', courseIds) : Promise.resolve({ data: [] }),
            profileIds.length > 0 ? adminClient.from('profiles').select('id, full_name').in('id', profileIds) : Promise.resolve({ data: [] })
        ]);

        const courseMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c.name]));
        const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.full_name]));

        const hydrated = (records || []).map((r: any) => ({
            ...r,
            course_name: r.cycle_name || courseMap.get(r.course_id) || (r.course_id === 'ALL' ? 'Historial Completo Consolidado' : null),
            delivered_by_name: profileMap.get(r.delivered_by) || null
        }));

        return res.json({ authorizations: hydrated });
    } catch (error: any) {
        console.error('Error in getStudentDocumentAuthorizations:', error);
        return res.status(500).json({ message: 'Error retrieving student authorizations' });
    }
};

/**
 * List all authorization requests for admin / secretary
 */
export const getAllDocumentAuthorizations = async (req: Request, res: Response) => {
    try {
        const { data: docAuths, error: authErr } = await adminClient
            .from('document_authorizations')
            .select('*')
            .order('requested_at', { ascending: false })
            .limit(100);

        if (authErr) throw authErr;

        const studentIds = [...new Set((docAuths || []).map((d: any) => d.student_id).filter(Boolean))];
        const requesterIds = [...new Set((docAuths || []).map((d: any) => d.requested_by).filter(Boolean))];
        const deliveredByIds = [...new Set((docAuths || []).map((d: any) => d.delivered_by).filter(Boolean))];
        const courseIds = [...new Set((docAuths || []).map((d: any) => d.course_id).filter(Boolean))];
        const allProfileIds = [...new Set([...requesterIds, ...deliveredByIds])];

        const [studentsRes, legacyCoursesRes, profilesRes, directCoursesRes] = await Promise.all([
            studentIds.length > 0
                ? adminClient.from('students').select('id, full_name, personal_code, identification_document').in('id', studentIds)
                : Promise.resolve({ data: [] }),
            studentIds.length > 0
                ? adminClient.from('courses').select('id, name').in('id', studentIds)
                : Promise.resolve({ data: [] }),
            allProfileIds.length > 0
                ? adminClient.from('profiles').select('id, full_name').in('id', allProfileIds)
                : Promise.resolve({ data: [] }),
            courseIds.length > 0
                ? adminClient.from('courses').select('id, name').in('id', courseIds)
                : Promise.resolve({ data: [] })
        ]);

        const studentMap = new Map((studentsRes.data || []).map((s: any) => [s.id, s]));
        const legacyCourseMap = new Map((legacyCoursesRes.data || []).map((c: any) => [c.id, c]));
        const directCourseMap = new Map((directCoursesRes.data || []).map((c: any) => [c.id, c]));
        const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p]));

        const hydrated = (docAuths || []).map((d: any) => {
            const student = studentMap.get(d.student_id);
            const legacyCourse = legacyCourseMap.get(d.student_id);
            const directCourse = directCourseMap.get(d.course_id);
            const requester = profileMap.get(d.requested_by);
            const deliveredBy = profileMap.get(d.delivered_by);

            const displayCourse = d.cycle_name || directCourse?.name || legacyCourse?.name || (d.course_id === 'ALL' ? 'Historial Completo Consolidado' : null);

            return {
                ...d,
                student_name: student?.full_name || legacyCourse?.name || 'Documento Académico',
                personal_code: student?.personal_code || null,
                identification_document: student?.identification_document || null,
                course_name: displayCourse,
                cycle_name: d.cycle_name || directCourse?.name || (d.course_id === 'ALL' ? 'Historial Completo' : null),
                requester_name: requester?.full_name || null,
                delivered_by_name: deliveredBy?.full_name || null
            };
        });

        return res.json({ authorizations: hydrated });
    } catch (error: any) {
        console.error('Error in getAllDocumentAuthorizations:', error);
        return res.status(500).json({ message: 'Error retrieving document authorizations' });
    }
};

/**
 * Update authorization status (Approve / Reject / Deliver)
 * - Approve / Reject: Admin / SuperAdmin
 * - Deliver: Admin / SuperAdmin / Secretary
 */
export const updateDocumentAuthorization = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const caller = req.currentUser;

        if (!['APPROVED', 'REJECTED', 'PENDING', 'DELIVERED'].includes(status)) {
            return res.status(400).json({ message: 'Estado inválido. Debe ser APPROVED, REJECTED, PENDING o DELIVERED' });
        }

        // Security check based on status
        if (status === 'DELIVERED') {
            if (!['admin', 'superadmin', 'secretary'].includes(caller?.role || '')) {
                return res.status(403).json({ message: 'Solo la Administración y Secretaría pueden registrar la entrega de documentos.' });
            }
        } else {
            // Only admin and superadmin can authorize or reject
            if (!['admin', 'superadmin'].includes(caller?.role || '')) {
                return res.status(403).json({ message: 'Solo la Administración puede autorizar o rechazar solicitudes.' });
            }
        }

        const updatePayload: any = {
            status
        };

        if (status === 'APPROVED' || status === 'REJECTED') {
            updatePayload.authorized_by = caller?.id || null;
            updatePayload.authorized_at = new Date().toISOString();
            if (status === 'APPROVED') {
                updatePayload.download_count = 0;
            }
        } else if (status === 'DELIVERED') {
            updatePayload.delivered_by = caller?.id || null;
            updatePayload.delivered_at = new Date().toISOString();
        }

        if (notes !== undefined) {
            updatePayload.notes = notes;
        }

        const { data: updatedRecord, error: updateErr } = await adminClient
            .from('document_authorizations')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (updateErr) throw updateErr;
        if (!updatedRecord) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        // If it's a student deletion and approved, execute student deletion directly!
        if (updatedRecord.document_type === 'STUDENT_DELETION' && status === 'APPROVED') {
            try {
                await adminClient.from('students').delete().eq('id', updatedRecord.student_id);
            } catch (delErr) {
                console.error('Error executing student deletion upon authorization:', delErr);
            }
        }

        // Notify the requester (e.g. secretary or student) if exists
        if (updatedRecord.requested_by) {
            try {
                const docLabels: Record<string, string> = {
                    STUDENT_DELETION: 'Eliminación de Estudiante',
                    COURSE_ACTA: 'Acta Oficial de Curso',
                    REPORT_CARD: 'Boleta de Calificaciones',
                    GRADES_CERTIFICATE: 'Constancia de Notas',
                    CERTIFICATE: 'Constancia de Estudio'
                };
                const docLabel = docLabels[updatedRecord.document_type] || 'Documento Académico';

                let title = `Solicitud de ${docLabel} ${status === 'APPROVED' ? 'Aprobada' : 'Rechazada'}`;
                let message = `La Administración ha ${status === 'APPROVED' ? 'APROBADO' : 'RECHAZADO'} la solicitud de ${docLabel}.${notes ? ' Nota: ' + notes : ''}`;

                if (status === 'DELIVERED') {
                    title = `Entrega de ${docLabel} Registrada`;
                    message = `Se ha registrado la entrega física de la ${docLabel} al estudiante/tutor.${notes ? ' Nota: ' + notes : ''}`;
                }

                await adminClient.from('notifications').insert([{
                    user_id: updatedRecord.requested_by,
                    title,
                    message,
                    type: 'SYSTEM',
                    is_read: false
                }]);
            } catch (notifErr) {
                console.error('Error notifying requester:', notifErr);
            }
        }

        // Notify the student if REPORT_CARD or GRADES_CERTIFICATE
        if (['REPORT_CARD', 'GRADES_CERTIFICATE'].includes(updatedRecord.document_type)) {
            try {
                const { data: studentRecord } = await adminClient
                    .from('students')
                    .select('id, user_id, full_name')
                    .or(`id.eq.${updatedRecord.student_id},user_id.eq.${updatedRecord.student_id}`)
                    .maybeSingle();

                const studentUserId = studentRecord?.user_id;
                if (studentUserId) {
                    let title = status === 'APPROVED' ? 'Documento Oficial Autorizado' : 'Solicitud de Documento Rechazada';
                    let message = status === 'APPROVED'
                        ? 'Tu solicitud para emitir el documento oficial ha sido aprobada por Dirección. Ya puedes pasar a recogerlo al plantel.'
                        : 'Tu solicitud de documento no pudo ser autorizada en este momento. Consulta con secretaría.';

                    if (status === 'DELIVERED') {
                        title = 'Boleta Oficial Entregada';
                        message = 'Tu boleta oficial ha sido entregada exitosamente en las oficinas del plantel. ¡Gracias por completar tu trámite!';
                    }

                    await adminClient.from('notifications').insert([{
                        user_id: studentUserId,
                        title,
                        message,
                        type: 'SYSTEM',
                        is_read: false
                    }]);
                }
            } catch (notifErr) {
                console.error('Error creating student notification:', notifErr);
            }
        }

        return res.json({
            success: true,
            message: `Solicitud marcada como ${status}`,
            request: updatedRecord
        });
    } catch (error: any) {
        console.error('Error in updateDocumentAuthorization:', error);
        return res.status(500).json({ message: error.message || 'Error updating authorization' });
    }
};

/**
 * Track a document download/print by secretary (maximum 3 allowed per approved authorization)
 */
export const trackDocumentDownload = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const callerRole = req.currentUser?.role;

        const { data: record, error: findErr } = await adminClient
            .from('document_authorizations')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (findErr) throw findErr;
        if (!record) {
            return res.status(404).json({ message: 'Autorización no encontrada' });
        }

        // Administrators and superadmins are exempt from the 3-download limit
        if (['admin', 'superadmin'].includes(callerRole || '')) {
            return res.json({
                success: true,
                message: 'Administrador exento del límite de descargas',
                download_count: record.download_count || 0,
                max_downloads: record.max_downloads || 3,
                remaining_downloads: 3,
                is_blocked: false
            });
        }

        const currentCount = record.download_count || 0;
        const maxCount = record.max_downloads || 3;
        const newCount = currentCount + 1;
        const isNowConsumed = newCount >= maxCount;

        const updatePayload: any = {
            download_count: newCount
        };
        if (isNowConsumed) {
            updatePayload.status = 'CONSUMED';
        }

        const { data: updated, error: updateErr } = await adminClient
            .from('document_authorizations')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (updateErr) throw updateErr;

        return res.json({
            success: true,
            message: isNowConsumed ? 'Límite máximo de 3 descargas alcanzado' : `Descarga registrada (${newCount} de ${maxCount})`,
            request: updated,
            download_count: newCount,
            max_downloads: maxCount,
            remaining_downloads: Math.max(0, maxCount - newCount),
            is_blocked: isNowConsumed
        });
    } catch (error: any) {
        console.error('Error tracking document download:', error);
        return res.status(500).json({ message: 'Error al registrar descarga' });
    }
};

/**
 * Check authorization status for a Course Acta (Sábana de notas)
 */
export const getCourseActaAuthorization = async (req: Request, res: Response) => {
    const { courseId } = req.params;
    try {
        const { data: records, error: fetchErr } = await adminClient
            .from('document_authorizations')
            .select('*')
            .eq('student_id', courseId)
            .eq('document_type', 'COURSE_ACTA')
            .order('requested_at', { ascending: false })
            .limit(1);

        if (fetchErr) throw fetchErr;

        if (!records || records.length === 0) {
            return res.json({ status: 'NONE' });
        }
        return res.json({ status: records[0].status, record: records[0] });
    } catch (error: any) {
        console.error('Error in getCourseActaAuthorization:', error);
        return res.status(500).json({ message: 'Error retrieving course acta authorization' });
    }
};

/**
 * Request authorization to download / print a Course Acta
 */
export const requestCourseActaAuthorization = async (req: Request, res: Response) => {
    const { courseId } = req.params;
    const { reason } = req.body;
    const caller = req.currentUser;
    try {
        const { data: course } = await adminClient
            .from('courses')
            .select('id, name')
            .eq('id', courseId)
            .maybeSingle();

        const courseName = course?.name || 'Curso';

        // Check existing pending
        const { data: existing, error: existErr } = await adminClient
            .from('document_authorizations')
            .select('*')
            .eq('student_id', courseId)
            .eq('document_type', 'COURSE_ACTA')
            .eq('status', 'PENDING')
            .limit(1);

        if (existErr) throw existErr;

        let record;
        if (existing && existing.length > 0) {
            record = existing[0];
        } else {
            const { data: inserted, error: insertErr } = await adminClient
                .from('document_authorizations')
                .insert([{
                    student_id: courseId,
                    document_type: 'COURSE_ACTA',
                    status: 'PENDING',
                    reason: reason || `Descarga e impresión de acta oficial de curso (${courseName})`,
                    requested_by: caller?.id || null,
                    requested_at: new Date().toISOString()
                }])
                .select()
                .single();

            if (insertErr) throw insertErr;
            record = inserted;

            // Notify admins
            try {
                const { data: staffProfiles } = await adminClient
                    .from('profiles')
                    .select('id')
                    .in('role', ['admin', 'superadmin']);

                if (staffProfiles && staffProfiles.length > 0) {
                    const notifs = staffProfiles.map((adm: any) => ({
                        user_id: adm.id,
                        title: '📑 Solicitud de Acta Oficial de Curso',
                        message: `Secretaría ha solicitado autorización para descargar e imprimir el Acta Oficial del curso ${courseName}.`,
                        type: 'SYSTEM',
                        is_read: false
                    }));
                    await adminClient.from('notifications').insert(notifs);
                }
            } catch (notifErr) {
                console.error('Error notifying admins about course acta request:', notifErr);
            }
        }

        return res.json({ success: true, message: 'Solicitud de acta enviada a Dirección', status: 'PENDING', request: record });
    } catch (error: any) {
        console.error('Error in requestCourseActaAuthorization:', error);
        return res.status(500).json({ message: error.message || 'Error requesting course acta authorization' });
    }
};
