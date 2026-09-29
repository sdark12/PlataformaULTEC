import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';
import { broadcastNotification } from '../services/notification.service';
import { sendPaymentConfirmationEmail } from '../services/email.service';
import { getTodayDateRangeGuatemala } from './reports.controller';
import { getEffectiveBranchId } from '../utils/branch.utils';

// Get Payments
export const getPayments = async (req: Request, res: Response) => {
    const branchId = getEffectiveBranchId(req);
    const userRole = req.currentUser?.role;
    const userId = req.currentUser?.id;
    const isSecretary = userRole === 'secretary';
    const db = (req as any).dbUserClient || adminClient || client;
    try {
        // Resource embedding for joins. Payment linked to student_id and optional enrollment_id
        let query = db
            .from('payments')
            .select(`
                id,
                amount,
                payment_date,
                method,
                reference_number,
                description,
                tuition_month,
                payment_type,
                discount,
                student_id,
                enrollment_id,
                created_by,
                students (
                    id,
                    full_name,
                    branch_id
                ),
                enrollments (
                    id,
                    course_id,
                    courses (
                        id,
                        name
                    )
                )
            `)
            .order('payment_date', { ascending: false });

        if (branchId) {
            query = query.eq('students.branch_id', branchId);
        }

        if (isSecretary) {
            // Seguridad: la secretaria solo ve los cobros realizados por ella HOY en su turno
            const { startIso, endIso } = getTodayDateRangeGuatemala();
            query = query.gte('payment_date', startIso).lte('payment_date', endIso);
            if (userId) {
                query = query.eq('created_by', userId);
            }
        }

        const { data, error } = await query;

        if (error) throw error;

        const flatData = data.map((p: any) => {
            const courseRealName = p.enrollments?.courses?.name;
            return {
                id: p.id,
                student_id: p.student_id,
                enrollment_id: p.enrollment_id,
                student_name: p.students?.full_name || 'Estudiante',
                course_name: courseRealName || (p.enrollment_id ? 'Curso' : (p.description || 'General')),
                amount: p.amount,
                payment_date: p.payment_date,
                method: p.method,
                reference_number: p.reference_number,
                description: p.description,
                tuition_month: p.tuition_month,
                payment_type: p.payment_type || 'TUITION',
                discount: p.discount || 0
            };
        });

        res.json(flatData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving payments' });
    }
};

// Register Payment
export const createPayment = async (req: Request, res: Response) => {
    const { student_id, enrollment_id, enrollment_ids, amount, method, reference_number, description, tuition_month, payment_type = 'TUITION', discount = 0, courses, branch_id } = req.body;
    const user = req.currentUser;
    const userId = user?.id;
    let finalBranchId = user?.role === 'superadmin'
        ? (branch_id || getEffectiveBranchId(req))
        : (user?.branch_id || null);
    const db = (req as any).dbUserClient || adminClient || client;

    try {
        console.log("PAYMENT POST REQUEST BODY:", req.body);

        if (!student_id) {
            return res.status(400).json({ message: 'Se requiere el student_id para unificar recibos.' });
        }

        // Si la sede no está definida, obtenerla del perfil del estudiante
        if (!finalBranchId && student_id) {
            const { data: stdBranch } = await db.from('students').select('branch_id').eq('id', student_id).maybeSingle();
            if (stdBranch?.branch_id) {
                finalBranchId = stdBranch.branch_id;
            }
        }

        // Buscar si existe un turno de caja abierto en la sede para asociar el cobro
        let activeCashShiftId: string | null = null;
        if (finalBranchId) {
            const { data: openShift } = await db
                .from('cash_shifts')
                .select('id')
                .eq('branch_id', finalBranchId)
                .eq('status', 'OPEN')
                .order('opened_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (openShift) {
                activeCashShiftId = openShift.id;
            }
        }

        // Determinar la lista de cursos a procesar (nueva estructura vs antigua)
        let targetCourses: any[] = [];

        if (courses && courses.length > 0) {
            targetCourses = courses;
        } else if (enrollment_ids && enrollment_ids.length > 0) {
            // Retrocompatibilidad
            targetCourses = enrollment_ids.map((id: string) => ({ enrollment_id: id, amount: amount / enrollment_ids.length, discount: discount / enrollment_ids.length }));
        } else if (enrollment_id) {
            targetCourses = [{ enrollment_id, amount, discount }];
        }

        const totalAmount = targetCourses.reduce((sum, c) => sum + Number(c.amount), 0);
        let firstPaymentRecord = null;

        // 1 & 2. Insertar Pago y Actualizar Estado Financiero por CADA curso
        for (const course of targetCourses) {
            const { data: payment, error: paymentError } = await db
                .from('payments')
                .insert([{
                    student_id,
                    enrollment_id: course.enrollment_id,
                    amount: course.amount,
                    method,
                    reference_number,
                    description: course.payment_description || description || (payment_type === 'TUITION' ? (tuition_month ? `Colegiatura de ${tuition_month}` : `Colegiatura`) : payment_type),
                    tuition_month: payment_type === 'TUITION' ? tuition_month : null,
                    payment_type,
                    discount: course.discount || 0,
                    created_by: userId,
                    cash_shift_id: activeCashShiftId
                }])
                .select()
                .single();

            if (paymentError) throw paymentError;
            if (!firstPaymentRecord) firstPaymentRecord = payment;

            // Update Financial Status
            if (payment_type === 'TUITION') {
                const { data: pendingList, error: pendingError } = await db
                    .from('financial_status')
                    .select('id, amount_due, amount_paid')
                    .eq('enrollment_id', course.enrollment_id)
                    .eq('status', 'PENDING')
                    .order('month', { ascending: true })
                    .limit(1);

                if (!pendingError && pendingList && pendingList.length > 0) {
                    const fs = pendingList[0];
                    const newPaid = Number(fs.amount_due);
                    const newStatus = 'PAID';

                    await db
                        .from('financial_status')
                        .update({ amount_paid: newPaid, status: newStatus })
                        .eq('id', fs.id);
                }
            }
        }

        // Si no se pasaron cursos pero sí un monto global (pago general)
        if (targetCourses.length === 0) {
            const { data: payment, error: paymentError } = await db
                .from('payments')
                .insert([{
                    student_id,
                    enrollment_id: null,
                    amount: totalAmount || amount,
                    method,
                    reference_number,
                    description: description || `Pago General`,
                    tuition_month: payment_type === 'TUITION' ? tuition_month : null,
                    payment_type,
                    discount: discount || 0,
                    created_by: userId,
                    cash_shift_id: activeCashShiftId
                }])
                .select()
                .single();

            if (paymentError) throw paymentError;
            firstPaymentRecord = payment;
        }

        // Actualizar acumulados del turno de caja activo si aplica
        if (activeCashShiftId) {
            const isCash = String(method || '').trim().toLowerCase() === 'cash' || String(method || '').trim().toLowerCase() === 'efectivo';
            const grandTotal = totalAmount || amount || 0;
            const { data: curShift } = await db.from('cash_shifts').select('opening_balance, cash_inflow, other_inflow, expenses_outflow').eq('id', activeCashShiftId).maybeSingle();
            if (curShift) {
                const newCashInflow = (Number(curShift.cash_inflow) || 0) + (isCash ? Number(grandTotal) : 0);
                const newOtherInflow = (Number(curShift.other_inflow) || 0) + (!isCash ? Number(grandTotal) : 0);
                const openBal = Number(curShift.opening_balance) || 0;
                const expOut = Number(curShift.expenses_outflow) || 0;
                await db.from('cash_shifts').update({
                    cash_inflow: newCashInflow,
                    other_inflow: newOtherInflow,
                    expected_cash: openBal + newCashInflow - expOut
                }).eq('id', activeCashShiftId);
            }
        }


        // 3. Automatically Create ONE Unified Invoice
        let invoiceId = null;
        let invoiceNumberStr = null;
        try {
            // Generate Invoice Number
            let invoiceNumber = `REC-${Date.now()}`;
            const { data: seqData } = await db
                .from('invoice_sequences')
                .select('series, current_number')
                .eq('branch_id', finalBranchId)
                .maybeSingle();

            if (seqData) {
                const nextNum = seqData.current_number + 1;
                await db
                    .from('invoice_sequences')
                    .update({ current_number: nextNum })
                    .eq('branch_id', finalBranchId);
                invoiceNumber = `${seqData.series}-${String(userId).slice(0, 4)}-${nextNum.toString().padStart(6, '0')}`;
            }

            const actTotal = totalAmount || amount;
            console.log('Creating invoice for student_id:', student_id, 'Total:', actTotal);

            // Create Invoice attached to student
            const { data: invoice, error: invoiceError } = await db
                .from('invoices')
                .insert([{
                    branch_id: finalBranchId,
                    student_id,
                    invoice_number: invoiceNumber,
                    total_amount: actTotal,
                    created_by: userId
                }])
                .select()
                .single();

            if (!invoiceError && invoice) {
                invoiceId = invoice.id;
                invoiceNumberStr = invoice.invoice_number;

                const itemsToInsert = [];

                if (targetCourses.length > 0) {
                    for (const course of targetCourses) {
                        const courseDesc = course.payment_description || (payment_type === 'TUITION' ? (tuition_month ? `Colegiatura de ${tuition_month}` : `Pago de Curso`) : payment_type);
                        itemsToInsert.push({
                            invoice_id: invoiceId,
                            description: courseDesc,
                            quantity: 1,
                            unit_price: course.amount,
                            total_price: course.amount
                        });
                    }
                } else {
                    const itemDescription = payment_type === 'TUITION'
                        ? (tuition_month ? `Colegiatura de ${tuition_month}` : `Pago de Cursos`)
                        : payment_type === 'ENROLLMENT' ? 'Inscripción'
                            : payment_type === 'UNIFORM' ? 'Uniforme'
                                : payment_type === 'MATERIALS' ? 'Materiales'
                                    : description || 'Pago Consolidado';

                    itemsToInsert.push({
                        invoice_id: invoiceId,
                        description: itemDescription,
                        quantity: 1,
                        unit_price: actTotal,
                        total_price: actTotal
                    });
                }

                if (itemsToInsert.length > 0) {
                    const { error: invoiceItemError } = await db
                        .from('invoice_items')
                        .insert(itemsToInsert);

                    if (invoiceItemError) {
                        console.error('Error inserting invoice items:', invoiceItemError);
                    } else {
                        console.log('Successfully inserted invoice items:', itemsToInsert.length);
                    }
                }
            } else {
                console.error('Failed to create invoice record:', invoiceError);
            }
        } catch (invoiceErr) {
            console.error('Failed to auto-create invoice', invoiceErr);
        }

        res.status(201).json({ ...firstPaymentRecord, invoice_id: invoiceId, invoice_number: invoiceNumberStr });

        // Retrieve Student Email to auto-send the receipt
        try {
            const { data: studentInfo } = await db
                .from('students')
                .select('full_name, guardian_email, user_id')
                .eq('id', student_id)
                .single();

            if (studentInfo) {
                let targetEmail = studentInfo.guardian_email;
                if (studentInfo.user_id) {
                    const { data: profileInfo } = await db
                        .from('profiles')
                        .select('email')
                        .eq('id', studentInfo.user_id)
                        .maybeSingle();

                    if (profileInfo?.email) {
                        targetEmail = profileInfo.email;
                    }
                }

                if (targetEmail) {
                    sendPaymentConfirmationEmail(
                        targetEmail,
                        studentInfo.full_name,
                        totalAmount || amount,
                        invoiceNumberStr || 'REC-PENDING',
                        description || 'Pago Consolidado'
                    );
                }
            }
        } catch (emailErr) {
            console.error('Failed to dispatch payment receipt email:', emailErr);
        }

        await broadcastNotification(
            db,
            finalBranchId || 0,
            'Nuevo Pago',
            `Se ha registrado un nuevo pago unificado por Q.${totalAmount || amount}`,
            'PAYMENT'
        );
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error registering payment' });
    }
};

export const updatePayment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { amount, method, reference_number, description, tuition_month, payment_type, discount } = req.body;
    const db = (req as any).dbUserClient || adminClient || client;
    const branchId = req.currentUser?.branch_id;

    try {
        if (branchId) {
            const { data: payCheck } = await db.from('payments').select('students (branch_id)').eq('id', id).maybeSingle();
            if (!payCheck || payCheck.students?.branch_id !== branchId) {
                return res.status(403).json({ message: 'Forbidden: Payment does not belong to your branch.' });
            }
        }

        const { data, error } = await db
            .from('payments')
            .update({
                amount,
                method,
                reference_number,
                description,
                tuition_month: payment_type === 'TUITION' ? tuition_month : null,
                payment_type,
                discount
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating payment' });
    }
};

export const deletePayment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const db = (req as any).dbUserClient || adminClient || client;
    const branchId = req.currentUser?.branch_id;

    try {
        let paymentToAdjust: any = null;
        if (branchId) {
            const { data: payCheck } = await db.from('payments').select('id, amount, method, cash_shift_id, students (branch_id)').eq('id', id).maybeSingle();
            if (!payCheck || payCheck.students?.branch_id !== branchId) {
                return res.status(403).json({ message: 'Forbidden: Payment does not belong to your branch.' });
            }
            paymentToAdjust = payCheck;
        } else {
            const { data: payCheck } = await db.from('payments').select('id, amount, method, cash_shift_id').eq('id', id).maybeSingle();
            paymentToAdjust = payCheck;
        }

        const { error } = await db
            .from('payments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Si el pago estaba vinculado a un turno de caja, descontar de los acumulados
        if (paymentToAdjust?.cash_shift_id) {
            const isCash = String(paymentToAdjust.method || '').trim().toLowerCase() === 'cash' || String(paymentToAdjust.method || '').trim().toLowerCase() === 'efectivo';
            const amt = Number(paymentToAdjust.amount) || 0;
            const { data: curShift } = await db.from('cash_shifts').select('opening_balance, cash_inflow, other_inflow, expenses_outflow').eq('id', paymentToAdjust.cash_shift_id).maybeSingle();
            if (curShift) {
                const newCashInflow = Math.max(0, (Number(curShift.cash_inflow) || 0) - (isCash ? amt : 0));
                const newOtherInflow = Math.max(0, (Number(curShift.other_inflow) || 0) - (!isCash ? amt : 0));
                const openBal = Number(curShift.opening_balance) || 0;
                const expOut = Number(curShift.expenses_outflow) || 0;
                await db.from('cash_shifts').update({
                    cash_inflow: newCashInflow,
                    other_inflow: newOtherInflow,
                    expected_cash: openBal + newCashInflow - expOut
                }).eq('id', paymentToAdjust.cash_shift_id);
            }
        }

        if (branchId) {
            await broadcastNotification(
                db,
                branchId,
                'Pago Eliminado',
                `Se ha eliminado el registro de un pago del sistema.`,
                'DELETE'
            );
        }

        res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting payment' });
    }
};

// Get Full Financial Statement for a Single Student
export const getStudentStatement = async (req: Request, res: Response) => {
    const { studentId } = req.params;
    const branchId = req.currentUser?.branch_id;
    const db = (req as any).dbUserClient || adminClient || client;
    const currentDate = new Date();

    try {
        // 1. Fetch student info
        const { data: student, error: studentError } = await db
            .from('students')
            .select(`
                id,
                full_name,
                personal_code,
                identification_document,
                phone,
                guardian_name,
                guardian_phone,
                guardian_email,
                branch_id,
                branches (name)
            `)
            .eq('id', studentId)
            .single();

        if (studentError || !student) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }

        if (branchId && student.branch_id !== branchId) {
            return res.status(403).json({ message: 'No tiene permiso para ver el estado de cuenta de este estudiante.' });
        }

        // 2. Fetch enrollments with course and schedule details
        const { data: enrollments, error: enrollError } = await db
            .from('enrollments')
            .select(`
                id,
                course_id,
                enrollment_date,
                is_active,
                academic_status,
                scholarship_type,
                scholarship_amount,
                scholarship_reason,
                courses (
                    id,
                    name,
                    monthly_fee,
                    duration_months,
                    start_date,
                    end_date
                ),
                course_schedules (
                    id,
                    grade,
                    day_of_week,
                    start_time,
                    end_time
                )
            `)
            .eq('student_id', studentId)
            .order('enrollment_date', { ascending: false });

        if (enrollError) throw enrollError;

        const enrollmentIds = (enrollments || []).map((e: any) => e.id);

        // 3. Fetch all payments for this student
        let payQuery = db
            .from('payments')
            .select(`
                id,
                amount,
                discount,
                payment_date,
                method,
                reference_number,
                description,
                tuition_month,
                payment_type,
                enrollment_id,
                student_id,
                enrollments (
                    courses (name)
                )
            `)
            .order('payment_date', { ascending: false });

        if (enrollmentIds.length > 0) {
            payQuery = payQuery.or(`student_id.eq.${studentId},enrollment_id.in.(${enrollmentIds.join(',')})`);
        } else {
            payQuery = payQuery.eq('student_id', studentId);
        }

        const { data: payments, error: paymentsError } = await payQuery;
        if (paymentsError) throw paymentsError;

        // 4. Fetch invoices for this student
        const { data: invoices } = await db
            .from('invoices')
            .select('id, invoice_number, total_amount, created_at')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        // Map payments with course name and invoice details
        const formattedPayments = (payments || []).map((p: any) => {
            const courseName = p.enrollments?.courses?.name || (p.enrollment_id ? 'Curso' : (p.description || 'General'));
            return {
                id: p.id,
                amount: Number(p.amount),
                discount: Number(p.discount || 0),
                payment_date: p.payment_date,
                method: p.method,
                reference_number: p.reference_number,
                description: p.description,
                tuition_month: p.tuition_month,
                payment_type: p.payment_type || 'TUITION',
                enrollment_id: p.enrollment_id,
                course_name: courseName
            };
        });

        // 5. Calculate course-by-course status
        const coursesSummary = (enrollments || []).map((enrollment: any) => {
            const course = enrollment.courses;
            const rawMonthlyFee = Number(course?.monthly_fee || 0);
            const durationMonths = course?.duration_months || 11;
            const baseDate = course?.start_date ? new Date(course.start_date) : new Date(enrollment.enrollment_date);

            // Calculate effective fee considering scholarship
            let effectiveMonthlyFee = rawMonthlyFee;
            if (enrollment.scholarship_type === 'PERCENTAGE' && Number(enrollment.scholarship_amount) > 0) {
                effectiveMonthlyFee = Math.max(0, rawMonthlyFee * (1 - Number(enrollment.scholarship_amount) / 100));
            } else if (enrollment.scholarship_type === 'FIXED_AMOUNT' && Number(enrollment.scholarship_amount) > 0) {
                effectiveMonthlyFee = Math.max(0, rawMonthlyFee - Number(enrollment.scholarship_amount));
            }

            let monthsElapsed = 1;
            if (currentDate > baseDate) {
                const yearsDiff = currentDate.getFullYear() - baseDate.getFullYear();
                const monthsDiff = currentDate.getMonth() - baseDate.getMonth();
                monthsElapsed = Math.max(1, (yearsDiff * 12) + monthsDiff + 1);
            }
            const effectiveMonths = Math.min(monthsElapsed, durationMonths);
            const totalDue = effectiveMonths * effectiveMonthlyFee;

            // Payments for this enrollment (TUITION)
            const enrollmentPayments = formattedPayments.filter(
                (p: any) => p.enrollment_id === enrollment.id && p.payment_type === 'TUITION'
            );
            const totalPaid = enrollmentPayments.reduce((sum: number, p: any) => sum + p.amount + p.discount, 0);
            const pendingAmount = Math.max(0, totalDue - totalPaid);
            const monthsOverdue = effectiveMonthlyFee > 0 ? Math.ceil(pendingAmount / effectiveMonthlyFee) : 0;
            const monthsPaidCount = effectiveMonthlyFee > 0 ? Math.floor(totalPaid / effectiveMonthlyFee) : 0;

            const schedule = enrollment.course_schedules;
            const scheduleLabel = schedule ? `${schedule.grade || ''} - ${schedule.day_of_week} (${schedule.start_time?.slice(0, 5)} - ${schedule.end_time?.slice(0, 5)})` : null;

            return {
                enrollment_id: enrollment.id,
                course_id: course?.id,
                course_name: course?.name,
                monthly_fee: rawMonthlyFee,
                effective_monthly_fee: effectiveMonthlyFee,
                scholarship_type: enrollment.scholarship_type || 'NONE',
                scholarship_amount: Number(enrollment.scholarship_amount || 0),
                scholarship_reason: enrollment.scholarship_reason || null,
                duration_months: durationMonths,
                start_date: course?.start_date,
                enrollment_date: enrollment.enrollment_date,
                is_active: enrollment.is_active,
                academic_status: enrollment.academic_status,
                schedule_label: scheduleLabel,
                months_elapsed: effectiveMonths,
                months_paid: monthsPaidCount,
                months_pending: monthsOverdue,
                total_due: totalDue,
                total_paid: totalPaid,
                pending_amount: pendingAmount,
                is_solvent: pendingAmount <= 0
            };
        });

        // 6. Global summary
        const totalPaidAll = formattedPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
        const totalDiscountAll = formattedPayments.reduce((sum: number, p: any) => sum + p.discount, 0);
        const totalPendingAll = coursesSummary
            .filter((c: any) => c.is_active)
            .reduce((sum: number, c: any) => sum + c.pending_amount, 0);

        const totalActiveCourses = coursesSummary.filter((c: any) => c.is_active).length;

        res.json({
            student: {
                ...student,
                branch_name: student.branches?.name || 'Sede Principal'
            },
            summary: {
                total_paid: totalPaidAll,
                total_discount: totalDiscountAll,
                total_pending: totalPendingAll,
                is_solvent: totalPendingAll <= 0,
                active_courses_count: totalActiveCourses,
                total_payments_count: formattedPayments.length
            },
            courses: coursesSummary,
            payments: formattedPayments,
            invoices: invoices || []
        });

    } catch (error) {
        console.error('Error in getStudentStatement:', error);
        res.status(500).json({ message: 'Error al generar el estado de cuenta del estudiante.' });
    }
};

// Bulk Group Tuition Payments
export const createBulkGroupPayment = async (req: Request, res: Response) => {
    const { course_id, tuition_month, payment_date, method = 'CASH', reference_prefix = '', branch_id, payments } = req.body;
    const userId = req.currentUser?.id;
    const finalBranchId = branch_id || req.currentUser?.branch_id;
    const db = (req as any).dbUserClient || adminClient || client;

    if (!payments || !Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ message: 'Debe incluir al menos un estudiante para procesar el cobro.' });
    }

    try {
        // Fetch course details
        const { data: courseData } = await db
            .from('courses')
            .select('name, monthly_fee')
            .eq('id', course_id)
            .maybeSingle();

        const courseName = courseData?.name || 'Curso';
        const formattedMonth = tuition_month ? (() => {
            const d = new Date(tuition_month + '-01T00:00:00');
            return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^./, (str) => str.toUpperCase());
        })() : '';

        // Fetch invoice sequence for branch
        let currentSeq = 1000;
        let series = 'REC';
        const { data: seqData } = await db
            .from('invoice_sequences')
            .select('series, current_number')
            .eq('branch_id', finalBranchId)
            .maybeSingle();

        if (seqData) {
            series = seqData.series;
            currentSeq = seqData.current_number;
        }

        const processedResults: any[] = [];
        let totalBatchAmount = 0;

        for (const item of payments) {
            const amount = Number(item.amount);
            const discount = Number(item.discount || 0);
            if (amount <= 0 && discount <= 0) continue;

            const studentId = item.student_id;
            const enrollmentId = item.enrollment_id;
            const refNumber = item.reference_number || (reference_prefix ? `${reference_prefix}-${String(studentId).slice(0, 4)}` : '');
            const description = item.notes || `Colegiatura ${formattedMonth} - ${courseName}`;

            // 1. Insert Payment
            const { data: paymentRecord, error: payErr } = await db
                .from('payments')
                .insert([{
                    student_id: studentId,
                    enrollment_id: enrollmentId,
                    amount: amount,
                    discount: discount,
                    method: item.method || method,
                    reference_number: refNumber,
                    description: description,
                    tuition_month: tuition_month,
                    payment_type: 'TUITION',
                    created_by: userId,
                    payment_date: payment_date || new Date().toISOString()
                }])
                .select()
                .single();

            if (payErr) {
                console.error('Error inserting bulk payment for student:', studentId, payErr);
                continue;
            }

            totalBatchAmount += amount;

            // 2. Update financial_status for this specific month
            if (enrollmentId) {
                await db
                    .from('financial_status')
                    .upsert({
                        enrollment_id: enrollmentId,
                        month: tuition_month,
                        amount_due: amount + discount,
                        amount_paid: amount + discount,
                        status: 'PAID',
                        last_updated: new Date().toISOString()
                    }, { onConflict: 'enrollment_id,month' });
            }

            // 3. Create Individual Invoice per student
            currentSeq++;
            const invoiceNumber = `${series}-${String(userId).slice(0, 4)}-${currentSeq.toString().padStart(6, '0')}`;

            const { data: invoice } = await db
                .from('invoices')
                .insert([{
                    branch_id: finalBranchId,
                    student_id: studentId,
                    invoice_number: invoiceNumber,
                    total_amount: amount,
                    created_by: userId
                }])
                .select()
                .single();

            if (invoice) {
                await db
                    .from('invoice_items')
                    .insert([{
                        invoice_id: invoice.id,
                        description: description,
                        quantity: 1,
                        unit_price: amount,
                        total_price: amount
                    }]);
            }

            processedResults.push({
                student_id: studentId,
                payment_id: paymentRecord?.id,
                invoice_id: invoice?.id,
                invoice_number: invoiceNumber,
                amount: amount
            });
        }

        // Update sequence in DB
        if (seqData && currentSeq > seqData.current_number) {
            await db
                .from('invoice_sequences')
                .update({ current_number: currentSeq })
                .eq('branch_id', finalBranchId);
        }

        // Broadcast notification
        await broadcastNotification(
            db,
            finalBranchId || 0,
            'Cobro Masivo Procesado',
            `Se han registrado ${processedResults.length} pagos del curso ${courseName} por un total de Q.${totalBatchAmount}.`,
            'PAYMENT'
        );

        res.status(201).json({
            success: true,
            count: processedResults.length,
            total_amount: totalBatchAmount,
            course_name: courseName,
            tuition_month: tuition_month,
            results: processedResults
        });

    } catch (error) {
        console.error('Error in createBulkGroupPayment:', error);
        res.status(500).json({ message: 'Error procesando el cobro masivo.' });
    }
};

// ==========================================
// 6. SYNC MONTHLY FEES (CONCILIADOR DE CUOTAS)
// ==========================================
export const syncMonthlyFees = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    const db = (req as any).dbUserClient || adminClient || client;
    const { target_month, filter_branch_id } = req.body || {};

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const selectedTargetMonth = target_month || currentMonthStr;

    try {
        // 1. Fetch active enrollments with course details
        let enrollQuery = db
            .from('enrollments')
            .select(`
                id,
                branch_id,
                student_id,
                course_id,
                enrollment_date,
                is_active,
                academic_status,
                scholarship_type,
                scholarship_amount,
                scholarship_reason,
                students (
                    id,
                    full_name,
                    personal_code
                ),
                courses (
                    id,
                    name,
                    monthly_fee,
                    duration_months,
                    start_date,
                    end_date
                )
            `)
            .eq('is_active', true);

        const targetBranch = filter_branch_id || branchId;
        if (targetBranch) {
            enrollQuery = enrollQuery.eq('branch_id', targetBranch);
        }

        const { data: enrollments, error: enrollError } = await enrollQuery;
        if (enrollError) throw enrollError;

        if (!enrollments || enrollments.length === 0) {
            return res.json({
                success: true,
                message: 'No se encontraron inscripciones activas para sincronizar.',
                total_reconciled: 0,
                total_pending: 0,
                total_paid: 0,
                total_partial: 0
            });
        }

        const enrollmentIds = enrollments.map((e: any) => e.id);

        // 2. Fetch all existing payments for these enrollments
        const { data: allPayments, error: payError } = await db
            .from('payments')
            .select('id, enrollment_id, student_id, amount, discount, tuition_month, payment_date, description')
            .in('enrollment_id', enrollmentIds);

        if (payError) throw payError;

        // 3. Fetch all existing financial_status records
        const { data: existingStatuses, error: fsError } = await db
            .from('financial_status')
            .select('id, enrollment_id, month, amount_due, amount_paid, status')
            .in('enrollment_id', enrollmentIds);

        if (fsError) throw fsError;

        const paymentsByEnrollment: Record<string, any[]> = {};
        allPayments?.forEach((p: any) => {
            if (!paymentsByEnrollment[p.enrollment_id]) paymentsByEnrollment[p.enrollment_id] = [];
            paymentsByEnrollment[p.enrollment_id].push(p);
        });

        const statusMap: Record<string, any> = {};
        existingStatuses?.forEach((fs: any) => {
            statusMap[`${fs.enrollment_id}_${fs.month}`] = fs;
        });

        const upsertRecords: any[] = [];
        let countPaid = 0;
        let countPending = 0;
        let countPartial = 0;

        const parseMonth = (mStr: string) => {
            const [y, m] = mStr.split('-').map(Number);
            return new Date(y, m - 1, 1);
        };

        const formatMonth = (d: Date) => {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        };

        for (const enrollment of enrollments) {
            const course = enrollment.courses;
            if (!course) continue;

            const rawMonthlyFee = Number(course.monthly_fee || 0);
            const durationMonths = course.duration_months || 11;

            // Apply scholarship if configured
            let effectiveFee = rawMonthlyFee;
            if (enrollment.scholarship_type === 'PERCENTAGE' && Number(enrollment.scholarship_amount) > 0) {
                effectiveFee = Math.max(0, rawMonthlyFee * (1 - Number(enrollment.scholarship_amount) / 100));
            } else if (enrollment.scholarship_type === 'FIXED_AMOUNT' && Number(enrollment.scholarship_amount) > 0) {
                effectiveFee = Math.max(0, rawMonthlyFee - Number(enrollment.scholarship_amount));
            }

            const baseStartDate = course.start_date ? new Date(course.start_date) : new Date(enrollment.enrollment_date);
            const startMonthStr = formatMonth(baseStartDate);

            const targetDate = parseMonth(selectedTargetMonth);
            const iterDate = parseMonth(startMonthStr);
            const monthsList: string[] = [];

            let monthCount = 0;
            while (iterDate <= targetDate && monthCount < durationMonths) {
                monthsList.push(formatMonth(iterDate));
                iterDate.setMonth(iterDate.getMonth() + 1);
                monthCount++;
            }

            const enrPayments = paymentsByEnrollment[enrollment.id] || [];
            const paidByMonth: Record<string, number> = {};
            let unassignedPaymentPool = 0;

            enrPayments.forEach((p: any) => {
                const effectivePaid = Number(p.amount || 0) + Number(p.discount || 0);
                let matched = false;

                if (p.tuition_month) {
                    const monthsInPayment = p.tuition_month.split(',').map((m: string) => m.trim()).filter(Boolean);
                    if (monthsInPayment.length > 0) {
                        const splitAmount = effectivePaid / monthsInPayment.length;
                        monthsInPayment.forEach((m: string) => {
                            paidByMonth[m] = (paidByMonth[m] || 0) + splitAmount;
                        });
                        matched = true;
                    }
                }

                if (!matched) {
                    const descUpper = (p.description || '').toUpperCase();
                    const monthNames = [
                        { name: 'ENERO', num: '01' },
                        { name: 'FEBRERO', num: '02' },
                        { name: 'MARZO', num: '03' },
                        { name: 'ABRIL', num: '04' },
                        { name: 'MAYO', num: '05' },
                        { name: 'JUNIO', num: '06' },
                        { name: 'JULIO', num: '07' },
                        { name: 'AGOSTO', num: '08' },
                        { name: 'SEPTIEMBRE', num: '09' },
                        { name: 'OCTUBRE', num: '10' },
                        { name: 'NOVIEMBRE', num: '11' },
                        { name: 'DICIEMBRE', num: '12' },
                    ];
                    const detectedMonths = monthNames
                        .filter(mn => descUpper.includes(mn.name))
                        .map(mn => `${baseStartDate.getFullYear()}-${mn.num}`);

                    if (detectedMonths.length > 0) {
                        const splitAmount = effectivePaid / detectedMonths.length;
                        detectedMonths.forEach(m => {
                            paidByMonth[m] = (paidByMonth[m] || 0) + splitAmount;
                        });
                        matched = true;
                    }
                }

                if (!matched) {
                    unassignedPaymentPool += effectivePaid;
                }
            });

            monthsList.forEach((monthStr) => {
                const existing = statusMap[`${enrollment.id}_${monthStr}`];
                let currentMonthPaid = paidByMonth[monthStr] || 0;

                if (existing && existing.status === 'PAID' && Number(existing.amount_paid) >= Number(existing.amount_due)) {
                    currentMonthPaid = Math.max(currentMonthPaid, Number(existing.amount_paid));
                }

                if (currentMonthPaid < effectiveFee && unassignedPaymentPool > 0) {
                    const needed = effectiveFee - currentMonthPaid;
                    const canAllocate = Math.min(needed, unassignedPaymentPool);
                    currentMonthPaid += canAllocate;
                    unassignedPaymentPool -= canAllocate;
                }

                let finalStatus = 'PENDING';
                if (currentMonthPaid >= effectiveFee && effectiveFee > 0) {
                    finalStatus = 'PAID';
                    countPaid++;
                } else if (currentMonthPaid > 0) {
                    finalStatus = 'PARTIAL';
                    countPartial++;
                } else {
                    finalStatus = (monthStr < currentMonthStr) ? 'OVERDUE' : 'PENDING';
                    countPending++;
                }

                upsertRecords.push({
                    enrollment_id: enrollment.id,
                    month: monthStr,
                    amount_due: effectiveFee,
                    amount_paid: currentMonthPaid,
                    status: finalStatus,
                    last_updated: new Date().toISOString()
                });
            });
        }

        if (upsertRecords.length > 0) {
            const chunkSize = 100;
            for (let i = 0; i < upsertRecords.length; i += chunkSize) {
                const chunk = upsertRecords.slice(i, i + chunkSize);
                const { error: upsertError } = await db
                    .from('financial_status')
                    .upsert(chunk, { onConflict: 'enrollment_id,month' });

                if (upsertError) {
                    console.error('Error during financial_status upsert:', upsertError);
                    throw upsertError;
                }
            }
        }

        res.json({
            success: true,
            message: `Sincronización completada exitosamente para las cuotas hasta ${selectedTargetMonth}.`,
            target_month: selectedTargetMonth,
            total_reconciled: upsertRecords.length,
            total_paid: countPaid,
            total_pending: countPending,
            total_partial: countPartial,
            active_enrollments_processed: enrollments.length
        });

    } catch (error) {
        console.error('Error in syncMonthlyFees:', error);
        res.status(500).json({ message: 'Error durante la conciliación de cuotas mensuales.' });
    }
};

