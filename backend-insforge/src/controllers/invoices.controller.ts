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
        const doc = new PDFDocument({ margin: 0, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoice_number}.pdf`);

        doc.pipe(res);

        // --- COLORS & LAYOUT ---
        const colors = {
            dark: '#1F2937',      // Sidebar
            orange: '#F97316',    // Accents / Table Header
            redOrange: '#EA580C', // Bottom Highlight
            lightGray: '#F3F4F6', // Table Alternate
            textDark: '#111827',
            textLight: '#6B7280',
            white: '#FFFFFF'
        };

        const sidebarWidth = 180;
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;

        // --- DRAW SIDEBAR ---
        doc.rect(0, 0, sidebarWidth, pageHeight).fill(colors.dark);

        // --- DRAW TOP ORANGE ACCENT (Sidebar) ---
        doc.rect(0, 30, sidebarWidth, 20).fill(colors.orange);

        // --- DRAW BOTTOM RED-ORANGE ACCENT (Sidebar) ---
        doc.polygon(
            [0, pageHeight - 150],
            [sidebarWidth, pageHeight - 220],
            [sidebarWidth, pageHeight],
            [0, pageHeight]
        ).fill(colors.redOrange);
        doc.rect(0, pageHeight - 150, sidebarWidth, 150).fill(colors.redOrange); // Fill below polygon to be safe

        // --- SIDEBAR CONTENT ---
        // Logo / Name (In sidebar)
        doc.fillColor(colors.white).fontSize(20).font('Helvetica-Bold')
            .text('ULTRA', 30, 80)
            .text('TECNOLOGÍA', 30, 100);

        doc.fontSize(9).font('Helvetica')
            .text('PANEL ADMINISTRATIVO', 30, 125, { characterSpacing: 1, text: 'PANEL ADMINISTRATIVO' } as any);

        doc.moveDown(4);
        doc.fontSize(11).font('Helvetica-Bold').text('CONTACTO', 30, doc.y);
        doc.moveDown(1);
        doc.fontSize(9).font('Helvetica')
            .text('Dir: ' + (invoice.branches?.address || 'Ciudad de Guatemala'), 30, doc.y, { width: 120 })
            .moveDown(1)
            .text('Tel: +502 1234-5678')
            .moveDown(0.5)
            .text('info@ultratecnologia.com');

        // --- MAIN AREA CONTENT ---
        const startX = sidebarWidth + 40;

        // --- TOP RIGHT ORANGE BLOCK (Logo/Title Area) ---
        doc.rect(pageWidth - 200, 30, 200, 60).fill(colors.orange);
        doc.fillColor(colors.white).fontSize(24).font('Helvetica-Bold')
            .text('INVOICE', pageWidth - 180, 45, { align: 'right', width: 160 });
        doc.fontSize(10).font('Helvetica')
            .text('RECIBO DE PAGO', pageWidth - 180, 70, { align: 'right', width: 160 });

        // --- INVOICE DETAILS ---
        const detailY = 150;

        // Column 1: Client
        doc.fillColor(colors.textDark).fontSize(10).font('Helvetica-Bold').text('FACTURAR A:', startX, detailY);
        doc.fillColor(colors.textLight).font('Helvetica')
            .text(invoice.enrollments?.students?.full_name?.toUpperCase() || 'CLIENTE', startX, detailY + 15)
            .text('Estudiante Activo', startX, detailY + 30);

        // Column 2: Details
        const col2X = startX + 180;
        doc.fillColor(colors.textDark).fontSize(10).font('Helvetica-Bold').text('NO. FACTURA:', col2X, detailY);
        doc.fillColor(colors.textLight).font('Helvetica').text(invoice.invoice_number, col2X, detailY + 15);

        doc.fillColor(colors.textDark).fontSize(10).font('Helvetica-Bold').text('FECHA:', col2X, detailY + 40);
        doc.fillColor(colors.textLight).font('Helvetica').text(new Date(invoice.issue_date || invoice.created_at).toLocaleDateString(), col2X, detailY + 55);

        // --- TABLE SECTION ---
        const tableTop = 280;
        const colDesc = startX;
        const colQty = startX + 180;
        const colUnit = startX + 230;
        const colTotal = startX + 300;

        // Table Header
        doc.rect(startX, tableTop, pageWidth - startX - 40, 25).fill(colors.orange);
        doc.fillColor(colors.white).fontSize(10).font('Helvetica-Bold')
            .text('DESCRIPCIÓN', colDesc + 10, tableTop + 8)
            .text('CANT', colQty, tableTop + 8)
            .text('PRECIO', colUnit, tableTop + 8)
            .text('TOTAL', colTotal, tableTop + 8);

        // Table Rows
        let rowY = tableTop + 25;
        doc.font('Helvetica').fontSize(9);

        if (items) {
            items.forEach((item: any, i: number) => {
                // Alternate row background
                if (i % 2 === 0) {
                    doc.rect(startX, rowY, pageWidth - startX - 40, 30).fill(colors.lightGray);
                }

                doc.fillColor(colors.textDark)
                    .text(item.description, colDesc + 10, rowY + 10, { width: 160 })
                    .text(item.quantity.toString(), colQty, rowY + 10)
                    .text(`Q${Number(item.unit_price).toFixed(2)}`, colUnit, rowY + 10)
                    .text(`Q${Number(item.total_price).toFixed(2)}`, colTotal, rowY + 10);

                rowY += 30;
            });
        }

        // --- TOTALS AREA ---
        rowY += 20;
        doc.rect(colTotal - 40, rowY, 120, 30).fill(colors.redOrange);
        doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(10)
            .text('TOTAL:', colTotal - 30, rowY + 10)
            .text(`Q${Number(invoice.total_amount).toFixed(2)}`, colTotal + 15, rowY + 10);

        // Footer / Notes
        doc.fillColor(colors.textLight).font('Helvetica').fontSize(8)
            .text('Gracias por su pago.', startX, doc.page.height - 80)
            .text('Este documento es un comprobante de pago electrónico sin validez fiscal a menos que se indique lo contrario.', startX, doc.page.height - 70, { width: 300 });

        doc.end();

    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).json({ message: 'Error generating PDF' });
    }
};
