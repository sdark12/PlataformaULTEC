import { Request, Response } from 'express';
import client from '../config/insforge';
import { broadcastNotification } from '../services/notification.service';
import { sendPaymentConfirmationEmail } from '../services/email.service';

// Get Payments
export const getPayments = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    try {
        // Resource embedding for joins. Now payment is linked to student_id
        let query = client.database
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
                students!inner (
                    full_name,
                    branch_id
                )
            `)
            .order('payment_date', { ascending: false });

        if (branchId) {
            query = query.eq('students.branch_id', branchId);
        }

        const { data, error } = await query;

        if (error) throw error;

        const flatData = data.map((p: any) => ({
            id: p.id,
            student_name: p.students?.full_name,
            course_name: p.description, // We will use description to store a summary like "Pago Varios Cursos"
            amount: p.amount,
            payment_date: p.payment_date,
            method: p.method,
            reference_number: p.reference_number,
            description: p.description,
            tuition_month: p.tuition_month,
            payment_type: p.payment_type || 'TUITION',
            discount: p.discount || 0
        }));

        res.json(flatData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving payments' });
    }
};

// Register Payment
export const createPayment = async (req: Request, res: Response) => {
    const { student_id, enrollment_id, enrollment_ids, amount, method, reference_number, description, tuition_month, payment_type = 'TUITION', discount = 0, courses, branch_id } = req.body;
    const userId = req.currentUser?.id;
    const finalBranchId = branch_id || req.currentUser?.branch_id;

    try {
        console.log("PAYMENT POST REQUEST BODY:", req.body);

        if (!student_id) {
            return res.status(400).json({ message: 'Se requiere el student_id para unificar recibos.' });
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
            const { data: payment, error: paymentError } = await client.database
                .from('payments')
                .insert([{
                    student_id,
                    enrollment_id: course.enrollment_id,
                    amount: course.amount,
                    method,
                    reference_number,
                    description: description || `Pago Consolidado`,
                    tuition_month: payment_type === 'TUITION' ? tuition_month : null,
                    payment_type,
                    discount: course.discount || 0,
                    created_by: userId
                }])
                .select()
                .single();

            if (paymentError) throw paymentError;
            if (!firstPaymentRecord) firstPaymentRecord = payment;

            // Update Financial Status
            if (payment_type === 'TUITION') {
                const { data: pendingList, error: pendingError } = await client.database
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

                    await client.database
                        .from('financial_status')
                        .update({ amount_paid: newPaid, status: newStatus })
                        .eq('id', fs.id);
                }
            }
        }

        // Si no se pasaron cursos pero sí un monto global (pago general)
        if (targetCourses.length === 0) {
            const { data: payment, error: paymentError } = await client.database
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
                    created_by: userId
                }])
                .select()
                .single();

            if (paymentError) throw paymentError;
            firstPaymentRecord = payment;
        }


        // 3. Automatically Create ONE Unified Invoice
        let invoiceId = null;
        let invoiceNumberStr = null;
        try {
            // Generate Invoice Number
            let invoiceNumber = `REC-${Date.now()}`;
            const { data: seqData } = await client.database
                .from('invoice_sequences')
                .select('series, current_number')
                .eq('branch_id', finalBranchId)
                .maybeSingle();

            if (seqData) {
                const nextNum = seqData.current_number + 1;
                await client.database
                    .from('invoice_sequences')
                    .update({ current_number: nextNum })
                    .eq('branch_id', finalBranchId);
                invoiceNumber = `${seqData.series}-${String(userId).slice(0, 4)}-${nextNum.toString().padStart(6, '0')}`;
            }

            const actTotal = totalAmount || amount;
            console.log('Creating invoice for student_id:', student_id, 'Total:', actTotal);

            // Create Invoice attached to student
            const { data: invoice, error: invoiceError } = await client.database
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
                    const { error: invoiceItemError } = await client.database
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
            const { data: studentInfo } = await client.database
                .from('students')
                .select('full_name, guardian_email, user_id')
                .eq('id', student_id)
                .single();

            if (studentInfo) {
                let targetEmail = studentInfo.guardian_email;
                if (studentInfo.user_id) {
                    const { data: profileInfo } = await client.database
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
            client,
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
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;
    const branchId = req.currentUser?.branch_id;

    try {
        if (branchId) {
            const { data: payCheck } = await db.from('payments').select('students!inner(branch_id)').eq('id', id).maybeSingle();
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
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;
    const branchId = req.currentUser?.branch_id;

    try {
        if (branchId) {
            const { data: payCheck } = await db.from('payments').select('students!inner(branch_id)').eq('id', id).maybeSingle();
            if (!payCheck || payCheck.students?.branch_id !== branchId) {
                return res.status(403).json({ message: 'Forbidden: Payment does not belong to your branch.' });
            }
        }

        const { error } = await db
            .from('payments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        if (branchId) {
            await broadcastNotification(
                client,
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
