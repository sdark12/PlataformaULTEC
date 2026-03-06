import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Loader2, Users, GraduationCap, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getStudentReports } from '../finance/reportService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

    const generatePDF = () => {
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
        doc.save(`Reporte_Alumnos_${fecha}.pdf`);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header & Export */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        Reporte de Estudiantes
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Listado completo y asignaciones de cursos.</p>
                </div>
                <button
                    onClick={generatePDF}
                    className="flex items-center space-x-2 bg-brand-blue hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg hover:shadow-brand-blue/30 active:scale-95 border border-brand-blue/50"
                >
                    <Download className="h-5 w-5" />
                    <span>Exportar PDF</span>
                </button>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="glass-card p-6 border border-slate-200 dark:border-white/10 flex items-center space-x-5 hover:border-brand-success/50 transition-colors">
                    <div className="h-16 w-16 bg-brand-success/10 text-brand-success rounded-2xl flex items-center justify-center border border-brand-success/20 shadow-inner">
                        <Users className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Total Estudiantes</p>
                        <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                            {students?.length || 0}
                        </h3>
                    </div>
                </div>

                <div className="glass-card p-6 border border-slate-200 dark:border-white/10 flex items-center space-x-5 hover:border-brand-blue/50 transition-colors">
                    <div className="h-16 w-16 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center border border-brand-blue/20 shadow-inner">
                        <GraduationCap className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Alumnos Activos</p>
                        <h3 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                            {activeStudentsCount}
                        </h3>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4">
                <div className="relative w-full group">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o CUI..."
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue transition-all placeholder:text-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative w-full">
                        <div className="absolute left-4 top-3.5 flex items-center pointer-events-none text-slate-400">
                            <Filter className="h-5 w-5" />
                        </div>
                        <select
                            className="w-full pl-12 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue appearance-none font-medium cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                            value={filterCourse}
                            onChange={(e) => setFilterCourse(e.target.value)}
                        >
                            <option value="">Cualquier Curso</option>
                            {uniqueCourses.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative md:w-48 w-full">
                        <select
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue appearance-none font-medium cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                            value={filterGrade}
                            onChange={(e) => setFilterGrade(e.target.value)}
                        >
                            <option value="">Cualquier Grado</option>
                            {uniqueGrades.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative w-full">
                        <select
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue appearance-none font-medium cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                            value={filterDay}
                            onChange={(e) => setFilterDay(e.target.value)}
                        >
                            <option value="">Cualquier Día</option>
                            {uniqueDays.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative w-full">
                        <select
                            className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue appearance-none font-medium cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                            value={filterSchool}
                            onChange={(e) => setFilterSchool(e.target.value)}
                        >
                            <option value="">Escuela de Procedencia</option>
                            {uniqueSchools.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin h-8 w-8 text-brand-blue" />
                </div>
            ) : (
                <div className="glass-card rounded-3xl overflow-hidden shadow-sm border border-slate-200 dark:border-white/10">
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
            )}
        </div>
    );
};

export default StudentReports;
