import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';
import { broadcastNotification } from '../services/notification.service';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmail } from '../services/email.service';
import { getEffectiveBranchId } from '../utils/branch.utils';

const linkOrCreateParent = async (studentId: string, email: string, fullName: string, relationship: string, createdBy: string | undefined) => {
    try {
        const db = adminClient || client;
        const { data: existingProfile } = await db
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single();
        
        let parentUserId: string;

        if (existingProfile) {
            parentUserId = existingProfile.id;
        } else {
             const tempClient = createClient(process.env.INSFORGE_URL || 'https://w6x267sp.us-east.insforge.app', process.env.INSFORGE_API_KEY || process.env.INSFORGE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxOTQ2NTJ9.LsB4ffiFE5H7qEfhgnM0NuPTX_It2aYd4iEmVUOHmh4');
            
            const password = 'Padre' + Math.floor(1000 + Math.random() * 9000) + '!';
            const { data: authData, error: authError } = await tempClient.auth.signUp({ email, password });
            
            if (authError || !authData?.user) {
                console.error('Failed to auto-create parent user auth:', authError);
                return;
            }

            parentUserId = authData.user.id;
            
            const { error: profileError } = await db
                .from('profiles')
                .upsert({
                    id: parentUserId,
                    email,
                    full_name: fullName || 'Encargado',
                    role: 'parent',
                    active: true
                });
                
            if (profileError) {
                console.error('Failed to auto-create parent profile:', profileError);
                return;
            }
            sendWelcomeEmail(email, fullName || 'Encargado', 'parent', password);
        }

        const { data: existingLink } = await db
            .from('parent_student_links')
            .select('id')
            .eq('parent_user_id', parentUserId)
            .eq('student_id', studentId)
            .maybeSingle();

        if (!existingLink) {
            await db
                .from('parent_student_links')
                .insert({
                    parent_user_id: parentUserId,
                    student_id: studentId,
                    relationship: relationship || 'parent',
                    created_by: createdBy
                });
        }
    } catch (err) {
        console.error('Error linking or creating parent:', err);
    }
};

export const getStudents = async (req: Request, res: Response) => {
    const branchId = getEffectiveBranchId(req);
    const db = req.dbUserClient || adminClient || client;

    try {
        let query = db
            .from('students')
            .select('*, branches(id, name)', { count: 'exact' })
            .order('full_name');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { page, limit, search } = req.query;

        if (search) {
            const cleanSearch = String(search).trim();
            query = query.or(`full_name.ilike.%${cleanSearch}%,personal_code.ilike.%${cleanSearch}%,academy_code.ilike.%${cleanSearch}%,identification_document.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%,guardian_name.ilike.%${cleanSearch}%`);
        }

        if (page && limit) {
            const pageNum = parseInt(page as string, 10);
            const limitNum = parseInt(limit as string, 10);
            const offset = (pageNum - 1) * limitNum;
            
            query = query.range(offset, offset + limitNum - 1);
            
            const { data, error, count } = await query;
            if (error) throw error;
            
            return res.json({
                data,
                meta: {
                    total: count || 0,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil((count || 0) / limitNum)
                }
            });
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        console.error('CRITICAL ERROR in getStudents:', error);
        if (error instanceof Error) {
            console.error('Stack:', error.stack);
            console.error('Message:', error.message);
        } else {
            console.error('Unknown error object:', JSON.stringify(error));
        }
        res.status(500).json({
            message: 'Error retrieving students',
            error: error?.message || 'Unknown error',
            details: JSON.stringify(error)
        });
    }
};

export const createStudent = async (req: Request, res: Response) => {
    const {
        full_name,
        birth_date,
        gender,
        identification_document,
        nationality,
        address,
        phone,
        // additional_phone, // Check if column exists or add to schema if needed
        guardian_name,
        guardian_phone,
        guardian_email,
        guardian_relationship,
        emergency_contact_name,
        emergency_contact_phone,
        medical_notes,
        previous_school,
        personal_code,
        academy_code,
        user_id, // Check for user link
        branch_id // Front-end passed branch_id
    } = req.body;

    const user = req.currentUser;
    const finalBranchId = user?.role === 'superadmin'
        ? ((branch_id === '' ? null : branch_id) || getEffectiveBranchId(req))
        : (user?.branch_id || null);
    const finalBirthDate = birth_date === '' ? null : birth_date;
    const finalUserId = user_id === '' ? null : user_id;
    const finalAcademyCode = academy_code === '' ? null : academy_code;

    const db = req.dbUserClient || adminClient || client;

    console.log('createStudent:', { branchId: finalBranchId, bodyName: full_name });

    try {
        const { data, error } = await db
            .from('students')
            .insert([{
                branch_id: finalBranchId,
                full_name,
                birth_date: finalBirthDate,
                gender,
                identification_document,
                nationality,
                address,
                phone,
                guardian_name,
                guardian_phone,
                guardian_email,
                guardian_relationship,
                emergency_contact_name,
                emergency_contact_phone,
                medical_notes,
                previous_school,
                personal_code,
                academy_code: finalAcademyCode,
                user_id: finalUserId
            }])
            .select()
            .single();

        if (error) throw error;

        // Auto-create/link parent if email is provided
        if (guardian_email && data?.id) {
            await linkOrCreateParent(data.id, guardian_email.trim(), guardian_name, guardian_relationship, req.currentUser?.id);
        }

        res.status(201).json(data);
    } catch (error) {
        console.error("Error creating student:", error);
        res.status(500).json({ message: 'Error creating student', error: (error as any).message });
    }
};

export const updateStudent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    // Convert empty string to null for UUID and Date columns
    if (updates.user_id === '') {
        updates.user_id = null;
    }
    if (updates.branch_id === '') {
        updates.branch_id = null;
    }
    if (updates.birth_date === '') {
        updates.birth_date = null;
    }

    const branchId = req.currentUser?.branch_id;
    const db = req.dbUserClient || adminClient || client;

    try {
        let query = db
            .from('students')
            .update(updates)
            .eq('id', id);

        if (branchId) {
            query = query.eq('branch_id', branchId); // Ensure user can only update students in their branch
        }

        const { data, error } = await query.select().single();

        if (error) throw error;

        // Auto-create/link parent if email is provided and updated
        if (updates.guardian_email && updates.guardian_name && data?.id) {
            await linkOrCreateParent(data.id, updates.guardian_email.trim(), updates.guardian_name, updates.guardian_relationship, req.currentUser?.id);
        }

        res.json(data);
    } catch (error) {
        console.error("Error updating student:", error);
        res.status(500).json({ message: 'Error updating student', error: (error as any).message });
    }
};

export const requestStudentDeletion = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;
    const caller = req.currentUser;

    if (!reason || !reason.trim()) {
        return res.status(400).json({ message: 'El motivo de la solicitud de eliminación es obligatorio.' });
    }

    try {
        // 1. Check if student exists
        const { data: student, error: stErr } = await adminClient
            .from('students')
            .select('id, full_name, personal_code, branch_id')
            .eq('id', id)
            .maybeSingle();

        if (stErr || !student) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }

        // 2. Check if there is already a pending request
        const { data: existingRecords, error: existErr } = await adminClient
            .from('document_authorizations')
            .select('id')
            .eq('student_id', id)
            .eq('document_type', 'STUDENT_DELETION')
            .eq('status', 'PENDING');

        if (existErr) throw existErr;

        if (existingRecords && existingRecords.length > 0) {
            return res.status(400).json({ message: 'Ya existe una solicitud pendiente de eliminación para este estudiante.' });
        }

        const { data: inserted, error: insertErr } = await adminClient
            .from('document_authorizations')
            .insert([{
                student_id: id,
                document_type: 'STUDENT_DELETION',
                status: 'PENDING',
                reason: reason.trim(),
                requested_by: caller?.id || null,
                requested_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (insertErr) throw insertErr;

        // 3. Notify administrators
        try {
            const { data: adminProfiles } = await adminClient
                .from('profiles')
                .select('id')
                .in('role', ['admin', 'superadmin']);

            if (adminProfiles && adminProfiles.length > 0) {
                const notifs = adminProfiles.map((adm: any) => ({
                    user_id: adm.id,
                    title: '⚠️ Solicitud de Eliminación de Estudiante',
                    message: `Secretaría ha solicitado autorización para eliminar a ${student.full_name} (${student.personal_code || 'S/C'}). Motivo: "${reason.trim()}".`,
                    type: 'SYSTEM',
                    is_read: false
                }));
                await adminClient.from('notifications').insert(notifs);
            }
        } catch (notifErr) {
            console.error('Error notifying admins about student deletion request:', notifErr);
        }

        res.status(201).json({
            success: true,
            message: 'Solicitud de eliminación enviada a la Administración.',
            request: inserted
        });
    } catch (error: any) {
        console.error('Error in requestStudentDeletion:', error);
        res.status(500).json({ message: 'Error al solicitar la eliminación del estudiante', error: error?.message });
    }
};

export const deleteStudent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const branchId = req.currentUser?.branch_id;
    const userRole = req.currentUser?.role;
    const db = req.dbUserClient || adminClient || client;

    try {
        // Security check: if secretary, check if there is an approved deletion request
        if (userRole === 'secretary') {
            const { data: authCheck, error: authCheckErr } = await adminClient
                .from('document_authorizations')
                .select('id')
                .eq('student_id', id)
                .eq('document_type', 'STUDENT_DELETION')
                .eq('status', 'APPROVED')
                .order('authorized_at', { ascending: false })
                .limit(1);

            if (authCheckErr || !authCheck || authCheck.length === 0) {
                return res.status(403).json({ 
                    message: 'La eliminación de estudiantes por parte de secretaría requiere la aprobación previa de la Administración.' 
                });
            }
        }

        let query = db
            .from('students')
            .delete()
            .eq('id', id);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { error } = await query;

        if (error) throw error;

        // Clean up or archive authorization record
        try {
            await adminClient
                .from('document_authorizations')
                .delete()
                .eq('student_id', id)
                .eq('document_type', 'STUDENT_DELETION');
        } catch (cleanupErr) {
            console.warn('Could not cleanup document authorization after delete:', cleanupErr);
        }

        if (branchId) {
            await broadcastNotification(
                client,
                branchId,
                'Estudiante Eliminado',
                `Se ha eliminado un estudiante del sistema.`,
                'DELETE'
            );
        }

        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error("Error deleting student:", error);
        res.status(500).json({ message: 'Error deleting student', error: (error as any).message });
    }
};

// ==========================================
// PUBLIC STUDENT CREDENTIAL VERIFICATION
// ==========================================
export const verifyStudentPublic = async (req: Request, res: Response) => {
    const { identifier } = req.params;

    if (!identifier) {
        return res.status(400).json({ valid: false, message: 'Identificador de estudiante requerido' });
    }

    try {
        const cleanId = String(identifier).trim();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

        let query = adminClient
            .from('students')
            .select(`
                id,
                user_id,
                full_name,
                personal_code,
                academy_code,
                status,
                created_at,
                branches:branch_id ( id, name, address, phone ),
                enrollments (
                    id,
                    is_active,
                    courses:course_id ( id, name, description )
                )
            `);

        if (isUUID) {
            query = query.or(`id.eq.${cleanId},user_id.eq.${cleanId}`);
        } else {
            query = query.or(`personal_code.eq.${cleanId},academy_code.eq.${cleanId}`);
        }

        const { data: student, error } = await query.maybeSingle();

        if (error) throw error;

        if (!student) {
            return res.status(404).json({
                valid: false,
                message: 'Estudiante no encontrado en los registros oficiales de ULTEC.'
            });
        }

        const activeCourses = (student.enrollments || [])
            .filter((e: any) => e.is_active && e.courses)
            .map((e: any) => e.courses.name);

        const isRegularActive = student.status === 'active' || student.status === 'activo' || (activeCourses.length > 0);
        const studentCode = student.personal_code || student.academy_code || `UT-${new Date().getFullYear()}-${student.id.slice(0, 4).toUpperCase()}`;

        res.json({
            valid: true,
            student_id: student.id,
            full_name: student.full_name,
            student_code: studentCode,
            status: isRegularActive ? 'ACTIVO' : 'INACTIVO',
            is_active: isRegularActive,
            branch_name: (student.branches as any)?.name || 'Sede Central',
            branch_address: (student.branches as any)?.address || '',
            courses: activeCourses,
            cycle: `Ciclo Lectivo ${new Date().getFullYear()}`,
            issued_at: student.created_at,
            verified_at: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error verifying student public:', error);
        res.status(500).json({ valid: false, message: 'Error interno al verificar credencial estudiantil' });
    }
};
