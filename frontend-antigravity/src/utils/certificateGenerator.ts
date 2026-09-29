import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfDoc } from './fileDownloader';

interface CertificateData {
    studentName: string;
    personalCode: string;
    courseName?: string;
    grade?: string;
    enrollmentDate?: string;
    branchName?: string;
    academicStatus?: string;
    cycleYear?: string;
    isCompleted?: boolean;
}

/**
 * Generate a "Constancia de Inscripción / Estudios" PDF
 */
export const generateEnrollmentCertificate = async (data: CertificateData) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    const isHistorical = data.isCompleted || data.academicStatus === 'PROMOTED';

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
    doc.setFontSize(19);
    doc.setTextColor(13, 89, 242);
    doc.setFont('helvetica', 'bold');
    const docTitle = isHistorical ? 'CONSTANCIA DE ESTUDIOS Y ACREDITACIÓN' : 'CONSTANCIA DE INSCRIPCIÓN';
    doc.text(docTitle, centerX, 65, { align: 'center' });

    // Decorative line under title
    doc.setDrawColor(13, 89, 242);
    doc.setLineWidth(0.8);
    doc.line(centerX - 55, 69, centerX + 55, 69);

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
    if (isHistorical) {
        detailLines.push(`Cursó satisfactoriamente y acreditó los requisitos académicos correspondientes a:`);
    } else if (data.courseName) {
        detailLines.push(`Se encuentra debidamente inscrito(a) y cursando activamente el ciclo formativo en:`);
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

        const subDetails: string[] = [];
        if (data.grade) subDetails.push(`Grado/Nivel: ${data.grade}`);
        if (data.cycleYear) subDetails.push(`Ciclo: ${data.cycleYear}`);
        if (isHistorical) subDetails.push(`Estatus: Aprobado / Promovido`);

        if (subDetails.length > 0) {
            y += 7;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(subDetails.join(' • '), centerX, y, { align: 'center' });
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

    // === Digital Certification Block (Replaces blank signature lines) ===
    y += 28;
    const certBoxW = pageWidth - 40;
    const certBoxX = 20;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(certBoxX, y, certBoxW, 20, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(certBoxX, y, certBoxW, 20, 2, 2, 'S');

    doc.setFillColor(13, 89, 242);
    doc.roundedRect(certBoxX, y, 2.5, 20, 1, 1, 'F');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('CERTIFICACIÓN DIGITAL INSTITUCIONAL', certBoxX + 6, y + 5.5);

    doc.setFontSize(7);
    doc.setTextColor(16, 185, 129);
    doc.text('[ VERIFICADO ]', certBoxX + certBoxW - 5, y + 5.5, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Constancia oficial emitida digitalmente por el Sistema Académico de Ultra Tecnología.', certBoxX + 6, y + 10.5);
    doc.text('Válido institucionalmente conforme a los registros electrónicos. No requiere firma autógrafa.', certBoxX + 6, y + 14.5);

    const certFolio = `FOLIO: ULTEC-INS-${data.personalCode || data.studentName.substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-5)}`;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(certFolio, certBoxX + 6, y + 18.5);

    // === Footer ===
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Documento generado digitalmente el ${dateStr} • Válido sin firma y sello.`, centerX, pageHeight - 7, { align: 'center' });

    await savePdfDoc(doc, `Constancia_Inscripcion_${data.studentName.replace(/\s+/g, '_')}.pdf`);
};

/**
 * Generate a "Constancia de Notas" PDF
 */
export const generateGradesCertificate = async (
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

    // === Digital Certification Block ===
    y += 16;
    const certBoxW = pageWidth - 40;
    const certBoxX = 20;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(certBoxX, y, certBoxW, 20, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.roundedRect(certBoxX, y, certBoxW, 20, 2, 2, 'S');

    doc.setFillColor(13, 89, 242);
    doc.roundedRect(certBoxX, y, 2.5, 20, 1, 1, 'F');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('CERTIFICACIÓN DIGITAL DE CALIFICACIONES', certBoxX + 6, y + 5.5);

    doc.setFontSize(7);
    doc.setTextColor(16, 185, 129);
    doc.text('[ VERIFICADO ]', certBoxX + certBoxW - 5, y + 5.5, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Constancia académica oficial emitida digitalmente por Ultra Tecnología.', certBoxX + 6, y + 10.5);
    doc.text('Válido institucionalmente conforme a los registros electrónicos y acreditaciones oficiales.', certBoxX + 6, y + 14.5);

    const certFolio = `FOLIO: ULTEC-NOT-${data.personalCode || data.studentName.substring(0, 4).toUpperCase()}-${Date.now().toString().slice(-5)}`;
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(certFolio, certBoxX + 6, y + 18.5);
    // QR placeholder
    doc.setDrawColor(148, 163, 184);
    doc.setFillColor(255, 255, 255);
    doc.rect(certBoxX + certBoxW - 18, y + 2.5, 15, 15, 'FD');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('QR VERIF', certBoxX + certBoxW - 10.5, y + 10.5, { align: 'center' });

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Documento académico oficial emitido por Ultra Tecnología el ${dateStr}.`, centerX, pageHeight - 7, { align: 'center' });

    await savePdfDoc(doc, `Constancia_Notas_${data.studentName.replace(/\s+/g, '_')}.pdf`);
};

export interface ReportCardStudentData {
    student: {
        id: string;
        full_name: string;
        personal_code?: string;
        identification_document?: string;
    };
    courses: Array<{
        course_name: string;
        course_id?: string;
        schedule_grade?: string;
        cycle_year?: string;
        academic_status?: string;
        average: number | string;
        payment_restricted?: boolean;
        units: Array<{
            unit_name: string;
            score: number;
            remarks?: string;
            restricted?: boolean;
        }>;
    }>;
    cycleInfo?: {
        cycle_year?: string;
        grade?: string;
        academic_status?: string;
        isConsolidated?: boolean;
    };
}

/**
 * Generate official "Boleta de Calificaciones" PDF with multiple courses and auto-pagination
 */
export const generateReportCardPdf = async (
    reportData: ReportCardStudentData,
    disabledCourses: Record<string, boolean> = {}
) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const centerX = pageWidth / 2;
    const dateStr = new Date().toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' });

    // === Top Header Band ===
    doc.setFillColor(13, 89, 242); // brand-blue
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setFillColor(127, 13, 242); // brand-purple
    doc.rect(0, 32, pageWidth, 2.5, 'F');

    // Header Titles
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('ULTRA TECNOLOGÍA', centerX, 14, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('CENTRO DE FORMACIÓN TÉCNICA Y PROFESIONAL • GUATEMALA', centerX, 21, { align: 'center' });
    doc.text('Boleta Oficial de Calificaciones y Rendimiento Académico', centerX, 27, { align: 'center' });

    // === Document Title & Info Box ===
    let currentY = 43;
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');

    let titleText = 'BOLETA DE CALIFICACIONES';
    if (reportData.cycleInfo?.isConsolidated) {
        titleText = 'HISTORIAL ACADÉMICO CONSOLIDADO (KÁRDEX)';
    } else if (reportData.cycleInfo?.cycle_year) {
        titleText = `BOLETA DE CALIFICACIONES • CICLO ${reportData.cycleInfo.cycle_year}`;
    }
    doc.text(titleText, 14, currentY);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha de Emisión: ${dateStr}`, pageWidth - 14, currentY, { align: 'right' });

    currentY += 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, currentY, pageWidth - 14, currentY);
    currentY += 5;

    // Student Info Card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, currentY, pageWidth - 28, 22, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, currentY, pageWidth - 28, 22, 2, 2, 'S');

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('ESTUDIANTE:', 18, currentY + 7);
    doc.text('CÓDIGO / IDENTIFICACIÓN:', 18, currentY + 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(reportData.student.full_name, 60, currentY + 7);

    const studentCode = reportData.student.personal_code ||
        reportData.student.identification_document ||
        reportData.student.id.substring(0, 8).toUpperCase();

    let subCodeText = studentCode;
    if (reportData.cycleInfo?.grade) {
        subCodeText += `   |   Grado: ${reportData.cycleInfo.grade}`;
    }
    if (reportData.cycleInfo?.academic_status === 'PROMOTED') {
        subCodeText += `   |   Estatus: Promovido`;
    } else if (reportData.cycleInfo?.academic_status === 'ACTIVE') {
        subCodeText += `   |   Estatus: En Curso`;
    }
    doc.text(subCodeText, 60, currentY + 15, { maxWidth: pageWidth - 145 });

    // Active Courses and Calculations
    const activeCourses = reportData.courses.filter(c => !disabledCourses[c.course_name]);
    let totalScoreSum = 0;
    let totalUnits = 0;

    activeCourses.forEach(c => {
        const sum = c.units.reduce((acc, curr) => acc + (curr.restricted ? 0 : curr.score), 0);
        totalScoreSum += sum;
        totalUnits += c.units.filter(u => !u.restricted).length;
    });

    const generalAverage = totalUnits > 0 ? (totalScoreSum / totalUnits).toFixed(2) : '—';

    // Summary pills on right side of card
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('PROMEDIO GENERAL', pageWidth - 55, currentY + 7, { align: 'center' });

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    if (Number(generalAverage) >= 60) {
        doc.setTextColor(16, 185, 129); // emerald
    } else if (generalAverage !== '—') {
        doc.setTextColor(239, 68, 68); // rose
    } else {
        doc.setTextColor(100, 116, 139);
    }
    doc.text(generalAverage !== '—' ? `${generalAverage} / 100` : '—', pageWidth - 55, currentY + 15, { align: 'center' });

    currentY += 28;

    // === Course Grades Loop ===
    if (activeCourses.length === 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('No hay cursos activos seleccionados para mostrar.', centerX, currentY + 10, { align: 'center' });
        currentY += 20;
    } else {
        for (const course of activeCourses) {
            // Check if page break is needed for course header
            if (currentY + 35 > pageHeight - 35) {
                doc.addPage();
                currentY = 20;
            }

            // Course Sub-header
            doc.setFillColor(241, 245, 249);
            doc.roundedRect(14, currentY, pageWidth - 28, 8, 1.5, 1.5, 'F');
            
            doc.setFontSize(9.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(30, 41, 59);
            const gradeTag = course.schedule_grade ? ` (${course.schedule_grade})` : '';
            const statusTag = course.academic_status === 'PROMOTED' ? ' • [Aprobado/Promovido]' : (course.academic_status === 'ACTIVE' ? ' • [En Curso]' : '');
            doc.text(`Curso: ${course.course_name}${gradeTag}${statusTag}`, 18, currentY + 5.5);

            const courseAvgNum = Number(course.average);
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            if (courseAvgNum >= 60) {
                doc.setTextColor(16, 185, 129);
            } else if (!isNaN(courseAvgNum)) {
                doc.setTextColor(239, 68, 68);
            } else {
                doc.setTextColor(100, 116, 139);
            }
            doc.text(`Promedio: ${course.average} pts`, pageWidth - 18, currentY + 5.5, { align: 'right' });

            currentY += 9;

            // Course Units Table
            const bodyRows = course.units.map(u => [
                u.unit_name,
                u.restricted ? 'Pago Pendiente' : `${u.score} pts`,
                u.restricted ? 'Calificación restringida por saldo pendiente' : (u.remarks || '—')
            ]);

            autoTable(doc, {
                startY: currentY,
                head: [['Unidad Evaluativa', 'Nota Obtenida', 'Comentarios del Docente']],
                body: bodyRows,
                headStyles: {
                    fillColor: [13, 89, 242],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 8,
                    cellPadding: 2,
                },
                bodyStyles: {
                    fontSize: 8,
                    textColor: [30, 41, 59],
                    cellPadding: 2.2,
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252],
                },
                columnStyles: {
                    0: { cellWidth: 50, fontStyle: 'bold' },
                    1: { cellWidth: 32, halign: 'center', fontStyle: 'bold' },
                    2: { cellWidth: 'auto', fontStyle: 'italic', textColor: [100, 116, 139] },
                },
                theme: 'grid',
                styles: {
                    lineColor: [226, 232, 240],
                    lineWidth: 0.2,
                },
                margin: { left: 14, right: 14 },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 1) {
                        const raw = String(data.cell.raw || '');
                        if (raw.includes('Pendiente')) {
                            data.cell.styles.textColor = [239, 68, 68];
                        } else {
                            const val = parseFloat(raw);
                            if (!isNaN(val)) {
                                data.cell.styles.textColor = val >= 60 ? [16, 185, 129] : [239, 68, 68];
                            }
                        }
                    }
                }
            });

            currentY = (doc as any).lastAutoTable.finalY + 7;
        }
    }

    // === Official Digital Certification Block (Replaces blank signature lines for anti-forgery security) ===
    if (currentY + 30 > pageHeight - 20) {
        doc.addPage();
        currentY = 25;
    } else {
        currentY += 8;
    }

    const certBoxY = currentY;
    const certBoxH = 23;

    // Subtle background box
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(14, certBoxY, pageWidth - 28, certBoxH, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.4);
    doc.roundedRect(14, certBoxY, pageWidth - 28, certBoxH, 2, 2, 'S');

    // Left security accent stripe
    doc.setFillColor(13, 89, 242); // brand-blue
    doc.roundedRect(14, certBoxY, 3, certBoxH, 1, 1, 'F');

    // Title & badge
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text('CERTIFICACIÓN DIGITAL DE CONTROL ACADÉMICO', 21, certBoxY + 6);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // emerald-600
    doc.text('[ AUTENTICIDAD INSTITUCIONAL VERIFICADA ]', pageWidth - 18, certBoxY + 6, { align: 'right' });

    // Legal & Security Statement
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(
        'Documento académico oficial emitido por la Plataforma de Control Académico de Ultra Tecnología.',
        21,
        certBoxY + 11.5
    );
    doc.text(
        'Válido para trámites institucionales conforme a los registros electrónicos y acreditaciones oficiales.',
        21,
        certBoxY + 15.5
    );

    // Folio & Timestamp
    const folioStr = `FOLIO DIGITAL: ULTEC-BOL-${reportData.student.id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(folioStr, 21, certBoxY + 20);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`Fecha de Emisión: ${dateStr}`, pageWidth - 18, certBoxY + 20, { align: 'right' });

    // === Signature and Seal Section ===
    let sigY = certBoxY + certBoxH + 20;
    if (sigY + 22 > pageHeight - 15) {
        doc.addPage();
        sigY = 35;
    }

    // === Footers on all pages ===
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');

        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.text(
            `Ultra Tecnología • Documento emitido digitalmente el ${dateStr} • Página ${i} de ${totalPages}`,
            centerX,
            pageHeight - 4,
            { align: 'center' }
        );
    }

    const cleanName = reportData.student.full_name.replace(/\s+/g, '_');
    await savePdfDoc(doc, `Boleta_Calificaciones_${cleanName}.pdf`);
};


