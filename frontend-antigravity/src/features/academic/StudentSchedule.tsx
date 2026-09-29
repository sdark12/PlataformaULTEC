import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Clock, MapPin, CheckCircle2, LayoutList, Grid } from 'lucide-react';
import api from '../../services/apiClient';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_SHORT: Record<string, string> = {
    'Lunes': 'LUN',
    'Martes': 'MAR',
    'Miércoles': 'MIÉ',
    'Jueves': 'JUE',
    'Viernes': 'VIE',
    'Sábado': 'SÁB'
};

const DAY_MAP = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const HOURS = Array.from({ length: 14 }, (_, i) => {
    const h = 7 + i; // 7 AM to 8 PM
    return `${h.toString().padStart(2, '0')}:00`;
});

interface ScheduleEntry {
    course_name: string;
    grade: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    color: string;
    classroom?: string;
}

const fetchSchedule = async (): Promise<ScheduleEntry[]> => {
    const res = await api.get('/api/resources/my-schedule');
    return res.data;
};

const normDay = (day: string) => {
    const d = day?.toLowerCase().trim();
    if (d?.includes('lunes') || d === 'monday') return 'Lunes';
    if (d?.includes('martes') || d === 'tuesday') return 'Martes';
    if (d?.includes('mi') || d === 'wednesday') return 'Miércoles';
    if (d?.includes('jueves') || d === 'thursday') return 'Jueves';
    if (d?.includes('viernes') || d === 'friday') return 'Viernes';
    if (d?.includes('s') || d === 'saturday') return 'Sábado';
    return day;
};

const timeToMinutes = (timeStr?: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

const StudentSchedule = () => {
    const todayIndex = new Date().getDay();
    const todayName = normDay(DAY_MAP[todayIndex]);
    const defaultSelectedDay = DAYS.includes(todayName) ? todayName : 'Lunes';

    const [selectedDay, setSelectedDay] = useState<string>(defaultSelectedDay);
    const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');

    const { data: schedule, isLoading } = useQuery({
        queryKey: ['studentSchedule'],
        queryFn: fetchSchedule,
    });

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-brand-blue/60" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando horario...</p>
        </div>
    );

    // Current time in minutes for live indicators
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isToday = selectedDay === todayName;

    // Filter classes for daily view
    const dailyClasses = (schedule || [])
        .filter(entry => normDay(entry.day_of_week) === selectedDay)
        .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    // Parse time to row index for weekly grid
    const timeToRow = (time: string) => {
        if (!time) return 0;
        const [h] = time.split(':').map(Number);
        return Math.max(0, h - 7);
    };

    const timeSpan = (start: string, end: string) => {
        if (!start || !end) return 1;
        const s = timeToRow(start);
        const e = timeToRow(end);
        return Math.max(1, e - s);
    };

    // Group schedule entries by (day, startHour)
    const grid: Map<string, ScheduleEntry[]> = new Map();
    schedule?.forEach(entry => {
        const day = normDay(entry.day_of_week);
        const row = timeToRow(entry.start_time);
        const key = `${day}-${row}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(entry);
    });

    // Track occupied cells
    const occupied = new Set<string>();
    schedule?.forEach(entry => {
        const day = normDay(entry.day_of_week);
        const start = timeToRow(entry.start_time);
        const span = timeSpan(entry.start_time, entry.end_time);
        for (let i = start; i < start + span; i++) {
            if (i > start) occupied.add(`${day}-${i}`);
        }
    });

    return (
        <div className="max-w-7xl mx-auto pb-36 sm:pb-16 space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-2xl text-brand-blue">
                        <Calendar className="h-7 w-7" />
                    </div>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Mi Horario</h2>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Agenda semanal de clases y laboratorios.</p>
                    </div>
                </div>

                {/* View switcher (Vista Diaria vs Semanal) */}
                <div className="flex bg-slate-100 dark:bg-[#161922] p-1 rounded-2xl border border-slate-200/80 dark:border-white/5 w-fit">
                    <button
                        onClick={() => setViewMode('daily')}
                        className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                            viewMode === 'daily'
                                ? 'bg-white dark:bg-[#252a3a] text-brand-blue shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                        }`}
                    >
                        <LayoutList className="w-4 h-4" />
                        <span>Vista Diaria</span>
                    </button>

                    <button
                        onClick={() => setViewMode('weekly')}
                        className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                            viewMode === 'weekly'
                                ? 'bg-white dark:bg-[#252a3a] text-brand-blue shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                        }`}
                    >
                        <Grid className="w-4 h-4" />
                        <span>Semanal</span>
                    </button>
                </div>
            </div>

            {(!schedule || schedule.length === 0) ? (
                <div className="text-center py-20 bg-white/60 dark:bg-[#1c1f2a]/60 rounded-3xl border border-dashed border-slate-300 dark:border-white/10 p-8">
                    <Calendar className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin horario asignado</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Aún no tienes clases programadas en tu expediente.</p>
                </div>
            ) : viewMode === 'daily' ? (
                /* Daily View with Day Selector Strip */
                <div className="space-y-6">
                    {/* Day selector horizontal pills */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                        {DAYS.map(day => {
                            const isSelected = selectedDay === day;
                            const isTodayDay = todayName === day;
                            const classCount = (schedule || []).filter(s => normDay(s.day_of_week) === day).length;

                            return (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDay(day)}
                                    className={`flex-1 min-w-[85px] sm:min-w-[105px] py-3 px-3 rounded-2xl flex flex-col items-center justify-center transition-all border ${
                                        isSelected
                                            ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/25 scale-[1.02]'
                                            : 'bg-white dark:bg-[#1c1f2a] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:border-brand-blue/40'
                                    }`}
                                >
                                    <span className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                                        {DAY_SHORT[day]}
                                    </span>
                                    <span className="text-sm sm:text-base font-extrabold mt-0.5">{day}</span>
                                    <div className="flex items-center gap-1 mt-1">
                                        {isTodayDay && (
                                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase ${
                                                isSelected ? 'bg-white text-brand-blue' : 'bg-emerald-500 text-white'
                                            }`}>
                                                Hoy
                                            </span>
                                        )}
                                        {classCount > 0 ? (
                                            <span className={`text-[10px] font-bold ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
                                                {classCount} {classCount === 1 ? 'clase' : 'clases'}
                                            </span>
                                        ) : (
                                            <span className={`text-[10px] ${isSelected ? 'text-blue-200/60' : 'text-slate-400/60'}`}>
                                                Libre
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Classes Timeline List for selected day */}
                    {dailyClasses.length === 0 ? (
                        <div className="bg-white/60 dark:bg-[#1c1f2a]/60 border border-dashed border-slate-300 dark:border-white/10 rounded-3xl py-16 px-6 text-center">
                            <div className="h-16 w-16 bg-brand-blue/10 dark:bg-brand-blue/20 rounded-full flex items-center justify-center text-brand-blue mx-auto mb-3">
                                <Clock className="h-8 w-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Día sin clases programadas</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 max-w-sm mx-auto">
                                No tienes actividades académicas agendadas para el {selectedDay}. Aprovecha para repasar o completar tus tareas pendientes.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                                <span>Itinerario del {selectedDay}</span>
                                <span>{dailyClasses.length} {dailyClasses.length === 1 ? 'Sesión' : 'Sesiones'}</span>
                            </div>

                            <div className="space-y-3.5">
                                {dailyClasses.map((item, idx) => {
                                    const startMin = timeToMinutes(item.start_time);
                                    const endMin = timeToMinutes(item.end_time);

                                    const isLiveNow = isToday && currentMinutes >= startMin && currentMinutes <= endMin;
                                    const isUpcoming = isToday && currentMinutes < startMin;
                                    const isCompleted = isToday && currentMinutes > endMin;

                                    return (
                                        <div
                                            key={`${item.course_name}-${idx}`}
                                            className={`relative bg-white dark:bg-[#1c1f2a] rounded-3xl p-5 sm:p-6 border transition-all duration-300 shadow-sm overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                                                isLiveNow
                                                    ? 'border-emerald-500/50 bg-emerald-500/[0.03] shadow-md shadow-emerald-500/10'
                                                    : 'border-slate-200/80 dark:border-white/10 hover:border-brand-blue/40'
                                            }`}
                                        >
                                            {/* Side Accent Color Strip */}
                                            <div
                                                className="absolute left-0 top-0 bottom-0 w-2"
                                                style={{ backgroundColor: item.color || '#0d59f2' }}
                                            />

                                            <div className="pl-2 space-y-1.5">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5 text-brand-blue" />
                                                        {item.start_time?.substring(0, 5)} - {item.end_time?.substring(0, 5)}
                                                    </span>

                                                    {isLiveNow ? (
                                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                            <span className="relative flex h-2 w-2">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                            </span>
                                                            En Curso Ahora
                                                        </span>
                                                    ) : isUpcoming ? (
                                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                                                            Próxima
                                                        </span>
                                                    ) : isCompleted ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                                                            <CheckCircle2 className="w-3 h-3 text-slate-400" />
                                                            Concluida
                                                        </span>
                                                    ) : null}
                                                </div>

                                                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                                    {item.course_name}
                                                </h3>

                                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                                    {item.grade && (
                                                        <span className="font-semibold text-brand-purple">
                                                            {item.grade}
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                                        {item.classroom || 'Laboratorio Central'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Action / Tag on the right */}
                                            <div className="pl-2 sm:pl-0 sm:text-right shrink-0">
                                                <div
                                                    className="inline-block px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm"
                                                    style={{ backgroundColor: item.color || '#0d59f2' }}
                                                >
                                                    Módulo Activo
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Weekly Matrix Table View */
                <div className="space-y-6">
                    {/* Legend */}
                    <div className="flex flex-wrap gap-2.5">
                        {Array.from(new Map(schedule.map(s => [s.course_name, s.color])).entries()).map(([name, color]) => (
                            <div key={name} className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-[#1c1f2a] rounded-full border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 shadow-sm">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                <span>{name}</span>
                            </div>
                        ))}
                    </div>

                    {/* Schedule Grid */}
                    <div className="bg-white dark:bg-[#1c1f2a] rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse min-w-[700px]">
                                <thead>
                                    <tr>
                                        <th className="w-20 p-3.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-r border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                                            <Clock className="w-4 h-4 mx-auto" />
                                        </th>
                                        {DAYS.map(day => (
                                            <th key={day} className="p-3.5 text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-center">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <span>{day}</span>
                                                    {day === todayName && (
                                                        <span className="text-[9px] font-black px-1.5 py-0.2 bg-emerald-500 text-white rounded-full">
                                                            Hoy
                                                        </span>
                                                    )}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {HOURS.map((hour, rowIdx) => (
                                        <tr key={hour} className="group">
                                            <td className="p-2 text-xs font-mono text-slate-400 dark:text-slate-500 text-center border-r border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                                                {hour}
                                            </td>
                                            {DAYS.map(day => {
                                                const key = `${day}-${rowIdx}`;
                                                if (occupied.has(key)) return null;

                                                const entries = grid.get(key);
                                                if (entries && entries.length > 0) {
                                                    const entry = entries[0];
                                                    const span = timeSpan(entry.start_time, entry.end_time);
                                                    return (
                                                        <td
                                                            key={day}
                                                            rowSpan={span}
                                                            className="p-1 border-b border-slate-100 dark:border-white/5"
                                                        >
                                                            <div
                                                                className="h-full rounded-2xl p-2.5 text-white text-xs font-bold shadow-sm flex flex-col justify-center gap-0.5 min-h-[52px] transition-transform hover:scale-[1.02]"
                                                                style={{ backgroundColor: entry.color }}
                                                            >
                                                                <span className="truncate">{entry.course_name}</span>
                                                                {entry.grade && <span className="opacity-85 text-[10px] font-normal">{entry.grade}</span>}
                                                                <span className="opacity-75 text-[10px]">
                                                                    {entry.start_time?.substring(0, 5)} - {entry.end_time?.substring(0, 5)}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td key={day} className="p-1 border-b border-slate-100 dark:border-white/5 min-h-[52px] group-hover:bg-slate-50/50 dark:group-hover:bg-white/[0.02] transition-colors">
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentSchedule;
