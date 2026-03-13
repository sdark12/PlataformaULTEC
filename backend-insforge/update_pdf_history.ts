import fs from 'fs';

const path = 'src/controllers/invoices.controller.ts';
let content = fs.readFileSync(path, 'utf-8');

// Target 1: Add queries before // Generate PDF
const target1 = `        const { data: items } = await client.database
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', invoiceId);`;

const replace1 = `        const { data: items } = await client.database
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
        }`;

content = content.replace(target1, replace1);

// Target 2: Insert into Sidebar
const target2 = `        doc.fontSize(8).font('Helvetica')
            .text('Dir: Ciudad de Guatemala', 25, doc.y, { width: 120 })
            .moveDown(1)
            .text('Tel: +502 1234-5678')
            .moveDown(0.5)
            .text('info@ultratecnologia.com');`;

const replace2 = `        doc.fontSize(8).font('Helvetica')
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
        }`;

content = content.replace(target2, replace2);

fs.writeFileSync(path, content, 'utf-8');
console.log("Updated invoices.controller.ts history successfully");
