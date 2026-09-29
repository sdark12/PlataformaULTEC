import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';
import { getSettingNumber } from './settings.controller';
import { broadcastNotification } from '../services/notification.service';

/**
 * GET /api/promotions/candidates
 * Fetches all enrolled students in a source course, calculates their final grade average,
 * compares against minimum_passing_grade, and flags target enrollment status.
 */
export const getCandidatesForPromotion = async (req: Request, res: Response) => {
    const { source_course_id, target_course_id } = req.query;

    if (!source_course_id) {
        return res.status(400).json({ message: 'source_course_id es requerido' });
    }

    try {
        const minimumPassingGrade = (await getSettingNumber('minimum_passing_grade')) || 60;

        // 1. Get source course details
        const { data: sourceCourse, error: courseErr } = await adminClient
            .from('courses')
            .select('id, name, branch_id')
            .eq('id', source_course_id)
            .single();

        if (courseErr || !sourceCourse) {
            return res.status(404).json({ message: 'Curso origen no encontrado' });
        }

        // 2. Fetch active enrollments in source course
        const { data: enrollments, error: enrollErr } = await adminClient
            .from('enrollments')
            .select(`
                id,
                student_id,
                course_id,
                schedule_id,
                is_active,
                academic_status,
                students (
                    id,
                    full_name,
                    personal_code,
                    identification_document
                )
            `)
            .eq('course_id', source_course_id)
            .eq('is_active', true);

        if (enrollErr) throw enrollErr;

        if (!enrollments || enrollments.length === 0) {
            return res.json({
                source_course: sourceCourse,
                minimum_passing_grade: minimumPassingGrade,
                candidates: []
            });
        }

        const studentIds = enrollments.map(e => e.student_id);

        // 3. Fetch all grades for these students in this course
        const { data: gradesData, error: gradesErr } = await adminClient
            .from('grades')
            .select('student_id, score, unit_name')
            .eq('course_id', source_course_id)
            .in('student_id', studentIds);

        if (gradesErr) throw gradesErr;

        // Map grades by student
        const studentGradesMap = new Map<string, Array<{ unit_name: string; score: number }>>();
        gradesData?.forEach(g => {
            const list = studentGradesMap.get(g.student_id) || [];
            list.push({ unit_name: g.unit_name, score: Number(g.score) || 0 });
            studentGradesMap.set(g.student_id, list);
        });

        // 4. If target_course_id is provided, check if students are already enrolled there
        const alreadyEnrolledMap = new Set<string>();
        if (target_course_id) {
            const { data: targetEnrollments } = await adminClient
                .from('enrollments')
                .select('student_id')
                .eq('course_id', target_course_id)
                .in('student_id', studentIds);

            targetEnrollments?.forEach(te => alreadyEnrolledMap.add(te.student_id));
        }

        // 5. Build candidates payload
        const candidates = enrollments.map(e => {
            const student = (e as any).students;
            const grades = studentGradesMap.get(e.student_id) || [];
            const ordinaryGrades = grades.filter(g => g.unit_name !== 'Recuperación' && !['Examen Final', 'Proyecto'].includes(g.unit_name));
            const recupGrade = grades.find(g => g.unit_name === 'Recuperación');
            const validScores = ordinaryGrades.map(g => g.score);
            let average = validScores.length > 0 
                ? Number((validScores.reduce((acc, curr) => acc + curr, 0) / validScores.length).toFixed(1))
                : 0;

            if (average < minimumPassingGrade && recupGrade && recupGrade.score >= minimumPassingGrade) {
                average = minimumPassingGrade;
            }

            let suggestedStatus: 'APPROVED' | 'CONDITIONAL' | 'RETAINED' = 'RETAINED';
            if (average >= minimumPassingGrade) {
                suggestedStatus = 'APPROVED';
            } else if (average >= minimumPassingGrade - 10) {
                suggestedStatus = 'CONDITIONAL';
            }

            const isAlreadyEnrolled = alreadyEnrolledMap.has(e.student_id);

            return {
                student_id: e.student_id,
                enrollment_id: e.id,
                full_name: student?.full_name || 'Sin nombre',
                personal_code: student?.personal_code || 'N/A',
                identification_document: student?.identification_document || 'N/A',
                grades,
                average,
                units_evaluated: validScores.length,
                suggested_status: suggestedStatus,
                is_eligible: average >= minimumPassingGrade && !isAlreadyEnrolled,
                already_enrolled_in_target: isAlreadyEnrolled
            };
        });

        res.json({
            source_course: sourceCourse,
            minimum_passing_grade: minimumPassingGrade,
            candidates
        });
    } catch (error: any) {
        console.error('Error fetching promotion candidates:', error);
        res.status(500).json({ message: 'Error al consultar candidatos de promoción', error: error?.message });
    }
};

/**
 * POST /api/promotions/execute
 * Executes atomic promotion for selected students:
 * 1. Creates new enrollment in target course.
 * 2. Archives source enrollment (is_active = false, academic_status = 'PROMOTED').
 * 3. Records history in student_promotions table.
 * 4. Generates initial financial status for target course.
 * 5. Emits notification to student.
 */
export const executePromotion = async (req: Request, res: Response) => {
    const { 
        source_course_id, 
        target_course_id, 
        target_schedule_id, 
        school_cycle, 
        promotions 
    } = req.body;

    const callerRole = req.currentUser?.role;
    const promotedBy = req.currentUser?.id;

    if (!['admin', 'superadmin'].includes(callerRole || '')) {
        return res.status(403).json({ message: 'Solo administradores pueden ejecutar la promoción escolar' });
    }

    if (!source_course_id || !target_course_id || !Array.isArray(promotions) || promotions.length === 0) {
        return res.status(400).json({ message: 'Parámetros inválidos. Se requiere source_course_id, target_course_id y lista de promociones' });
    }

    try {
        // 1. Fetch Target Course info
        const { data: targetCourse, error: tcErr } = await adminClient
            .from('courses')
            .select('id, name, branch_id, monthly_fee, is_active')
            .eq('id', target_course_id)
            .single();

        if (tcErr || !targetCourse) {
            return res.status(404).json({ message: 'Curso destino no encontrado' });
        }

        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const results: any[] = [];
        let promotedCount = 0;
        let retainedCount = 0;
        let skippedCount = 0;

        for (const item of promotions) {
            const { student_id, status = 'APPROVED', final_grade = 0, notes = '' } = item;

            // Fetch current enrollment in source course
            const { data: sourceEnrollment } = await adminClient
                .from('enrollments')
                .select('id, branch_id')
                .eq('student_id', student_id)
                .eq('course_id', source_course_id)
                .maybeSingle();

            if (!sourceEnrollment) {
                skippedCount++;
                results.push({ student_id, status: 'SKIPPED', message: 'Inscripción origen no encontrada' });
                continue;
            }

            if (status === 'APPROVED' || status === 'CONDITIONAL') {
                // Check if already enrolled in target course
                const { data: existingTarget } = await adminClient
                    .from('enrollments')
                    .select('id')
                    .eq('student_id', student_id)
                    .eq('course_id', target_course_id)
                    .maybeSingle();

                let newEnrollmentId: string | null = null;

                if (!existingTarget) {
                    // Create new enrollment in target course
                    const { data: newEnrollment, error: newEnrErr } = await adminClient
                        .from('enrollments')
                        .insert([{
                            branch_id: targetCourse.branch_id || sourceEnrollment.branch_id,
                            student_id,
                            course_id: target_course_id,
                            schedule_id: target_schedule_id || null,
                            is_active: true,
                            academic_status: 'ACTIVE'
                        }])
                        .select('id')
                        .single();

                    if (newEnrErr) {
                        console.error(`Error creating enrollment for student ${student_id}:`, newEnrErr);
                        skippedCount++;
                        results.push({ student_id, status: 'ERROR', message: newEnrErr.message });
                        continue;
                    }
                    newEnrollmentId = newEnrollment.id;

                    // Generate initial financial status if monthly_fee > 0
                    if (targetCourse.monthly_fee && targetCourse.monthly_fee > 0) {
                        await adminClient
                            .from('financial_status')
                            .insert([{
                                enrollment_id: newEnrollmentId,
                                month: currentMonth,
                                amount_due: targetCourse.monthly_fee,
                                status: 'PENDING'
                            }]);
                    }
                } else {
                    newEnrollmentId = existingTarget.id;
                }

                // Archive source enrollment
                await adminClient
                    .from('enrollments')
                    .update({
                        is_active: false,
                        academic_status: 'PROMOTED',
                        promoted_to_enrollment_id: newEnrollmentId
                    })
                    .eq('id', sourceEnrollment.id);

                // Insert into student_promotions history
                await adminClient
                    .from('student_promotions')
                    .insert([{
                        student_id,
                        from_course_id: source_course_id,
                        to_course_id: target_course_id,
                        from_enrollment_id: sourceEnrollment.id,
                        to_enrollment_id: newEnrollmentId,
                        final_grade,
                        status,
                        school_cycle: school_cycle || `${new Date().getFullYear()} -> ${new Date().getFullYear() + 1}`,
                        notes: notes || 'Promovido satisfactoriamente',
                        promoted_by: promotedBy || null
                    }]);

                // Notify student
                try {
                    await broadcastNotification(
                        adminClient,
                        targetCourse.branch_id,
                        '¡Promoción Académica Aprobada!',
                        `Has sido promovido oficialmente al curso ${targetCourse.name}. ¡Felicitaciones por tu desempeño!`,
                        'ENROLLMENT'
                    );
                } catch (notifErr) {
                    console.warn('Could not broadcast notification:', notifErr);
                }

                promotedCount++;
                results.push({ student_id, status: 'PROMOTED', target_enrollment_id: newEnrollmentId });
            } else {
                // Marked as RETAINED (No promovido)
                await adminClient
                    .from('enrollments')
                    .update({
                        academic_status: 'RETAINED'
                    })
                    .eq('id', sourceEnrollment.id);

                await adminClient
                    .from('student_promotions')
                    .insert([{
                        student_id,
                        from_course_id: source_course_id,
                        to_course_id: target_course_id,
                        from_enrollment_id: sourceEnrollment.id,
                        final_grade,
                        status: 'RETAINED',
                        school_cycle: school_cycle || `${new Date().getFullYear()}`,
                        notes: notes || 'No promovido / Requiere recuperación',
                        promoted_by: promotedBy || null
                    }]);

                retainedCount++;
                results.push({ student_id, status: 'RETAINED' });
            }
        }

        res.json({
            message: 'Proceso de promoción completado con éxito',
            summary: {
                promoted_count: promotedCount,
                retained_count: retainedCount,
                skipped_count: skippedCount,
                total_processed: promotions.length
            },
            results
        });
    } catch (error: any) {
        console.error('Error executing promotions:', error);
        res.status(500).json({ message: 'Error al ejecutar la promoción', error: error?.message });
    }
};

/**
 * GET /api/promotions/history
 * Returns the history of academic promotions
 */
export const getPromotionHistory = async (req: Request, res: Response) => {
    const { student_id, from_course_id, to_course_id, limit = 50 } = req.query;

    try {
        let query = adminClient
            .from('student_promotions')
            .select(`
                id,
                student_id,
                from_course_id,
                to_course_id,
                from_enrollment_id,
                to_enrollment_id,
                final_grade,
                status,
                school_cycle,
                notes,
                promoted_at,
                students (
                    id,
                    full_name,
                    personal_code,
                    identification_document
                ),
                from_course:courses!from_course_id (
                    id,
                    name
                ),
                to_course:courses!to_course_id (
                    id,
                    name
                )
            `)
            .order('promoted_at', { ascending: false })
            .limit(Number(limit) || 50);

        if (student_id) query = query.eq('student_id', student_id);
        if (from_course_id) query = query.eq('from_course_id', from_course_id);
        if (to_course_id) query = query.eq('to_course_id', to_course_id);

        const { data, error } = await query;

        if (error) throw error;

        res.json({ promotions: data || [] });
    } catch (error: any) {
        console.error('Error fetching promotion history:', error);
        res.status(500).json({ message: 'Error al obtener historial de promociones', error: error?.message });
    }
};
