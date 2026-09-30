import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';

/**
 * Helper to sync a subgrade category and bimestral grades for students
 */
async function syncCategoryForStudents(categoryId: string, studentIds?: string[], userId?: string) {
    try {
        const db = adminClient;
        // 1. Fetch category
        const { data: category } = await db
            .from('subgrade_categories')
            .select('id, name, max_score, course_id, unit_name')
            .eq('id', categoryId)
            .single();
        if (!category) return;

        // 2. Fetch all assignments in this category
        const { data: catAssignments } = await db
            .from('assignments')
            .select('id, max_score')
            .eq('category_id', categoryId);

        const catAssignmentIds = (catAssignments || []).map((a: any) => a.id);

        let targetStudents = studentIds;
        if (!targetStudents || targetStudents.length === 0) {
            const { data: enrs } = await db
                .from('enrollments')
                .select('student_id')
                .eq('course_id', category.course_id)
                .eq('is_active', true);
            targetStudents = (enrs || []).map((e: any) => e.student_id);
        }

        if (!targetStudents || targetStudents.length === 0) return;

        for (const studentId of targetStudents) {
            let totalEarned = 0;
            if (catAssignmentIds.length > 0) {
                const { data: subs } = await db
                    .from('assignment_submissions')
                    .select('score')
                    .in('assignment_id', catAssignmentIds)
                    .eq('student_id', studentId);

                subs?.forEach((s: any) => {
                    if (s.score !== null && s.score !== undefined) {
                        totalEarned += Number(s.score);
                    }
                });
            }

            const catMaxScore = Number(category.max_score) || 100;
            const finalScore = Math.min(catMaxScore, Math.max(0, Math.round(totalEarned * 100) / 100));

            await db
                .from('subgrades')
                .upsert({
                    category_id: category.id,
                    student_id: studentId,
                    score: finalScore,
                    remarks: `Sincronizado de Tareas (${finalScore}/${catMaxScore} pts)`,
                    created_by: userId || null
                }, { onConflict: 'category_id, student_id' });

            // Sync bimestral grades
            const { data: allCats } = await db
                .from('subgrade_categories')
                .select('id')
                .eq('course_id', category.course_id)
                .eq('unit_name', category.unit_name);

            if (allCats && allCats.length > 0) {
                const allCatIds = allCats.map((c: any) => c.id);
                const { data: allSg } = await db
                    .from('subgrades')
                    .select('score')
                    .in('category_id', allCatIds)
                    .eq('student_id', studentId);

                const sumScore = (allSg || []).reduce((acc: number, curr: any) => acc + (Number(curr.score) || 0), 0);
                const bimestralScore = Math.min(100, Math.max(0, Math.round(sumScore)));

                await db
                    .from('grades')
                    .upsert({
                        course_id: category.course_id,
                        unit_name: category.unit_name,
                        student_id: studentId,
                        score: bimestralScore,
                        remarks: `Sincronizado de ${allCats.length} subcalificaciones`,
                        created_by: userId || null
                    }, { onConflict: 'student_id, course_id, unit_name' });
            }
        }
    } catch (err) {
        console.error('Error in syncCategoryForStudents:', err);
    }
}

export const assignmentsController = {
    // ---- INSTRUCTOR / ADMIN ENDPOINTS ----

    /** Create a new assignment for a course */
    async createAssignment(req: Request, res: Response) {
        try {
            const { 
                course_id, 
                title, 
                description, 
                assignment_type, 
                due_date, 
                weight_points = 1.0, 
                max_score, 
                schedule_id,
                merit_points = 0,
                unit_name = 'Bimestre 1',
                category_id = null,
                attachment_url = null
            } = req.body;
            const created_by = req.currentUser?.id;
            const db = adminClient; // Use service role to bypass RLS since we verify manually

            // Budget validation for linked category (Enfoque 1: Suma directa con presupuesto)
            if (category_id) {
                const { data: cat, error: catErr } = await db
                    .from('subgrade_categories')
                    .select('id, name, max_score')
                    .eq('id', category_id)
                    .single();

                if (catErr || !cat) {
                    return res.status(400).json({ message: 'La categoría seleccionada no existe.' });
                }

                const { data: existingAssignments } = await db
                    .from('assignments')
                    .select('id, max_score')
                    .eq('category_id', category_id);

                const currentAllocated = (existingAssignments || []).reduce((sum: number, a: any) => sum + (Number(a.max_score) || 0), 0);
                const catMax = Number(cat.max_score) || 0;
                const remaining = Math.max(0, catMax - currentAllocated);
                const requestedScore = Number(max_score) || 0;

                if (remaining <= 0) {
                    return res.status(400).json({ 
                        message: `La categoría "${cat.name}" ya tiene asignados todos sus puntos (${catMax} pts). No se pueden agregar más tareas a esta categoría.` 
                    });
                }

                if (requestedScore > remaining + 0.01) {
                    return res.status(400).json({ 
                        message: `El punteo asignado (${requestedScore} pts) supera los puntos disponibles (${remaining} pts) de la categoría "${cat.name}".` 
                    });
                }
            }

            const { data, error } = await db
                .from('assignments')
                .insert([{ 
                    course_id, 
                    title, 
                    description, 
                    assignment_type, 
                    due_date, 
                    weight_points: Number(weight_points) || 1.0, 
                    max_score: Number(max_score) || 100, 
                    schedule_id: schedule_id || null, 
                    merit_points: Number(merit_points) || 0,
                    unit_name: unit_name || 'Bimestre 1',
                    category_id: category_id || null,
                    attachment_url: attachment_url || null,
                    created_by 
                }])
                .select('*, subgrade_categories(id, name, max_score)')
                .single();

            if (error) throw error;
            res.status(201).json(data);
        } catch (error: any) {
            console.error('Error creating assignment:', error);
            res.status(500).json({ message: 'Error creating assignment', error: error?.message });
        }
    },

    /** Get all assignments for a specific course */
    async getCourseAssignments(req: Request, res: Response) {
        try {
            const { courseId } = req.params;
            const { schedule_id, unit_name } = req.query;
            const db = adminClient;

            let query = db
                .from('assignments')
                .select('*, subgrade_categories(id, name, max_score)')
                .eq('course_id', courseId);

            if (schedule_id) {
                query = query.or(`schedule_id.eq.${schedule_id},schedule_id.is.null`);
            }

            if (unit_name) {
                query = query.eq('unit_name', unit_name);
            }

            const { data, error } = await query.order('due_date', { ascending: true });

            if (error) throw error;
            res.json(data);
        } catch (error: any) {
            console.error('Error fetching course assignments:', error);
            res.status(500).json({ message: 'Error fetching course assignments', error: error?.message });
        }
    },

    /** Get all submissions for a specific assignment */
    async getAssignmentSubmissions(req: Request, res: Response) {
        try {
            const { assignmentId } = req.params;
            const db = adminClient;

            // 1. Get assignment to find course_id
            const { data: assignment, error: assignError } = await db
                .from('assignments')
                .select('course_id, max_score, merit_points')
                .eq('id', assignmentId)
                .single();
            if (assignError) throw assignError;

            // 2. Get active enrollments for that course
            const { data: enrollments, error: enrollError } = await db
                .from('enrollments')
                .select('id, student_id, students(full_name)')
                .eq('course_id', assignment.course_id)
                .eq('is_active', true);
            if (enrollError) throw enrollError;

            // 3. Get existing submissions
            const { data: submissions, error: subError } = await db
                .from('assignment_submissions')
                .select('*')
                .eq('assignment_id', assignmentId);
            if (subError) throw subError;

            // 3b. Get merit transactions for these submissions
            const submissionIds = (submissions || []).map((s: any) => s.id).filter(Boolean);
            const meritMap = new Map<string, number>();
            if (submissionIds.length > 0) {
                const { data: merits } = await db
                    .from('merit_transactions')
                    .select('reference_id, points')
                    .in('reference_id', submissionIds)
                    .eq('transaction_type', 'assignment');
                merits?.forEach((m: any) => {
                    meritMap.set(m.reference_id, m.points);
                });
            }

            // 4. Merge
            const result = enrollments.map((enr: any) => {
                const sub = submissions?.find((s: any) => s.student_id === enr.student_id);
                return {
                    enrollment_id: enr.id,
                    student_id: enr.student_id,
                    student_name: enr.students?.full_name || 'Desconocido',
                    submission_id: sub?.id || null,
                    submission_date: sub?.submission_date || null,
                    status: sub?.status || 'PENDING',
                    score: sub?.score || null,
                    feedback: sub?.feedback || '',
                    attachment_url: sub?.attachment_url || null,
                    merit_points_awarded: sub?.id ? (meritMap.get(sub.id) || 0) : 0
                };
            });

            res.json(result);
        } catch (error: any) {
            console.error('Error fetching assignment submissions:', error);
            res.status(500).json({ message: 'Error fetching assignment submissions', error: error?.message });
        }
    },

    /** Grade a student's submission */
    async gradeSubmission(req: Request, res: Response) {
        try {
            const { submissionId } = req.params;
            const { score, feedback, custom_merit_points } = req.body;
            const db = adminClient;
            const userId = req.currentUser?.id;

            const { data, error } = await db
                .from('assignment_submissions')
                .update({ score: Number(score), feedback, status: 'GRADED' })
                .eq('id', submissionId)
                .select('*, assignments(id, title, max_score, merit_points, course_id, unit_name, category_id, courses(name))')
                .single();

            if (error) throw error;

            // Handle Merit Points
            const assignment = data?.assignments;
            const studentId = data?.student_id;

            if (assignment && studentId) {
                const maxScore = Number(assignment.max_score) || 100;
                const earnedScore = Number(score) || 0;
                const baseMeritPoints = Number(assignment.merit_points) || 0;

                let meritPointsToAward = 0;

                if (custom_merit_points !== undefined && custom_merit_points !== null) {
                    meritPointsToAward = Math.max(0, Number(custom_merit_points));
                } else if (baseMeritPoints > 0 && maxScore > 0) {
                    const scoreRatio = earnedScore / maxScore;
                    if (scoreRatio >= 0.6) {
                        if (scoreRatio >= 0.8) {
                            meritPointsToAward = baseMeritPoints;
                        } else {
                            meritPointsToAward = Math.round(baseMeritPoints * scoreRatio);
                        }
                    }
                }

                const courseName = assignment.courses?.name || 'Curso';

                if (meritPointsToAward > 0) {
                    await db
                        .from('merit_transactions')
                        .upsert({
                            student_id: studentId,
                            points: meritPointsToAward,
                            transaction_type: 'assignment',
                            description: `Mérito por Tarea: ${assignment.title} (Nota: ${earnedScore}/${maxScore} pts) - ${courseName}`,
                            reference_id: submissionId,
                            created_by: userId || null
                        }, { onConflict: 'student_id, reference_id, transaction_type' });
                } else {
                    await db
                        .from('merit_transactions')
                        .delete()
                        .eq('student_id', studentId)
                        .eq('reference_id', submissionId)
                        .eq('transaction_type', 'assignment');
                }

                // Handle Subgrades Sync if linked to a category (Enfoque 1: Suma directa)
                if (assignment.category_id) {
                    await syncCategoryForStudents(assignment.category_id, [studentId], userId);
                }
            }

            res.json(data);
        } catch (error: any) {
            console.error('Error grading submission:', error);
            res.status(500).json({ message: 'Error grading submission', error: error?.message });
        }
    },

    /** Update an assignment */
    async updateAssignment(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const { 
                title, 
                description, 
                assignment_type, 
                due_date, 
                weight_points, 
                max_score, 
                schedule_id,
                merit_points,
                unit_name,
                category_id,
                attachment_url
            } = req.body;
            const db = adminClient;
            const userId = req.currentUser?.id;

            const { data: current, error: curErr } = await db
                .from('assignments')
                .select('*')
                .eq('id', id)
                .single();

            if (curErr || !current) {
                return res.status(404).json({ message: 'Tarea no encontrada.' });
            }

            const targetCatId = category_id !== undefined ? (category_id || null) : current.category_id;
            const targetMaxScore = max_score !== undefined ? Number(max_score) : Number(current.max_score);

            if (targetCatId) {
                const { data: cat } = await db
                    .from('subgrade_categories')
                    .select('id, name, max_score')
                    .eq('id', targetCatId)
                    .single();

                if (cat) {
                    const { data: otherAssignments } = await db
                        .from('assignments')
                        .select('id, max_score')
                        .eq('category_id', targetCatId)
                        .neq('id', id);

                    const otherAllocated = (otherAssignments || []).reduce((sum: number, a: any) => sum + (Number(a.max_score) || 0), 0);
                    const catMax = Number(cat.max_score) || 0;
                    const remaining = Math.max(0, catMax - otherAllocated);

                    if (targetMaxScore > remaining + 0.01) {
                        return res.status(400).json({ 
                            message: `El punteo asignado (${targetMaxScore} pts) supera los puntos disponibles (${remaining} pts) de la categoría "${cat.name}".` 
                        });
                    }
                }
            }

            const updatePayload: any = {};
            if (title !== undefined) updatePayload.title = title;
            if (description !== undefined) updatePayload.description = description;
            if (assignment_type !== undefined) updatePayload.assignment_type = assignment_type;
            if (due_date !== undefined) updatePayload.due_date = due_date;
            if (weight_points !== undefined) updatePayload.weight_points = Number(weight_points) || 1.0;
            if (max_score !== undefined) updatePayload.max_score = Number(max_score) || 100;
            if (schedule_id !== undefined) updatePayload.schedule_id = schedule_id || null;
            if (merit_points !== undefined) updatePayload.merit_points = Number(merit_points) || 0;
            if (unit_name !== undefined) updatePayload.unit_name = unit_name || 'Bimestre 1';
            if (category_id !== undefined) updatePayload.category_id = category_id || null;
            if (attachment_url !== undefined) updatePayload.attachment_url = attachment_url || null;

            const { data: updated, error: updateErr } = await db
                .from('assignments')
                .update(updatePayload)
                .eq('id', id)
                .select('*, subgrade_categories(id, name, max_score)')
                .single();

            if (updateErr) throw updateErr;

            if (current.category_id && current.category_id !== targetCatId) {
                await syncCategoryForStudents(current.category_id, undefined, userId);
            }
            if (targetCatId) {
                await syncCategoryForStudents(targetCatId, undefined, userId);
            }

            res.json(updated);
        } catch (error: any) {
            console.error('Error updating assignment:', error);
            res.status(500).json({ message: 'Error updating assignment', error: error?.message });
        }
    },

    /** Delete an assignment */
    async deleteAssignment(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const db = adminClient;
            const userId = req.currentUser?.id;

            const { data: current, error: curErr } = await db
                .from('assignments')
                .select('id, category_id, course_id')
                .eq('id', id)
                .single();

            if (curErr || !current) {
                return res.status(404).json({ message: 'Tarea no encontrada.' });
            }

            // Get submissions to clear merits and capture affected students
            const { data: subs } = await db
                .from('assignment_submissions')
                .select('id, student_id')
                .eq('assignment_id', id);

            const subIds = (subs || []).map((s: any) => s.id);
            const studentIds = (subs || []).map((s: any) => s.student_id);

            if (subIds.length > 0) {
                await db
                    .from('merit_transactions')
                    .delete()
                    .in('reference_id', subIds)
                    .eq('transaction_type', 'assignment');

                await db
                    .from('assignment_submissions')
                    .delete()
                    .eq('assignment_id', id);
            }

            const { error: delErr } = await db
                .from('assignments')
                .delete()
                .eq('id', id);

            if (delErr) throw delErr;

            if (current.category_id) {
                await syncCategoryForStudents(current.category_id, studentIds.length > 0 ? studentIds : undefined, userId);
            }

            res.json({ message: 'Tarea eliminada exitosamente' });
        } catch (error: any) {
            console.error('Error deleting assignment:', error);
            res.status(500).json({ message: 'Error deleting assignment', error: error?.message });
        }
    },

    /** Get gradebook report for all students in a course */
    async getCourseAssignmentReport(req: Request, res: Response) {
        try {
            const { courseId } = req.params;
            const { schedule_id } = req.query;
            const db = adminClient;

            // 1. Get active enrollments for the course (students)
            let enrollmentsQuery = db
                .from('enrollments')
                .select('student_id, schedule_id, students(full_name)')
                .eq('course_id', courseId)
                .eq('is_active', true);

            if (schedule_id) {
                enrollmentsQuery = enrollmentsQuery.eq('schedule_id', schedule_id);
            }

            const { data: enrollments, error: enrollError } = await enrollmentsQuery;

            if (enrollError) throw enrollError;
            if (!enrollments || enrollments.length === 0) return res.json({ assignments: [], students: [] });

            // 2. Get all assignments for this course
            let assignmentsQuery = db
                .from('assignments')
                .select('id, title, max_score, weight_points, schedule_id')
                .eq('course_id', courseId);

            if (schedule_id) {
                assignmentsQuery = assignmentsQuery.or(`schedule_id.eq.${schedule_id},schedule_id.is.null`);
            }

            const { data: assignments, error: assignError } = await assignmentsQuery.order('due_date', { ascending: true });

            if (assignError) throw assignError;

            // 3. Get all submissions (grades) for these assignments
            const assignmentIds = assignments?.map((a: any) => a.id) || [];
            let submissions: any[] = [];

            if (assignmentIds.length > 0) {
                const { data: subs, error: subError } = await db
                    .from('assignment_submissions')
                    .select('student_id, assignment_id, score, status')
                    .in('assignment_id', assignmentIds);
                if (subError) throw subError;
                submissions = subs || [];
            }

            // 4. Compile the report structure
            const studentsReport = enrollments.map((enr: any) => {
                const studentId = enr.student_id;
                const studentName = enr.students?.full_name || 'Desconocido';

                let courseTotalScore = 0;
                let courseMaxPossible = 0;

                const grades = assignments?.map((assign: any) => {
                    // Find submission for this student and this assignment
                    const sub = submissions.find((s: any) => s.student_id === studentId && s.assignment_id === assign.id);

                    const score = sub?.score || 0;
                    const maxScore = assign.max_score || 0;

                    courseTotalScore += score;
                    courseMaxPossible += maxScore;

                    return {
                        assignment_id: assign.id,
                        score: score,
                        max_score: maxScore,
                        status: sub?.status || 'PENDING'
                    };
                }) || [];

                return {
                    student_id: studentId,
                    student_name: studentName,
                    total_score: courseTotalScore,
                    max_possible_score: courseMaxPossible,
                    percentage: courseMaxPossible > 0 ? Math.round((courseTotalScore / courseMaxPossible) * 100) : 0,
                    grades
                };
            });

            // Sort students alphabetically
            studentsReport.sort((a, b) => a.student_name.localeCompare(b.student_name));

            res.json({
                assignments: assignments || [],
                students: studentsReport
            });

        } catch (error: any) {
            console.error('Error fetching course report:', error);
            res.status(500).json({ message: 'Error fetching course report', error: error?.message });
        }
    },

    // ---- STUDENT ENDPOINTS ----

    /** Get all pending/upcoming assignments for a student */
    async getStudentAssignments(req: Request, res: Response) {
        try {
            let { studentId } = req.params;
            const db = adminClient;

            if (studentId === 'me') {
                const userId = req.currentUser?.id;
                if (!userId) return res.status(401).json({ message: 'No autenticado' });

                console.log(`[Student Assignments] Attempting to find student for user_id: ${userId}`);

                const { data: studentData, error: studentError } = await db
                    .from('students')
                    .select('id, user_id, full_name')
                    .eq('user_id', userId)
                    .single();

                if (studentError || !studentData) {
                    console.error('[Student Assignments] Error mapping user to student:', { userId, error: studentError, data: studentData });
                    return res.status(404).json({ message: 'Perfil de estudiante no encontrado' });
                }

                console.log(`[Student Assignments] Successfully found student ${studentData.id} for user ${userId}`);
                studentId = studentData.id;
            }

            // Fetch active enrollments for student
            const { data: enrollments, error: enrollError } = await db
                .from('enrollments')
                .select('id, course_id, schedule_id, courses(name)')
                .eq('student_id', studentId)
                .eq('is_active', true);

            if (enrollError) throw enrollError;
            if (!enrollments || enrollments.length === 0) return res.json([]);

            const courseIds = enrollments.map((e: any) => e.course_id);

            // Fetch all assignments for those courses
            const { data: assignments, error: assignError } = await db
                .from('assignments')
                .select('*, subgrade_categories(id, name, max_score)')
                .in('course_id', courseIds)
                .order('due_date', { ascending: true });

            if (assignError) throw assignError;

            // Fetch all submissions for this student
            const { data: submissions, error: subError } = await db
                .from('assignment_submissions')
                .select('*')
                .eq('student_id', studentId);

            if (subError) throw subError;

            // Fetch merit transactions for this student for assignments
            const subIds = (submissions || []).map((s: any) => s.id).filter(Boolean);
            const meritMap = new Map<string, number>();
            if (subIds.length > 0) {
                const { data: merits } = await db
                    .from('merit_transactions')
                    .select('reference_id, points')
                    .eq('student_id', studentId)
                    .eq('transaction_type', 'assignment')
                    .in('reference_id', subIds);

                merits?.forEach((m: any) => {
                    meritMap.set(m.reference_id, m.points);
                });
            }

            // Merge everything and filter by schedule_id if assignment has one
            const merged = assignments
                .filter((a: any) => {
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
                        weight_points: a.weight_points,
                        merit_points: a.merit_points ?? 0,
                        unit_name: a.unit_name || 'Bimestre 1',
                        category_id: a.category_id || null,
                        category_name: a.subgrade_categories?.name || null,
                        max_score: a.max_score,
                        guide_url: a.attachment_url || null,
                        course_name: Array.isArray(enr?.courses) ? enr?.courses[0]?.name : (enr?.courses as any)?.name || '',
                        submission_id: sub?.id,
                        status: sub?.status || 'PENDING',
                        submission_date: sub?.submission_date,
                        score: sub?.score,
                        merit_points_awarded: sub?.id ? (meritMap.get(sub.id) || 0) : 0,
                        feedback: sub?.feedback || '',
                        attachment_url: sub?.attachment_url || null,
                        submission_attachment_url: sub?.attachment_url || null
                    };
                });

            res.json(merged);
        } catch (error: any) {
            console.error('Error fetching student assignments:', error);
            res.status(500).json({ message: 'Error fetching student assignments', error: error?.message });
        }
    },

    /** Student submits an assignment (mark as SUBMITTED) */
    async submitAssignment(req: Request, res: Response) {
        try {
            let { assignmentId, studentId, attachment_url } = req.body;
            const db = adminClient;

            if (studentId === 'me') {
                const userId = req.currentUser?.id;
                if (!userId) return res.status(401).json({ message: 'No autenticado' });

                console.log(`[Submit Assignment] Attempting to find student for user_id: ${userId}`);

                const { data: studentData, error: studentError } = await db
                    .from('students')
                    .select('id, user_id, full_name')
                    .eq('user_id', userId)
                    .single();

                if (studentError || !studentData) {
                    console.error('[Submit Assignment] Error mapping user to student:', { userId, error: studentError, data: studentData });
                    return res.status(404).json({ message: 'Perfil de estudiante no encontrado' });
                }

                console.log(`[Submit Assignment] Successfully found student ${studentData.id} for user ${userId}`);
                studentId = studentData.id;
            }

            // Find enrollment
            const { data: assignment, error: assignError } = await db
                .from('assignments')
                .select('course_id')
                .eq('id', assignmentId)
                .single();
            if (assignError) throw assignError;

            const { data: enrollment, error: enrollError } = await db
                .from('enrollments')
                .select('id')
                .eq('course_id', assignment.course_id)
                .eq('student_id', studentId)
                .eq('is_active', true)
                .single();

            if (enrollError || !enrollment) {
                return res.status(400).json({ message: 'Invalid enrollment for this assignment' });
            }

            // Upsert submission manually since Insforge/Supabase upsert needs primary keys
            // First check if exists
            const { data: existing, error: existError } = await db
                .from('assignment_submissions')
                .select('id, attachment_url')
                .eq('assignment_id', assignmentId)
                .eq('enrollment_id', enrollment.id)
                .single();

            let result;
            if (existing) {
                // Update
                const { data, error } = await db
                    .from('assignment_submissions')
                    .update({
                        submission_date: new Date().toISOString(),
                        status: 'SUBMITTED',
                        attachment_url: attachment_url || existing.attachment_url // Keep old if not provided
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();
                if (error) throw error;
                result = data;
            } else {
                // Insert
                const { data, error } = await db
                    .from('assignment_submissions')
                    .insert([{
                        assignment_id: assignmentId,
                        enrollment_id: enrollment.id,
                        student_id: studentId,
                        submission_date: new Date().toISOString(),
                        status: 'SUBMITTED',
                        attachment_url: attachment_url || null
                    }])
                    .select()
                    .single();
                if (error) throw error;
                result = data;
            }

            res.status(200).json(result);
        } catch (error: any) {
            console.error('Error submitting assignment:', error);
            res.status(500).json({ message: 'Error submitting assignment', error: error?.message });
        }
    }
};
