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
        const { data: student, error: studentError } = await adminClient.database
            .from('students')
            .select('id, full_name, personal_code')
            .or(`id.eq.${student_id},user_id.eq.${student_id}`)
            .maybeSingle();

        if (studentError) throw studentError;
        if (!student) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }

        const actualStudentId = student.id;

        // Fetch transactions
        const { data: transactions, error: txError } = await adminClient.database
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
    try {
        // Fetch all active students (filtered by branch if applicable)
        let studentsQuery = adminClient.database
            .from('students')
            .select('id, full_name, personal_code, branch_id');

        if (branchId) {
            studentsQuery = studentsQuery.eq('branch_id', branchId);
        }

        const { data: students, error: studentError } = await studentsQuery;
        if (studentError) throw studentError;

        // Fetch all transactions
        const { data: transactions, error: txError } = await adminClient.database
            .from('merit_transactions')
            .select('student_id, points');

        if (txError) throw txError;

        // Compute balances
        const balanceMap = new Map<string, number>();
        transactions?.forEach((tx: any) => {
            balanceMap.set(tx.student_id, (balanceMap.get(tx.student_id) || 0) + tx.points);
        });

        const leaderboard = students.map((s: any) => ({
            id: s.id,
            full_name: s.full_name,
            personal_code: s.personal_code,
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
        const { data, error } = await adminClient.database
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
        let query = adminClient.database
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
        const { data, error } = await adminClient.database
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

        const { data, error } = await adminClient.database
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
        const { error } = await adminClient.database
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
        const { data: student, error: studentError } = await adminClient.database
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
        const { data: reward, error: rewardError } = await adminClient.database
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
        const { data: txs, error: txsError } = await adminClient.database
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
        const { error: insertError } = await adminClient.database
            .from('merit_transactions')
            .insert([{
                student_id: studentId,
                points: -reward.points_required,
                transaction_type: 'claim',
                description: `Canje de Premio: ${reward.title}`,
                reference_id: reward.id,
                created_by: userId
            }]);

        if (insertError) throw insertError;

        // 5. Decrement reward stock if not unlimited
        if (reward.stock !== null) {
            const { error: stockError } = await adminClient.database
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
