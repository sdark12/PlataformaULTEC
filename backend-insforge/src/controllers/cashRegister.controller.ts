import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';
import { getEffectiveBranchId } from '../utils/branch.utils';
import { broadcastNotification } from '../services/notification.service';

const getDb = (req: Request) => (req as any).dbUserClient || adminClient || client;

/**
 * Normaliza métodos de pago para clasificar entre Efectivo y Otros
 */
const isCashMethod = (method?: string | null): boolean => {
    if (!method) return false;
    const m = method.trim().toLowerCase();
    return m === 'cash' || m === 'efectivo';
};

/**
 * 1. Obtener Turno Activo Actual de la Sede con Cálculo en Vivo
 * GET /api/cash-register/current
 */
export const getCurrentShift = async (req: Request, res: Response) => {
    try {
        const db = getDb(req);
        const branchId = getEffectiveBranchId(req);

        if (!branchId) {
            return res.json({
                active: false,
                requires_branch_selection: true,
                message: 'Por favor seleccione una sede específica para gestionar la caja chica.',
                shift: null,
                payments: [],
                expenses: []
            });
        }

        // Buscar turno en estado 'OPEN'
        const { data: shift, error: shiftError } = await db
            .from('cash_shifts')
            .select('*')
            .eq('branch_id', branchId)
            .eq('status', 'OPEN')
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (shiftError) throw shiftError;

        if (!shift) {
            return res.json({
                active: false,
                requires_branch_selection: false,
                message: 'No hay ningún turno de caja abierto en esta sede.',
                shift: null,
                payments: [],
                expenses: []
            });
        }

        // Obtener datos del usuario que abrió el turno y de la sede
        const [{ data: openedByProfile }, { data: branch }] = await Promise.all([
            db.from('profiles').select('id, full_name, email').eq('id', shift.opened_by).maybeSingle(),
            db.from('branches').select('id, name, address').eq('id', shift.branch_id).maybeSingle()
        ]);

        // Obtener todos los cobros / pagos vinculados a este turno
        const { data: payments, error: paymentsError } = await db
            .from('payments')
            .select(`
                id,
                amount,
                method,
                description,
                payment_type,
                tuition_month,
                payment_date,
                reference_number,
                created_by,
                students (
                    id,
                    full_name,
                    academy_code
                )
            `)
            .eq('cash_shift_id', shift.id)
            .order('payment_date', { ascending: false });

        if (paymentsError) throw paymentsError;

        // Obtener todos los gastos de caja chica de este turno
        const { data: expenses, error: expensesError } = await db
            .from('cash_expenses')
            .select('*')
            .eq('shift_id', shift.id)
            .order('created_at', { ascending: false });

        if (expensesError) throw expensesError;

        // Calcular totales en vivo
        let liveCashInflow = 0;
        let liveOtherInflow = 0;

        (payments || []).forEach((p: any) => {
            const amt = Number(p.amount) || 0;
            if (isCashMethod(p.method)) {
                liveCashInflow += amt;
            } else {
                liveOtherInflow += amt;
            }
        });

        const liveExpensesOutflow = (expenses || []).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
        const openingBalance = Number(shift.opening_balance) || 0;
        const liveExpectedCash = openingBalance + liveCashInflow - liveExpensesOutflow;

        const enrichedShift = {
            ...shift,
            opening_balance: openingBalance,
            cash_inflow: liveCashInflow,
            other_inflow: liveOtherInflow,
            expenses_outflow: liveExpensesOutflow,
            expected_cash: liveExpectedCash,
            opened_by_name: openedByProfile?.full_name || openedByProfile?.email || 'Usuario',
            branch_name: branch?.name || 'Sede'
        };

        return res.json({
            active: true,
            requires_branch_selection: false,
            shift: enrichedShift,
            payments: payments || [],
            expenses: expenses || []
        });

    } catch (error) {
        console.error('Error al obtener turno actual de caja:', error);
        return res.status(500).json({ message: 'Error al consultar el turno actual de caja.' });
    }
};

/**
 * 2. Abrir Nuevo Turno de Caja
 * POST /api/cash-register/open
 */
export const openShift = async (req: Request, res: Response) => {
    try {
        const db = getDb(req);
        const user = req.currentUser;

        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }

        const allowedRoles = ['superadmin', 'admin', 'secretary'];
        if (!allowedRoles.includes(user.role)) {
            return res.status(403).json({ message: 'No tiene permisos para operar la caja chica.' });
        }

        const branchId = user.role === 'superadmin'
            ? (req.body.branch_id || getEffectiveBranchId(req))
            : user.branch_id;

        if (!branchId) {
            return res.status(400).json({ message: 'Debe especificar la sede para la cual se abrirá la caja chica.' });
        }

        // Verificar que no haya un turno ya abierto para esta sede
        const { data: activeShift, error: checkError } = await db
            .from('cash_shifts')
            .select('id, opened_at')
            .eq('branch_id', branchId)
            .eq('status', 'OPEN')
            .limit(1)
            .maybeSingle();

        if (checkError) throw checkError;

        if (activeShift) {
            return res.status(400).json({
                message: 'Ya existe un turno de caja abierto en esta sede. Debe realizar el arqueo y cierre del turno actual antes de abrir uno nuevo.',
                activeShiftId: activeShift.id
            });
        }

        const openingBalance = Math.max(0, Number(req.body.opening_balance) || 0);
        const openingNotes = req.body.opening_notes ? String(req.body.opening_notes).trim() : null;

        const { data: newShift, error: insertError } = await db
            .from('cash_shifts')
            .insert([{
                branch_id: branchId,
                opened_by: user.id,
                opening_balance: openingBalance,
                cash_inflow: 0.00,
                other_inflow: 0.00,
                expenses_outflow: 0.00,
                expected_cash: openingBalance,
                status: 'OPEN',
                opening_notes: openingNotes,
                opened_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (insertError) throw insertError;

        // Notificación de auditoría institucional
        try {
            await broadcastNotification(
                db,
                branchId,
                'Apertura de Caja Chica',
                `Se ha abierto un nuevo turno de caja con fondo inicial de Q${openingBalance.toFixed(2)}.`,
                'SYSTEM'
            );
        } catch (e) {
            console.error('Error enviando notificación de apertura:', e);
        }

        return res.status(201).json({
            message: 'Turno de caja abierto exitosamente.',
            shift: newShift
        });

    } catch (error) {
        console.error('Error al abrir turno de caja:', error);
        return res.status(500).json({ message: 'Error interno al abrir turno de caja.' });
    }
};

/**
 * 3. Registrar Gasto Menor / Egreso de Caja Chica
 * POST /api/cash-register/expense
 */
export const recordExpense = async (req: Request, res: Response) => {
    try {
        const db = getDb(req);
        const user = req.currentUser;

        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }

        const { description, amount, category = 'supplies', receipt_number, receipt_url, shift_id } = req.body;

        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
            return res.status(400).json({ message: 'El monto del gasto debe ser un número mayor a cero.' });
        }

        if (!description || String(description).trim().length < 3) {
            return res.status(400).json({ message: 'Debe ingresar una descripción válida para el gasto.' });
        }

        const branchId = user.role === 'superadmin'
            ? (req.body.branch_id || getEffectiveBranchId(req))
            : user.branch_id;

        // Determinar turno activo
        let targetShift = null;
        if (shift_id) {
            const { data: s } = await db.from('cash_shifts').select('*').eq('id', shift_id).maybeSingle();
            targetShift = s;
        } else if (branchId) {
            const { data: s } = await db.from('cash_shifts').select('*').eq('branch_id', branchId).eq('status', 'OPEN').order('opened_at', { ascending: false }).limit(1).maybeSingle();
            targetShift = s;
        }

        if (!targetShift) {
            return res.status(400).json({ message: 'No se encontró un turno de caja abierto para registrar egresos.' });
        }

        if (targetShift.status !== 'OPEN') {
            return res.status(400).json({ message: 'El turno indicado ya se encuentra cerrado. No se pueden registrar egresos en turnos cerrados.' });
        }

        // Insertar egreso
        const { data: expense, error: expError } = await db
            .from('cash_expenses')
            .insert([{
                branch_id: targetShift.branch_id,
                shift_id: targetShift.id,
                category: category || 'supplies',
                description: String(description).trim(),
                amount: numAmount,
                receipt_number: receipt_number ? String(receipt_number).trim() : null,
                receipt_url: receipt_url ? String(receipt_url).trim() : null,
                created_by: user.id,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (expError) throw expError;

        // Actualizar acumulador en turno
        const newExpensesOutflow = (Number(targetShift.expenses_outflow) || 0) + numAmount;
        const newExpectedCash = (Number(targetShift.opening_balance) || 0) + (Number(targetShift.cash_inflow) || 0) - newExpensesOutflow;

        await db
            .from('cash_shifts')
            .update({
                expenses_outflow: newExpensesOutflow,
                expected_cash: newExpectedCash
            })
            .eq('id', targetShift.id);

        return res.status(201).json({
            message: 'Gasto registrado correctamente en el turno de caja.',
            expense
        });

    } catch (error) {
        console.error('Error al registrar gasto de caja:', error);
        return res.status(500).json({ message: 'Error interno al registrar el gasto de caja chica.' });
    }
};

/**
 * 4. Eliminar Gasto Menor
 * DELETE /api/cash-register/expense/:id
 */
export const deleteExpense = async (req: Request, res: Response) => {
    try {
        const db = getDb(req);
        const { id } = req.params;

        const { data: expense, error: findError } = await db
            .from('cash_expenses')
            .select('*, cash_shifts (status)')
            .eq('id', id)
            .maybeSingle();

        if (findError || !expense) {
            return res.status(404).json({ message: 'Registro de gasto no encontrado.' });
        }

        if (expense.cash_shifts?.status !== 'OPEN') {
            return res.status(400).json({ message: 'No se pueden eliminar gastos de un turno que ya ha sido cerrado.' });
        }

        const { error: deleteError } = await db.from('cash_expenses').delete().eq('id', id);
        if (deleteError) throw deleteError;

        // Recalcular expenses_outflow
        const { data: remainingExpenses } = await db
            .from('cash_expenses')
            .select('amount')
            .eq('shift_id', expense.shift_id);

        const newOutflow = (remainingExpenses || []).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
        await db.from('cash_shifts').update({ expenses_outflow: newOutflow }).eq('id', expense.shift_id);

        return res.json({ message: 'Gasto eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar gasto:', error);
        return res.status(500).json({ message: 'Error al eliminar el gasto de caja chica.' });
    }
};

/**
 * 5. Realizar Arqueo y Cerrar Turno de Caja
 * POST /api/cash-register/close
 */
export const closeShift = async (req: Request, res: Response) => {
    try {
        const db = getDb(req);
        const user = req.currentUser;

        if (!user) {
            return res.status(401).json({ message: 'Usuario no autenticado.' });
        }

        const { shift_id, actual_cash, closing_notes } = req.body;

        if (actual_cash === undefined || actual_cash === null || isNaN(Number(actual_cash))) {
            return res.status(400).json({ message: 'Debe ingresar el monto físico real contado en efectivo (Gaveta).' });
        }

        const countedCash = Math.max(0, Number(actual_cash));
        const branchId = user.role === 'superadmin'
            ? (req.body.branch_id || getEffectiveBranchId(req))
            : user.branch_id;

        // Encontrar el turno abierto
        let targetShift = null;
        if (shift_id) {
            const { data: s } = await db.from('cash_shifts').select('*').eq('id', shift_id).maybeSingle();
            targetShift = s;
        } else if (branchId) {
            const { data: s } = await db.from('cash_shifts').select('*').eq('branch_id', branchId).eq('status', 'OPEN').order('opened_at', { ascending: false }).limit(1).maybeSingle();
            targetShift = s;
        }

        if (!targetShift) {
            return res.status(404).json({ message: 'No se encontró un turno de caja abierto para cerrar.' });
        }

        if (targetShift.status !== 'OPEN') {
            return res.status(400).json({ message: 'El turno indicado ya se encuentra cerrado.' });
        }

        // Consultar pagos reales vinculados a este turno
        const { data: payments } = await db
            .from('payments')
            .select('amount, method')
            .eq('cash_shift_id', targetShift.id);

        // Consultar gastos reales vinculados a este turno
        const { data: expenses } = await db
            .from('cash_expenses')
            .select('amount')
            .eq('shift_id', targetShift.id);

        let finalCashInflow = 0;
        let finalOtherInflow = 0;

        (payments || []).forEach((p: any) => {
            const amt = Number(p.amount) || 0;
            if (isCashMethod(p.method)) {
                finalCashInflow += amt;
            } else {
                finalOtherInflow += amt;
            }
        });

        const finalExpensesOutflow = (expenses || []).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
        const openingBalance = Number(targetShift.opening_balance) || 0;
        const expectedCash = openingBalance + finalCashInflow - finalExpensesOutflow;
        const difference = countedCash - expectedCash; // >0: Sobrante, <0: Faltante, 0: Exacto

        const { data: closedShift, error: updateError } = await db
            .from('cash_shifts')
            .update({
                closed_by: user.id,
                closed_at: new Date().toISOString(),
                cash_inflow: finalCashInflow,
                other_inflow: finalOtherInflow,
                expenses_outflow: finalExpensesOutflow,
                expected_cash: expectedCash,
                actual_cash: countedCash,
                difference: difference,
                closing_notes: closing_notes ? String(closing_notes).trim() : null,
                status: 'CLOSED'
            })
            .eq('id', targetShift.id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Notificación de cierre
        try {
            const diffSign = difference === 0 ? 'Exacto' : difference > 0 ? `Sobrante: +Q${difference.toFixed(2)}` : `Faltante: -Q${Math.abs(difference).toFixed(2)}`;
            await broadcastNotification(
                db,
                targetShift.branch_id,
                'Cierre y Arqueo de Caja',
                `Turno cerrado. Efectivo contado: Q${countedCash.toFixed(2)}. ${diffSign}.`,
                'SYSTEM'
            );
        } catch (e) {
            console.error('Error enviando notificación de cierre:', e);
        }

        return res.json({
            message: 'Turno de caja cerrado y arqueado exitosamente.',
            shift: closedShift,
            summary: {
                opening_balance: openingBalance,
                cash_inflow: finalCashInflow,
                other_inflow: finalOtherInflow,
                expenses_outflow: finalExpensesOutflow,
                expected_cash: expectedCash,
                actual_cash: countedCash,
                difference: difference
            }
        });

    } catch (error) {
        console.error('Error al cerrar turno de caja:', error);
        return res.status(500).json({ message: 'Error interno al procesar el cierre de caja.' });
    }
};

/**
 * 6. Historial de Turnos Cerrados
 * GET /api/cash-register/history
 */
export const getShiftsHistory = async (req: Request, res: Response) => {
    try {
        const db = getDb(req);
        const branchId = getEffectiveBranchId(req);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

        let query = db
            .from('cash_shifts')
            .select('*')
            .order('opened_at', { ascending: false })
            .limit(limit);

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data: shifts, error } = await query;
        if (error) throw error;

        if (!shifts || shifts.length === 0) {
            return res.json([]);
        }

        // Recolectar IDs de usuarios y sedes para enriquecer la respuesta
        const userIds = Array.from(new Set(shifts.flatMap((s: any) => [s.opened_by, s.closed_by]).filter(Boolean)));
        const branchIds = Array.from(new Set(shifts.map((s: any) => s.branch_id).filter(Boolean)));

        const [{ data: profiles }, { data: branches }] = await Promise.all([
            userIds.length > 0 ? db.from('profiles').select('id, full_name, email').in('id', userIds) : Promise.resolve({ data: [] }),
            branchIds.length > 0 ? db.from('branches').select('id, name').in('id', branchIds) : Promise.resolve({ data: [] })
        ]);

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || p.email]));
        const branchMap = new Map((branches || []).map((b: any) => [b.id, b.name]));

        const enrichedHistory = shifts.map((s: any) => ({
            ...s,
            opened_by_name: profileMap.get(s.opened_by) || 'Usuario',
            closed_by_name: s.closed_by ? (profileMap.get(s.closed_by) || 'Usuario') : null,
            branch_name: branchMap.get(s.branch_id) || 'Sede'
        }));

        return res.json(enrichedHistory);

    } catch (error) {
        console.error('Error al obtener historial de turnos:', error);
        return res.status(500).json({ message: 'Error al consultar historial de caja.' });
    }
};

/**
 * 7. Detalle Completo de un Turno de Caja (Auditoría / Comprobante de Corte)
 * GET /api/cash-register/shifts/:id
 */
export const getShiftDetails = async (req: Request, res: Response) => {
    try {
        const db = getDb(req);
        const { id } = req.params;

        const { data: shift, error: shiftError } = await db
            .from('cash_shifts')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (shiftError || !shift) {
            return res.status(404).json({ message: 'Turno de caja no encontrado.' });
        }

        const [{ data: profiles }, { data: branch }, { data: payments }, { data: expenses }] = await Promise.all([
            db.from('profiles').select('id, full_name, email').in('id', [shift.opened_by, shift.closed_by].filter(Boolean)),
            db.from('branches').select('id, name, address, phone').eq('id', shift.branch_id).maybeSingle(),
            db.from('payments').select(`
                id,
                amount,
                method,
                description,
                payment_type,
                tuition_month,
                payment_date,
                reference_number,
                students (
                    id,
                    full_name,
                    academy_code
                )
            `).eq('cash_shift_id', shift.id).order('payment_date', { ascending: true }),
            db.from('cash_expenses').select('*').eq('shift_id', shift.id).order('created_at', { ascending: true })
        ]);

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name || p.email]));

        return res.json({
            shift: {
                ...shift,
                opened_by_name: profileMap.get(shift.opened_by) || 'Usuario',
                closed_by_name: shift.closed_by ? (profileMap.get(shift.closed_by) || 'Usuario') : null,
                branch_name: branch?.name || 'Sede',
                branch_address: branch?.address || '',
                branch_phone: branch?.phone || ''
            },
            payments: payments || [],
            expenses: expenses || []
        });

    } catch (error) {
        console.error('Error al obtener detalle de turno:', error);
        return res.status(500).json({ message: 'Error al obtener detalle del turno.' });
    }
};

/**
 * 8. Auditar Turno (Admin / SuperAdmin)
 * PATCH /api/cash-register/shifts/:id/audit
 */
export const auditShift = async (req: Request, res: Response) => {
    try {
        const db = getDb(req);
        const user = req.currentUser;

        if (!user || !['admin', 'superadmin'].includes(user.role)) {
            return res.status(403).json({ message: 'Solo directores o administradores pueden visar/auditar turnos de caja.' });
        }

        const { id } = req.params;
        const { audit_notes } = req.body;

        const { data: updated, error } = await db
            .from('cash_shifts')
            .update({
                status: 'AUDITED',
                closing_notes: audit_notes ? `[AUDITADO POR ${user.email}]: ${audit_notes}` : undefined
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({ message: 'Turno de caja auditado y visado correctamente.', shift: updated });
    } catch (error) {
        console.error('Error al auditar turno:', error);
        return res.status(500).json({ message: 'Error al auditar el turno.' });
    }
};
