import jsPDF from 'jspdf';

interface CertificateData {
    studentName: string;
    personalCode: string;
    courseName?: string;
    grade?: string;
    enrollmentDate?: string;
    branchName?: string;
}

/**
 * Generate a "Constancia de Inscripción" PDF
 */
export const generateEnrollmentCertificate = (data: CertificateData) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    // === Decorative Header Band ===
    doc.setFillColor(13, 89, 242); // brand-blue
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Subtle secondary band
    doc.setFillColor(127, 13, 242); // brand-purple
    doc.rect(0, 40, pageWidth, 3, 'F');

    // Institution name
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('ULTRA TECNOLOGÍA', centerX, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Centro de Formación Técnica y Profesional', centerX, 28, { align: 'center' });

    doc.setFontSize(8);
    doc.text('Guatemala, C.A.', centerX, 34, { align: 'center' });

    // === Document Title ===
    doc.setFontSize(20);
    doc.setTextColor(13, 89, 242);
    doc.setFont('helvetica', 'bold');
    doc.text('CONSTANCIA DE INSCRIPCIÓN', centerX, 65, { align: 'center' });

    // Decorative line under title
    doc.setDrawColor(13, 89, 242);
    doc.setLineWidth(0.8);
    doc.line(centerX - 50, 69, centerX + 50, 69);

    // === Body Text ===
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFont('helvetica', 'normal');

    const today = new Date();
    const dateStr = today.toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });

    const bodyLines = [
        'El/La infrascrito(a) Director(a) de Ultra Tecnología, Centro de Formación',
        'Técnica y Profesional, HACE CONSTAR que:',
    ];

    let y = 90;
    bodyLines.forEach(line => {
        doc.text(line, centerX, y, { align: 'center' });
        y += 7;
    });

    // Student Name (highlighted)
    y += 8;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 89, 242);
    doc.text(data.studentName.toUpperCase(), centerX, y, { align: 'center' });

    // Personal Code
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Código Personal: ${data.personalCode || 'N/A'}`, centerX, y, { align: 'center' });

    // Enrollment details
    y += 15;
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');

    const detailLines: string[] = [];
    if (data.courseName) {
        detailLines.push(`Se encuentra debidamente inscrito(a) en el curso de:`);
    } else {
        detailLines.push(`Se encuentra debidamente inscrito(a) en esta institución.`);
    }

    detailLines.forEach(line => {
        doc.text(line, centerX, y, { align: 'center' });
        y += 7;
    });

    if (data.courseName) {
        y += 3;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(127, 13, 242);
        doc.text(data.courseName, centerX, y, { align: 'center' });

        if (data.grade) {
            y += 7;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Grado/Sección: ${data.grade}`, centerX, y, { align: 'center' });
        }
    }

    // Purpose statement
    y += 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text('La presente constancia se extiende a solicitud del interesado(a),', centerX, y, { align: 'center' });
    y += 7;
    doc.text('para los usos legales que le convengan.', centerX, y, { align: 'center' });

    // Date
    y += 15;
    doc.text(`Guatemala, ${dateStr}.`, centerX, y, { align: 'center' });

    // === Signature Area ===
    y += 40;
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.5);
    doc.line(centerX - 40, y, centerX + 40, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Director(a)', centerX, y, { align: 'center' });
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Ultra Tecnología', centerX, y, { align: 'center' });

    // === Footer ===
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Documento generado digitalmente el ${dateStr} • Válido sin firma y sello.`, centerX, pageHeight - 7, { align: 'center' });

    doc.save(`Constancia_Inscripcion_${data.studentName.replace(/\s+/g, '_')}.pdf`);
};

/**
 * Generate a "Constancia de Notas" PDF
 */
export const generateGradesCertificate = (
    data: CertificateData,
    grades: Array<{ unit: string; score: number | string }>
) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;

    // === Header ===
    doc.setFillColor(13, 89, 242);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setFillColor(127, 13, 242);
    doc.rect(0, 40, pageWidth, 3, 'F');

    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('ULTRA TECNOLOGÍA', centerX, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Centro de Formación Técnica y Profesional', centerX, 28, { align: 'center' });
    doc.setFontSize(8);
    doc.text('Guatemala, C.A.', centerX, 34, { align: 'center' });

    // === Title ===
    doc.setFontSize(20);
    doc.setTextColor(13, 89, 242);
    doc.setFont('helvetica', 'bold');
    doc.text('CONSTANCIA DE NOTAS', centerX, 65, { align: 'center' });
    doc.setDrawColor(13, 89, 242);
    doc.setLineWidth(0.8);
    doc.line(centerX - 45, 69, centerX + 45, 69);

    // === Student Info ===
    let y = 85;
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');

    const infoLeft = 30;
    doc.text('Estudiante:', infoLeft, y);
    doc.setFont('helvetica', 'bold');
    doc.text(data.studentName, infoLeft + 28, y);

    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text('Código:', infoLeft, y);
    doc.setFont('helvetica', 'bold');
    doc.text(data.personalCode || 'N/A', infoLeft + 28, y);

    if (data.courseName) {
        y += 8;
        doc.setFont('helvetica', 'normal');
        doc.text('Curso:', infoLeft, y);
        doc.setFont('helvetica', 'bold');
        doc.text(data.courseName, infoLeft + 28, y);
    }

    // === Grades Table ===
    y += 15;
    const tableStartX = 40;
    const colWidth = pageWidth - 80;
    const unitColW = colWidth * 0.65;
    const scoreColW = colWidth * 0.35;

    // Table header
    doc.setFillColor(13, 89, 242);
    doc.rect(tableStartX, y, colWidth, 10, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('Unidad / Evaluación', tableStartX + 5, y + 7);
    doc.text('Nota', tableStartX + unitColW + scoreColW / 2, y + 7, { align: 'center' });
    y += 10;

    // Table rows
    grades.forEach((g, idx) => {
        const bgColor = idx % 2 === 0 ? [248, 250, 252] : [255, 255, 255];
        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.rect(tableStartX, y, colWidth, 9, 'F');

        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'normal');
        doc.text(String(g.unit), tableStartX + 5, y + 6.5);

        const scoreVal = g.score !== '' && g.score !== null ? Number(g.score) : null;
        const scoreStr = scoreVal !== null ? scoreVal.toFixed(1) : 'Pendiente';
        doc.setFont('helvetica', 'bold');
        if (scoreVal !== null && scoreVal >= 60) {
            doc.setTextColor(16, 185, 129); // emerald
        } else if (scoreVal !== null) {
            doc.setTextColor(239, 68, 68); // red
        } else {
            doc.setTextColor(148, 163, 184); // slate
        }
        doc.text(scoreStr, tableStartX + unitColW + scoreColW / 2, y + 6.5, { align: 'center' });
        y += 9;
    });

    // Table border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(tableStartX, y - grades.length * 9 - 10, colWidth, grades.length * 9 + 10);

    // Average
    const validScores = grades.filter(g => g.score !== '' && g.score !== null).map(g => Number(g.score));
    if (validScores.length > 0) {
        y += 5;
        const avg = (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(13, 89, 242);
        doc.text(`Promedio General: ${avg}`, centerX, y + 5, { align: 'center' });
        y += 10;
    }

    // Date
    const dateStr = new Date().toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });
    y += 15;
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(`Guatemala, ${dateStr}.`, centerX, y, { align: 'center' });

    // Signature
    y += 30;
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.5);
    doc.line(centerX - 40, y, centerX + 40, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Director(a)', centerX, y, { align: 'center' });
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Ultra Tecnología', centerX, y, { align: 'center' });

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(248, 250, 252);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Documento generado digitalmente el ${dateStr} • Válido sin firma y sello.`, centerX, pageHeight - 7, { align: 'center' });

    doc.save(`Constancia_Notas_${data.studentName.replace(/\s+/g, '_')}.pdf`);
};
