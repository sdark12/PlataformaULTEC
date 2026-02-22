import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCourses } from './academicService';
import { getGrades, saveGrades } from './gradeService';
import { Loader2, Save, Users, Award, TrendingUp, TrendingDown } from 'lucide-react';

const EVALUATION_UNITS = [
    'Unidad 1',
    'Unidad 2',
    'Unidad 3',
    'Unidad 4',
    'Examen Final',
    'Proyecto',
    'Recuperación'
];

const Grades = () => {
    const queryClient = useQueryClient();
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [selectedUnit, setSelectedUnit] = useState<string>(EVALUATION_UNITS[0]);
    const [gradesData, setGradesData] = useState<any[]>([]);

    const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: getCourses });

    const { data: fetchedGrades, isLoading, isFetching } = useQuery({
        queryKey: ['grades', selectedCourse, selectedUnit],
        queryFn: () => getGrades(selectedCourse, selectedUnit),
        enabled: !!selectedCourse && !!selectedUnit,
    });

    useEffect(() => {
        if (fetchedGrades) {
            setGradesData(fetchedGrades);
        }
    }, [fetchedGrades]);

    const mutation = useMutation({
        mutationFn: saveGrades,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            alert('Calificaciones guardadas exitosamente.');
        },
        onError: () => alert('Error al guardar calificaciones')
    });

    const handleScoreChange = (studentId: string, scoreStr: string) => {
        // Allow empty string to clear out a grade, or parse to number
        let val: string | number = scoreStr;
        if (scoreStr !== '') {
            const num = Number(scoreStr);
            if (num < 0) val = 0;
            if (num > 100) val = 100;
        }

        setGradesData(prev => prev.map(p => p.student_id === studentId ? { ...p, score: val } : p));
    };

    const handleSave = () => {
        mutation.mutate({
            course_id: selectedCourse,
            unit_name: selectedUnit,
            students: gradesData.map(g => ({
                student_id: g.student_id,
                score: g.score,
                remarks: g.remarks
            }))
        });
    };

    // Stats calculations
    const validScores = gradesData.filter(g => g.score !== '').map(g => Number(g.score));
    const stats = {
        total: gradesData.length,
        evaluated: validScores.length,
        average: validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : 0,
        highest: validScores.length > 0 ? Math.max(...validScores) : 0,
        lowest: validScores.length > 0 ? Math.min(...validScores) : 0,
    };

    return (
        <div className="max-w-7xl mx-auto pb-12">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Registro de Calificaciones</h2>
                    <p className="text-slate-500 mt-1">Ingresa y administra las notas de los estudiantes por curso y unidad.</p>
                </div>
            </div>

            {/* Config Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/60 mb-8 flex flex-col md:flex-row gap-6 items-end">
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
                <div className="w-full md:w-64">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Unidad a Evaluar</label>
                    <div className="relative">
                        <select
                            className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none outline-none font-medium"
                            value={selectedUnit}
                            onChange={(e) => setSelectedUnit(e.target.value)}
                        >
                            {EVALUATION_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
            </div>

            {selectedCourse && (
                <>
                    {/* Stats Section */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Users className="w-6 h-6" /></div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Alumnos Listos</p>
                                <p className="text-2xl font-bold text-slate-800">{stats.evaluated} <span className="text-sm text-slate-400 font-normal">/ {stats.total}</span></p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
                            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><Award className="w-6 h-6" /></div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Promedio Salón</p>
                                <p className="text-2xl font-bold text-slate-800">{Number(stats.average) > 0 ? stats.average : '--'}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><TrendingUp className="w-6 h-6" /></div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Nota Más Alta</p>
                                <p className="text-2xl font-bold text-slate-800">{stats.highest > 0 ? stats.highest : '--'}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
                            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl"><TrendingDown className="w-6 h-6" /></div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Nota Más Baja</p>
                                <p className="text-2xl font-bold text-slate-800">{stats.lowest > 0 ? stats.lowest : '--'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Table Section */}
                    {isLoading || isFetching ? (
                        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-100">
                            <Loader2 className="animate-spin h-10 w-10 text-blue-500 mb-4" />
                            <p className="text-slate-500 font-medium">Cargando libreta de calificaciones...</p>
                        </div>
                    ) : (
                        stats.total > 0 ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden relative">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50/50 border-b border-slate-200 uppercase text-xs font-bold text-slate-500 tracking-wider">
                                            <tr>
                                                <th className="px-6 py-5">Estudiante</th>
                                                <th className="px-6 py-5 w-48">Calificación (0 - 100)</th>
                                                <th className="px-6 py-5">Retroalimentación / Notas</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {gradesData.map((record) => (
                                                <tr key={record.student_id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-6 py-5 font-medium text-slate-800">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase">
                                                                {record.student_name.charAt(0)}{record.student_name.split(' ')[1]?.[0] || ''}
                                                            </div>
                                                            <span>{record.student_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                className={`w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold text-lg ${record.score === '' ? 'border-slate-300' :
                                                                    Number(record.score) >= 60 ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-rose-300 bg-rose-50 text-rose-700'
                                                                    }`}
                                                                placeholder="--"
                                                                value={record.score}
                                                                onChange={(e) => handleScoreChange(record.student_id, e.target.value)}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <input
                                                            type="text"
                                                            className="w-full bg-transparent border-0 border-b border-transparent group-hover:border-slate-300 focus:border-blue-500 focus:ring-0 transition-colors text-sm px-1 py-1.5 outline-none text-slate-600 placeholder:text-slate-300"
                                                            placeholder="Añadir comentario (opcional)..."
                                                            value={record.remarks || ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setGradesData(prev => prev.map(p => p.student_id === record.student_id ? { ...p, remarks: val } : p));
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/80 p-5 border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-10 backdrop-blur-md">
                                    <div className="text-sm font-medium text-slate-500 flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${stats.evaluated === stats.total ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                        {stats.evaluated === stats.total ? 'Todas las notas han sido ingresadas.' : `Faltan ${stats.total - stats.evaluated} notas por ingresar.`}
                                    </div>
                                    <button
                                        onClick={handleSave}
                                        disabled={mutation.isPending}
                                        className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 hover:shadow disabled:opacity-50 transition-all active:scale-95"
                                    >
                                        {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        <span>{mutation.isPending ? 'Guardando...' : 'Guardar Calificaciones'}</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                                <Award className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                                <h3 className="text-lg font-bold text-slate-900">No hay estudiantes matriculados</h3>
                                <p className="text-slate-500 mt-1">Este curso actualmente no tiene estudiantes activos para evaluar.</p>
                            </div>
                        )
                    )}
                </>
            )}
        </div>
    );
};

export default Grades;
