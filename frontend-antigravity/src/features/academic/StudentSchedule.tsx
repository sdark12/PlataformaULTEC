import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Clock } from 'lucide-react';
import api from '../../services/apiClient';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
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
}

const fetchSchedule = async (): Promise<ScheduleEntry[]> => {
    const res = await api.get('/api/resources/my-schedule');
    return res.data;
};

const StudentSchedule = () => {
    const { data: schedule, isLoading } = useQuery({
        queryKey: ['studentSchedule'],
        queryFn: fetchSchedule,
    });

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-blue-500/50" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando horario...</p>
        </div>
    );

    // Normalize day name mapping
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

    // Parse time to row index
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
        <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-brand-blue/10 rounded-2xl">
                    <Calendar className="h-7 w-7 text-brand-blue" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Mi Horario</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">Tu agenda semanal de clases.</p>
                </div>
            </div>

            {(!schedule || schedule.length === 0) ? (
                <div className="text-center py-20 glass-card">
                    <Calendar className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin horario</h3>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">No tienes clases programadas todavía.</p>
                </div>
            ) : (
                <>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 mb-6">
                        {Array.from(new Map(schedule.map(s => [s.course_name, s.color])).entries()).map(([name, color]) => (
                            <div key={name} className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-white/5 rounded-full border border-slate-200 dark:border-white/10 text-sm">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                                <span className="font-medium text-slate-700 dark:text-slate-300">{name}</span>
                            </div>
                        ))}
                    </div>

                    {/* Schedule Grid */}
                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse min-w-[700px]">
                                <thead>
                                    <tr>
                                        <th className="w-20 p-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-r border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                                            <Clock className="w-4 h-4 mx-auto" />
                                        </th>
                                        {DAYS.map(day => (
                                            <th key={day} className="p-3 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-center">
                                                {day}
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
                                                // Skip occupied cells (spanned over)
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
                                                                className="h-full rounded-xl p-2.5 text-white text-xs font-bold shadow-sm flex flex-col justify-center gap-0.5 min-h-[48px] transition-transform hover:scale-[1.02]"
                                                                style={{ backgroundColor: entry.color }}
                                                            >
                                                                <span className="truncate">{entry.course_name}</span>
                                                                {entry.grade && <span className="opacity-80 text-[10px] font-normal">{entry.grade}</span>}
                                                                <span className="opacity-70 text-[10px]">
                                                                    {entry.start_time?.substring(0, 5)} - {entry.end_time?.substring(0, 5)}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                return (
                                                    <td key={day} className="p-1 border-b border-slate-100 dark:border-white/5 min-h-[48px] group-hover:bg-slate-50/50 dark:group-hover:bg-white/[0.02] transition-colors">
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default StudentSchedule;
