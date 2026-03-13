import fs from 'fs';

const path = 'src/controllers/invoices.controller.ts';
let content = fs.readFileSync(path, 'utf-8');

const splitMarker = `        // Generate PDF`;
const endMarker = `    } catch (error) {`;

const parts = content.split(splitMarker);
const endParts = parts[1].split(endMarker);

const newPdfLogic = `        // Fetch past payments for sidebar history
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

            // Map tuitions to months
            studentPayments.filter(p => p.payment_type === 'TUITION' && p.tuition_month).forEach((p) => {
                const match = p.tuition_month.match(/^\\d{4}-(\\d{2})$/);
                if (match) {
                    const monthNum = parseInt(match[1], 10);
                    if (!monthlyPayments[monthNum] || new Date(p.created_at) > new Date(monthlyPayments[monthNum].split('/').reverse().join('-'))) {
                        monthlyPayments[monthNum] = new Date(p.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
                    }
                }
            });
        }

        // Generate PDF
        const doc = new PDFDocument({ margin: 0, size: 'A4', layout: 'landscape' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', \`attachment; filename=\${invoice.invoice_number}.pdf\`);

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
            border: '#cbd5e1'
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

        // --- PAYMENT HISTORY (SIDEBAR) ---
        let pyY = 220;
        doc.fillColor(colors.redOrange).fontSize(9).font('Helvetica-Bold')
            .text(\`Inscripción: \${inscriptionDate}\`, 25, pyY);
        
        pyY += 15;
        // Border around history
        doc.rect(20, pyY - 5, 120, 215).lineWidth(1).stroke(colors.redOrange);
        
        for (let i = 1; i <= 12; i++) {
            const dateStr = monthlyPayments[i] || '';
            doc.fillColor(colors.redOrange).fontSize(8).font('Helvetica-Bold').text(\`pago\${i}:\`, 25, pyY);
            doc.fillColor(colors.white).fontSize(8).font('Helvetica').text(dateStr, 65, pyY);
            pyY += 17;
        }

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
        
        doc.rect(startX, detailY, mainWidth, 75).lineWidth(1).stroke(colors.border);
        
        // Client Row 1
        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold').text('CÓDIGO ALUMNO:', startX + 15, detailY + 15);
        doc.fillColor(colors.textDark).font('Helvetica').text(invoice.students?.personal_code || 'N/A', startX + 110, detailY + 15);
        
        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold').text('NO. FACTURA:', startX + 240, detailY + 15);
        doc.fillColor(colors.textDark).font('Helvetica').text(invoice.invoice_number, startX + 320, detailY + 15);

        // Client Row 2
        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold').text('NOMBRES:', startX + 15, detailY + 35);
        doc.fillColor(colors.textDark).font('Helvetica').text(invoice.students?.full_name?.toUpperCase() || 'CLIENTE', startX + 110, detailY + 35);
        
        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold').text('FECHA:', startX + 240, detailY + 35);
        doc.fillColor(colors.textDark).font('Helvetica').text(new Date(invoice.issue_date || invoice.created_at).toLocaleDateString(), startX + 320, detailY + 35);

        // Client Row 3
        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold').text('ESTADO:', startX + 15, detailY + 55);
        doc.fillColor(colors.textDark).font('Helvetica').text('ESTUDIANTE ACTIVO', startX + 110, detailY + 55);


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
                    .text(\`Q\${Number(item.unit_price).toFixed(2)}\`, colUnit, rowY + 8)
                    .text(\`Q\${Number(item.total_price).toFixed(2)}\`, colTotal, rowY + 8);

                rowY += 25;
            });
        }
        
        // Draw Table Border outline
        doc.rect(startX, tableTop + 22, mainWidth, Math.max(120, rowY - (tableTop + 22))).stroke(colors.border);

        // --- TOTALS AREA ---
        const totalBoxY = Math.max(tableTop + 140, rowY + 10);
        doc.rect(cutX - 160, totalBoxY, 130, 25).fill(colors.redOrange);
        doc.fillColor(colors.white).font('Helvetica-Bold').fontSize(10)
            .text('TOTAL:', cutX - 150, totalBoxY + 8)
            .text(\`Q\${Number(invoice.total_amount).toFixed(2)}\`, cutX - 80, totalBoxY + 8);

        // Signatures (Main)
        const signY = pageHeight - 60;
        doc.moveTo(startX, signY).lineTo(startX + 180, signY).lineWidth(1).stroke(colors.border);
        doc.fillColor(colors.textDark).font('Helvetica-Bold').fontSize(9)
            .text('Firma de Secretaría', startX + 45, signY + 5);
        
        doc.fillColor(colors.textLight).font('Helvetica').fontSize(7)
            .text('Nota: Revise sus pagos y saldos mensuales.\\nLos recibos son válidos con la firma de autorización.', startX, signY + 25, { width: 200 });


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
            .text(\`CÓDIGO:\`, codoX, 85);
        doc.fillColor(colors.textDark).fontSize(8).font('Helvetica')
            .text(invoice.students?.personal_code || 'N/A', codoX + 50, 85);

        doc.fillColor(colors.textLight).fontSize(8).font('Helvetica-Bold')
            .text(\`RECIBO NO:\`, codoX, 100);
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
                   .text(\`• \${item.description}\`, codoX, clistY, { width: 120 })
                   .text(\`Q\${Number(item.total_price).toFixed(2)}\`, codoX + 130, clistY, { align: 'right', width: 60 });
                clistY += 20;
            });
        }

        // Codo Totals
        const codoTotalY = Math.max(clistY + 20, 250);
        doc.rect(codoX, codoTotalY, 190, 20).fill(colors.lightGray).stroke(colors.border);
        doc.fillColor(colors.textDark).fontSize(9).font('Helvetica-Bold')
            .text('TOTAL:', codoX + 10, codoTotalY + 6)
            .text(\`Q\${Number(invoice.total_amount).toFixed(2)}\`, codoX + 110, codoTotalY + 6, { align: 'right', width: 70 });

        // Information / Signature
        doc.fillColor(colors.textLight).fontSize(7).font('Helvetica-Bold')
            .text(\`Fecha de pago: \`, codoX, codoTotalY + 30);
        doc.fillColor(colors.textDark).fontSize(7).font('Helvetica')
            .text(new Date(invoice.issue_date || invoice.created_at).toLocaleDateString(), codoX + 60, codoTotalY + 30);
            
        const stampDate = new Date().toLocaleString()
        doc.fillColor(colors.textLight).text(\`Hora de Impresion:\`, codoX, codoTotalY + 45);
        doc.fillColor(colors.textDark).text(stampDate, codoX + 70, codoTotalY + 45);

        const codoSignY = pageHeight - 60;
        doc.moveTo(codoX + 10, codoSignY).lineTo(codoX + 180, codoSignY).lineWidth(1).stroke(colors.border);
        doc.fillColor(colors.textDark).font('Helvetica-Bold').fontSize(8)
            .text('Firma Encargado', codoX + 10, codoSignY + 5, { width: 170, align: 'center' });

        doc.end();
`;

let finalContent = parts[0] + newPdfLogic + endMarker + endParts[1];

fs.writeFileSync(path, finalContent, 'utf-8');
console.log("Updated invoices PDF successfully with exact history logic.");
