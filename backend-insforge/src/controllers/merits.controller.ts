import { Request, Response } from 'express';
import { adminClient } from '../config/insforge';

/**
 * GET /api/merits/student/:student_id/balance
 * Returns point balance and transaction logs for a student.
 */
export const getStudentBalance = async (req: Request, res: Response) => {
    const { student_id } = req.params;
    
    try {
        // Resolve student_id if it's user_id or already student_id
        const { data: student, error: studentError } = await adminClient
            .from('students')
            .select('id, full_name, personal_code, academy_code')
            .or(`id.eq.${student_id},user_id.eq.${student_id}`)
            .maybeSingle();

        if (studentError) throw studentError;
        if (!student) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }

        const actualStudentId = student.id;

        // Fetch transactions
        const { data: transactions, error: txError } = await adminClient
            .from('merit_transactions')
            .select('*')
            .eq('student_id', actualStudentId)
            .order('created_at', { ascending: false });

        if (txError) throw txError;

        const balance = transactions?.reduce((acc: number, item: any) => acc + item.points, 0) || 0;

        res.json({
            student,
            balance,
            transactions: transactions || []
        });
    } catch (error: any) {
        console.error('Error fetching student points balance:', error);
        res.status(500).json({ message: 'Error al obtener el saldo de puntos', error: error?.message });
    }
};

/**
 * GET /api/merits/leaderboard
 * Returns leaderboard of students sorted by total point balance.
 */
export const getLeaderboard = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    const { course_id } = req.query;

    try {
        let studentIdsFilter: string[] | null = null;
        if (course_id) {
            const { data: enrollments } = await adminClient
                .from('enrollments')
                .select('student_id')
                .eq('course_id', course_id);

            studentIdsFilter = (enrollments || []).map((e: any) => e.student_id).filter(Boolean);
        }

        // Fetch all active students (filtered by branch if applicable)
        let studentsQuery = adminClient
            .from('students')
            .select('id, full_name, personal_code, academy_code, branch_id');

        if (branchId) {
            studentsQuery = studentsQuery.eq('branch_id', branchId);
        }

        if (studentIdsFilter !== null) {
            if (studentIdsFilter.length === 0) {
                return res.json([]);
            }
            studentsQuery = studentsQuery.in('id', studentIdsFilter);
        }

        const { data: students, error: studentError } = await studentsQuery;
        if (studentError) throw studentError;

        // Fetch all transactions
        const { data: transactions, error: txError } = await adminClient
            .from('merit_transactions')
            .select('student_id, points');

        if (txError) throw txError;

        // Compute balances
        const balanceMap = new Map<string, number>();
        transactions?.forEach((tx: any) => {
            balanceMap.set(tx.student_id, (balanceMap.get(tx.student_id) || 0) + tx.points);
        });

        const leaderboard = (students || []).map((s: any) => ({
            id: s.id,
            full_name: s.full_name,
            personal_code: s.personal_code,
            academy_code: s.academy_code,
            branch_id: s.branch_id,
            balance: balanceMap.get(s.id) || 0
        }));

        // Sort descending by balance
        leaderboard.sort((a, b) => b.balance - a.balance);

        res.json(leaderboard);
    } catch (error: any) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Error al obtener el ranking de méritos', error: error?.message });
    }
};

/**
 * POST /api/merits/award
 * Manually awards/deducts points for a student (admin/instructor only).
 */
export const awardPoints = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;
    const { student_id, points, description } = req.body;

    if (!student_id || points === undefined || !description) {
        return res.status(400).json({ message: 'student_id, points y description son requeridos' });
    }

    try {
        const { data, error } = await adminClient
            .from('merit_transactions')
            .insert([{
                student_id,
                points: Number(points),
                transaction_type: 'manual',
                description,
                created_by: userId
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error: any) {
        console.error('Error manually awarding points:', error);
        res.status(500).json({ message: 'Error al asignar puntos manualmente', error: error?.message });
    }
};

/**
 * GET /api/merits/rewards
 * Returns a list of active rewards available for student redemption.
 */
export const getRewards = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    try {
        let query = adminClient
            .from('rewards')
            .select('*')
            .eq('is_active', true)
            .order('points_required', { ascending: true });

        if (branchId) {
            query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json(data || []);
    } catch (error: any) {
        console.error('Error fetching rewards:', error);
        res.status(500).json({ message: 'Error al obtener las recompensas', error: error?.message });
    }
};

/**
 * POST /api/merits/rewards
 * Admin creates a new reward.
 */
export const createReward = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    const { title, description, points_required, stock, image_url } = req.body;

    if (!title || !points_required) {
        return res.status(400).json({ message: 'title y points_required son requeridos' });
    }

    try {
        const { data, error } = await adminClient
            .from('rewards')
            .insert([{
                title,
                description: description || null,
                points_required: Number(points_required),
                stock: stock !== undefined && stock !== '' && stock !== null ? Number(stock) : null,
                image_url: image_url || null,
                branch_id: branchId || null
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error: any) {
        console.error('Error creating reward:', error);
        res.status(500).json({ message: 'Error al crear recompensa', error: error?.message });
    }
};

/**
 * PUT /api/merits/rewards/:id
 * Admin updates a reward.
 */
export const updateReward = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, description, points_required, stock, image_url, is_active } = req.body;

    try {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (points_required !== undefined) updateData.points_required = Number(points_required);
        if (stock !== undefined) updateData.stock = stock !== '' && stock !== null ? Number(stock) : null;
        if (image_url !== undefined) updateData.image_url = image_url;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await adminClient
            .from('rewards')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        console.error('Error updating reward:', error);
        res.status(500).json({ message: 'Error al actualizar recompensa', error: error?.message });
    }
};

/**
 * DELETE /api/merits/rewards/:id
 * Admin deletes a reward.
 */
export const deleteReward = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const { error } = await adminClient
            .from('rewards')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Recompensa eliminada exitosamente' });
    } catch (error: any) {
        console.error('Error deleting reward:', error);
        res.status(500).json({ message: 'Error al eliminar recompensa', error: error?.message });
    }
};

/**
 * POST /api/merits/rewards/:id/claim
 * Student claims/redeems a reward.
 */
export const claimReward = async (req: Request, res: Response) => {
    const { id } = req.params; // reward_id
    const userId = req.currentUser?.id;

    try {
        // 1. Resolve student record linked to current user
        const { data: student, error: studentError } = await adminClient
            .from('students')
            .select('id, full_name')
            .eq('user_id', userId)
            .maybeSingle();

        if (studentError) throw studentError;
        if (!student) {
            return res.status(403).json({ message: 'El usuario actual no está vinculado a ningún estudiante' });
        }

        const studentId = student.id;

        // 2. Fetch reward details
        const { data: reward, error: rewardError } = await adminClient
            .from('rewards')
            .select('*')
            .eq('id', id)
            .single();

        if (rewardError || !reward) {
            return res.status(404).json({ message: 'Recompensa no encontrada' });
        }

        if (!reward.is_active) {
            return res.status(400).json({ message: 'Esta recompensa no está activa actualmente' });
        }

        // Check stock if limited
        if (reward.stock !== null && reward.stock <= 0) {
            return res.status(400).json({ message: 'Esta recompensa está agotada' });
        }

        // 3. Verify student has enough points
        const { data: txs, error: txsError } = await adminClient
            .from('merit_transactions')
            .select('points')
            .eq('student_id', studentId);

        if (txsError) throw txsError;

        const currentPoints = txs?.reduce((acc: number, item: any) => acc + item.points, 0) || 0;

        if (currentPoints < reward.points_required) {
            return res.status(400).json({ 
                message: `Puntos insuficientes. Requiere ${reward.points_required} puntos, pero tienes ${currentPoints}.` 
            });
        }

        // 4. Create merit transaction for points deduction (negative points)
        const { error: insertError } = await adminClient
            .from('merit_transactions')
            .insert([{
                student_id: studentId,
                points: -reward.points_required,
                transaction_type: 'claim',
                status: 'pending',
                description: `Canje de Premio: ${reward.title}`,
                reference_id: reward.id,
                created_by: userId
            }]);

        if (insertError) throw insertError;

        // 5. Decrement reward stock if not unlimited
        if (reward.stock !== null) {
            const { error: stockError } = await adminClient
                .from('rewards')
                .update({ stock: reward.stock - 1, updated_at: new Date().toISOString() })
                .eq('id', reward.id);

            if (stockError) {
                console.error('Warning: Failed to decrement reward stock:', stockError);
            }
        }

        res.json({ message: '¡Premio reclamado con éxito! Tu tutor o administrador te entregará tu recompensa.' });
    } catch (error: any) {
        console.error('Error claiming reward:', error);
        res.status(500).json({ message: 'Error al reclamar la recompensa', error: error?.message });
    }
};

/**
 * GET /api/merits/claims
 * Returns all reward claims made by students with related student & reward details.
 */
export const getClaims = async (req: Request, res: Response) => {
    try {
        const { data: claims, error: claimsError } = await adminClient
            .from('merit_transactions')
            .select('*')
            .eq('transaction_type', 'claim')
            .order('created_at', { ascending: false });

        if (claimsError) throw claimsError;

        if (!claims || claims.length === 0) {
            return res.json([]);
        }

        // Fetch students
        const studentIds = Array.from(new Set(claims.map((c: any) => c.student_id).filter(Boolean)));
        const { data: students } = await adminClient
            .from('students')
            .select('id, full_name, personal_code, academy_code')
            .in('id', studentIds);
        const studentMap = new Map((students || []).map((s: any) => [s.id, s]));

        // Fetch rewards
        const rewardIds = Array.from(new Set(claims.map((c: any) => c.reference_id).filter(Boolean)));
        let rewardMap = new Map();
        if (rewardIds.length > 0) {
            const { data: rewards } = await adminClient
                .from('rewards')
                .select('id, title, image_url, points_required')
                .in('id', rewardIds);
            rewardMap = new Map((rewards || []).map((r: any) => [r.id, r]));
        }

        // Fetch deliverer profiles if any
        const delivererIds = Array.from(new Set(claims.map((c: any) => c.delivered_by).filter(Boolean)));
        let delivererMap = new Map();
        if (delivererIds.length > 0) {
            const { data: profiles } = await adminClient
                .from('profiles')
                .select('id, full_name')
                .in('id', delivererIds);
            delivererMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        }

        const enrichedClaims = claims.map((claim: any) => ({
            ...claim,
            student: studentMap.get(claim.student_id) || null,
            reward: rewardMap.get(claim.reference_id) || null,
            deliverer: claim.delivered_by ? delivererMap.get(claim.delivered_by) : null
        }));

        res.json(enrichedClaims);
    } catch (error: any) {
        console.error('Error fetching claims:', error);
        res.status(500).json({ message: 'Error al obtener las solicitudes de canje', error: error?.message });
    }
};

/**
 * PUT /api/merits/claims/:id/deliver
 * Marks a reward claim as physically delivered.
 */
export const deliverClaim = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.currentUser?.id;

    try {
        const { data, error } = await adminClient
            .from('merit_transactions')
            .update({
                status: 'delivered',
                delivered_at: new Date().toISOString(),
                delivered_by: userId
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ message: 'Premio marcado como entregado con éxito', claim: data });
    } catch (error: any) {
        console.error('Error delivering claim:', error);
        res.status(500).json({ message: 'Error al marcar entrega de premio', error: error?.message });
    }
};

/**
 * PUT /api/merits/claims/:id/cancel
 * Cancels a reward claim, refunds the points to the student, and restores reward stock.
 */
export const cancelClaim = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.currentUser?.id;
    const { reason } = req.body;

    try {
        // 1. Get the original claim transaction
        const { data: claim, error: claimError } = await adminClient
            .from('merit_transactions')
            .select('*')
            .eq('id', id)
            .single();

        if (claimError || !claim) {
            return res.status(404).json({ message: 'Solicitud de canje no encontrada' });
        }

        if (claim.status === 'cancelled') {
            return res.status(400).json({ message: 'Este canje ya ha sido cancelado previamente' });
        }

        // 2. Update claim status to cancelled
        const { error: updateError } = await adminClient
            .from('merit_transactions')
            .update({
                status: 'cancelled',
                delivered_at: null,
                delivered_by: userId
            })
            .eq('id', id);

        if (updateError) throw updateError;

        // 3. Create refund transaction (points was negative, so Math.abs to return positive points)
        const refundPoints = Math.abs(claim.points);
        const { error: refundError } = await adminClient
            .from('merit_transactions')
            .insert([{
                student_id: claim.student_id,
                points: refundPoints,
                transaction_type: 'refund',
                status: 'delivered',
                description: `Reembolso por canje cancelado: ${claim.description}${reason ? ` (${reason})` : ''}`,
                reference_id: claim.id,
                created_by: userId
            }]);

        if (refundError) throw refundError;

        // 4. Restore reward stock if not unlimited
        if (claim.reference_id) {
            const { data: reward } = await adminClient
                .from('rewards')
                .select('id, stock')
                .eq('id', claim.reference_id)
                .maybeSingle();

            if (reward && reward.stock !== null) {
                await adminClient
                    .from('rewards')
                    .update({ stock: reward.stock + 1, updated_at: new Date().toISOString() })
                    .eq('id', reward.id);
            }
        }

        res.json({ message: 'Canje cancelado y puntos reembolsados exitosamente al estudiante' });
    } catch (error: any) {
        console.error('Error cancelling claim:', error);
        res.status(500).json({ message: 'Error al cancelar canje y reembolsar puntos', error: error?.message });
    }
};

/**
 * POST /api/merits/award-bulk
 * Awards points to multiple students at once (by array of student IDs or by course).
 */
export const awardPointsBulk = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;
    const { student_ids, course_id, points, description } = req.body;

    if (!points || !description) {
        return res.status(400).json({ message: 'points y description son requeridos' });
    }

    try {
        let targetStudentIds: string[] = [];

        if (student_ids && Array.isArray(student_ids) && student_ids.length > 0) {
            targetStudentIds = student_ids;
        } else if (course_id) {
            const { data: enrollments, error: enrollError } = await adminClient
                .from('enrollments')
                .select('student_id')
                .eq('course_id', course_id);

            if (enrollError) throw enrollError;
            targetStudentIds = (enrollments || []).map((e: any) => e.student_id).filter(Boolean);
        } else {
            return res.status(400).json({ message: 'Debe especificar student_ids o course_id' });
        }

        if (targetStudentIds.length === 0) {
            return res.status(400).json({ message: 'No se encontraron estudiantes para la asignación' });
        }

        const txRows = targetStudentIds.map(stId => ({
            student_id: stId,
            points: Number(points),
            transaction_type: 'manual',
            status: 'delivered',
            description,
            created_by: userId
        }));

        const { data, error } = await adminClient
            .from('merit_transactions')
            .insert(txRows)
            .select();

        if (error) throw error;

        res.status(201).json({
            message: `¡Puntos asignados exitosamente a ${targetStudentIds.length} estudiante(s)!`,
            count: targetStudentIds.length,
            transactions: data
        });
    } catch (error: any) {
        console.error('Error in bulk points award:', error);
        res.status(500).json({ message: 'Error al asignar puntos masivamente', error: error?.message });
    }
};
