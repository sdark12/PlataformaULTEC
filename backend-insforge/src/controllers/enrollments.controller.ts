import { Request, Response } from 'express';
import client from '../config/insforge';

export const enrollStudent = async (req: Request, res: Response) => {
    const { student_id, course_id } = req.body;
    const branchId = req.currentUser?.branch_id;

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
            .insert([{ branch_id: branchId, student_id, course_id }])
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
                enrollment_date,
                is_active,
                students (full_name),
                courses (name)
            `);

        if (branchId) {
            query.eq('branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Flatten structure for frontend if needed, or update frontend to read nested props
        const flatData = data.map((item: any) => ({
            id: item.id,
            enrollment_date: item.enrollment_date,
            is_active: item.is_active,
            student_name: item.students?.full_name,
            course_name: item.courses?.name
        }));

        res.json(flatData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving enrollments' });
    }
};

export const updateEnrollment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { is_active } = req.body;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    try {
        const { data, error } = await db
            .from('enrollments')
            .update({ is_active })
            .eq('id', id)
            .select()
            .single();

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

    try {
        // Optimistically clean up related financial records first to avoid FK constraints
        // We use Promise.all to do it in parallel if supported, or sequential

        // 1. Delete Financial Status
        await db.from('financial_status').delete().eq('enrollment_id', id);

        // 2. Delete Payments
        await db.from('payments').delete().eq('enrollment_id', id);

        // 3. Delete Attendance (if any)
        // await db.from('attendance').delete().eq('enrollment_id', id);

        // 4. Finally delete the enrollment
        const { error } = await db
            .from('enrollments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Enrollment deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting enrollment', details: (error as any).message });
    }
};
