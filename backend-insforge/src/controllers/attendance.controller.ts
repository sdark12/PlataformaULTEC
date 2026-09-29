import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';
import { getSettingBool, getSettingNumber } from './settings.controller';

// Get Attendance (merged with enrolled students and contact/QR info)
export const getAttendance = async (req: Request, res: Response) => {
    const { course_id, date, schedule_id } = req.query;
    const branchId = req.currentUser?.branch_id;

    if (!course_id || !date) {
        return res.status(400).json({ message: 'course_id and date are required' });
    }

    try {
        // 1. Fetch all active students enrolled in this course
        let enrollmentsQuery = adminClient
            .from('enrollments')
            .select(`
                student_id,
                schedule_id,
                students!inner (
                    id,
                    full_name,
                    phone,
                    guardian_phone,
                    guardian_name,
                    personal_code,
                    academy_code,
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
        const { data: attendanceData, error: attError } = await adminClient
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

        // 3. Fetch any existing justifications for this course and date
        const { data: justifications, error: justError } = await adminClient
            .from('attendance_justifications')
            .select('id, student_id, reason_type, description, status, review_notes')
            .eq('course_id', course_id)
            .eq('date', date);

        if (justError) {
            console.warn('Warning fetching justifications:', justError.message);
        }

        const justificationMap = new Map();
        if (justifications) {
            justifications.forEach((j: any) => {
                justificationMap.set(j.student_id, j);
            });
        }

        const currentYear = new Date().getFullYear();

        // 4. Merge data
        const mergedData = enrollments?.map((enrollment: any) => {
            const studentId = enrollment.student_id;
            const existingRecord = attendanceMap.get(studentId);
            const justification = justificationMap.get(studentId);
            const st = enrollment.students;

            const computedStudentCode = st?.personal_code || 
                st?.academy_code || 
                `UT-${currentYear}-${studentId.slice(0, 4).toUpperCase()}`;

            let resolvedStatus: string = 'PENDING';
            let resolvedRemarks: string = '';

            if (existingRecord) {
                resolvedStatus = existingRecord.status;
                resolvedRemarks = existingRecord.remarks || '';
            } else if (justification && justification.status === 'APPROVED') {
                resolvedStatus = 'EXCUSED';
                resolvedRemarks = justification.description ? `Excusa aprobada: ${justification.description}` : 'Excusa aprobada';
            } else {
                resolvedStatus = 'PENDING';
                resolvedRemarks = '';
            }

            return {
                student_id: studentId,
                student_name: st?.full_name || 'Desconocido',
                phone: st?.phone || null,
                guardian_phone: st?.guardian_phone || null,
                guardian_name: st?.guardian_name || null,
                personal_code: st?.personal_code || null,
                academy_code: st?.academy_code || null,
                student_code: computedStudentCode,
                date: date,
                status: resolvedStatus,
                remarks: resolvedRemarks,
                is_recorded: !!existingRecord,
                justification: justification || null
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

// Helper: Handle automatic merit allocation for attendance
const handleAttendanceMerits = async (records: any[], creatorUserId: string | undefined) => {
    try {
        const autoEnabled = await getSettingBool('merit_enable_auto_attendance');
        if (!autoEnabled) return;

        const pointsPresent = await getSettingNumber('merit_points_attendance_present');
        if (pointsPresent <= 0) return;

        for (const r of records) {
            if (r.status === 'PRESENT') {
                // Upsert merit transaction (preventing duplicates using DB constraint)
                await adminClient
                    .from('merit_transactions')
                    .upsert({
                        student_id: r.student_id,
                        points: pointsPresent,
                        transaction_type: 'attendance',
                        description: `Asistencia Presente - Fecha: ${r.date}`,
                        reference_id: r.id,
                        created_by: creatorUserId || null
                    }, { onConflict: 'student_id, reference_id, transaction_type' });
            } else {
                // If not PRESENT, delete transaction if any existed
                await adminClient
                    .from('merit_transactions')
                    .delete()
                    .eq('student_id', r.student_id)
                    .eq('reference_id', r.id)
                    .eq('transaction_type', 'attendance');
            }
        }
    } catch (err) {
        console.error('Error handling attendance merits:', err);
    }
};

// Mark Attendance (Bulk or Single)
export const markAttendance = async (req: Request, res: Response) => {
    const { course_id, date, students } = req.body; // students: [{ student_id, status, remarks }]
    const userId = req.currentUser?.id;

    try {
        // Prepare data for upsert - Any student left as 'PENDING' is saved as 'ABSENT'
        const upsertData = students.map((s: any) => ({
            course_id,
            student_id: s.student_id,
            date,
            status: (!s.status || s.status === 'PENDING') ? 'ABSENT' : s.status,
            remarks: s.remarks || '',
            created_by: userId
        }));

        // Perform Bulk Upsert
        // Requires a unique constraint on (course_id, student_id, date) in the database
        const { data, error } = await adminClient
            .from('attendance')
            .upsert(upsertData, { onConflict: 'student_id, course_id, date' })
            .select('id, student_id, status, date');

        if (error) throw error;

        // Process automatic merits in background
        if (data && data.length > 0) {
            handleAttendanceMerits(data, userId).catch(err => 
                console.error('Failed to trigger background merits:', err)
            );
        }

        res.json({ message: 'Attendance marked successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error marking attendance' });
    }
};

// Get personal attendance history for a single student
export const getStudentAttendanceHistory = async (req: Request, res: Response) => {
    let studentId = req.query.student_id ? req.query.student_id as string : req.currentUser?.id;

    if (!studentId) {
        return res.status(400).json({ message: 'Student ID is required' });
    }

    try {
        // Map user_id to actual student_id avoiding RLS
        const { data: studentRecord, error: findError } = await adminClient
            .from('students')
            .select('id, user_id')
            .or(`id.eq.${studentId},user_id.eq.${studentId}`)
            .maybeSingle();

        if (findError) throw findError;

        if (studentRecord) {
            studentId = studentRecord.id;
        } else {
            return res.json([]);
        }

        const { data, error } = await adminClient
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

        // Fetch justifications for this student to cross-reference
        const { data: justifications } = await adminClient
            .from('attendance_justifications')
            .select('id, course_id, date, reason_type, description, status, review_notes')
            .eq('student_id', studentId);

        const justMap = new Map();
        if (justifications) {
            justifications.forEach((j: any) => {
                const key = `${j.course_id}_${j.date}`;
                justMap.set(key, j);
            });
        }
        
        const formattedData = data.map((record: any) => {
            const key = `${record.course_id}_${record.date}`;
            return {
                id: record.id,
                date: record.date,
                status: record.status,
                remarks: record.remarks,
                course_id: record.course_id,
                course_name: record.courses ? record.courses.name : 'Curso Desconocido',
                justification: justMap.get(key) || null
            };
        });

        res.json(formattedData);
    } catch (error) {
        console.error('Error retrieving personal attendance:', error);
        res.status(500).json({ message: 'Error retrieving personal attendance' });
    }
};

// ==========================================
// 📊 SÁBANA MENSUAL / MATRIZ DE ASISTENCIA
// ==========================================
export const getAttendanceMatrix = async (req: Request, res: Response) => {
    const { course_id, month, schedule_id } = req.query;
    const branchId = req.currentUser?.branch_id;

    if (!course_id) {
        return res.status(400).json({ message: 'course_id is required' });
    }

    try {
        // Month format: 'YYYY-MM', defaults to current month
        const now = new Date();
        const selectedMonth = (month as string) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const [yearStr, monthStr] = selectedMonth.split('-');
        const year = parseInt(yearStr, 10);
        const monthNum = parseInt(monthStr, 10);

        const startDate = `${selectedMonth}-01`;
        // Last day of month
        const lastDay = new Date(year, monthNum, 0).getDate();
        const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

        // 1. Fetch active students in this course
        let enrollmentsQuery = adminClient
            .from('enrollments')
            .select(`
                student_id,
                schedule_id,
                students!inner (
                    id,
                    full_name,
                    phone,
                    guardian_phone,
                    personal_code,
                    academy_code,
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

        // 2. Fetch all attendance records for this course in the month
        const { data: records, error: attError } = await adminClient
            .from('attendance')
            .select('student_id, date, status, remarks')
            .eq('course_id', course_id)
            .gte('date', startDate)
            .lte('date', endDate);

        if (attError) throw attError;

        // 3. Find unique dates where attendance was taken
        const dateSet = new Set<string>();
        if (records) {
            records.forEach((r: any) => dateSet.add(r.date));
        }
        const activeDates = Array.from(dateSet).sort();

        // 4. Map student records
        const studentRecordsMap = new Map<string, Map<string, string>>();
        if (records) {
            records.forEach((r: any) => {
                if (!studentRecordsMap.has(r.student_id)) {
                    studentRecordsMap.set(r.student_id, new Map());
                }
                studentRecordsMap.get(r.student_id)!.set(r.date, r.status);
            });
        }

        // 5. Build matrix per student
        const currentYear = new Date().getFullYear();
        const matrixStudents = (enrollments || []).map((e: any) => {
            const sid = e.student_id;
            const st = e.students;
            const dateMap = studentRecordsMap.get(sid) || new Map<string, string>();

            const days: Record<string, string> = {};
            let presentCount = 0;
            let absentCount = 0;
            let lateCount = 0;
            let excusedCount = 0;

            activeDates.forEach((dateStr) => {
                const status = dateMap.get(dateStr) || '-';
                days[dateStr] = status;
                if (status === 'PRESENT') presentCount++;
                else if (status === 'ABSENT') absentCount++;
                else if (status === 'LATE') lateCount++;
                else if (status === 'EXCUSED') excusedCount++;
            });

            const totalRecorded = presentCount + absentCount + lateCount + excusedCount;
            // Standard formula: Present + 0.8 * Excuses / Total recorded
            const attendancePercentage = totalRecorded > 0 
                ? Math.round(((presentCount + (lateCount * 0.9) + (excusedCount * 0.8)) / totalRecorded) * 100)
                : 100;

            const isAtRisk = totalRecorded >= 3 && attendancePercentage < 75;

            const computedStudentCode = st?.personal_code || 
                st?.academy_code || 
                `UT-${currentYear}-${sid.slice(0, 4).toUpperCase()}`;

            return {
                student_id: sid,
                student_name: st?.full_name || 'Desconocido',
                student_code: computedStudentCode,
                phone: st?.phone || null,
                guardian_phone: st?.guardian_phone || null,
                days,
                present_count: presentCount,
                absent_count: absentCount,
                late_count: lateCount,
                excused_count: excusedCount,
                total_recorded: totalRecorded,
                attendance_percentage: attendancePercentage,
                is_at_risk: isAtRisk
            };
        });

        // Sort alphabetically
        matrixStudents.sort((a: any, b: any) => a.student_name.localeCompare(b.student_name));

        res.json({
            course_id,
            month: selectedMonth,
            active_dates: activeDates,
            students: matrixStudents,
            total_students: matrixStudents.length,
            total_active_days: activeDates.length
        });
    } catch (error) {
        console.error('Error retrieving attendance matrix:', error);
        res.status(500).json({ message: 'Error retrieving attendance matrix' });
    }
};

// ==========================================
// 📋 MÓDULO DE JUSTIFICACIONES / EXCUSAS
// ==========================================

// Create a justification request
export const createJustification = async (req: Request, res: Response) => {
    const { course_id, date, reason_type, description, document_url, student_id: requestedStudentId } = req.body;
    const userRole = req.currentUser?.role;
    const userId = req.currentUser?.id;

    if (!course_id || !date || !reason_type || !description) {
        return res.status(400).json({ message: 'course_id, date, reason_type y description son requeridos' });
    }

    try {
        let finalStudentId = requestedStudentId;

        // If caller is student, resolve their student record
        if (userRole === 'student') {
            const { data: st, error: stErr } = await adminClient
                .from('students')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (stErr || !st) {
                return res.status(404).json({ message: 'Registro de estudiante no encontrado' });
            }
            finalStudentId = st.id;
        } else if (userRole === 'parent') {
            // Validate parent link
            if (!requestedStudentId) {
                return res.status(400).json({ message: 'Debe especificar el estudiante' });
            }
            const { data: link } = await adminClient
                .from('parent_student_links')
                .select('id')
                .eq('parent_id', userId)
                .eq('student_id', requestedStudentId)
                .maybeSingle();

            if (!link) {
                return res.status(403).json({ message: 'No tiene permiso para justificar a este estudiante' });
            }
            finalStudentId = requestedStudentId;
        } else if (!finalStudentId) {
            return res.status(400).json({ message: 'student_id es requerido para este rol' });
        }

        const { data, error } = await adminClient
            .from('attendance_justifications')
            .upsert({
                student_id: finalStudentId,
                course_id,
                date,
                reason_type,
                description,
                document_url: document_url || null,
                status: 'PENDING'
            }, { onConflict: 'student_id, course_id, date' })
            .select(`
                id,
                student_id,
                course_id,
                date,
                reason_type,
                description,
                status,
                created_at
            `)
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error: any) {
        console.error('Error creating attendance justification:', error);
        res.status(500).json({ message: 'Error creating justification', error: error?.message });
    }
};

// Get justifications list (filtered by role)
export const getJustifications = async (req: Request, res: Response) => {
    const { course_id, status, student_id } = req.query;
    const userRole = req.currentUser?.role;
    const userId = req.currentUser?.id;
    const branchId = req.currentUser?.branch_id;

    try {
        let query = adminClient
            .from('attendance_justifications')
            .select(`
                id,
                student_id,
                course_id,
                date,
                reason_type,
                description,
                document_url,
                status,
                reviewed_by,
                reviewed_at,
                review_notes,
                created_at,
                students ( id, full_name, personal_code, academy_code, phone, guardian_phone, branch_id ),
                courses ( id, name ),
                reviewer:profiles!reviewed_by ( id, full_name )
            `)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        if (course_id) {
            query = query.eq('course_id', course_id);
        }

        // Role-based scoping
        if (userRole === 'student') {
            const { data: st } = await adminClient
                .from('students')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (!st) return res.json([]);
            query = query.eq('student_id', st.id);
        } else if (userRole === 'parent') {
            const { data: links } = await adminClient
                .from('parent_student_links')
                .select('student_id')
                .eq('parent_id', userId);

            const studentIds = (links || []).map((l: any) => l.student_id);
            if (studentIds.length === 0) return res.json([]);
            query = query.in('student_id', studentIds);
        } else if (student_id) {
            query = query.eq('student_id', student_id);
        }

        if (branchId && !['admin', 'superadmin'].includes(userRole || '')) {
            query = query.eq('students.branch_id', branchId);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json(data || []);
    } catch (error: any) {
        console.error('Error fetching justifications:', error);
        res.status(500).json({ message: 'Error fetching justifications', error: error?.message });
    }
};

// Review a justification (Approve or Reject)
export const reviewJustification = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, review_notes } = req.body; // status: 'APPROVED' | 'REJECTED'
    const userRole = req.currentUser?.role;
    const userId = req.currentUser?.id;

    if (!['admin', 'superadmin', 'secretary', 'instructor'].includes(userRole || '')) {
        return res.status(403).json({ message: 'No tiene permiso para revisar justificaciones' });
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ message: 'El estado debe ser APPROVED o REJECTED' });
    }

    try {
        // 1. Fetch current justification
        const { data: just, error: fetchErr } = await adminClient
            .from('attendance_justifications')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchErr || !just) {
            return res.status(404).json({ message: 'Justificación no encontrada' });
        }

        // 2. Update justification status
        const { data: updatedJust, error: updateErr } = await adminClient
            .from('attendance_justifications')
            .update({
                status,
                review_notes: review_notes || null,
                reviewed_by: userId,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateErr) throw updateErr;

        // 3. If APPROVED, automatically update attendance record to EXCUSED
        if (status === 'APPROVED') {
            const remarkText = `[Justificación aprobada: ${just.reason_type}] ${just.description}`;
            await adminClient
                .from('attendance')
                .upsert({
                    course_id: just.course_id,
                    student_id: just.student_id,
                    date: just.date,
                    status: 'EXCUSED',
                    remarks: remarkText,
                    created_by: userId
                }, { onConflict: 'student_id, course_id, date' });
        }

        res.json({
            message: `Justificación ${status === 'APPROVED' ? 'aprobada' : 'rechazada'} exitosamente`,
            justification: updatedJust
        });
    } catch (error: any) {
        console.error('Error reviewing justification:', error);
        res.status(500).json({ message: 'Error reviewing justification', error: error?.message });
    }
};
