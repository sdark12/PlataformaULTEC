import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, Users, GraduationCap, Download, ArrowUpDown, ArrowUp, ArrowDown, Phone, Clock, SlidersHorizontal, X } from 'lucide-react';
import { getStudentReports } from '../finance/reportService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { savePdfDoc } from '../../utils/fileDownloader';


const SortableHeader = ({ field, label, currentSort, order, onClick }: { field: any, label: string, currentSort: any, order: string, onClick: (f: any) => void }) => (
    <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer group select-none" onClick={() => onClick(field)}>
        <div className="flex items-center gap-1 group-hover:text-brand-blue transition-colors">
            {label}
            {currentSort === field ? (order === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
        </div>
    </th>
);

const StudentReports = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCourse, setFilterCourse] = useState('');
    const [filterGrade, setFilterGrade] = useState('');
    const [filterDay, setFilterDay] = useState('');
    const [filterSchool, setFilterSchool] = useState('');
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    const activeFiltersCount = (filterCourse ? 1 : 0) + (filterGrade ? 1 : 0) + (filterDay ? 1 : 0) + (filterSchool ? 1 : 0);

    type SortField = 'student_name' | 'dpi' | 'course_name' | 'grade' | 'previous_school' | 'personal_code';
    const [sortField, setSortField] = useState<SortField>('student_name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const setSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const { data: students, isLoading } = useQuery({
        queryKey: ['studentReports'],
        queryFn: getStudentReports,
    });

    // Extract unique filters
    const uniqueCourses = useMemo(() => {
        if (!students) return [];
        const courses = new Set<string>();
        students.forEach(s => s.enrollments.forEach((e: any) => courses.add(e.course_name)));
        return Array.from(courses).sort();
    }, [students]);

    const uniqueGrades = useMemo(() => {
        if (!students) return [];
        const grades = new Set<string>();
        students.forEach(s => s.enrollments.forEach((e: any) => grades.add(e.grade)));
        return Array.from(grades).sort();
    }, [students]);

    const uniqueDays = useMemo(() => {
        if (!students) return [];
        const days = new Set<string>();
        students.forEach(s => s.enrollments.forEach((e: any) => days.add(e.day_of_week)));
        return Array.from(days).sort();
    }, [students]);

    const uniqueSchools = useMemo(() => {
        if (!students) return [];
        const schools = new Set<string>();
        students.forEach(s => {
            if (s.previous_school) schools.add(s.previous_school);
        });
        return Array.from(schools).sort();
    }, [students]);

    // Flatten data for table view (1 row per student per course)
    const tableData = useMemo(() => {
        if (!students) return [];

        const flattened: any[] = [];
        students.forEach(student => {
            if (student.enrollments.length === 0) {
                // Determine if we should include students without active enrollments
                // Let's include them but with N/A for course fields
                flattened.push({
                    id: student.id,
                    student_name: student.full_name,
                    dpi: student.identification_document,
                    phone: student.phone,
                    previous_school: student.previous_school || '-',
                    personal_code: student.personal_code || '-',
                    course_name: 'Sin Asignación',
                    grade: 'N/A',
                    day_of_week: 'N/A',
                    start_time: '',
                    end_time: ''
                });
            } else {
                student.enrollments.forEach((e: any) => {
                    flattened.push({
                        id: student.id,
                        student_name: student.full_name,
                        dpi: student.identification_document,
                        phone: student.phone,
                        previous_school: student.previous_school || '-',
                        personal_code: student.personal_code || '-',
                        course_name: e.course_name,
                        grade: e.grade,
                        day_of_week: e.day_of_week,
                        start_time: e.start_time,
                        end_time: e.end_time
                    });
                });
            }
        });

        // Filter data
        const filtered = flattened.filter(item => {
            const matchesSearch = item.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.dpi && item.dpi.includes(searchTerm)) ||
                (item.personal_code && item.personal_code.includes(searchTerm));
            const matchesCourse = filterCourse ? item.course_name === filterCourse : true;
            const matchesGrade = filterGrade ? item.grade === filterGrade : true;
            const matchesDay = filterDay ? item.day_of_week === filterDay : true;
            const matchesSchool = filterSchool ? item.previous_school === filterSchool : true;

            return matchesSearch && matchesCourse && matchesGrade && matchesDay && matchesSchool;
        });

        // Sort data
        return filtered.sort((a, b) => {
            const valA = String(a[sortField] || '').toLowerCase();
            const valB = String(b[sortField] || '').toLowerCase();

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

    }, [students, searchTerm, filterCourse, filterGrade, filterDay, filterSchool, sortField, sortOrder]);

    const activeStudentsCount = useMemo(() => {
        if (!students) return 0;
        // Count unique students who have at least one active enrollment
        const uniqueIds = new Set(tableData.filter(t => t.course_name !== 'Sin Asignación').map(t => t.id));
        return uniqueIds.size;
    }, [tableData, students]);

    const generatePDF = async () => {
        const doc = new jsPDF({ orientation: 'landscape', format: 'letter' });

        doc.setFontSize(18);
        doc.text('REPORTE DE ALUMNOS INSCRITOS', 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);

        const filterTexts = [];
        if (filterCourse) filterTexts.push(`Curso: ${filterCourse}`);
        if (filterGrade) filterTexts.push(`Grado: ${filterGrade}`);
        if (filterDay) filterTexts.push(`Día: ${filterDay}`);
        if (filterSchool) filterTexts.push(`Proc.: ${filterSchool}`);

        if (filterTexts.length > 0) {
            doc.text(`Filtros activos: ${filterTexts.join(' | ')}`, 14, 30);
        } else {
            doc.text('Todos los alumnos', 14, 30);
        }

        const tableColumn = ["No.", "Estudiante", "CUI/DPI", "Cód. Mineduc", "Procedencia", "Curso", "Grado / Día"];
        const tableRows = tableData.map((item, index) => [
            index + 1,
            item.student_name,
            item.dpi || 'N/A',
            item.personal_code,
            item.previous_school,
            item.course_name,
            item.grade !== 'N/A' ? `${item.grade} - ${item.day_of_week}` : 'N/A'
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: filterTexts.length > 0 ? 35 : 35,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [37, 192, 244] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
        });

        const fecha = new Date().toLocaleDateString('es-GT').replace(/\//g, '-');
        await savePdfDoc(doc, `Reporte_Alumnos_${fecha}.pdf`);
    };

    return (
        <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* Header & Export */}
            <div className="flex items-center justify-between gap-3 mt-1 sm:mt-2">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Reporte de Estudiantes
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        Listado completo y asignaciones de cursos.
                    </p>
                </div>
                <button
                    onClick={generatePDF}
                    className="flex items-center gap-1.5 bg-brand-blue hover:bg-blue-600 text-white px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md hover:shadow-brand-blue/30 active:scale-95 border border-brand-blue/50 shrink-0 cursor-pointer"
                    title="Exportar reporte en PDF"
                >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Exportar PDF</span>
                    <span className="inline sm:hidden">PDF</span>
                </button>
            </div>

            {/* Metrics (2 Columns on mobile, side-by-side) */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                <div className="glass-card p-3.5 sm:p-5 border border-slate-200 dark:border-white/10 flex items-center space-x-3 sm:space-x-4 hover:border-brand-success/50 transition-colors">
                    <div className="h-11 w-11 sm:h-14 sm:h-14 bg-brand-success/10 text-brand-success rounded-xl sm:rounded-2xl flex items-center justify-center border border-brand-success/20 shrink-0 shadow-inner">
                        <Users className="h-5 w-5 sm:h-7 sm:h-7" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                            Total Estudiantes
                        </p>
                        <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                            {students?.length || 0}
                        </h3>
                    </div>
                </div>

                <div className="glass-card p-3.5 sm:p-5 border border-slate-200 dark:border-white/10 flex items-center space-x-3 sm:space-x-4 hover:border-brand-blue/50 transition-colors">
                    <div className="h-11 w-11 sm:h-14 sm:h-14 bg-brand-blue/10 text-brand-blue rounded-xl sm:rounded-2xl flex items-center justify-center border border-brand-blue/20 shrink-0 shadow-inner">
                        <GraduationCap className="h-5 w-5 sm:h-7 sm:h-7" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                            Alumnos Activos
                        </p>
                        <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                            {activeStudentsCount}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-brand-blue transition-colors pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o CUI..."
                            className="w-full h-11 pl-10 pr-9 bg-slate-50/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-white rounded-xl text-sm focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
                                aria-label="Limpiar búsqueda"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Mobile Filter Toggle Button */}
                    <button
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                        className={`md:hidden flex items-center gap-1.5 h-11 px-3.5 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                            activeFiltersCount > 0 || isFiltersOpen
                                ? 'bg-brand-blue/15 border-brand-blue/50 text-brand-blue dark:text-brand-teal'
                                : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                        aria-label="Alternar filtros"
                    >
                        <SlidersHorizontal className="h-4 w-4" />
                        <span>Filtros</span>
                        {activeFiltersCount > 0 && (
                            <span className="w-4 h-4 rounded-full bg-brand-blue text-white text-[9px] flex items-center justify-center font-black">
                                {activeFiltersCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Dropdown Filters: Collapsible on mobile, always visible on desktop */}
                <div className={`${isFiltersOpen ? 'grid' : 'hidden md:grid'} grid-cols-2 md:grid-cols-4 gap-2.5 pt-0.5`}>
                    <div className="relative">
                        <select
                            className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue outline-none transition-all cursor-pointer truncate"
                            value={filterCourse}
                            onChange={(e) => setFilterCourse(e.target.value)}
                        >
                            <option value="">Todos los Cursos</option>
                            {uniqueCourses.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <select
                            className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue outline-none transition-all cursor-pointer truncate"
                            value={filterGrade}
                            onChange={(e) => setFilterGrade(e.target.value)}
                        >
                            <option value="">Todos los Grados</option>
                            {uniqueGrades.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <select
                            className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue outline-none transition-all cursor-pointer truncate"
                            value={filterDay}
                            onChange={(e) => setFilterDay(e.target.value)}
                        >
                            <option value="">Cualquier Día</option>
                            {uniqueDays.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <select
                            className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-blue/25 focus:border-brand-blue outline-none transition-all cursor-pointer truncate"
                            value={filterSchool}
                            onChange={(e) => setFilterSchool(e.target.value)}
                        >
                            <option value="">Procedencia</option>
                            {uniqueSchools.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Filter info and reset */}
                {(activeFiltersCount > 0 || searchTerm) && (
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <span className="text-slate-400 text-[11px]">
                            Mostrando {tableData.length} resultados
                        </span>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setFilterCourse('');
                                setFilterGrade('');
                                setFilterDay('');
                                setFilterSchool('');
                            }}
                            className="text-brand-blue dark:text-brand-teal font-semibold hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                            <X className="w-3 h-3" /> Limpiar filtros
                        </button>
                    </div>
                )}
            </div>

            {/* Loading Indicator */}
            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin h-8 w-8 text-brand-blue" />
                </div>
            ) : (
                <>
                    {/* Mobile Cards Feed (Visible on phones, hidden on desktop) */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                        {tableData.map((item, idx) => (
                            <div
                                key={`mob-${item.id}-${idx}`}
                                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/5 rounded-2xl p-4 shadow-sm space-y-2.5 transition-all"
                            >
                                {/* Top: Student Initials + Name + CUI */}
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-blue to-brand-purple text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm shadow-brand-blue/20">
                                        {item.student_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-1">
                                            <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                                {item.student_name}
                                            </h3>
                                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">#{idx + 1}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                            {item.dpi && (
                                                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                    CUI: {item.dpi}
                                                </span>
                                            )}
                                            {item.personal_code && item.personal_code !== '-' && (
                                                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                    Cód: {item.personal_code}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Course & Schedule Box */}
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-xs text-brand-blue dark:text-brand-teal truncate">
                                            {item.course_name}
                                        </span>
                                        {item.grade !== 'N/A' && (
                                            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-600 shrink-0">
                                                {item.grade}
                                            </span>
                                        )}
                                    </div>
                                    {item.grade !== 'N/A' ? (
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                            <span>{item.day_of_week} {item.start_time ? `(${item.start_time.substring(0, 5)} - ${item.end_time.substring(0, 5)})` : ''}</span>
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-slate-400 italic">Sin horario asignado</p>
                                    )}
                                </div>

                                {/* Procedencia and Phone Contact */}
                                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                                    <span className="truncate max-w-[60%]" title={item.previous_school}>
                                        {item.previous_school && item.previous_school !== '-' ? `Procedencia: ${item.previous_school}` : 'Sin procedencia'}
                                    </span>
                                    {item.phone && (
                                        <a
                                            href={`tel:${item.phone}`}
                                            className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 shrink-0"
                                        >
                                            <Phone className="w-3 h-3" />
                                            <span>{item.phone}</span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}

                        {tableData.length === 0 && (
                            <div className="text-center py-12 px-4 bg-white/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-sm">
                                No se encontraron estudiantes con los filtros aplicados.
                            </div>
                        )}
                    </div>

                    {/* Desktop Table View (Hidden on mobile, visible on tablet/desktop) */}
                    <div className="hidden md:block glass-card rounded-3xl overflow-hidden shadow-sm border border-slate-200 dark:border-white/10">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50 select-none">
                                    <tr>
                                        <th className="px-6 py-5 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest w-12">No.</th>
                                        <SortableHeader field="student_name" label="Estudiante" currentSort={sortField} order={sortOrder} onClick={setSort} />
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => setSort('dpi')}>
                                            <div className="flex items-center gap-1 group-hover:text-brand-blue transition-colors">CUI/DPI {sortField === 'dpi' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />}</div>
                                        </th>
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => setSort('personal_code')}>
                                            <div className="flex items-center gap-1 group-hover:text-brand-blue transition-colors">Cód. Personal {sortField === 'personal_code' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />}</div>
                                        </th>
                                        <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest cursor-pointer group" onClick={() => setSort('previous_school')}>
                                            <div className="flex items-center gap-1 group-hover:text-brand-blue transition-colors">Procedencia {sortField === 'previous_school' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />}</div>
                                        </th>
                                        <SortableHeader field="course_name" label="Curso" currentSort={sortField} order={sortOrder} onClick={setSort} />
                                        <SortableHeader field="grade" label="Grado/Día" currentSort={sortField} order={sortOrder} onClick={setSort} />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/50 dark:bg-transparent">
                                    {tableData.map((item, idx) => (
                                        <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group">
                                            <td className="px-6 py-4 text-center text-slate-400 text-xs font-medium">{idx + 1}</td>
                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{item.student_name}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium text-sm">{item.dpi || '-'}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium text-sm">{item.personal_code || '-'}</td>
                                            <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium text-xs max-w-[150px] truncate" title={item.previous_school}>{item.previous_school}</td>
                                            <td className="px-6 py-4 text-brand-blue font-bold text-sm">{item.course_name}</td>
                                            <td className="px-6 py-4">
                                                {item.grade !== 'N/A' ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-slate-700 dark:text-slate-200 font-bold text-sm">{item.grade}</span>
                                                        <span className="text-slate-500 text-xs">{item.day_of_week} {item.start_time ? `(${item.start_time.substring(0, 5)} - ${item.end_time.substring(0, 5)})` : ''}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">Sin asignar</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {tableData.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                                                No se encontraron estudiantes con los filtros aplicados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default StudentReports;
