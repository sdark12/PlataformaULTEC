import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCourses } from './academicService';
import { getAttendance, markAttendance } from './attendanceService';
import { Loader2, Save, Users, CheckCircle, XCircle, Clock } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
    PRESENT: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200',
    ABSENT: 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200',
    LATE: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
    EXCUSED: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200',
};

const Attendance = () => {
    const queryClient = useQueryClient();
    const [selectedCourse, setSelectedCourse] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
    const [attendanceData, setAttendanceData] = useState<any[]>([]);

    const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: getCourses });

    const { data: fetchedAttendance, isLoading, isFetching } = useQuery({
        queryKey: ['attendance', selectedCourse, selectedDate],
        queryFn: () => getAttendance(Number(selectedCourse), selectedDate),
        enabled: !!selectedCourse && !!selectedDate,
    });

    useEffect(() => {
        if (fetchedAttendance) {
            setAttendanceData(fetchedAttendance);
        }
    }, [fetchedAttendance]);

    const mutation = useMutation({
        mutationFn: markAttendance,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            alert('Asistencia guardada correctamente.');
        },
        onError: () => alert('Error al guardar asistencia')
    });

    const handleStatusChange = (studentId: number, status: string) => {
        setAttendanceData(prev => prev.map(p => p.student_id === studentId ? { ...p, status } : p));
    };

    const handleSave = () => {
        mutation.mutate({
            course_id: Number(selectedCourse),
            date: selectedDate,
            students: attendanceData.map(a => ({ student_id: a.student_id, status: a.status, remarks: a.remarks }))
        });
    };

    const stats = {
        total: attendanceData.length,
        present: attendanceData.filter(a => a.status === 'PRESENT').length,
        absent: attendanceData.filter(a => a.status === 'ABSENT').length,
        late: attendanceData.filter(a => a.status === 'LATE').length,
    };

    return (
        <div className="max-w-7xl mx-auto pb-12">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Control de Asistencia</h2>
                    <p className="text-slate-500 mt-1">Registra la asistencia de los estudiantes matriculados por curso.</p>
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
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Fecha de Clase</label>
                    <input
                        type="date"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                </div>
            </div>

            {selectedCourse && (
                <>
                    {/* Stats Section */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Users className="w-6 h-6" /></div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Total Alumnos</p>
                                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><CheckCircle className="w-6 h-6" /></div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Presentes</p>
                                <p className="text-2xl font-bold text-slate-800">{stats.present}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
                            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl"><XCircle className="w-6 h-6" /></div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Ausentes</p>
                                <p className="text-2xl font-bold text-slate-800">{stats.absent}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
                            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><Clock className="w-6 h-6" /></div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Tardes</p>
                                <p className="text-2xl font-bold text-slate-800">{stats.late}</p>
                            </div>
                        </div>
                    </div>

                    {/* Table Section */}
                    {isLoading || isFetching ? (
                        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-100">
                            <Loader2 className="animate-spin h-10 w-10 text-blue-500 mb-4" />
                            <p className="text-slate-500 font-medium">Cargando lista de estudiantes...</p>
                        </div>
                    ) : (
                        stats.total > 0 ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden relative">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50/50 border-b border-slate-200 uppercase text-xs font-bold text-slate-500 tracking-wider">
                                            <tr>
                                                <th className="px-6 py-5">Estudiante</th>
                                                <th className="px-6 py-5">Estado de Asistencia</th>
                                                <th className="px-6 py-5">Notas / Observaciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {attendanceData.map((record) => (
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
                                                        <div className="flex flex-wrap gap-2">
                                                            {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((statusOption) => (
                                                                <button
                                                                    key={statusOption}
                                                                    onClick={() => handleStatusChange(record.student_id, statusOption)}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${record.status === statusOption
                                                                        ? STATUS_COLORS[statusOption] + ' shadow-sm ring-2 ring-offset-1 ring-opacity-50 ' + (
                                                                            statusOption === 'PRESENT' ? 'ring-emerald-400' :
                                                                                statusOption === 'ABSENT' ? 'ring-rose-400' :
                                                                                    statusOption === 'LATE' ? 'ring-amber-400' : 'ring-slate-400'
                                                                        )
                                                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
                                                                        }`}
                                                                >
                                                                    {statusOption === 'PRESENT' ? 'Presente' :
                                                                        statusOption === 'ABSENT' ? 'Ausente' :
                                                                            statusOption === 'LATE' ? 'Tarde' : 'Excusado'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <input
                                                            type="text"
                                                            className="w-full bg-transparent border-0 border-b border-transparent group-hover:border-slate-300 focus:border-blue-500 focus:ring-0 transition-colors text-sm px-1 py-1.5 outline-none text-slate-600 placeholder:text-slate-300"
                                                            placeholder="Añadir nota..."
                                                            value={record.remarks || ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setAttendanceData(prev => prev.map(p => p.student_id === record.student_id ? { ...p, remarks: val } : p));
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="bg-slate-50/80 p-5 border-t border-slate-200 flex justify-between items-center sticky bottom-0 z-10 backdrop-blur-md">
                                    <div className="text-sm font-medium text-slate-500">
                                        Revisa que todos los estados sean correctos antes de guardar.
                                    </div>
                                    <button
                                        onClick={handleSave}
                                        disabled={mutation.isPending}
                                        className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 hover:shadow disabled:opacity-50 transition-all active:scale-95"
                                    >
                                        {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                        <span>{mutation.isPending ? 'Guardando...' : 'Guardar Asistencia'}</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                                <Users className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                                <h3 className="text-lg font-bold text-slate-900">No hay estudiantes matriculados</h3>
                                <p className="text-slate-500 mt-1">Este curso actualmente no tiene estudiantes activos asignados.</p>
                            </div>
                        )
                    )}
                </>
            )}
        </div>
    );
};

export default Attendance;
