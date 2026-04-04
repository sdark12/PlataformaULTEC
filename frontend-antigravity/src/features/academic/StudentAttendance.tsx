import { useQuery } from '@tanstack/react-query';
import { getStudentAttendance } from './academicService';
import { Loader2, Users, Calendar, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const StudentAttendance = () => {
    const { data: attendanceHistory, isLoading, error } = useQuery({
        queryKey: ['my_attendance'],
        queryFn: getStudentAttendance,
    });

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin h-10 w-10 text-brand-blue mb-4" />
                <p className="text-slate-500 font-medium">Cargando historial de asistencia...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <AlertCircle className="h-10 w-10 text-rose-500 mb-4" />
                <p className="text-slate-500 font-medium">Error al cargar el historial.</p>
            </div>
        );
    }

    // Calcular estadísticas
    const totalClasses = attendanceHistory?.length || 0;
    const presentCount = attendanceHistory?.filter((r: any) => r.status === 'PRESENT').length || 0;
    const absentCount = attendanceHistory?.filter((r: any) => r.status === 'ABSENT').length || 0;
    const lateCount = attendanceHistory?.filter((r: any) => r.status === 'LATE').length || 0;
    
    const attendancePercentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

    return (
        <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Mi Asistencia</h2>
            <p className="text-slate-500 mb-8 max-w-2xl">
                Revisa tu historial de asistencia a clases. Mantén un buen récord para no tener problemas con la evaluación final de cada curso.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-slate-500 uppercase">Clases Totales</p>
                        <p className="text-3xl font-black text-slate-800 mt-1">{totalClasses}</p>
                    </div>
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                        <Calendar className="w-6 h-6" />
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
                    <div>
                        <p className="text-sm font-semibold text-emerald-600 uppercase">Presente</p>
                        <p className="text-3xl font-black text-emerald-700 mt-1">{presentCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-between relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent pointer-events-none" />
                    <div>
                        <p className="text-sm font-semibold text-rose-600 uppercase">Ausente</p>
                        <p className="text-3xl font-black text-rose-700 mt-1">{absentCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm flex items-center justify-between relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
                    <div>
                        <p className="text-sm font-semibold text-amber-600 uppercase">Tardanza</p>
                        <p className="text-3xl font-black text-amber-700 mt-1">{lateCount}</p>
                    </div>
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                        <Clock className="w-6 h-6" />
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-4 mb-8">
                <div className={`text-2xl font-black ${attendancePercentage >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {attendancePercentage}%
                </div>
                <div className="flex-1">
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ${attendancePercentage >= 80 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                            style={{ width: `${attendancePercentage}%` }} 
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5 font-medium">Asistencia Promedio General</p>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">Detalle Histórico</h3>
                </div>
                {attendanceHistory?.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">
                        <Users className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p>No tienes registros de asistencia aún.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {attendanceHistory?.map((record: any) => (
                            <div key={record.id} className="p-4 hover:bg-slate-50/50 transition-colors flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800">{record.course_name}</p>
                                        <p className="text-sm text-slate-500">{new Date(record.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                        {record.remarks && (
                                            <p className="text-xs text-slate-400 mt-1 italic">Nota: {record.remarks}</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    {record.status === 'PRESENT' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Presente</span>}
                                    {record.status === 'ABSENT' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">Ausente</span>}
                                    {record.status === 'LATE' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">Tardanza</span>}
                                    {record.status === 'EXCUSED' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">Justificado</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentAttendance;
