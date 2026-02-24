import { Request, Response } from 'express';
import client from '../config/insforge';

// Get Payments
export const getPayments = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    try {
        // Resource embedding for joins
        const { data, error } = await client.database
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
                enrollments!inner (
                    branch_id,
                    students (full_name),
                    courses (name)
                )
            `)
            .eq('enrollments.branch_id', branchId)
            .order('payment_date', { ascending: false });

        if (error) throw error;

        const flatData = data.map((p: any) => ({
            id: p.id,
            student_name: p.enrollments?.students?.full_name,
            course_name: p.enrollments?.courses?.name,
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
    const { enrollment_id, amount, method, reference_number, description, tuition_month, payment_type = 'TUITION', discount = 0 } = req.body;
    const userId = req.currentUser?.id;

    try {
        // 0. Validation for duplicate tuition
        if (payment_type === 'TUITION' && tuition_month) {
            const { data: existingOption } = await client.database
                .from('payments')
                .select('id')
                .eq('enrollment_id', enrollment_id)
                .eq('tuition_month', tuition_month)
                .eq('payment_type', 'TUITION')
                .maybeSingle();

            if (existingOption) {
                return res.status(400).json({ message: `Este estudiante ya tiene registrado el pago de la colegiatura para el mes seleccionado (${tuition_month}).` });
            }
        }

        // 1. Insert Payment
        const { data: payment, error: paymentError } = await client.database
            .from('payments')
            .insert([{
                enrollment_id,
                amount,
                method,
                reference_number,
                description,
                tuition_month: payment_type === 'TUITION' ? tuition_month : null,
                payment_type,
                discount,
                created_by: userId
            }])
            .select()
            .single();

        if (paymentError) throw paymentError;

        // 2. Update Financial Status ONLY IF IT IS TUITION
        if (payment_type === 'TUITION') {
            // Find oldest pending status
            const { data: pendingList, error: pendingError } = await client.database
                .from('financial_status')
                .select('id, amount_due, amount_paid')
                .eq('enrollment_id', enrollment_id)
                .eq('status', 'PENDING')
                .order('month', { ascending: true })
                .limit(1);

            if (!pendingError && pendingList && pendingList.length > 0) {
                const fs = pendingList[0];
                const newPaid = Number(fs.amount_paid) + Number(amount);
                let newStatus = 'PENDING';
                if (newPaid >= Number(fs.amount_due)) {
                    newStatus = 'PAID';
                }

                const { error: updateError } = await client.database
                    .from('financial_status')
                    .update({ amount_paid: newPaid, status: newStatus })
                    .eq('id', fs.id);

                if (updateError) {
                    console.error('Failed to update financial status', updateError);
                    // Optional: Should we rollback payment? 
                    // For now, logging error. Payment is recorded, just status not updated.
                }
            }
        }

        res.status(201).json(payment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error registering payment' });
    }
};

export const updatePayment = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { amount, method, reference_number, description, tuition_month, payment_type, discount } = req.body;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    try {
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

    try {
        const { error } = await db
            .from('payments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting payment' });
    }
};
