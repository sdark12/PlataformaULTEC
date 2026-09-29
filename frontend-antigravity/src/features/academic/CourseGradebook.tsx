import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCourses, getCourseSchedules } from './academicService';
import { getCourseGradebook, getCourseActaAuthStatus, requestCourseActaAuth } from './gradeService';
import { getCurrentUser } from '../../features/auth/authService';
import { Loader2, BookOpen, Printer, Award, ShieldAlert, Clock } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfDoc } from '../../utils/fileDownloader';
import SearchableSelect, { type SearchableOption } from '../../components/ui/SearchableSelect';

const CourseGradebook = () => {
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [selectedSchedule, setSelectedSchedule] = useState<string>('');

    const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: getCourses });

    const courseOptions = useMemo<SearchableOption[]>(() => {
        if (!courses) return [];
        return courses.map((c: any) => ({
            value: c.id,
            label: c.name,
            subLabel: c.monthly_fee ? `Q${c.monthly_fee}/mes` : undefined,
        }));
    }, [courses]);

    // Auto-select first course if none selected
    useEffect(() => {
        if (courses && courses.length > 0 && !selectedCourse) {
            setSelectedCourse(courses[0].id);
        }
    }, [courses, selectedCourse]);

    const { data: schedules } = useQuery({
        queryKey: ['course_schedules', selectedCourse],
        queryFn: () => getCourseSchedules(selectedCourse),
        enabled: !!selectedCourse,
    });

    const { data: gradebook, isLoading, isFetching } = useQuery({
        queryKey: ['course_gradebook', selectedCourse, selectedSchedule],
        queryFn: () => getCourseGradebook(selectedCourse, selectedSchedule),
        enabled: !!selectedCourse,
    });

    const user = getCurrentUser();
    const isSecretary = user?.role === 'secretary';
    const [isRequestingAuth, setIsRequestingAuth] = useState(false);

    const { data: authData, refetch: refetchAuth } = useQuery({
        queryKey: ['course_acta_auth', selectedCourse],
        queryFn: () => getCourseActaAuthStatus(selectedCourse),
        enabled: !!selectedCourse && isSecretary,
        refetchInterval: 10000,
    });

    const isActaApproved = authData?.status === 'APPROVED';
    const isActaPending = authData?.status === 'PENDING';

    const handleRequestActaAuth = async () => {
        if (!selectedCourse) return;
        setIsRequestingAuth(true);
        try {
            await requestCourseActaAuth(selectedCourse);
            alert('Solicitud enviada a la Administración. Cuando sea aprobada por Dirección, se habilitará la descarga e impresión del Acta en PDF.');
            refetchAuth();
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Error al solicitar autorización para el acta');
        } finally {
            setIsRequestingAuth(false);
        }
    };

    const generatePDF = async () => {
        if (!gradebook) return;

        const doc = new jsPDF({ orientation: 'landscape', format: 'letter' });

        // Headers & Title
        doc.setFontSize(18);
        doc.text('ACTA OFICIAL DE CALIFICACIONES', 14, 22);

        doc.setFontSize(11);
        doc.text(`Curso: ${gradebook.course_name}`, 14, 30);

        let headerText = `Generado el: ${new Date().toLocaleDateString('es-ES')}`;
        if (selectedSchedule && schedules) {
            const sched = schedules.find((s: any) => s.id === parseInt(selectedSchedule));
            if (sched) {
                headerText += ` | Horario: ${sched.grade} - ${sched.day_of_week}`;
            }
        }
        doc.text(headerText, 14, 36);

        // Map Table Columns
        const tableHeaders = [
            'No.',
            'Nombre del Estudiante',
            ...gradebook.units,
            'Prom. Ordinario',
            'Recuperación',
            'Nota Final',
            'Resultado'
        ];

        // Map Table Rows
        const tableData = gradebook.students.map((student: any, idx: number) => {
            const row: any[] = [
                idx + 1,
                student.student_name
            ];

            gradebook.units.forEach((unitName: string) => {
                const unitData = student.units[unitName];
                row.push(unitData && unitData.score !== null && unitData.score !== undefined ? unitData.score : '-');
            });

            row.push(student.ordinary_average !== null && student.ordinary_average !== undefined ? student.ordinary_average : '--');

            const recup = student.recuperation_score !== null && student.recuperation_score !== undefined
                ? student.recuperation_score
                : (student.units['Recuperación']?.score ?? '-');
            row.push(recup !== null && recup !== undefined ? recup : '-');

            row.push(student.final_score !== null && student.final_score !== undefined ? student.final_score : (Number(student.average) > 0 ? student.average : '--'));
            row.push(student.status_label || (Number(student.average) >= 60 ? 'Aprobado' : 'Reprobado'));
            return row;
        });

        // Inject AutoTable with high density
        autoTable(doc, {
            startY: 40,
            head: [tableHeaders],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [67, 56, 202], // Indigo
                fontSize: 7.5,
                halign: 'center',
                valign: 'middle',
                cellPadding: 1.5
            },
            bodyStyles: {
                fontSize: 7,
                halign: 'center',
                textColor: [40, 40, 40],
                cellPadding: 1 // High density padding
            },
            columnStyles: {
                0: { halign: 'center', minCellWidth: 8 },
                1: { halign: 'left', fontStyle: 'bold', minCellWidth: 40 }
            },
            styles: {
                overflow: 'linebreak',
                lineColor: [220, 220, 220],
                lineWidth: 0.1
            },
            didParseCell: function (data) {
                // Formatting failing grades in red
                if (data.section === 'body' && data.column.index > 1 && data.column.index < tableHeaders.length - 1) {
                    const val = data.cell.raw;
                    if (val !== '-' && val !== '--') {
                        const num = Number(val);
                        if (!isNaN(num) && num < 60) {
                            data.cell.styles.textColor = [225, 29, 72]; // Rose-600
                            data.cell.styles.fontStyle = 'bold';
                        } else if (!isNaN(num)) {
                            data.cell.styles.textColor = [5, 150, 105]; // Emerald-600
                        }
                    }
                }

                // Final average column formatting
                if (data.section === 'body' && data.column.index === tableHeaders.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    const val = data.cell.raw;
                    if (val !== '--') {
                        const num = Number(val);
                        if (!isNaN(num) && num < 60) {
                            data.cell.styles.textColor = [190, 18, 60]; // Rose-700
                            data.cell.styles.fillColor = [255, 228, 230]; // Rose-50 (light red background)
                        } else if (!isNaN(num)) {
                            data.cell.styles.textColor = [4, 120, 87]; // Emerald-700
                            data.cell.styles.fillColor = [209, 250, 229]; // Emerald-50 (light green background)
                        }
                    }
                }
            }
        });

        // Signatures and Footer
        const finalY = (doc as any).lastAutoTable.finalY || 40;
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();

        if (finalY + 40 > pageHeight) {
            doc.addPage();
        }

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Total Estudiantes: ${gradebook.students.length}`, 14, pageHeight - 20);

        // Signature Line
        doc.setDrawColor(150, 150, 150);
        doc.line(pageWidth - 80, pageHeight - 25, pageWidth - 14, pageHeight - 25);
        doc.text('Sello y Firma Catedrático', pageWidth - 65, pageHeight - 18);

        // Trigger Download
        await savePdfDoc(doc, `Acta_de_Curso_${gradebook.course_name.replace(/\s+/g, '_')}.pdf`);
    };

    return (
        <div className="max-w-7xl mx-auto pb-12">
            {/* Control Panel (Hidden during print) */}
            <div className="print:hidden">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Acta de Calificaciones (Sábana)</h2>
                        <p className="text-slate-500 mt-1">Visualiza y analiza el consolidado de todas las notas del salón.</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 mb-8 max-w-2xl flex flex-col sm:flex-row gap-4 items-end relative z-30 overflow-visible">
                    <div className="flex-1 w-full relative z-40 overflow-visible">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Seleccionar Curso</label>
                        <SearchableSelect
                            options={courseOptions}
                            value={selectedCourse}
                            onChange={(val) => {
                                setSelectedCourse(val);
                                setSelectedSchedule('');
                            }}
                            placeholder="-- Elige un curso --"
                            searchPlaceholder="Buscar curso..."
                        />
                    </div>

                    <div className="flex-1 w-full relative">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Seleccionar Horario</label>
                        <select
                            className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none outline-none font-medium disabled:opacity-50"
                            value={selectedSchedule}
                            onChange={(e) => setSelectedSchedule(e.target.value)}
                            disabled={!selectedCourse}
                        >
                            <option value="">Todos los Horarios</option>
                            {schedules?.map((s: any) => (
                                <option key={s.id} value={s.id}>
                                    {s.grade} - {s.day_of_week} {s.start_time ? `(${s.start_time.substring(0, 5)})` : ''}
                                </option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center mt-7 pointer-events-none text-slate-500">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>

                    {selectedCourse && gradebook && !isFetching && !isLoading && (
                        isSecretary ? (
                            isActaApproved ? (
                                <div className="flex items-center gap-2">
                                    <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 rounded-xl border border-emerald-500/20">
                                        <Award className="w-3.5 h-3.5" /> Acta Autorizada
                                    </span>
                                    <button
                                        onClick={generatePDF}
                                        className="flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-md hover:bg-emerald-700 transition-all active:scale-95 whitespace-nowrap"
                                    >
                                        <Printer className="w-5 h-5" />
                                        <span>Exportar PDF</span>
                                    </button>
                                </div>
                            ) : isActaPending ? (
                                <button
                                    disabled
                                    className="flex items-center justify-center space-x-2 px-5 py-3 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold rounded-xl border border-amber-500/30 cursor-not-allowed whitespace-nowrap text-xs shadow-sm"
                                >
                                    <Clock className="w-4 h-4 animate-spin text-amber-600" />
                                    <span>Solicitud Pendiente de Dirección</span>
                                </button>
                            ) : (
                                <button
                                    onClick={handleRequestActaAuth}
                                    disabled={isRequestingAuth}
                                    className="flex items-center justify-center space-x-2 px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(217,119,6,0.3)] transition-all active:scale-95 whitespace-nowrap text-xs"
                                >
                                    {isRequestingAuth ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                                    <span>Solicitar Aprobación para Descargar</span>
                                </button>
                            )
                        ) : (
                            <button
                                onClick={generatePDF}
                                className="flex items-center justify-center space-x-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap"
                            >
                                <Printer className="w-5 h-5" />
                                <span>Exportar PDF</span>
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Banner de Seguridad para Secretaría */}
            {isSecretary && selectedCourse && gradebook && !isActaApproved && (
                <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3 shadow-sm print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-xl text-amber-600 shrink-0">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-bold text-sm text-amber-950 dark:text-amber-100">Filtro de Seguridad Institucional: Descarga de Actas Oficiales</p>
                            <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                                Puedes auditar y revisar las notas del curso en pantalla. Para exportar el archivo PDF o imprimir el acta oficial, presiona <strong>"Solicitar Aprobación para Descargar"</strong> para que Dirección la habilite.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Document / Report to Print */}
            {isLoading || isFetching ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-100 print:hidden">
                    <Loader2 className="animate-spin h-10 w-10 text-blue-500 mb-4" />
                    <p className="text-slate-500 font-medium">Generando acta del salón...</p>
                </div>
            ) : !selectedCourse ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-300 print:hidden">
                    <BookOpen className="mx-auto h-16 w-16 text-slate-300 mb-4" />
                    <h3 className="text-xl font-bold text-slate-500">Ningún curso seleccionado</h3>
                    <p className="text-slate-400 mt-2 max-w-sm mx-auto text-sm">Selecciona un curso arriba para ver la matriz completa de notas de todos los estudiantes inscritos.</p>
                </div>
            ) : gradebook && gradebook.students.length > 0 ? (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200/60 print:shadow-none print:border-none print:p-0">

                    {/* Header Documento Presencial */}
                    <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8 mt-4 print:mt-0">
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-widest">Ultra Tecnología</h1>
                            <p className="text-slate-500 font-bold tracking-widest mt-1 uppercase text-sm">Acta Oficial de Calificaciones</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold text-slate-800">{gradebook.course_name}</h2>
                            <p className="text-slate-500 text-xs mt-1">Fecha Emisión: {new Date().toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto print:overflow-visible">
                        <table className="w-full text-left text-sm whitespace-nowrap border-collapse print-compact-table">
                            <thead>
                                <tr className="border-b-2 border-slate-800">
                                    <th className="px-4 py-3 font-bold text-slate-700 w-10 text-center">No.</th>
                                    <th className="px-4 py-3 font-bold text-slate-700 min-w-[200px]">Nombre del Estudiante</th>
                                    {gradebook.units.map((unitName: string) => (
                                        <th key={unitName} className="px-4 py-3 font-bold text-slate-700 text-center bg-slate-50/50 border-x border-slate-100">{unitName}</th>
                                    ))}
                                    <th className="px-4 py-3 font-bold text-blue-800 text-center bg-blue-50/60 border-x border-blue-100">Prom. Ordinario</th>
                                    <th className="px-4 py-3 font-bold text-amber-800 text-center bg-amber-50/60 border-x border-amber-100">Recuperación</th>
                                    <th className="px-4 py-3 font-black text-indigo-700 text-center text-base bg-indigo-50 border-l-2 border-indigo-200 border-r-2">NOTA FINAL</th>
                                    <th className="px-4 py-3 font-bold text-slate-700 text-center bg-slate-50/50">Resultado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {gradebook.students.map((student: any, idx: number) => {
                                    const recup = student.recuperation_score ?? (student.units['Recuperación']?.score ?? null);
                                    const finalScore = student.final_score ?? (Number(student.average) > 0 ? student.average : null);
                                    const isPass = finalScore !== null && Number(finalScore) >= 60;
                                    const status = student.status;
                                    const label = student.status_label || (isPass ? 'Aprobado' : 'Reprobado');

                                    return (
                                        <tr key={student.student_id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-3 text-slate-500 text-center">{idx + 1}</td>
                                            <td className="px-4 py-3 font-bold text-slate-800">{student.student_name}</td>

                                            {/* Dynamic Unit Cells */}
                                            {gradebook.units.map((unitName: string) => {
                                                const unitData = student.units[unitName];
                                                const score = unitData ? unitData.score : null;
                                                return (
                                                    <td key={unitName} className="px-4 py-3 text-center border-x border-slate-100 font-medium">
                                                        {score !== null ? (
                                                            <span className={Number(score) >= 60 ? 'text-emerald-600' : 'text-rose-600 font-bold'}>
                                                                {score}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}

                                            {/* Promedio Ordinario */}
                                            <td className="px-4 py-3 text-center border-x border-blue-100 font-semibold bg-blue-50/20 text-slate-700">
                                                {student.ordinary_average !== null && student.ordinary_average !== undefined ? student.ordinary_average : '--'}
                                            </td>

                                            {/* Recuperación */}
                                            <td className="px-4 py-3 text-center border-x border-amber-100 font-semibold bg-amber-50/20">
                                                {recup !== null && recup !== undefined ? (
                                                    <span className={Number(recup) >= 60 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                                        {recup}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>

                                            {/* Final Score Cell */}
                                            <td className={`px-4 py-3 text-center border-l-2 border-indigo-200 border-r-2 font-black text-lg ${isPass ? 'text-emerald-700 bg-emerald-50/30' : 'text-rose-700 bg-rose-50/30'}`}>
                                                {finalScore !== null ? finalScore : '--'}
                                            </td>

                                            {/* Resultado / Status */}
                                            <td className="px-4 py-3 text-center font-medium">
                                                {status === 'APROBADO' && (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                        Aprobado
                                                    </span>
                                                )}
                                                {status === 'APROBADO_RECUPERACION' && (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-300">
                                                        Aprobado (Recup.)
                                                    </span>
                                                )}
                                                {status === 'REPROBADO' && (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                                        Reprobado
                                                    </span>
                                                )}
                                                {status === 'REQUIERE_RECUPERACION' && (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                                        En Recuperación
                                                    </span>
                                                )}
                                                {status === 'EN_RIESGO' && (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">
                                                        En Riesgo
                                                    </span>
                                                )}
                                                {(!status || status === 'PENDIENTE') && (
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300">
                                                        {label}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer / Summary Stats */}
                    <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-3 gap-8">
                        <div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Estudiantes</p>
                            <p className="text-2xl font-bold text-slate-800">{gradebook.students.length}</p>
                        </div>
                        <div className="col-span-2 text-right">
                            <div className="border-b border-slate-400 mt-16 w-64 ml-auto"></div>
                            <p className="text-sm font-bold text-slate-600 mt-2">Sello y Firma Catedrático</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-300 print:hidden">
                    <Award className="mx-auto h-16 w-16 text-slate-300 mb-4" />
                    <h3 className="text-xl font-bold text-slate-500">El curso está vacío</h3>
                    <p className="text-slate-400 mt-2 max-w-sm mx-auto text-sm">Aún no hay estudiantes inscritos en este curso o activos.</p>
                </div>
            )}

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 10mm; size: letter; }
                    body { 
                        background: white; 
                        -webkit-print-color-adjust: exact; 
                        print-color-adjust: exact;
                        zoom: 85%;
                    }
                    #root { height: auto !important; overflow: visible !important; }
                    .print-compact-table td, .print-compact-table th {
                        padding-top: 0.5rem !important;
                        padding-bottom: 0.5rem !important;
                        font-size: 0.8rem !important;
                    }
                }
            `}} />
        </div>
    );
};

export default CourseGradebook;
