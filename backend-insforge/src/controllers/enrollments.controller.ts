import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';
import { broadcastNotification } from '../services/notification.service';
import { getEffectiveBranchId } from '../utils/branch.utils';

export const enrollStudent = async (req: Request, res: Response) => {
    const { 
        student_id, 
        course_id, 
        schedule_id, 
        branch_id,
        scholarship_type,
        scholarship_amount,
        scholarship_reason
    } = req.body;
    const user = req.currentUser;
    const finalBranchId = user?.role === 'superadmin'
        ? (branch_id || getEffectiveBranchId(req))
        : (user?.branch_id || null);

    try {
        // Use the authenticated client attached by middleware or adminClient
        const db = req.dbUserClient || adminClient || client;

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

        const monthlyFee = Number(course.monthly_fee || 0);

        // Calculate initial due with scholarship
        let initialDue = monthlyFee;
        const validScholarshipType = scholarship_type || 'NONE';
        const numScholarshipAmount = scholarship_amount ? Number(scholarship_amount) : 0;
        if (validScholarshipType === 'PERCENTAGE' && numScholarshipAmount > 0) {
            initialDue = Math.max(0, monthlyFee * (1 - numScholarshipAmount / 100));
        } else if (validScholarshipType === 'FIXED_AMOUNT' && numScholarshipAmount > 0) {
            initialDue = Math.max(0, monthlyFee - numScholarshipAmount);
        }

        // 3. Create Enrollment
        const { data: enrollment, error: enrollError } = await db
            .from('enrollments')
            .insert([{ 
                branch_id: finalBranchId, 
                student_id, 
                course_id, 
                schedule_id,
                scholarship_type: validScholarshipType,
                scholarship_amount: numScholarshipAmount,
                scholarship_reason: scholarship_reason || null
            }])
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
                    amount_due: initialDue,
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
    const branchId = getEffectiveBranchId(req);
    const db = req.dbUserClient || adminClient || client;
    const { student_id } = req.query;
    try {
        let query = db
            .from('enrollments')
            .select(`
                id,
                branch_id,
                student_id,
                course_id,
                enrollment_date,
                is_active,
                schedule_id,
                academic_status,
                promoted_to_enrollment_id,
                scholarship_type,
                scholarship_amount,
                scholarship_reason,
                students (id, full_name, personal_code, identification_document, academy_code),
                courses (id, name, description, monthly_fee),
                course_schedules (id, grade, day_of_week, start_time, end_time)
            `)
            .order('enrollment_date', { ascending: false });

        if (student_id) {
            query = query.eq('student_id', student_id);
        } else if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Flatten structure for frontend
        const flatData = (data || []).map((item: any) => ({
            id: item.id,
            branch_id: item.branch_id,
            student_id: item.student_id,
            course_id: item.course_id,
            enrollment_date: item.enrollment_date,
            is_active: item.is_active,
            academic_status: item.academic_status || (item.is_active ? 'ACTIVE' : 'INACTIVE'),
            promoted_to_enrollment_id: item.promoted_to_enrollment_id,
            schedule_id: item.schedule_id,
            scholarship_type: item.scholarship_type || 'NONE',
            scholarship_amount: Number(item.scholarship_amount || 0),
            scholarship_reason: item.scholarship_reason || null,
            student_name: item.students?.full_name || 'Sin nombre',
            student_code: item.students?.personal_code || item.students?.academy_code || item.students?.identification_document || 'N/A',
            identification_document: item.students?.identification_document || null,
            course_name: item.courses?.name || 'Sin curso',
            monthly_fee: Number(item.courses?.monthly_fee || 0),
            schedule_details: item.course_schedules ? `${item.course_schedules.grade ? item.course_schedules.grade + ' - ' : ''}${item.course_schedules.day_of_week || ''} ${item.course_schedules.start_time || ''}`.trim() : null,
            students: item.students,
            courses: item.courses,
            course_schedules: item.course_schedules
        }));

        res.json(flatData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving enrollments' });
    }
};

export const updateEnrollment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { 
        is_active, 
        schedule_id, 
        academic_status,
        scholarship_type,
        scholarship_amount,
        scholarship_reason
    } = req.body;
    const db = req.dbUserClient || adminClient || client;

    const updates: any = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (schedule_id !== undefined) updates.schedule_id = schedule_id === '' ? null : schedule_id;
    if (academic_status !== undefined) updates.academic_status = academic_status;
    if (scholarship_type !== undefined) updates.scholarship_type = scholarship_type;
    if (scholarship_amount !== undefined) updates.scholarship_amount = Number(scholarship_amount);
    if (scholarship_reason !== undefined) updates.scholarship_reason = scholarship_reason;

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
    const db = req.dbUserClient || adminClient || client;
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
