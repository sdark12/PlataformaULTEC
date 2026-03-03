import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';

export const assignmentsController = {
    // ---- INSTRUCTOR / ADMIN ENDPOINTS ----

    /** Create a new assignment for a course */
    async createAssignment(req: Request, res: Response) {
        try {
            const { course_id, title, description, assignment_type, due_date, weight_points, max_score } = req.body;
            const created_by = req.currentUser?.id;
            const db = adminClient; // Use service role to bypass RLS since we verify manually

            const { data, error } = await db.database
                .from('assignments')
                .insert([{ course_id, title, description, assignment_type, due_date, weight_points, max_score, created_by }])
                .select()
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
            const db = adminClient;

            const { data, error } = await db.database
                .from('assignments')
                .select('*')
                .eq('course_id', courseId)
                .order('due_date', { ascending: true });

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
            const { data: assignment, error: assignError } = await db.database
                .from('assignments')
                .select('course_id')
                .eq('id', assignmentId)
                .single();
            if (assignError) throw assignError;

            // 2. Get active enrollments for that course
            const { data: enrollments, error: enrollError } = await db.database
                .from('enrollments')
                .select('id, student_id, students(full_name)')
                .eq('course_id', assignment.course_id)
                .eq('is_active', true);
            if (enrollError) throw enrollError;

            // 3. Get existing submissions
            const { data: submissions, error: subError } = await db.database
                .from('assignment_submissions')
                .select('*')
                .eq('assignment_id', assignmentId);
            if (subError) throw subError;

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
                    feedback: sub?.feedback || ''
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
            const { score, feedback } = req.body;
            const db = adminClient;

            const { data, error } = await db.database
                .from('assignment_submissions')
                .update({ score, feedback, status: 'GRADED' })
                .eq('id', submissionId)
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error: any) {
            console.error('Error grading submission:', error);
            res.status(500).json({ message: 'Error grading submission', error: error?.message });
        }
    },

    /** Get gradebook report for all students in a course */
    async getCourseAssignmentReport(req: Request, res: Response) {
        try {
            const { courseId } = req.params;
            const db = adminClient;

            // 1. Get active enrollments for the course (students)
            const { data: enrollments, error: enrollError } = await db.database
                .from('enrollments')
                .select('student_id, students(full_name)')
                .eq('course_id', courseId)
                .eq('is_active', true);

            if (enrollError) throw enrollError;
            if (!enrollments || enrollments.length === 0) return res.json({ assignments: [], students: [] });

            // 2. Get all assignments for this course
            const { data: assignments, error: assignError } = await db.database
                .from('assignments')
                .select('id, title, max_score, weight_points')
                .eq('course_id', courseId)
                .order('due_date', { ascending: true });

            if (assignError) throw assignError;

            // 3. Get all submissions (grades) for these assignments
            const assignmentIds = assignments?.map((a: any) => a.id) || [];
            let submissions: any[] = [];

            if (assignmentIds.length > 0) {
                const { data: subs, error: subError } = await db.database
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

                const { data: studentData, error: studentError } = await db.database
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
            const { data: enrollments, error: enrollError } = await db.database
                .from('enrollments')
                .select('id, course_id, courses(name)')
                .eq('student_id', studentId)
                .eq('is_active', true);

            if (enrollError) throw enrollError;
            if (!enrollments || enrollments.length === 0) return res.json([]);

            const courseIds = enrollments.map((e: any) => e.course_id);

            // Fetch all assignments for those courses
            const { data: assignments, error: assignError } = await db.database
                .from('assignments')
                .select('*')
                .in('course_id', courseIds)
                .order('due_date', { ascending: true });

            if (assignError) throw assignError;

            // Fetch all submissions for this student
            const { data: submissions, error: subError } = await db.database
                .from('assignment_submissions')
                .select('*')
                .eq('student_id', studentId);

            if (subError) throw subError;

            // Merge everything
            const merged = assignments.map((a: any) => {
                const sub = submissions?.find((s: any) => s.assignment_id === a.id);
                const enr = enrollments.find((e: any) => e.course_id === a.course_id);
                return {
                    assignment_id: a.id,
                    title: a.title,
                    description: a.description,
                    assignment_type: a.assignment_type,
                    due_date: a.due_date,
                    weight_points: a.weight_points,
                    max_score: a.max_score,
                    course_name: Array.isArray(enr?.courses) ? enr?.courses[0]?.name : (enr?.courses as any)?.name || '',
                    submission_id: sub?.id,
                    status: sub?.status || 'PENDING',
                    submission_date: sub?.submission_date,
                    score: sub?.score
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

                const { data: studentData, error: studentError } = await db.database
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
            const { data: assignment, error: assignError } = await db.database
                .from('assignments')
                .select('course_id')
                .eq('id', assignmentId)
                .single();
            if (assignError) throw assignError;

            const { data: enrollment, error: enrollError } = await db.database
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
            const { data: existing, error: existError } = await db.database
                .from('assignment_submissions')
                .select('id, attachment_url')
                .eq('assignment_id', assignmentId)
                .eq('enrollment_id', enrollment.id)
                .single();

            let result;
            if (existing) {
                // Update
                const { data, error } = await db.database
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
                const { data, error } = await db.database
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
