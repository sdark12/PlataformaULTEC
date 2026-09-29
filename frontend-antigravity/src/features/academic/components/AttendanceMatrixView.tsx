import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAttendanceMatrix } from '../attendanceService';
import type { AttendanceMatrixStudent } from '../attendanceService';
import { 
    Loader2, Calendar, FileSpreadsheet, Download, Search, AlertTriangle, 
    ChevronLeft, ChevronRight, Users, CheckCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AttendanceMatrixViewProps {
    courseId: string;
    courseName?: string;
    scheduleId?: string;
}

const AttendanceMatrixView = ({ courseId, courseName, scheduleId }: AttendanceMatrixViewProps) => {
    const now = new Date();
    const currentMonthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthString);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [showOnlyAtRisk, setShowOnlyAtRisk] = useState<boolean>(false);

    const { data: matrixData, isLoading, error } = useQuery({
        queryKey: ['attendance_matrix', courseId, selectedMonth, scheduleId],
        queryFn: () => getAttendanceMatrix(courseId, selectedMonth, scheduleId),
        enabled: !!courseId,
    });

    const handleAdjustMonth = (delta: number) => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(newMonth);
    };

    const formattedMonthHeader = (() => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const d = new Date(y, m - 1, 1);
        return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    })();

    const students: AttendanceMatrixStudent[] = matrixData?.students || [];
    const activeDates: string[] = matrixData?.active_dates || [];

    // Filtros
    const filteredStudents = students.filter((s) => {
        const matchesSearch = s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.student_code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRisk = showOnlyAtRisk ? s.is_at_risk : true;
        return matchesSearch && matchesRisk;
    });

    // Métricas del mes
    const totalStudents = students.length;
    const atRiskCount = students.filter((s) => s.is_at_risk).length;
    const avgAttendance = totalStudents > 0
        ? Math.round(students.reduce((acc, s) => acc + s.attendance_percentage, 0) / totalStudents)
        : 100;

    // Exportación a Excel
    const handleExportExcel = () => {
        if (!students.length) return;

        const rows = students.map((s) => {
            const row: Record<string, any> = {
                'Código': s.student_code,
                'Estudiante': s.student_name,
                'Teléfono': s.phone || '',
                'Acudiente': s.guardian_phone || '',
            };

            activeDates.forEach((d) => {
                row[d] = s.days[d] || '-';
            });

            row['Presentes'] = s.present_count;
            row['Ausentes'] = s.absent_count;
            row['Tardes'] = s.late_count;
            row['Excusados'] = s.excused_count;
            row['% Asistencia'] = `${s.attendance_percentage}%`;
            row['Estado'] = s.is_at_risk ? 'EN RIESGO' : 'NORMAL';

            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Asistencia Mensual');
        XLSX.writeFile(workbook, `Sabana_Asistencia_${courseName || 'Curso'}_${selectedMonth}.xlsx`);
    };

    // Exportación a PDF
    const handleExportPDF = () => {
        if (!students.length) return;

        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(14);
        doc.text(`Sábana de Asistencia - ${courseName || 'Curso'} (${formattedMonthHeader})`, 14, 15);
        doc.setFontSize(9);
        doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')} | Total estudiantes: ${totalStudents} | En riesgo: ${atRiskCount}`, 14, 21);

        const headColumns = ['Código', 'Estudiante', ...activeDates.map(d => d.slice(8, 10)), 'P', 'A', 'T', 'E', '%'];
        const bodyRows = students.map((s) => [
            s.student_code,
            s.student_name,
            ...activeDates.map(d => s.days[d] === 'PRESENT' ? 'P' : s.days[d] === 'ABSENT' ? 'A' : s.days[d] === 'LATE' ? 'T' : s.days[d] === 'EXCUSED' ? 'E' : '-'),
            s.present_count,
            s.absent_count,
            s.late_count,
            s.excused_count,
            `${s.attendance_percentage}%`
        ]);

        autoTable(doc, {
            head: [headColumns],
            body: bodyRows,
            startY: 25,
            styles: { fontSize: 7, cellPadding: 1.5, halign: 'center' },
            columnStyles: {
                0: { halign: 'left', cellWidth: 22 },
                1: { halign: 'left', cellWidth: 40 },
            },
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] }
        });

        doc.save(`Sabana_Asistencia_${selectedMonth}.pdf`);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PRESENT':
                return <span className="inline-block w-6 h-6 leading-6 text-center rounded-lg bg-emerald-500/20 text-emerald-400 font-black text-[11px] border border-emerald-500/40">P</span>;
            case 'ABSENT':
                return <span className="inline-block w-6 h-6 leading-6 text-center rounded-lg bg-rose-500/20 text-rose-400 font-black text-[11px] border border-rose-500/40">A</span>;
            case 'LATE':
                return <span className="inline-block w-6 h-6 leading-6 text-center rounded-lg bg-amber-500/20 text-amber-400 font-black text-[11px] border border-amber-500/40">T</span>;
            case 'EXCUSED':
                return <span className="inline-block w-6 h-6 leading-6 text-center rounded-lg bg-blue-500/20 text-blue-400 font-black text-[11px] border border-blue-500/40">E</span>;
            default:
                return <span className="text-slate-600 font-medium text-xs">•</span>;
        }
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* Controles de Mes y Exportación */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Selector de Mes */}
                <div className="flex items-center space-x-2">
                    <button
                        type="button"
                        onClick={() => handleAdjustMonth(-1)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                        title="Mes anterior"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/90 border border-slate-700 rounded-xl">
                        <Calendar className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="text-sm font-bold text-slate-100 capitalize">
                            {formattedMonthHeader}
                        </span>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                            className="w-5 opacity-0 cursor-pointer absolute"
                            title="Seleccionar mes"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => handleAdjustMonth(1)}
                        className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
                        title="Mes siguiente"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                {/* Métricas Rápidas del Mes */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <div className="px-3 py-1.5 bg-slate-800/70 border border-slate-700/80 rounded-xl flex items-center gap-2 text-xs">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-slate-400">Total:</span>
                        <span className="font-bold text-white">{totalStudents}</span>
                    </div>
                    <div className="px-3 py-1.5 bg-slate-800/70 border border-slate-700/80 rounded-xl flex items-center gap-2 text-xs">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-slate-400">Promedio:</span>
                        <span className={`font-bold ${avgAttendance >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{avgAttendance}%</span>
                    </div>
                    {atRiskCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowOnlyAtRisk(!showOnlyAtRisk)}
                            className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all border ${
                                showOnlyAtRisk 
                                    ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30' 
                                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
                            }`}
                        >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{atRiskCount} en Riesgo (&lt;75%)</span>
                        </button>
                    )}
                </div>

                {/* Botones de Descarga */}
                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={students.length === 0}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-xl border border-emerald-500/30 transition-all text-xs disabled:opacity-50"
                        title="Descargar cuadrícula en Excel"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Excel</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleExportPDF}
                        disabled={students.length === 0}
                        className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-xl border border-rose-500/30 transition-all text-xs disabled:opacity-50"
                        title="Descargar sábana en PDF"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                    </button>
                </div>
            </div>

            {/* Barra de Búsqueda */}
            <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por estudiante o código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-800 text-slate-200 text-xs rounded-xl outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
                    />
                </div>

                {/* Leyenda de Estados */}
                <div className="hidden sm:flex items-center gap-2.5 text-[11px] text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> P: Presente</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> A: Ausente</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> T: Tarde</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> E: Excusado</span>
                </div>
            </div>

            {/* Tabla Matriz en Sábana */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center p-16 bg-slate-900/60 rounded-3xl border border-slate-800 text-slate-400">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-500 mb-3" />
                    <p className="text-sm font-medium">Cargando matriz mensual de asistencia...</p>
                </div>
            ) : error ? (
                <div className="p-8 text-center bg-rose-500/10 border border-rose-500/20 rounded-3xl text-rose-400 text-xs">
                    Error al cargar los datos de la sábana de asistencia.
                </div>
            ) : filteredStudents.length > 0 ? (
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-700">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-950/95 sticky top-0 z-20 border-b border-slate-800 uppercase tracking-wider text-[10px] text-slate-400">
                                <tr>
                                    <th className="px-4 py-3.5 sticky left-0 z-30 bg-slate-950 min-w-[200px] shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                                        Estudiante
                                    </th>
                                    {activeDates.length === 0 ? (
                                        <th className="px-4 py-3 text-center text-slate-500 italic font-normal">
                                            Sin clases registradas en este mes
                                        </th>
                                    ) : (
                                        activeDates.map((d) => {
                                            const dayNum = d.slice(8, 10);
                                            const dayOfWeek = new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'narrow' }).toUpperCase();
                                            return (
                                                <th key={d} className="px-2 py-3 text-center min-w-[36px] font-bold">
                                                    <span className="block text-[9px] text-slate-500">{dayOfWeek}</span>
                                                    <span>{dayNum}</span>
                                                </th>
                                            );
                                        })
                                    )}
                                    {/* Resúmenes */}
                                    <th className="px-2.5 py-3 text-center bg-slate-950/90 text-emerald-400 min-w-[32px]" title="Total Presentes">P</th>
                                    <th className="px-2.5 py-3 text-center bg-slate-950/90 text-rose-400 min-w-[32px]" title="Total Ausentes">A</th>
                                    <th className="px-2.5 py-3 text-center bg-slate-950/90 text-amber-400 min-w-[32px]" title="Total Tardes">T</th>
                                    <th className="px-2.5 py-3 text-center bg-slate-950/90 text-blue-400 min-w-[32px]" title="Total Excusas">E</th>
                                    <th className="px-4 py-3 text-center bg-slate-950/90 min-w-[70px]">Rendimiento</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {filteredStudents.map((s) => (
                                    <tr 
                                        key={s.student_id} 
                                        className={`hover:bg-slate-800/40 transition-colors ${s.is_at_risk ? 'bg-rose-500/5' : ''}`}
                                    >
                                        {/* Columna Estudiante fija */}
                                        <td className="px-4 py-3 sticky left-0 z-10 bg-slate-900/95 font-medium text-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                                            <div className="flex items-center space-x-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-[10px] shrink-0">
                                                    {s.student_name.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-100 text-xs truncate max-w-[150px]">
                                                        {s.student_name}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 font-mono">
                                                        {s.student_code}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Celdas por día */}
                                        {activeDates.length === 0 ? (
                                            <td className="text-center text-slate-600 text-xs py-3">-</td>
                                        ) : (
                                            activeDates.map((d) => (
                                                <td key={d} className="px-1.5 py-2 text-center">
                                                    {getStatusBadge(s.days[d])}
                                                </td>
                                            ))
                                        )}

                                        {/* Totales */}
                                        <td className="px-2 py-3 text-center font-bold text-emerald-400 bg-emerald-500/5">{s.present_count}</td>
                                        <td className="px-2 py-3 text-center font-bold text-rose-400 bg-rose-500/5">{s.absent_count}</td>
                                        <td className="px-2 py-3 text-center font-bold text-amber-400 bg-amber-500/5">{s.late_count}</td>
                                        <td className="px-2 py-3 text-center font-bold text-blue-400 bg-blue-500/5">{s.excused_count}</td>

                                        {/* % Asistencia */}
                                        <td className="px-3 py-3 text-center">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                                    s.is_at_risk 
                                                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse'
                                                        : s.attendance_percentage >= 80 
                                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                                }`}>
                                                    {s.attendance_percentage}%
                                                </span>
                                                {s.is_at_risk && (
                                                    <span className="text-[9px] text-rose-400 font-bold uppercase tracking-tight">Riesgo</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="text-center py-16 bg-slate-900/60 rounded-3xl border border-dashed border-slate-800">
                    <Calendar className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                    <h3 className="text-base font-bold text-slate-200">No se encontraron registros</h3>
                    <p className="text-slate-400 text-xs mt-1">No hay datos de asistencia para el mes y filtros seleccionados.</p>
                </div>
            )}
        </div>
    );
};

export default AttendanceMatrixView;
