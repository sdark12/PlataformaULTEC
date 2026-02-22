import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCourses } from './academicService';
import { getCourseGradebook } from './gradeService';
import { Loader2, BookOpen, Printer, Award } from 'lucide-react';

const CourseGradebook = () => {
    const [selectedCourse, setSelectedCourse] = useState<string>('');

    const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: getCourses });

    const { data: gradebook, isLoading, isFetching } = useQuery({
        queryKey: ['course_gradebook', selectedCourse],
        queryFn: () => getCourseGradebook(selectedCourse),
        enabled: !!selectedCourse,
    });

    const handlePrint = () => {
        window.print();
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

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 mb-8 max-w-2xl flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Seleccionar Curso</label>
                        <div className="relative">
                            <select
                                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none outline-none font-medium"
                                value={selectedCourse}
                                onChange={(e) => setSelectedCourse(e.target.value)}
                            >
                                <option value="">-- Elige un curso --</option>
                                {courses?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                    </div>
                    {selectedCourse && gradebook && !isFetching && !isLoading && (
                        <button
                            onClick={handlePrint}
                            className="flex items-center justify-center space-x-2 px-6 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-sm hover:bg-slate-900 transition-all active:scale-95 whitespace-nowrap"
                        >
                            <Printer className="w-5 h-5" />
                            <span>Imprimir Acta</span>
                        </button>
                    )}
                </div>
            </div>

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
                                    <th className="px-4 py-3 font-black text-indigo-700 text-center text-base bg-indigo-50 border-l-2 border-indigo-200 border-r-2">PROMEDIO FINAL</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {gradebook.students.map((student: any, idx: number) => (
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

                                        {/* Final Average Cell */}
                                        <td className={`px-4 py-3 text-center border-l-2 border-indigo-200 border-r-2 font-black text-lg ${Number(student.average) >= 60 ? 'text-emerald-700 bg-emerald-50/30' : 'text-rose-700 bg-rose-50/30'}`}>
                                            {Number(student.average) > 0 ? student.average : '--'}
                                        </td>
                                    </tr>
                                ))}
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
