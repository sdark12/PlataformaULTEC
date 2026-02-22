import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStudents } from './academicService';
import { getStudentReportCard } from './gradeService';
import { Loader2, Printer, Search, GraduationCap } from 'lucide-react';

const ReportCard = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [disabledCourses, setDisabledCourses] = useState<Record<string, boolean>>({});

    // Fetch students list for searching
    const { data: students, isLoading: loadingStudents } = useQuery({
        queryKey: ['students'],
        queryFn: getStudents
    });

    // Fetch report card data for selected student
    const { data: reportData, isLoading: loadingReport, isFetching } = useQuery({
        queryKey: ['report_card', selectedStudentId],
        queryFn: () => getStudentReportCard(selectedStudentId!),
        enabled: !!selectedStudentId,
    });

    const filteredStudents = students?.filter(s =>
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.identification_document && s.identification_document.includes(searchTerm))
    );

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="max-w-7xl mx-auto pb-12">

            {/* Control Panel (Hidden during print) */}
            <div className="print:hidden">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Boletas de Calificaciones</h2>
                        <p className="text-slate-500 mt-1">Genera y visualiza reportes consolidados del rendimiento estudiantil.</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 mb-8 max-w-2xl">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Buscar Estudiante</label>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium"
                            placeholder="Ej. Nombre del alumno o DPI..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {searchTerm && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl max-h-48 overflow-y-auto w-full">
                            {loadingStudents && <div className="p-4 text-center text-slate-500"><Loader2 className="animate-spin h-5 w-5 inline" /> Buscando...</div>}
                            {filteredStudents?.map((student) => (
                                <button
                                    key={student.id}
                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 focus:bg-blue-50 border-b border-slate-100 last:border-0 transition-colors"
                                    onClick={() => {
                                        setSelectedStudentId(student.id);
                                        setSearchTerm(''); // Collapse
                                        setDisabledCourses({}); // Reset filters
                                    }}
                                >
                                    <div className="font-bold text-slate-800">{student.full_name}</div>
                                    <div className="text-xs text-slate-500">{student.identification_document || 'Sin ID'}</div>
                                </button>
                            ))}
                            {filteredStudents?.length === 0 && (
                                <div className="p-4 text-center text-slate-500 text-sm">No se encontraron alumnos con ese nombre.</div>
                            )}
                        </div>
                    )}

                    {selectedStudentId && reportData && !isFetching && !loadingReport && (
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={handlePrint}
                                className="flex items-center space-x-2 px-6 py-2.5 bg-slate-800 text-white font-bold rounded-xl shadow-sm hover:bg-slate-900 transition-all active:scale-95"
                            >
                                <Printer className="w-5 h-5" />
                                <span>Imprimir Boleta</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Document / Report Card to Print */}
            {(loadingReport || isFetching) && (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-100 print:hidden">
                    <Loader2 className="animate-spin h-10 w-10 text-blue-500 mb-4" />
                    <p className="text-slate-500 font-medium">Generando boleta oficial...</p>
                </div>
            )}

            {!selectedStudentId && !isFetching && (
                <div className="text-center py-20 bg-slate-50/50 rounded-3xl border border-dashed border-slate-300 print:hidden">
                    <GraduationCap className="mx-auto h-16 w-16 text-slate-300 mb-4" />
                    <h3 className="text-xl font-bold text-slate-500">Ningún estudiante seleccionado</h3>
                    <p className="text-slate-400 mt-2 max-w-sm mx-auto text-sm">Busca y selecciona un estudiante arriba para generar instantáneamente su boleta de calificaciones oficial cruzando todos los cursos a los que pertenece.</p>
                </div>
            )}

            {selectedStudentId && reportData && !isFetching && !loadingReport && (
                <div className="bg-white p-10 md:p-16 rounded-2xl shadow-sm border border-slate-200/60 print:shadow-none print:border-none print:p-0 my-8">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b-2 border-slate-800 pb-8 mb-8">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-widest">Ultra Tecnología</h1>
                            <p className="text-slate-500 font-medium tracking-widest mt-1 uppercase text-sm">Boleta de Calificaciones Oficial</p>
                            <p className="text-slate-400 text-xs mt-2">Fecha de Empisión: {new Date().toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-2xl font-bold text-slate-800">{reportData.student.full_name}</h2>
                            <p className="text-slate-500">ID Estudiante: <span className="font-mono">{reportData.student.id.substring(0, 8).toUpperCase()}</span></p>
                        </div>
                    </div>

                    {/* Summary */}
                    {(() => {
                        const activeCourses = reportData.courses.filter((c: any) => !disabledCourses[c.course_name]);

                        let totalScoreSum = 0;
                        let totalUnits = 0;

                        activeCourses.forEach((c: any) => {
                            const sum = c.units.reduce((acc: number, curr: any) => acc + curr.score, 0);
                            totalScoreSum += sum;
                            totalUnits += c.units.length;
                        });

                        const visibleGeneralAverage = totalUnits > 0 ? (totalScoreSum / totalUnits).toFixed(2) : 0;

                        return (
                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 flex justify-between items-center mb-10 print:bg-white print:border-2 print:border-slate-800">
                                <div>
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Promedio General</p>
                                    <p className={`text-4xl font-black ${Number(visibleGeneralAverage) >= 60 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {visibleGeneralAverage} <span className="text-xl text-slate-400">/ 100</span>
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Cursos Mostrados</p>
                                    <p className="text-3xl font-bold text-slate-800">{activeCourses.length}</p>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Filters (Hidden in print) */}
                    {reportData.courses.length > 0 && (
                        <div className="mb-8 print:hidden">
                            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-3">Incluir Cursos en Boleta:</h3>
                            <div className="flex flex-wrap gap-3">
                                {reportData.courses.map((course: any) => {
                                    const isDisabled = disabledCourses[course.course_name];
                                    return (
                                        <button
                                            key={`filter-${course.course_name}`}
                                            onClick={() => setDisabledCourses(prev => ({
                                                ...prev,
                                                [course.course_name]: !isDisabled
                                            }))}
                                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors border ${isDisabled
                                                ? 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                                                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                                        >
                                            <div className="flex items-center space-x-2">
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isDisabled ? 'border-slate-300' : 'bg-blue-600 border-blue-600 text-white'}`}>
                                                    {!isDisabled && <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                </div>
                                                <span>{course.course_name}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Grades Table */}
                    {reportData.courses.filter((c: any) => !disabledCourses[c.course_name]).length > 0 ? reportData.courses.filter((c: any) => !disabledCourses[c.course_name]).map((course: any) => (
                        <div key={course.course_name} className="mb-10 page-break-inside-avoid">
                            <div className="flex justify-between items-end mb-4 border-b border-slate-200 pb-2">
                                <h3 className="text-xl font-bold text-slate-800">{course.course_name}</h3>
                                <div className="text-sm font-bold bg-slate-100 px-3 py-1 rounded text-slate-600">Promedio Curso: {course.average}</div>
                            </div>
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50">
                                    <tr>
                                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Unidad Evaluativa</th>
                                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Nota Alcanzada</th>
                                        <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Comentarios del Profesor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {course.units.map((unit: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/30">
                                            <td className="px-4 py-3 font-medium text-slate-800">{unit.unit_name}</td>
                                            <td className="px-4 py-3 font-bold">
                                                <span className={Number(unit.score) >= 60 ? 'text-emerald-600' : 'text-rose-600'}>{unit.score}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600 italic">
                                                {unit.remarks || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )) : (
                        <div className="text-center py-10 text-slate-500 italic">
                            El estudiante no tiene ninguna evaluación registrada en sus cursos actualmente.
                        </div>
                    )}

                    {/* Signatures */}
                    <div className="mt-24 flex justify-between px-10 border-t-2 border-slate-100 pt-8 print:border-slate-800">
                        <div className="text-center w-48">
                            <div className="border-b border-slate-400 mb-2"></div>
                            <p className="text-sm font-bold text-slate-600">Firma Dirección</p>
                        </div>
                        <div className="text-center w-48">
                            <div className="border-b border-slate-400 mb-2"></div>
                            <p className="text-sm font-bold text-slate-600">Sello de la Institución</p>
                        </div>
                    </div>

                </div>
            )}

            {/* Print specific styles to hide sidebar and header if needed globally */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page { margin: 15mm; size: letter; }
                    body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    #root { height: auto !important; overflow: visible !important; }
                }
            `}} />
        </div>
    );
};

export default ReportCard;
