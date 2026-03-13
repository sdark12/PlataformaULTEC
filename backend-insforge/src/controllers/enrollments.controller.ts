import { Request, Response } from 'express';
import client from '../config/insforge';
import { broadcastNotification } from '../services/notification.service';

export const enrollStudent = async (req: Request, res: Response) => {
    const { student_id, course_id, schedule_id, branch_id } = req.body;
    const finalBranchId = branch_id || req.currentUser?.branch_id;

    try {
        // Use the authenticated client attached by middleware
        const db = req.dbUserClient ? req.dbUserClient.database : client.database;

        // 1. Check if subscription already exists
        const { data: existing, error: checkError } = await db
            .from('enrollments')
            .select('id')
            .eq('student_id', student_id)
            .eq('course_id', course_id)
            .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
            return res.status(400).json({ message: 'Student already enrolled in this course' });
        }

        // 2. Get Course Fee
        const { data: course, error: courseError } = await db
            .from('courses')
            .select('monthly_fee')
            .eq('id', course_id)
            .single();

        if (courseError) {
            return res.status(404).json({ message: 'Course not found' });
        }

        const monthlyFee = course.monthly_fee;

        // 3. Create Enrollment
        const { data: enrollment, error: enrollError } = await db
            .from('enrollments')
            .insert([{ branch_id: finalBranchId, student_id, course_id, schedule_id }])
            .select()
            .single();

        if (enrollError) throw enrollError;

        // 4. Create Initial Financial Status
        if (enrollment) {
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            const { error: financeError } = await db
                .from('financial_status')
                .insert([{
                    enrollment_id: enrollment.id,
                    month: currentMonth,
                    amount_due: monthlyFee,
                    status: 'PENDING'
                }]);

            if (financeError) {
                // Ideally we should rollback enrollment creation here
                console.error('Failed to create financial status', financeError);
                // Clean up enrollment to maintain consistency (simulating rollback)
                await db.from('enrollments').delete().eq('id', enrollment.id);
                return res.status(500).json({ message: 'Error creating financial record' });
            }
        }

        if (enrollment) {
            await broadcastNotification(
                client,
                finalBranchId || enrollment.branch_id,
                'Nueva Inscripción',
                `Se ha registrado una nueva inscripción en el curso.`,
                'ENROLLMENT'
            );
        }

        res.status(201).json(enrollment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error enrolling student' });
    }
};

export const getEnrollments = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    try {
        // Using PostgREST resource embedding for joins
        // Note: This relies on foreign keys existing in the schema
        const query = client.database
            .from('enrollments')
            .select(`
                id,
                student_id,
                course_id,
                enrollment_date,
                is_active,
                schedule_id,
                students (full_name),
                courses (name),
                course_schedules (grade, day_of_week, start_time, end_time)
            `);

        if (branchId) {
            query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Flatten structure for frontend if needed, or update frontend to read nested props
        const flatData = data.map((item: any) => ({
            id: item.id,
            student_id: item.student_id,
            course_id: item.course_id,
            enrollment_date: item.enrollment_date,
            is_active: item.is_active,
            schedule_id: item.schedule_id,
            student_name: item.students?.full_name,
            course_name: item.courses?.name,
            schedule_details: item.course_schedules ? `${item.course_schedules.grade} - ${item.course_schedules.day_of_week} ${item.course_schedules.start_time}` : null
        }));

        res.json(flatData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving enrollments' });
    }
};

export const updateEnrollment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { is_active, schedule_id } = req.body;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    const updates: any = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (schedule_id !== undefined) updates.schedule_id = schedule_id === '' ? null : schedule_id;

    const branchId = req.currentUser?.branch_id;

    try {
        let query = db
            .from('enrollments')
            .update(updates)
            .eq('id', id);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query.select().single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating enrollment' });
    }
};

export const deleteEnrollment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;
    const branchId = req.currentUser?.branch_id;

    try {
        if (branchId) {
            const { data: checkEnrollment } = await db
                .from('enrollments')
                .select('id')
                .eq('id', id)
                .eq('branch_id', branchId)
                .maybeSingle();

            if (!checkEnrollment) {
                return res.status(403).json({ message: 'Forbidden: Enrollment does not belong to your branch.' });
            }
        }

        // Optimistically clean up related financial records first to avoid FK constraints
        // We use Promise.all to do it in parallel if supported, or sequential

        // 1. Delete Financial Status
        await db.from('financial_status').delete().eq('enrollment_id', id);

        // 2. Delete Payments
        await db.from('payments').delete().eq('enrollment_id', id);

        // 3. Delete Attendance
        await db.from('attendances').delete().eq('enrollment_id', id);

        // 4. Delete Grades
        await db.from('grades').delete().eq('enrollment_id', id);

        // 5. Delete Assignment Submissions
        await db.from('assignment_submissions').delete().eq('enrollment_id', id);

        // 6. Delete Invoice Items and Invoices
        const { data: invoices } = await db.from('invoices').select('id').eq('enrollment_id', id);
        if (invoices && invoices.length > 0) {
            for (const inv of invoices) {
                await db.from('invoice_items').delete().eq('invoice_id', inv.id);
            }
            await db.from('invoices').delete().eq('enrollment_id', id);
        }

        // 7. Finally delete the enrollment
        const { error } = await db
            .from('enrollments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        if (branchId) {
            await broadcastNotification(
                client,
                branchId,
                'Inscripción Eliminada',
                `Se ha eliminado una inscripción del sistema.`,
                'DELETE'
            );
        }

        res.json({ message: 'Enrollment deleted successfully' });
    } catch (error) {
        console.error("Error deleting enrollment:", error);
        res.status(500).json({ message: 'Error deleting enrollment', details: (error as any).message });
    }
};
