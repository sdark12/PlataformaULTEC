import { Request, Response } from 'express';
import { adminClient } from '../config/insforge';

// Helper to resolve student ID from caller or requested student_id
const resolveStudent = async (caller: any, requestedStudentId?: any) => {
    let studentId = requestedStudentId ? String(requestedStudentId).trim() : undefined;

    if (!studentId && caller?.role === 'student') {
        const { data: st } = await adminClient
            .from('students')
            .select('id, full_name, personal_code, branch_id, user_id')
            .or(`id.eq.${caller.id},user_id.eq.${caller.id}`)
            .maybeSingle();
        if (st) studentId = st.id;
    }

    if (!studentId) return null;

    const { data: student } = await adminClient
        .from('students')
        .select(`
            id,
            user_id,
            full_name,
            personal_code,
            academy_code,
            branch_id,
            status,
            branches:branch_id ( id, name, address, phone ),
            enrollments (
                id,
                is_active,
                courses:course_id ( id, name )
            )
        `)
        .or(`id.eq.${studentId},user_id.eq.${studentId}`)
        .maybeSingle();

    return student;
};

/**
 * Solicitar emisión de carnet físico oficial
 * Exclusivo: Estudiante, Padre o Personal Administrativo
 */
export const requestPhysicalCredential = async (req: Request, res: Response) => {
    const caller = req.currentUser;
    const { student_id, reason, request_type } = req.body;

    try {
        const student = await resolveStudent(caller, student_id);

        if (!student) {
            return res.status(404).json({ message: 'Estudiante no encontrado en el sistema.' });
        }

        // Si es padre, verificar que esté vinculado al estudiante
        if (caller?.role === 'parent') {
            const { data: link } = await adminClient
                .from('parent_student_links')
                .select('id')
                .eq('parent_id', caller.id)
                .eq('student_id', student.id)
                .maybeSingle();

            if (!link) {
                return res.status(403).json({ message: 'No tienes autorización para solicitar carnet para este estudiante.' });
            }
        }

        // Verificar si ya existe una solicitud en proceso
        const { data: existing, error: existErr } = await adminClient
            .from('document_authorizations')
            .select('*')
            .eq('student_id', student.id)
            .eq('document_type', 'STUDENT_ID')
            .in('status', ['PENDING', 'READY'])
            .order('requested_at', { ascending: false })
            .limit(1);

        if (existErr) throw existErr;

        if (existing && existing.length > 0) {
            const currentReq = existing[0];
            if (currentReq.status === 'READY') {
                return res.status(400).json({
                    message: 'Ya tienes un carnet oficial impreso listo para recoger en la Secretaría del plantel.',
                    request: currentReq
                });
            }
            // Si está pendiente, actualizamos la nota / motivo
            const { data: updated } = await adminClient
                .from('document_authorizations')
                .update({
                    reason: reason?.trim() || currentReq.reason,
                    notes: request_type || currentReq.notes || 'FIRST_TIME',
                    requested_at: new Date().toISOString()
                })
                .eq('id', currentReq.id)
                .select()
                .single();

            return res.json({
                success: true,
                message: 'Tu solicitud de carnet físico se encuentra en revisión en la Administración.',
                request: updated
            });
        }

        // Insertar nueva solicitud
        const reqReason = reason?.trim() || (request_type === 'REPLACEMENT' ? 'Reposición por extravío/daño' : 'Primer carnet institucional');
        const { data: inserted, error: insertErr } = await adminClient
            .from('document_authorizations')
            .insert([{
                student_id: student.id,
                document_type: 'STUDENT_ID',
                status: 'PENDING',
                reason: reqReason,
                notes: request_type || 'FIRST_TIME',
                requested_by: caller?.id || null,
                requested_at: new Date().toISOString(),
                download_count: 0,
                max_downloads: 0
            }])
            .select()
            .single();

        if (insertErr) throw insertErr;

        // Notificar al personal administrativo y secretaría
        try {
            const { data: staff } = await adminClient
                .from('profiles')
                .select('id, branch_id')
                .in('role', ['admin', 'superadmin', 'secretary']);

            if (staff && staff.length > 0) {
                const filteredStaff = staff.filter((s: any) => 
                    !s.branch_id || !student.branch_id || s.branch_id === student.branch_id
                );

                const notifs = filteredStaff.map((s: any) => ({
                    user_id: s.id,
                    title: '🪪 Solicitud de Carnet Estudiantil',
                    message: `${student.full_name} (${student.personal_code || student.academy_code || 'S/C'}) ha solicitado la emisión de su carnet físico. Motivo: "${reqReason}".`,
                    type: 'SYSTEM',
                    is_read: false
                }));

                await adminClient.from('notifications').insert(notifs);
            }
        } catch (notifErr) {
            console.error('Error al notificar sobre solicitud de carnet:', notifErr);
        }

        res.status(201).json({
            success: true,
            message: 'Solicitud de carnet físico enviada con éxito a la Administración.',
            request: inserted
        });
    } catch (error: any) {
        console.error('Error in requestPhysicalCredential:', error);
        res.status(500).json({ message: 'Error al procesar solicitud de carnet físico', error: error?.message });
    }
};

/**
 * Consultar estado de trámite de carnet físico
 */
export const getMyCredentialStatus = async (req: Request, res: Response) => {
    const caller = req.currentUser;
    const { studentId } = req.params;

    try {
        const student = await resolveStudent(caller, studentId);

        if (!student) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }

        const { data: latestRequest, error } = await adminClient
            .from('document_authorizations')
            .select('*')
            .eq('student_id', student.id)
            .eq('document_type', 'STUDENT_ID')
            .order('requested_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        const activeCourses = (student.enrollments || [])
            .filter((e: any) => e.is_active && e.courses)
            .map((e: any) => e.courses.name);

        res.json({
            student: {
                id: student.id,
                full_name: student.full_name,
                personal_code: student.personal_code || student.academy_code || `UT-${new Date().getFullYear()}-${student.id.slice(0, 4).toUpperCase()}`,
                branch_name: (student.branches as any)?.name || 'Sede Central',
                courses: activeCourses,
                status: student.status
            },
            request: latestRequest || null
        });
    } catch (error: any) {
        console.error('Error in getMyCredentialStatus:', error);
        res.status(500).json({ message: 'Error al consultar estado de credencial', error: error?.message });
    }
};

/**
 * Listado de solicitudes de carnet para Administración y Secretaría
 */
export const getCredentialRequests = async (req: Request, res: Response) => {
    const caller = req.currentUser;
    const { status, branch_id, search } = req.query;

    if (!['superadmin', 'admin', 'secretary'].includes(caller?.role || '')) {
        return res.status(403).json({ message: 'Acceso no autorizado al panel de carnets.' });
    }

    try {
        let query = adminClient
            .from('document_authorizations')
            .select(`
                id,
                student_id,
                document_type,
                status,
                reason,
                notes,
                requested_by,
                requested_at,
                authorized_by,
                authorized_at,
                delivered_by,
                delivered_at,
                students:student_id (
                    id,
                    full_name,
                    personal_code,
                    academy_code,
                    branch_id,
                    status,
                    branches:branch_id ( id, name, address, phone ),
                    enrollments (
                        id,
                        is_active,
                        courses:course_id ( id, name )
                    )
                )
            `)
            .eq('document_type', 'STUDENT_ID');

        // Filtro por estado
        if (status && status !== 'ALL') {
            query = query.eq('status', status);
        }

        // Filtro por sede (estricto para administradores de sede local)
        const targetBranch = caller?.role === 'superadmin' ? branch_id : (caller?.branch_id || branch_id);
        if (targetBranch && targetBranch !== 'ALL') {
            query = query.eq('students.branch_id', targetBranch);
        }

        const { data, error } = await query.order('requested_at', { ascending: false });

        if (error) throw error;

        let formatted = (data || []).map((item: any) => {
            const st = item.students;
            const courses = (st?.enrollments || [])
                .filter((e: any) => e.is_active && e.courses)
                .map((e: any) => e.courses.name);

            return {
                id: item.id,
                student_id: item.student_id,
                status: item.status,
                reason: item.reason,
                request_type: item.notes || 'FIRST_TIME',
                requested_at: item.requested_at,
                authorized_by: item.authorized_by,
                authorized_at: item.authorized_at,
                delivered_by: item.delivered_by,
                delivered_at: item.delivered_at,
                full_name: st?.full_name || 'Desconocido',
                personal_code: st?.personal_code || st?.academy_code || `UT-${item.student_id?.slice(0, 4)?.toUpperCase()}`,
                branch_id: st?.branch_id,
                branch_name: st?.branches?.name || 'Sede Central',
                courses: courses,
                is_active: st?.status === 'active' || st?.status === 'activo'
            };
        });

        // Filtro de búsqueda textual en memoria
        if (search && typeof search === 'string' && search.trim()) {
            const term = search.toLowerCase();
            formatted = formatted.filter(item => 
                item.full_name.toLowerCase().includes(term) ||
                item.personal_code.toLowerCase().includes(term) ||
                item.branch_name.toLowerCase().includes(term)
            );
        }

        res.json(formatted);
    } catch (error: any) {
        console.error('Error in getCredentialRequests:', error);
        res.status(500).json({ message: 'Error al obtener solicitudes de carnets', error: error?.message });
    }
};

/**
 * Cambiar estado de solicitud (Impreso/Listo o Entregado Presencial)
 */
export const updateCredentialRequestStatus = async (req: Request, res: Response) => {
    const caller = req.currentUser;
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['superadmin', 'admin', 'secretary'].includes(caller?.role || '')) {
        return res.status(403).json({ message: 'Acceso no autorizado para actualizar estado de carnets.' });
    }

    if (!['READY', 'DELIVERED', 'REJECTED', 'PENDING'].includes(status)) {
        return res.status(400).json({ message: 'Estado inválido. Debe ser READY, DELIVERED, REJECTED o PENDING.' });
    }

    try {
        const updatePayload: any = {
            status,
            notes: notes !== undefined ? notes : undefined
        };

        if (status === 'READY') {
            updatePayload.authorized_by = (caller as any)?.full_name || caller?.email || 'Administración';
            updatePayload.authorized_at = new Date().toISOString();
        } else if (status === 'DELIVERED') {
            updatePayload.delivered_by = (caller as any)?.full_name || caller?.email || 'Administración';
            updatePayload.delivered_at = new Date().toISOString();
        }

        const { data: updated, error } = await adminClient
            .from('document_authorizations')
            .update(updatePayload)
            .eq('id', id)
            .select(`
                *,
                students:student_id ( id, user_id, full_name, personal_code )
            `)
            .single();

        if (error) throw error;

        // Notificar al estudiante si tiene usuario vinculado
        const st = updated.students;
        if (st?.user_id) {
            let notifTitle = '🪪 Actualización de Carnet Físico';
            let notifMessage = `Tu solicitud de carnet institucional ha sido actualizada al estado: ${status}.`;

            if (status === 'READY') {
                notifTitle = '🎉 ¡Tu Carnet Físico está Listo!';
                notifMessage = `¡Excelente noticia! Tu carnet oficial ha sido impreso y se encuentra listo para recoger en la Secretaría del plantel.`;
            } else if (status === 'DELIVERED') {
                notifTitle = '✓ Carnet Oficial Entregado';
                notifMessage = `Se ha registrado exitosamente la entrega física de tu carnet estudiantil en el plantel por ${updatePayload.delivered_by}.`;
            } else if (status === 'REJECTED') {
                notifTitle = '⚠️ Solicitud de Carnet Denegada';
                notifMessage = `Tu solicitud de carnet físico no pudo ser procesada. Motivo: ${notes || 'Consulta en la Secretaría de tu sede.'}`;
            }

            try {
                await adminClient.from('notifications').insert([{
                    user_id: st.user_id,
                    title: notifTitle,
                    message: notifMessage,
                    type: 'SYSTEM',
                    is_read: false
                }]);
            } catch (notifErr) {
                console.error('Error notifying student about credential update:', notifErr);
            }
        }

        res.json({
            success: true,
            message: `Solicitud de carnet actualizada a ${status}.`,
            request: updated
        });
    } catch (error: any) {
        console.error('Error in updateCredentialRequestStatus:', error);
        res.status(500).json({ message: 'Error al actualizar estado del carnet', error: error?.message });
    }
};

/**
 * Obtener datos completos de estudiante para emisión de credencial
 * (Usado tanto por la vista previa del carnet digital como por la herramienta de impresión oficial)
 */
export const getStudentCredentialCard = async (req: Request, res: Response) => {
    const caller = req.currentUser;
    const { studentId } = req.params;

    try {
        const student = await resolveStudent(caller, studentId);

        if (!student) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }

        // Buscar tutor / contacto de emergencia
        const { data: parentLink } = await adminClient
            .from('parent_student_links')
            .select(`
                relationship,
                parents:parent_id ( id, full_name, phone, email )
            `)
            .eq('student_id', student.id)
            .limit(1)
            .maybeSingle();

        // Buscar última entrega física oficial
        const { data: lastDelivery } = await adminClient
            .from('document_authorizations')
            .select('status, delivered_at, delivered_by')
            .eq('student_id', student.id)
            .eq('document_type', 'STUDENT_ID')
            .eq('status', 'DELIVERED')
            .order('delivered_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        const activeCourses = (student.enrollments || [])
            .filter((e: any) => e.is_active && e.courses)
            .map((e: any) => e.courses.name);

        const currentYear = new Date().getFullYear();
        const studentCode = student.personal_code || student.academy_code || `UT-${currentYear}-${student.id.slice(0, 4).toUpperCase()}`;

        res.json({
            student_id: student.id,
            full_name: student.full_name,
            student_code: studentCode,
            status: student.status,
            branch_name: (student.branches as any)?.name || 'Sede Central',
            branch_address: (student.branches as any)?.address || '',
            branch_phone: (student.branches as any)?.phone || '',
            course_name: activeCourses[0] || 'Educación Técnica y Tecnológica',
            courses: activeCourses,
            cycle: `Ciclo Lectivo ${currentYear}`,
            valid_until: `31/12/${currentYear}`,
            emergency_contact: {
                name: (parentLink?.parents as any)?.full_name || 'Dirección / Secretaría',
                phone: (parentLink?.parents as any)?.phone || (student.branches as any)?.phone || 'PBX: 2200-0000',
                relationship: parentLink?.relationship || 'Tutor'
            },
            physical_card: {
                is_delivered: !!lastDelivery,
                delivered_at: lastDelivery?.delivered_at || null,
                delivered_by: lastDelivery?.delivered_by || null
            },
            verification_url: `https://plataformaultec.duckdns.org/verify-student/${encodeURIComponent(studentCode)}`
        });
    } catch (error: any) {
        console.error('Error in getStudentCredentialCard:', error);
        res.status(500).json({ message: 'Error al obtener datos de la credencial', error: error?.message });
    }
};
