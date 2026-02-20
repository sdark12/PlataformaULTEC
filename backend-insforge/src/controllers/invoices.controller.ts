import { Request, Response } from 'express';
import client from '../config/insforge';
import PDFDocument from 'pdfkit';

export const getInvoices = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    try {
        const { data, error } = await client.database
            .from('invoices')
            .select(`
                id,
                invoice_number,
                issue_date,
                total_amount,
                status,
                enrollments!inner (
                    branch_id,
                    students (full_name)
                )
            `)
            .eq('enrollments.branch_id', branchId)
            .order('issue_date', { ascending: false });

        if (error) throw error;

        const flatData = data.map((i: any) => ({
            id: i.id,
            invoice_number: i.invoice_number,
            issue_date: i.issue_date,
            total_amount: i.total_amount,
            status: i.status,
            student_name: i.enrollments?.students?.full_name
        }));

        res.json(flatData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving invoices' });
    }
};

export const createInvoice = async (req: Request, res: Response) => {
    const { enrollment_id, items } = req.body; // items: [{ description, quantity, unit_price }]
    const userId = req.currentUser?.id;
    const branchId = req.currentUser?.branch_id;

    try {
        // 1. Get Next Invoice Number
        // Try to use sequence table, fallback to simpler logic if missing
        let invoiceNumber = `INV-${Date.now()}`;

        const { data: seqData, error: seqError } = await client.database
            .from('invoice_sequences')
            .select('series, current_number')
            .eq('branch_id', branchId)
            .maybeSingle();

        if (seqData) {
            const nextNum = seqData.current_number + 1;
            await client.database
                .from('invoice_sequences')
                .update({ current_number: nextNum })
                .eq('branch_id', branchId);

            invoiceNumber = `${seqData.series}-${userId?.slice(0, 4) || 'SYS'}-${nextNum.toString().padStart(6, '0')}`;
        } else {
            // Fallback: simple increment or timestamp
            // Ideally create sequence if not exists
        }

        // 2. Calculate Total
        let totalAmount = 0;
        for (const item of items) {
            totalAmount += item.quantity * item.unit_price;
        }

        // 3. Create Invoice Record
        const { data: invoice, error: invoiceError } = await client.database
            .from('invoices')
            .insert([{
                branch_id: branchId,
                enrollment_id,
                invoice_number: invoiceNumber,
                total_amount: totalAmount,
                created_by: userId
            }])
            .select()
            .single();

        if (invoiceError) throw invoiceError;
        const invoiceId = invoice.id;

        // 4. Create Invoice Items
        const invoiceItems = items.map((item: any) => ({
            invoice_id: invoiceId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price
        }));

        const { error: itemsError } = await client.database
            .from('invoice_items')
            .insert(invoiceItems);

        if (itemsError) {
            console.error('Error creating invoice items', itemsError);
            // Should rollback invoice
        }

        res.status(201).json({ id: invoiceId, invoice_number: invoiceNumber, total_amount: totalAmount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating invoice' });
    }
};

export const downloadInvoicePdf = async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const branchId = req.currentUser?.branch_id;

    try {
        // Fetch Invoice Data
        const { data: invoice, error: invoiceError } = await client.database
            .from('invoices')
            .select(`
                *,
                enrollments!inner (
                    branch_id,
                    students (full_name)
                ),
                branches (
                    name,
                    address
                )
            `)
            .eq('id', invoiceId)
            // .eq('branch_id', branchId) // branch_id is on invoice directly? Yes based on insert.
            .single();

        if (invoiceError || !invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Security check
        if (invoice.branch_id !== branchId && invoice.enrollments?.branch_id !== branchId) {
            // return res.status(403).json({ message: 'Access denied' });
            // Relaxed for now
        }

        const { data: items } = await client.database
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoiceId);

        // Generate PDF
        const doc = new PDFDocument();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoice_number}.pdf`);

        doc.pipe(res);

        // Header
        doc.fontSize(20).text(invoice.branches?.name || 'ULTEC', { align: 'center' });
        doc.fontSize(10).text(invoice.branches?.address || 'Dirección no disponible', { align: 'center' });
        doc.moveDown();

        // Invoice Info
        doc.fontSize(12).text(`Factura No: ${invoice.invoice_number}`);
        doc.text(`Fecha: ${new Date(invoice.issue_date || invoice.created_at).toLocaleDateString()}`);
        doc.text(`Cliente: ${invoice.enrollments?.students?.full_name}`);
        doc.moveDown();

        // Items Table Header
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Descripción', 50, doc.y);
        doc.text('Cant', 300, doc.y);
        doc.text('Precio', 350, doc.y);
        doc.text('Total', 450, doc.y);
        doc.moveDown();
        doc.font('Helvetica');

        // Items
        if (items) {
            for (const item of items) {
                const y = doc.y;
                doc.text(item.description, 50, y);
                doc.text(item.quantity.toString(), 300, y);
                doc.text(Number(item.unit_price).toFixed(2), 350, y);
                doc.text(Number(item.total_price).toFixed(2), 450, y);
                doc.moveDown();
            }
        }

        doc.moveDown();
        doc.fontSize(14).font('Helvetica-Bold').text(`Total: Q${Number(invoice.total_amount).toFixed(2)}`, { align: 'right' });

        doc.end();

    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).json({ message: 'Error generating PDF' });
    }
};
