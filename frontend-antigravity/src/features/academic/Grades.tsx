import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCourses } from './academicService';
import { getGrades, saveGrades } from './gradeService';
import { Loader2, Save, Users, Award, TrendingUp, TrendingDown, AlignJustify, ListChecks } from 'lucide-react';
import SubGrades from './SubGrades';

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
    const [activeTab, setActiveTab] = useState<'general' | 'detailed'>('general');
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
        <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Registro de Calificaciones</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Ingresa y administra las notas de los estudiantes por curso y unidad.</p>
                </div>
            </div>

            {/* Config Section */}
            <div className="glass-card p-6 mb-8 flex flex-col md:flex-row gap-6 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Seleccionar Curso</label>
                    <div className="relative">
                        <select
                            className="w-full pl-4 pr-10 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue transition-all appearance-none outline-none font-medium backdrop-blur-sm"
                            value={selectedCourse}
                            onChange={(e) => setSelectedCourse(e.target.value)}
                        >
                            <option value="">-- Elige un curso --</option>
                            {courses?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
                <div className="w-full md:w-64">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Unidad a Evaluar</label>
                    <div className="relative">
                        <select
                            className="w-full pl-4 pr-10 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue transition-all appearance-none outline-none font-medium backdrop-blur-sm"
                            value={selectedUnit}
                            onChange={(e) => setSelectedUnit(e.target.value)}
                        >
                            {EVALUATION_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500 dark:text-slate-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-6 mb-8 border-b border-slate-200 dark:border-slate-800">
                <button
                    className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'general' ? 'border-brand-blue text-brand-blue dark:border-brand-teal dark:text-brand-teal' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    onClick={() => setActiveTab('general')}
                >
                    <AlignJustify className="w-4 h-4" /> Calificación General Bimestral
                </button>
                <button
                    className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${activeTab === 'detailed' ? 'border-brand-blue text-brand-blue dark:border-brand-teal dark:text-brand-teal' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    onClick={() => setActiveTab('detailed')}
                >
                    <ListChecks className="w-4 h-4" /> Detalle de Notas (Subcalificaciones)
                </button>
            </div>

            {selectedCourse && (
                <>
                    {activeTab === 'detailed' ? (
                        <SubGrades selectedCourse={selectedCourse} selectedUnit={selectedUnit} />
                    ) : (
                        <>
                            {/* Stats Section */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <div className="glass-card p-5 flex items-center space-x-4">
                                    <div className="p-3 bg-brand-blue/10 text-brand-blue dark:text-brand-teal rounded-xl shadow-inner"><Users className="w-6 h-6" /></div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Alumnos Listos</p>
                                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.evaluated} <span className="text-sm text-slate-400 font-normal">/ {stats.total}</span></p>
                                    </div>
                                </div>
                                <div className="glass-card p-5 flex items-center space-x-4">
                                    <div className="p-3 bg-brand-purple/10 text-brand-purple dark:text-brand-magenta rounded-xl shadow-inner"><Award className="w-6 h-6" /></div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Promedio Salón</p>
                                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{Number(stats.average) > 0 ? stats.average : '--'}</p>
                                    </div>
                                </div>
                                <div className="glass-card p-5 flex items-center space-x-4">
                                    <div className="p-3 bg-brand-success/10 text-brand-success rounded-xl shadow-inner"><TrendingUp className="w-6 h-6" /></div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nota Más Alta</p>
                                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.highest > 0 ? stats.highest : '--'}</p>
                                    </div>
                                </div>
                                <div className="glass-card p-5 flex items-center space-x-4">
                                    <div className="p-3 bg-brand-danger/10 text-brand-danger rounded-xl shadow-inner"><TrendingDown className="w-6 h-6" /></div>
                                    <div>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nota Más Baja</p>
                                        <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.lowest > 0 ? stats.lowest : '--'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Table Section */}
                            {isLoading || isFetching ? (
                                <div className="flex flex-col items-center justify-center p-12 glass-card">
                                    <Loader2 className="animate-spin h-10 w-10 text-brand-blue mb-4" />
                                    <p className="text-slate-500 dark:text-slate-400 font-medium tracking-wide">Cargando libreta de calificaciones...</p>
                                </div>
                            ) : (
                                stats.total > 0 ? (
                                    <div className="glass-card overflow-hidden relative">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-slate-100/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50 uppercase text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                                                    <tr>
                                                        <th className="px-6 py-5">Estudiante</th>
                                                        <th className="px-6 py-5 w-48 text-center">Calificación (0 - 100)</th>
                                                        <th className="px-6 py-5">Retroalimentación / Notas</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                                    {gradesData.map((record) => (
                                                        <tr key={record.student_id} className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors group">
                                                            <td className="px-6 py-5 font-medium text-slate-800 dark:text-slate-200">
                                                                <div className="flex items-center space-x-3">
                                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-blue/20 to-brand-purple/20 text-brand-blue dark:text-brand-teal border border-brand-blue/10 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                                                                        {record.student_name.charAt(0)}{record.student_name.split(' ')[1]?.[0] || ''}
                                                                    </div>
                                                                    <span>{record.student_name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-5">
                                                                <div className="relative flex justify-center">
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        max="100"
                                                                        className={`w-24 px-3 py-2 border rounded-xl focus:ring-4 focus:ring-brand-blue/20 outline-none text-center font-bold text-lg transition-all ${record.score === '' ? 'border-slate-300 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50 text-slate-800 dark:text-white' :
                                                                            Number(record.score) >= 60 ? 'border-brand-success/50 bg-brand-success/10 text-brand-success shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'border-brand-danger/50 bg-brand-danger/10 text-brand-danger shadow-[0_0_10px_rgba(239,68,68,0.1)]'
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
                                                                    className="w-full bg-transparent border-0 border-b border-transparent group-hover:border-slate-300 dark:group-hover:border-slate-600 focus:border-brand-blue focus:ring-0 transition-colors text-sm px-1 py-1.5 outline-none text-slate-600 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600"
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
                                        <div className="glass p-5 border-t border-slate-200 dark:border-white/10 flex justify-between items-center sticky bottom-0 z-10 transition-colors">
                                            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${stats.evaluated === stats.total ? 'bg-brand-success shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-brand-warning animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]'}`}></div>
                                                {stats.evaluated === stats.total ? 'Todas las notas han sido ingresadas.' : `Faltan ${stats.total - stats.evaluated} notas por ingresar.`}
                                            </div>
                                            <button
                                                onClick={handleSave}
                                                disabled={mutation.isPending}
                                                className="flex items-center space-x-2 px-6 py-2.5 bg-brand-blue text-white font-bold rounded-xl shadow-[0_0_15px_rgba(13,89,242,0.4)] hover:bg-blue-600 hover:shadow-[0_0_20px_rgba(13,89,242,0.6)] disabled:opacity-50 transition-all active:scale-95 border border-white/10"
                                            >
                                                {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                                <span>{mutation.isPending ? 'Guardando...' : 'Guardar Calificaciones'}</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-16 glass-card border border-dashed border-slate-300 dark:border-slate-700">
                                        <Award className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-4" />
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No hay estudiantes matriculados</h3>
                                        <p className="text-slate-500 dark:text-slate-400 mt-1">Este curso actualmente no tiene estudiantes activos para evaluar.</p>
                                    </div>
                                )
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default Grades;
