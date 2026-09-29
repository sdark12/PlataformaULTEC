import { Request, Response } from 'express';
import { adminClient as client } from '../config/insforge';
import { sendWelcomeEmail } from '../services/email.service';

/**
 * Obtener estadísticas globales y conteos de usuarios
 * Retorna conteos totales, activos/inactivos y desglose por rol de forma instantánea.
 */
export const getUserStats = async (req: Request, res: Response) => {
    try {
        const { branch_id } = req.query;

        let query = client
            .from('profiles')
            .select('role, active, branch_id');

        if (branch_id && branch_id !== 'all') {
            query = query.eq('branch_id', branch_id);
        }

        const { data, error } = await query;
        if (error) throw error;

        const total = data?.length || 0;
        let active = 0;
        let inactive = 0;
        const byRole: Record<string, number> = {
            student: 0,
            parent: 0,
            instructor: 0,
            secretary: 0,
            admin: 0,
            superadmin: 0
        };

        (data || []).forEach((u: any) => {
            if (u.active !== false) {
                active++;
            } else {
                inactive++;
            }
            if (u.role && byRole[u.role] !== undefined) {
                byRole[u.role]++;
            } else if (u.role) {
                byRole[u.role] = 1;
            }
        });

        res.json({
            total,
            active,
            inactive,
            byRole
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ message: 'Error fetching user stats' });
    }
};

export const getUsers = async (req: Request, res: Response) => {
    try {
        let query = client
            .from('profiles')
            .select('*', { count: 'exact' })
            .order('full_name', { ascending: true });

        const { page, limit, search, role, status, branch_id } = req.query;

        if (role && role !== 'all') {
            query = query.eq('role', role);
        }

        if (branch_id && branch_id !== 'all') {
            query = query.eq('branch_id', branch_id);
        }

        if (status === 'active') {
            query = query.or('active.is.null,active.eq.true');
        } else if (status === 'inactive') {
            query = query.eq('active', false);
        }

        // Búsqueda multi-campo acelerada con índices GIN Trigram
        if (search && typeof search === 'string' && search.trim()) {
            const term = search.trim();
            query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
        }

        const enrichUsersWithRelations = async (userList: any[]) => {
            if (!userList || userList.length === 0) return userList;

            // 1. Enrich parents with their linked children
            const parentIds = userList.filter((u: any) => u.role === 'parent').map((u: any) => u.id);
            if (parentIds.length > 0) {
                const { data: parentLinks } = await client
                    .from('parent_student_links')
                    .select('id, parent_user_id, student_id, relationship, students(id, full_name, academy_code, personal_code)')
                    .in('parent_user_id', parentIds);

                const linksMap: Record<string, any[]> = {};
                parentLinks?.forEach((link: any) => {
                    if (!linksMap[link.parent_user_id]) linksMap[link.parent_user_id] = [];
                    linksMap[link.parent_user_id].push(link);
                });

                userList.forEach((u: any) => {
                    if (u.role === 'parent') {
                        u.parent_links = linksMap[u.id] || [];
                    }
                });
            }

            // 2. Enrich students with their linked student profile
            const studentUserIds = userList.filter((u: any) => u.role === 'student').map((u: any) => u.id);
            if (studentUserIds.length > 0) {
                const { data: studentProfiles } = await client
                    .from('students')
                    .select('id, user_id, full_name, academy_code, personal_code')
                    .in('user_id', studentUserIds);

                const studentMap: Record<string, any> = {};
                studentProfiles?.forEach((st: any) => {
                    studentMap[st.user_id] = st;
                });

                userList.forEach((u: any) => {
                    if (u.role === 'student') {
                        u.student_profile = studentMap[u.id] || null;
                    }
                });
            }

            return userList;
        };

        // Soporte de exportación bajo demanda (hasta 2,000 registros enriquecidos)
        const isExport = req.query.export === 'true' || req.query.all === 'true';
        if (isExport) {
            query = query.limit(2000);
            const { data, error, count } = await query;
            if (error) throw error;
            const enriched = await enrichUsersWithRelations(data || []);
            return res.json({
                data: enriched,
                meta: {
                    total: count || (enriched?.length || 0),
                    page: 1,
                    limit: enriched?.length || 0,
                    totalPages: 1
                }
            });
        }

        // Paginación server-side
        if (page || limit) {
            const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
            const limitNum = Math.min(100, Math.max(5, parseInt(limit as string, 10) || 25));
            const offset = (pageNum - 1) * limitNum;
            
            query = query.range(offset, offset + limitNum - 1);
            
            const { data, error, count } = await query;
            if (error) throw error;
            
            const enriched = await enrichUsersWithRelations(data || []);

            return res.json({
                data: enriched,
                meta: {
                    total: count || 0,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil((count || 0) / limitNum)
                }
            });
        }

        // Consulta estándar sin parámetros de paginación (compatibilidad hacia atrás con límite de seguridad)
        query = query.limit(500);
        const { data, error } = await query;
        if (error) throw error;
        const enriched = await enrichUsersWithRelations(data || []);
        res.json(enriched);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Error fetching users' });
    }
};

export const createUser = async (req: Request, res: Response) => {
    try {
        const { email, password, full_name, role, phone, student_id, branch_id } = req.body;

        if (!email || !password || !full_name || !role) {
            return res.status(400).json({ message: 'Nombre, correo, contraseña y rol son obligatorios.' });
        }

        const callerRole = req.currentUser?.role;

        // RBAC: Solo Superadmin puede crear roles administrativos (admin o superadmin)
        if (['admin', 'superadmin'].includes(role) && callerRole !== 'superadmin') {
            return res.status(403).json({ message: 'Solo un Superadministrador puede registrar usuarios con roles administrativos.' });
        }

        let userId: string;

        // 1. Check if a profile with this email already exists
        const { data: existingProfile } = await client
            .from('profiles')
            .select('id, email')
            .eq('email', email)
            .maybeSingle();

        if (existingProfile) {
            return res.status(409).json({ message: `El usuario con correo ${email} ya existe en el sistema.` });
        }

        // 2. Create user via Supabase Auth Admin API (bypasses email confirmation requirement / SMTP errors)
        const { data: adminUserData, error: adminAuthError } = await client.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name }
        });

        if (adminAuthError) {
            console.error('Error creating user via auth.admin:', adminAuthError);
            const errMsg = (adminAuthError.message || '').toLowerCase();

            // If user already exists in Auth (e.g. from an orphaned auth record)
            if (errMsg.includes('already registered') || errMsg.includes('already exists') || (adminAuthError as any).status === 422 || (adminAuthError as any).statusCode === 400) {
                console.log(`User ${email} already exists in auth. Fetching user list...`);
                const { data: listData, error: listError } = await client.auth.admin.listUsers();
                
                if (listError) {
                    console.error('Error listing auth users:', listError);
                    return res.status(400).json({ message: `El correo ${email} ya está registrado en el sistema de autenticación.` });
                }

                const matchedUser = listData?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

                if (matchedUser) {
                    userId = matchedUser.id;
                    // Update password and metadata for the existing auth user
                    await client.auth.admin.updateUserById(userId, {
                        password,
                        email_confirm: true,
                        user_metadata: { full_name }
                    });
                    console.log(`Reusing and updating existing auth user: ${userId}`);
                } else {
                    return res.status(400).json({ message: `El correo ${email} ya existe en autenticación pero no se pudo recuperar.` });
                }
            } else {
                return res.status(500).json({ message: adminAuthError.message || 'Error al crear credenciales de usuario.' });
            }
        } else if (!adminUserData?.user) {
            return res.status(400).json({ message: 'Error al registrar credenciales de acceso.' });
        } else {
            userId = adminUserData.user.id;
        }

        // 3. Upsert Profile
        const profilePayload: any = {
            id: userId,
            email,
            full_name,
            role
        };

        if (branch_id !== undefined && branch_id !== '') {
            profilePayload.branch_id = branch_id;
        } else {
            profilePayload.branch_id = null;
        }

        const { data: existingProfileById } = await client
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

        let profileResult;
        if (existingProfileById) {
            profileResult = await client
                .from('profiles')
                .update(profilePayload)
                .eq('id', userId)
                .select()
                .single();
        } else {
            profileResult = await client
                .from('profiles')
                .insert([profilePayload])
                .select()
                .single();
        }

        if (profileResult.error) {
            console.error('Profile creation error:', profileResult.error);
            return res.status(400).json({ message: 'Error al registrar el perfil.', details: profileResult.error });
        }

        // 4. Link to student if provided
        if (role === 'student' && student_id) {
            const studentUpdate: any = { user_id: userId };
            if (phone) studentUpdate.phone = phone;

            const { error: studentLinkError } = await client
                .from('students')
                .update(studentUpdate)
                .eq('id', student_id);

            if (studentLinkError) {
                console.error('Student linking error:', studentLinkError);
            }
        } else if (role === 'parent') {
            const { student_links } = req.body;
            if (Array.isArray(student_links) && student_links.length > 0) {
                for (const item of student_links) {
                    if (!item.student_id) continue;
                    await client.from('parent_student_links').insert({
                        parent_user_id: userId,
                        student_id: item.student_id,
                        relationship: item.relationship || 'parent',
                        created_by: (req as any).currentUser?.id
                    });
                }
                const studentIds = student_links.map((l: any) => l.student_id).filter(Boolean);
                if (studentIds.length > 0) {
                    const stUpdate: any = {};
                    if (full_name) stUpdate.guardian_name = full_name;
                    if (phone) stUpdate.guardian_phone = phone;
                    if (email) stUpdate.guardian_email = email;
                    if (Object.keys(stUpdate).length > 0) {
                        await client.from('students').update(stUpdate).in('id', studentIds);
                    }
                }
            }
        } else if (role === 'instructor' && phone) {
            await client.from('instructors').update({ phone }).eq('user_id', userId);
        }

        // 5. Send Welcome Email asynchronously (non-fatal if it fails)
        try {
            sendWelcomeEmail(email, full_name, role, password);
        } catch (mailErr) {
            console.warn('Welcome email error (non-fatal):', mailErr);
        }

        return res.status(201).json(profileResult.data);
    } catch (error: any) {
        console.error('Error creating user:', error);
        return res.status(500).json({ message: error?.message || 'Error interno al crear usuario.' });
    }
};

export const getUserById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ message: 'User not found' });

        let userPhone = (data as any).phone || null;

        if (data.role === 'student') {
            const { data: st } = await client
                .from('students')
                .select('id, full_name, phone, guardian_phone, guardian_name, personal_code, academy_code')
                .eq('user_id', id)
                .maybeSingle();

            if (st) {
                if (st.full_name && st.full_name.trim()) {
                    data.full_name = st.full_name.trim();
                    if (data.full_name !== st.full_name.trim()) {
                        client.from('profiles').update({ full_name: st.full_name.trim() }).eq('id', id).then();
                    }
                }
                userPhone = st.phone || '';
                (data as any).student_phone = st.phone || '';
                (data as any).guardian_phone = st.guardian_phone || '';
                (data as any).guardian_name = st.guardian_name || '';
                (data as any).personal_code = st.personal_code;
                (data as any).academy_code = st.academy_code;
                (data as any).student_id = st.id;
            }
        } else if (data.role === 'instructor') {
            const { data: inst } = await client.from('instructors').select('phone').eq('user_id', id).maybeSingle();
            if (inst?.phone) userPhone = inst.phone;
        } else if (data.role === 'parent') {
            // Step 1: get linked students and details
            const { data: links } = await client
                .from('parent_student_links')
                .select(`
                    id,
                    student_id,
                    relationship,
                    students (
                        id,
                        full_name,
                        personal_code,
                        academy_code,
                        guardian_phone,
                        phone
                    )
                `)
                .eq('parent_user_id', id);

            (data as any).parent_links = links || [];

            if (links && links.length > 0) {
                const firstStudent = (links[0] as any).students;
                const linkedPhone = firstStudent?.guardian_phone || firstStudent?.phone;
                if (linkedPhone && !userPhone) {
                    userPhone = linkedPhone;
                }
                (data as any).guardian_phone = firstStudent?.guardian_phone || '';
                (data as any).student_name = (links as any[])
                    .map(l => l.students?.full_name)
                    .filter(Boolean)
                    .join(', ');
            }
        }

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.json({ ...data, phone: userPhone });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Error fetching user' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { full_name, email, role, phone, active, branch_id } = req.body;

        const callerRole = req.currentUser?.role;
        const callerId = req.currentUser?.id;

        // Fetch target profile to verify permissions
        const { data: targetProfile, error: targetError } = await client
            .from('profiles')
            .select('id, role, branch_id')
            .eq('id', id)
            .maybeSingle();

        if (targetError || !targetProfile) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // RBAC: Solo Superadmin puede modificar o asignar roles administrativos
        if (callerRole !== 'superadmin') {
            if (targetProfile.role === 'superadmin') {
                return res.status(403).json({ message: 'Acceso denegado: No tiene permisos para modificar una cuenta de Superadministrador.' });
            }
            if (targetProfile.role === 'admin' && targetProfile.id !== callerId) {
                return res.status(403).json({ message: 'Acceso denegado: Solo un Superadministrador puede modificar otras cuentas de administradores.' });
            }
            if (role && ['admin', 'superadmin'].includes(role) && targetProfile.role !== role) {
                return res.status(403).json({ message: 'Acceso denegado: Solo un Superadministrador puede otorgar roles administrativos.' });
            }
        }

        const updatePayload: any = {};
        if (full_name !== undefined) updatePayload.full_name = full_name;
        if (email !== undefined) updatePayload.email = email;
        if (role !== undefined) updatePayload.role = role;
        if (active !== undefined) updatePayload.active = active;
        if (branch_id !== undefined) updatePayload.branch_id = branch_id === '' ? null : branch_id;

        let data: any;
        if (Object.keys(updatePayload).length > 0) {
            const { data: updated, error } = await client
                .from('profiles')
                .update(updatePayload)
                .eq('id', id)
                .select('*')
                .single();

            if (error) throw error;
            if (!updated) return res.status(404).json({ message: 'User not found' });
            data = updated;
        } else {
            // No profile fields to update (e.g. only phone), just fetch current profile
            const { data: fetched, error } = await client
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (!fetched) return res.status(404).json({ message: 'User not found' });
            data = fetched;
        }

        // Update phone in specific role tables if provided
        if (phone !== undefined) {
            const currentRole = role || data.role;
            if (currentRole === 'student') {
                await client.from('students').update({ phone }).eq('user_id', id);
            } else if (currentRole === 'parent') {
                const { data: links } = await client
                    .from('parent_student_links')
                    .select('student_id')
                    .eq('parent_user_id', id);

                if (links && links.length > 0) {
                    const studentIds = links.map((l: any) => l.student_id);
                    await client.from('students').update({ guardian_phone: phone }).in('id', studentIds);
                }
            } else if (currentRole === 'instructor') {
                await client.from('instructors').update({ phone }).eq('user_id', id);
            }
        }

        // Synchronize full_name in student/parent tables if provided
        if (full_name !== undefined) {
            const currentRole = role || data.role;
            if (currentRole === 'student') {
                await client.from('students').update({ full_name }).eq('user_id', id);
            } else if (currentRole === 'parent') {
                const { data: links } = await client
                    .from('parent_student_links')
                    .select('student_id')
                    .eq('parent_user_id', id);

                if (links && links.length > 0) {
                    const studentIds = links.map((l: any) => l.student_id);
                    await client.from('students').update({ guardian_name: full_name }).in('id', studentIds);
                }
            }
        }

        // Handle student linking if role is student and student_id is provided
        const { student_id, student_links } = req.body;
        if (role === 'student' && student_id) {
            await client
                .from('students')
                .update({ user_id: null })
                .eq('user_id', id);

            const { error: studentLinkError } = await client
                .from('students')
                .update({ user_id: id })
                .eq('id', student_id);

            if (studentLinkError) {
                console.error('Student linking error during update:', studentLinkError);
            }
        } else if (role && role !== 'student') {
            await client
                .from('students')
                .update({ user_id: null })
                .eq('user_id', id);
        }

        // Handle parent student_links synchronization
        const effectiveRole = role || data.role;
        if (effectiveRole === 'parent' && student_links !== undefined && Array.isArray(student_links)) {
            const { data: currentLinks } = await client
                .from('parent_student_links')
                .select('id, student_id, relationship')
                .eq('parent_user_id', id);

            const currentMap = new Map((currentLinks || []).map((l: any) => [l.student_id, l]));
            const incomingStudentIds = new Set((student_links || []).map((l: any) => l.student_id).filter(Boolean));

            // Delete links not in incoming
            const toDeleteIds: string[] = [];
            for (const [stId, link] of currentMap.entries()) {
                if (!incomingStudentIds.has(stId)) {
                    toDeleteIds.push(link.id);
                }
            }

            if (toDeleteIds.length > 0) {
                await client
                    .from('parent_student_links')
                    .delete()
                    .in('id', toDeleteIds);
            }

            // Insert or update incoming links
            for (const item of student_links) {
                if (!item.student_id) continue;
                const existing = currentMap.get(item.student_id);
                const rel = item.relationship || 'parent';
                if (existing) {
                    if (existing.relationship !== rel) {
                        await client
                            .from('parent_student_links')
                            .update({ relationship: rel })
                            .eq('id', existing.id);
                    }
                } else {
                    await client
                        .from('parent_student_links')
                        .insert({
                            parent_user_id: id,
                            student_id: item.student_id,
                            relationship: rel,
                            created_by: (req as any).currentUser?.id
                        });
                }
            }

            // Cascade update guardian contact details on students table
            if (incomingStudentIds.size > 0) {
                const studentIdsArray = Array.from(incomingStudentIds);
                const studentUpdates: any = {};
                if (data.full_name || full_name) studentUpdates.guardian_name = data.full_name || full_name;
                if (phone !== undefined) studentUpdates.guardian_phone = phone;
                if (email !== undefined) studentUpdates.guardian_email = email;

                if (Object.keys(studentUpdates).length > 0) {
                    await client
                        .from('students')
                        .update(studentUpdates)
                        .in('id', studentIdsArray);
                }
            }
        }

        res.json({ ...data, phone: phone !== undefined ? phone : undefined });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Error updating user' });
    }
};

export const deleteUser = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const callerRole = req.currentUser?.role;

        // Fetch target profile
        const { data: targetProfile } = await client
            .from('profiles')
            .select('id, role')
            .eq('id', id)
            .maybeSingle();

        if (targetProfile?.role === 'superadmin') {
            return res.status(403).json({ message: 'Acción bloqueada: No es posible eliminar a un Superadministrador del sistema.' });
        }

        if (callerRole !== 'superadmin' && targetProfile?.role === 'admin') {
            return res.status(403).json({ message: 'Acceso denegado: Solo un Superadministrador puede eliminar cuentas de administradores.' });
        }

        // 1. Unlink any students referencing this user
        await client.from('students').update({ user_id: null }).eq('user_id', id);

        // 2. Unlink any instructors referencing this user
        await client.from('instructors').update({ user_id: null }).eq('user_id', id);

        // 3. Delete profile record
        const { error } = await client
            .from('profiles')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting profile:', error);
            return res.status(400).json({ message: 'Error al eliminar el perfil del usuario.', details: error });
        }

        // 4. Delete auth user via Admin API
        try {
            await client.auth.admin.deleteUser(id);
        } catch (authErr) {
            console.warn('Warning: error deleting auth user (non-fatal):', authErr);
        }

        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Error deleting user' });
    }
};
