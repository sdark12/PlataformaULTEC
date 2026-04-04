import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';
import { getSettingBool, getSetting } from './settings.controller';

export const getGrades = async (req: Request, res: Response) => {
    const { course_id, unit_name, schedule_id } = req.query;
    const branchId = req.currentUser?.branch_id;

    if (!course_id || !unit_name) {
        return res.status(400).json({ message: 'course_id and unit_name are required' });
    }

    try {
        // 1. Fetch all active enrolled students
        let enrollmentsQuery = client.database
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
        const { data: gradesData, error: gradesError } = await client.database
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

        // 3. Merge data
        const mergedData = enrollments?.map((enrollment: any) => {
            const studentId = enrollment.student_id;
            const existingRecord = gradesMap.get(studentId);

            return {
                student_id: studentId,
                student_name: enrollment.students.full_name,
                unit_name: unit_name,
                score: existingRecord ? existingRecord.score : '',
                remarks: existingRecord ? existingRecord.remarks : ''
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

export const saveGrades = async (req: Request, res: Response) => {
    const { course_id, unit_name, students } = req.body;
    const userId = req.currentUser?.id;

    if (!course_id || !unit_name || !students) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const upsertData = students.map((s: any) => ({
            course_id,
            student_id: s.student_id,
            unit_name,
            score: Number(s.score) || 0,
            remarks: s.remarks,
            created_by: userId
        }));

        const { error } = await client.database
            .from('grades')
            .upsert(upsertData, { onConflict: 'course_id, student_id, unit_name' });

        if (error) throw error;

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
    const TOTAL_UNITS = 4;

    if (courseIds.length === 0) return allowedMap;

    // Get enrollments for these courses
    const { data: enrollments } = await adminClient.database
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
    const { data: payments } = await adminClient.database
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
        let studentQuery = adminClient.database
            .from('students')
            .select('full_name, id, user_id');

        const { data: studentRecord, error: findError } = await studentQuery
            .or(`id.eq.${student_id},user_id.eq.${student_id}`)
            .maybeSingle();

        if (findError) throw findError;
        
        if (!studentRecord) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }

        const actualStudentId = studentRecord.id;

        // Get all grades across courses
        const { data: gradesData, error: gradesError } = await adminClient.database
            .from('grades')
            .select(`
                 score,
                 unit_name,
                 remarks,
                 courses (id, name)
             `)
            .eq('student_id', actualStudentId);

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

        // If caller is admin/superadmin/instructor, skip payment restriction
        const isStaff = callerRole && ['admin', 'superadmin', 'instructor'].includes(callerRole);
        const restrictByPayment = await getSettingBool('restrict_grades_by_payment');

        // Calculate payment-based restrictions for students/parents
        let allowedUnitsMap = new Map<number, number>();
        if (!isStaff && restrictByPayment) {
            const courseIds = Array.from(coursesMap.keys());
            allowedUnitsMap = await calculateAllowedUnits(actualStudentId, courseIds);
        }

        // Sort units by name (Unidad 1, Unidad 2...) and apply restriction
        const unitOrder = ['Unidad 1', 'Unidad 2', 'Unidad 3', 'Unidad 4', 'Examen Final', 'Proyecto'];

        const reportCard: any[] = [];
        let totalScoreSum = 0;
        let totalUnits = 0;

        coursesMap.forEach((course) => {
            // Sort units in order
            course.units.sort((a: any, b: any) => {
                const ai = unitOrder.indexOf(a.unit_name);
                const bi = unitOrder.indexOf(b.unit_name);
                return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            });

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

            // Only count visible units for average
            const visibleUnits = processedUnits.filter((u: any) => !u.restricted && u.score !== null);
            const sum = visibleUnits.reduce((acc: number, curr: any) => acc + Number(curr.score), 0);
            course.average = visibleUnits.length > 0 ? Number((sum / visibleUnits.length).toFixed(2)) : 0;

            totalScoreSum += sum;
            totalUnits += visibleUnits.length;

            reportCard.push({
                course_name: course.course_name,
                units: processedUnits,
                average: course.average,
                payment_restricted: paymentRestricted
            });
        });

        const generalAverage = totalUnits > 0 ? Number((totalScoreSum / totalUnits).toFixed(2)) : 0;

        res.json({
            student: studentRecord,
            general_average: generalAverage,
            courses: reportCard
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
        // 1. Fetch course details
        const { data: course, error: courseError } = await client.database
            .from('courses')
            .select('name')
            .eq('id', course_id)
            .single();

        if (courseError) throw courseError;

        // 2. Fetch all enrolled students
        let enrollmentsQuery = client.database
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
        const { data: gradesData, error: gradesError } = await client.database
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

        const allUnits = Array.from(allUnitsSet).sort();

        // Calculate averages for each student
        const gradebook: any[] = [];

        studentGradesMap.forEach((student) => {
            let sum = 0;
            let count = 0;

            Object.keys(student.units).forEach(unitName => {
                sum += student.units[unitName].score;
                count++;
            });

            student.average = count > 0 ? (sum / count).toFixed(2) : 0;
            gradebook.push(student);
        });

        // Sort alphabetically
        gradebook.sort((a, b) => a.student_name.localeCompare(b.student_name));

        res.json({
            course_name: course.name,
            units: allUnits,
            students: gradebook
        });

    } catch (error) {
        console.error('Error retrieving course gradebook:', error);
        res.status(500).json({ message: 'Error retrieving course gradebook' });
    }
};
