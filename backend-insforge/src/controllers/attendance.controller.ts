import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';

// Get Attendance (merged with enrolled students)
export const getAttendance = async (req: Request, res: Response) => {
    const { course_id, date, schedule_id } = req.query;
    const branchId = req.currentUser?.branch_id;

    if (!course_id || !date) {
        return res.status(400).json({ message: 'course_id and date are required' });
    }

    try {
        // 1. Fetch all active students enrolled in this course
        let enrollmentsQuery = adminClient.database
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

        // 2. Fetch existing attendance records for the given course and date
        const { data: attendanceData, error: attError } = await adminClient.database
            .from('attendance')
            .select('student_id, status, remarks')
            .eq('course_id', course_id)
            .eq('date', date);

        if (attError) throw attError;

        // Create a map for quick lookup
        const attendanceMap = new Map();
        if (attendanceData) {
            attendanceData.forEach((record: any) => {
                attendanceMap.set(record.student_id, record);
            });
        }

        // 3. Merge data
        const mergedData = enrollments?.map((enrollment: any) => {
            const studentId = enrollment.student_id;
            const existingRecord = attendanceMap.get(studentId);

            return {
                student_id: studentId,
                student_name: enrollment.students?.full_name || 'Desconocido',
                date: date,
                status: existingRecord ? existingRecord.status : 'PRESENT', // default
                remarks: existingRecord ? existingRecord.remarks : ''
            };
        }) || [];

        // Sort alphabetically by student name
        mergedData.sort((a: any, b: any) => a.student_name.localeCompare(b.student_name));

        res.json(mergedData);
    } catch (error) {
        console.error('Error retrieving attendance:', error);
        res.status(500).json({ message: 'Error retrieving attendance' });
    }
};

// Mark Attendance (Bulk or Single)
export const markAttendance = async (req: Request, res: Response) => {
    const { course_id, date, students } = req.body; // students: [{ student_id, status, remarks }]
    const userId = req.currentUser?.id;

    try {
        // Prepare data for upsert
        const upsertData = students.map((s: any) => ({
            course_id,
            student_id: s.student_id,
            date,
            status: s.status,
            remarks: s.remarks,
            created_by: userId
        }));

        // Perform Bulk Upsert
        // Requires a unique constraint on (course_id, student_id, date) in the database
        const { error } = await adminClient.database
            .from('attendance')
            .upsert(upsertData, { onConflict: 'student_id, course_id, date' });

        if (error) throw error;

        res.json({ message: 'Attendance marked successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error marking attendance' });
    }
};

// Get personal attendance history for a single student
export const getStudentAttendanceHistory = async (req: Request, res: Response) => {
    // We assume the user is asking for their own records, or an admin provides a student ID
    let studentId = req.query.student_id ? req.query.student_id as string : req.currentUser?.id;

    if (!studentId) {
        return res.status(400).json({ message: 'Student ID is required' });
    }

    try {
        // Map user_id to actual student_id avoiding RLS
        const { data: studentRecord, error: findError } = await adminClient.database
            .from('students')
            .select('id, user_id')
            .or(`id.eq.${studentId},user_id.eq.${studentId}`)
            .maybeSingle();

        if (findError) throw findError;

        if (studentRecord) {
            studentId = studentRecord.id;
        } else {
            // If the user's profile is not linked to any student, return empty gracefully
            return res.json([]);
        }

        const { data, error } = await adminClient.database
            .from('attendance')
            .select(`
                id,
                date,
                status,
                remarks,
                course_id,
                courses ( name )
            `)
            .eq('student_id', studentId)
            .order('date', { ascending: false });

        if (error) throw error;
        
        // Transform the data slightly to make it easier for the frontend
        const formattedData = data.map((record: any) => ({
            id: record.id,
            date: record.date,
            status: record.status,
            remarks: record.remarks,
            course_id: record.course_id,
            course_name: record.courses ? record.courses.name : 'Curso Desconocido'
        }));

        res.json(formattedData);
    } catch (error) {
        console.error('Error retrieving personal attendance:', error);
        res.status(500).json({ message: 'Error retrieving personal attendance' });
    }
};
