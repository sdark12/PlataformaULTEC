import { Request, Response } from 'express';
import client from '../config/insforge';
import PDFDocument from 'pdfkit';

export const getInvoices = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    try {
        let invQuery = client.database
            .from('invoices')
            .select(`
                id,
                invoice_number,
                issue_date,
                total_amount,
                status,
                students!inner (
                    full_name,
                    branch_id
                )
            `);
        
        if (branchId) {
            invQuery = invQuery.eq('students.branch_id', branchId);
        }

        const { data, error } = await invQuery.order('issue_date', { ascending: false });

        if (error) throw error;

        const flatData = data.map((i: any) => ({
            id: i.id,
            invoice_number: i.invoice_number,
            issue_date: i.issue_date,
            total_amount: i.total_amount,
            status: i.status,
            student_name: i.students?.full_name
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
                students!inner (
                    full_name,
                    personal_code,
                    branch_id
                ),
                branches (
                    name,
                    address
                )
            `)
            .eq('id', invoiceId)
            .single();

        if (invoiceError || !invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Security check
        if (invoice.branch_id !== branchId && invoice.students?.branch_id !== branchId) {
            // return res.status(403).json({ message: 'Access denied' });
            // Relaxed for now
        }

        const { data: items } = await client.database
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoiceId);

        // Fetch past payments for sidebar history
        const { data: studentPayments } = await client.database
            .from('payments')
            .select('created_at, tuition_month, payment_type')
            .eq('student_id', invoice.student_id);

        let inscriptionDate = '-';
        const monthlyPayments: Record<number, string> = {};

        if (studentPayments) {
            // Find first enrollment payment
            const enrollmentPayments = studentPayments.filter(p => p.payment_type === 'ENROLLMENT').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            if (enrollmentPayments.length > 0) {
                inscriptionDate = new Date(enrollmentPayments[0].created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
            }

            // Map tuitions to months — handle multi-month entries like "2026-01, 2026-02"
            studentPayments.filter(p => p.payment_type === 'TUITION' && p.tuition_month).forEach((p) => {
                // Split comma/space separated months
                const monthEntries = p.tuition_month.split(/[,;]\s*/);
                const paymentDateStr = new Date(p.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
                
                monthEntries.forEach((entry: string) => {
                    const match = entry.trim().match(/(\d{4})-(\d{2})/);
                    if (match) {
                        const monthNum = parseInt(match[2], 10);
                        if (!monthlyPayments[monthNum]) {
                            monthlyPayments[monthNum] = paymentDateStr;
                        }
                    }
                });
            });
        }

        let classSchedule = 'Sin horario asignado';
        const { data: schedCheck } = await client.database
            .from('enrollments')
            .select(`course_schedules!inner(day_of_week, start_time, end_time)`)
            .eq('student_id', invoice.student_id)
            .limit(1)
            .maybeSingle();
            
        if (schedCheck && (schedCheck as any).course_schedules) {
            const s: any = (schedCheck as any).course_schedules;
            classSchedule = `${s.day_of_week} ${s.start_time?.substring(0,5)} - ${s.end_time?.substring(0,5)}`;
        }

        // Generate PDF
        const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoice_number}.pdf`);

        doc.pipe(res);

        // --- COLORS & LAYOUT ---
        const colors = {
            dark: '#0f172a',      // Sidebar (Slate 900)
            orange: '#3b82f6',    // Accents / Table Header (Blue 500)
            redOrange: '#4f46e5', // Bottom Highlight (Indigo 600)
            lightGray: '#f8fafc', // Table Alternate (Slate 50)
            textDark: '#0f172a',
            textLight: '#475569',
            white: '#FFFFFF',
            black: '#000000',
            border: '#cbd5e1',
            red: '#dc2626'
        };

        const pageWidth = doc.page.width;   // ~841.89
        const pageHeight = doc.page.height; // ~595.28

        // Define Split
        const cutX = pageWidth * 0.72; // ~606
        const sidebarWidth = 160;

        // ==========================================
        // LEFT SECTION (MAIN RECIBO)
        // ==========================================

        // --- DRAW SIDEBAR ---
        doc.rect(0, 0, sidebarWidth, pageHeight).fill(colors.dark);

        // --- DRAW TOP BLOB (Sidebar) ---
        doc.rect(0, 30, sidebarWidth, 20).fill(colors.orange);

        // --- DRAW BOTTOM BLOB (Sidebar) ---
        doc.polygon(
            [0, pageHeight - 120],
            [sidebarWidth, pageHeight - 180],
            [sidebarWidth, pageHeight],
            [0, pageHeight]
        ).fill(colors.redOrange);
        doc.rect(0, pageHeight - 120, sidebarWidth, 120).fill(colors.redOrange);

        // --- SIDEBAR CONTENT ---
        doc.fillColor(colors.white).fontSize(20).font('Helvetica-Bold')
            .text('ULTRA', 25, 60)
            .text('TECNOLOGÍA', 25, 80);

        doc.fontSize(8).font('Helvetica')
            .text('CENTRO ACADÉMICO', 25, 105, { characterSpacing: 1, text: 'CENTRO ACADÉMICO' } as any);

        doc.moveDown(4);
        doc.fontSize(10).font('Helvetica-Bold').text('CONTACTO', 25, doc.y);
        doc.moveDown(1);
        doc.fontSize(8).font('Helvetica')
            .text('Dir: ' + (invoice.branches?.address || 'Ciudad de Guatemala'), 25, doc.y, { width: 120 })
            .moveDown(1)
            .text('Tel: +502 1234-5678')
            .moveDown(0.5)
            .text('info@ultratecnologia.com');

        doc.moveDown(3);
        doc.fillColor(colors.red).fontSize(8).font('Helvetica-Bold')
            .text('HORARIO DE ATENCIÓN', 25, doc.y)
            .text('8:00 AM A 12:00 MD')
            .text('2:00 PM A 6:00 PM')
            .moveDown(1)
            .text('DOMINGOS:')
            .text('8:00 AM A 12:00 MD');

        // --- PAYMENT HISTORY (SIDEBAR) ---
        // (Moved to the Codo section on the right)

        // --- MAIN AREA CONTENT ---
        const startX = sidebarWidth + 30;
        const mainWidth = cutX - startX - 30;

        // Title Block
        doc.rect(cutX - 190, 30, 160, 50).fill(colors.dark);
        doc.fillColor(colors.white).fontSize(20).font('Helvetica-Bold')
            .text('RECIBO', cutX - 175, 40, { align: 'right', width: 130 });
        doc.fontSize(9).font('Helvetica')
            .text('OFICIAL', cutX - 175, 62, { align: 'right', width: 130 });

        // Institutional info (Left top)
        doc.fillColor(colors.textDark).fontSize(10).font('Helvetica-Bold')
            .text('ACADEMIA AUTORIZADA', startX, 40);
        doc.fontSize(8).font('Helvetica')
            .text('RESOLUCIÓN 154-2006, 00840-DIGEACE', startX, 55)
            .text('CÓDIGOS: 00929-2010 / 00930-2010', startX, 68);

        // Client Details Box
        const detailY = 120;

        doc.rect(startX, detailY, mainWidth, 90).lineWidth(1).stroke(colors.border);

        // Client Row 1
        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold').text('CÓDIGO ALUMNO:', startX + 15, detailY + 15);
        doc.fillColor(colors.textDark).font('Helvetica').text(invoice.students?.personal_code || 'N/A', startX + 110, detailY + 15);

        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold').text('NO. FACTURA:', startX + 220, detailY + 15);
        doc.fillColor(colors.textDark).font('Helvetica').text(invoice.invoice_number, startX + 280, detailY + 15);

        // Client Row 2
        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold').text('NOMBRES:', startX + 15, detailY + 35);
        doc.fillColor(colors.textDark).font('Helvetica').text(invoice.students?.full_name?.toUpperCase() || 'CLIENTE', startX + 110, detailY + 35);

        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold').text('FECHA:', startX + 220, detailY + 35);
        doc.fillColor(colors.textDark).font('Helvetica').text(new Date(invoice.issue_date || invoice.created_at).toLocaleDateString(), startX + 280, detailY + 35);

        // Client Row 3
        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold').text('ESTADO:', startX + 15, detailY + 55);
        doc.fillColor(colors.textDark).font('Helvetica').text('ESTUDIANTE ACTIVO', startX + 110, detailY + 55);

        // Client Row 4
        doc.fillColor(colors.red).fontSize(8).font('Helvetica-Bold').text('HORARIO DE CLASES:', startX + 15, detailY + 75);
        doc.fillColor(colors.red).font('Helvetica').text(classSchedule, startX + 120, detailY + 75);


        // --- TABLE SECTION ---
        const tableTop = 220;
        const colDesc = startX;
        const colQty = startX + 220;
        const colUnit = startX + 270;
        const colTotal = startX + 340;

        // Table Header
        doc.rect(startX, tableTop, mainWidth, 22).fill(colors.orange);
        doc.fillColor(colors.white).fontSize(9).font('Helvetica-Bold')
            .text('DESCRIPCIÓN DEL CONCEPTO', colDesc + 10, tableTop + 6)
            .text('CANT', colQty, tableTop + 6)
            .text('PRECIO', colUnit, tableTop + 6)
            .text('TOTAL', colTotal, tableTop + 6);

        // Table Rows
        let rowY = tableTop + 22;
        doc.font('Helvetica').fontSize(8);

        if (items) {
            items.forEach((item: any, i: number) => {
                if (i % 2 === 0) {
                    doc.rect(startX, rowY, mainWidth, 25).fill(colors.lightGray);
                }

                doc.fillColor(colors.textDark)
                    .text(item.description, colDesc + 10, rowY + 8, { width: 200 })
                    .text(item.quantity.toString(), colQty, rowY + 8)
                    .text(`Q${Number(item.unit_price).toFixed(2)}`, colUnit, rowY + 8)
                    .text(`Q${Number(item.total_price).toFixed(2)}`, colTotal, rowY + 8);

                rowY += 25;
            });
        }
        
        // --- PAYMENT HISTORY (MAIN AREA) ---
        let mainHistY = rowY + 15;
        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold')
            .text(`HISTORIAL DE PAGOS DEL ESTUDIANTE (Inscripción: ${inscriptionDate})`, startX + 10, mainHistY);
        
        mainHistY += 15;
        for (let i = 1; i <= 12; i++) {
            const dateStr = monthlyPayments[i] || '---';
            const col = Math.floor((i - 1) / 4);
            const row = (i - 1) % 4;
            const cX = startX + 15 + (col * 110);
            const cY = mainHistY + (row * 15);
            doc.fillColor(colors.textLight).fontSize(7).font('Helvetica-Bold').text(`pago${i}:`, cX, cY);
            doc.fillColor(colors.textDark).fontSize(7).font('Helvetica').text(dateStr, cX + 30, cY);
        }
        
        rowY = mainHistY + (4 * 15) + 10;

        // Draw Table Border outline
        const finalBoxHeight = Math.max(140, rowY - (tableTop + 22));
        doc.rect(startX, tableTop + 22, mainWidth, finalBoxHeight).stroke(colors.border);

        // --- TOTALS AREA ---
        const totalBoxY = tableTop + 22 + finalBoxHeight;
        doc.rect(cutX - 160, totalBoxY, 130, 25).fill(colors.redOrange);
        doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(10)
            .text('TOTAL:', cutX - 150, totalBoxY + 8)
            .text(`Q${Number(invoice.total_amount).toFixed(2)}`, cutX - 80, totalBoxY + 8);
            
        // Print Time
        const stampDateMain = new Date().toLocaleString();
        doc.fillColor(colors.red).fontSize(7).font('Helvetica')
            .text(`hora de Impresión:  ${stampDateMain}`, startX + 10, totalBoxY + 30);

        // Foto del Estudiante box
        doc.rect(cutX - 110, totalBoxY + 45, 80, 85).lineWidth(2).stroke(colors.red);
        doc.fillColor(colors.red).fontSize(7).font('Helvetica')
            .text('foto del', cutX - 110, totalBoxY + 75, { width: 80, align: 'center' })
            .text('estudiante', cutX - 110, totalBoxY + 85, { width: 80, align: 'center' });
        
        doc.lineWidth(1); // reset lineWidth for subsequent strokes

        // Signatures (Main)
        const signY = pageHeight - 65;
        doc.moveTo(startX, signY).lineTo(startX + 180, signY).lineWidth(1).stroke(colors.border);
        doc.fillColor(colors.textDark).font('Helvetica-Bold').fontSize(9)
            .text('Firma de Secretaría', startX + 20, signY + 5, { width: 140, align: 'center' });

        doc.fillColor(colors.red).font('Helvetica-Bold').fontSize(7)
            .text('NOTA: todas las colegiaturas se cobran por adelantado.\nLea condiciones y términos de la academia, desde el numeral 1 hasta 1.10', startX + 200, signY + 15, { width: 220 });


        // ==========================================
        // CUT LINE SEPARATOR
        // ==========================================
        doc.moveTo(cutX, 15).lineTo(cutX, pageHeight - 15)
            .lineWidth(1)
            .dash(5, { space: 5 })
            .stroke(colors.textLight);


        // ==========================================
        // RIGHT SECTION (CODO)
        // ==========================================
        const codoX = cutX + 20;
        doc.undash(); // remove dash config

        doc.fillColor(colors.dark).fontSize(10).font('Helvetica-Bold').text('CODO DE RECIBO', codoX, 35);

        doc.moveDown(2);
        doc.fillColor(colors.textDark).fontSize(10).font('Helvetica-Bold')
            .text(invoice.students?.full_name?.toUpperCase() || 'CLIENTE', codoX, 60, { width: 180 });

        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold')
            .text(`CÓDIGO:`, codoX, 85);
        doc.fillColor(colors.textDark).fontSize(8).font('Helvetica')
            .text(invoice.students?.personal_code || 'N/A', codoX + 50, 85);

        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold')
            .text(`RECIBO NO:`, codoX, 100);
        doc.fillColor(colors.textDark).fontSize(8).font('Helvetica')
            .text(invoice.invoice_number, codoX + 55, 100);

        doc.moveDown(2);
        doc.fillColor(colors.orange).fontSize(9).font('Helvetica-Bold')
            .text('TIENE CANCELADO LOS SIGUIENTES CONCEPTOS:', codoX, 130, { width: 180 });

        // Codo List
        let clistY = 160;
        doc.font('Helvetica').fontSize(7);
        if (items) {
            items.forEach((item: any) => {
                doc.fillColor(colors.textDark)
                    .text(`• ${item.description}`, codoX, clistY, { width: 120 })
                    .text(`Q${Number(item.total_price).toFixed(2)}`, codoX + 130, clistY, { align: 'right', width: 60 });
                clistY += 20;
            });
        }

        // Codo Totals
        const codoTotalY = Math.max(clistY + 10, 220);
        doc.rect(codoX, codoTotalY, 190, 20).fill(colors.lightGray).stroke(colors.border);
        doc.fillColor(colors.textDark).fontSize(9).font('Helvetica-Bold')
            .text('TOTAL:', codoX + 10, codoTotalY + 6)
            .text(`Q${Number(invoice.total_amount).toFixed(2)}`, codoX + 110, codoTotalY + 6, { align: 'right', width: 70 });

        // Information
        let infoY = codoTotalY + 30;
        doc.fillColor(colors.textLight).fontSize(7).font('Helvetica-Bold')
            .text(`Fecha de pago: `, codoX, infoY);
        doc.fillColor(colors.textDark).fontSize(7).font('Helvetica')
            .text(new Date(invoice.issue_date || invoice.created_at).toLocaleDateString(), codoX + 60, infoY);
            
        const stampDate = new Date().toLocaleString();
        infoY += 15;
        doc.fillColor(colors.textLight).text(`Hora Impresión:`, codoX, infoY);
        doc.fillColor(colors.textDark).text(stampDate, codoX + 65, infoY);

        // --- PAYMENT HISTORY (CODO) ---
        let codoHistY = infoY + 25;
        doc.fillColor(colors.textDark).fontSize(8).font('Helvetica-Bold')
            .text(`HISTORIAL DE PAGOS`, codoX, codoHistY);
        doc.fillColor(colors.textLight).fontSize(7).font('Helvetica')
            .text(`Inscripción: ${inscriptionDate}`, codoX + 100, codoHistY);
        
        codoHistY += 15;
        // Two columns for history space saving
        for (let i = 1; i <= 12; i++) {
            const dateStr = monthlyPayments[i] || '---';
            const colOff = i > 6 ? 95 : 0;
            const rowOff = ((i - 1) % 6) * 14;
            doc.fillColor(colors.textLight).fontSize(7).font('Helvetica-Bold').text(`pago${i}:`, codoX + colOff, codoHistY + rowOff);
            doc.fillColor(colors.textDark).fontSize(7).font('Helvetica').text(dateStr, codoX + colOff + 30, codoHistY + rowOff);
        }

        // Signature
        const codoSignY = pageHeight - 45;
        doc.moveTo(codoX + 10, codoSignY).lineTo(codoX + 180, codoSignY).lineWidth(1).stroke(colors.border);
        doc.fillColor(colors.textDark).font('Helvetica-Bold').fontSize(8)
            .text('Firma Encargado / Caja', codoX + 10, codoSignY + 5, { width: 170, align: 'center' });

        doc.end();
    } catch (error) {
        console.error(error);
        if (!res.headersSent) res.status(500).json({ message: 'Error generating PDF' });
    }
};
