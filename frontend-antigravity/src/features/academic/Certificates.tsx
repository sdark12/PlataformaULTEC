import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, FileText, GraduationCap, Search, Download } from 'lucide-react';
import api from '../../services/apiClient';
import { generateEnrollmentCertificate, generateGradesCertificate } from '../../utils/certificateGenerator';

type CertType = 'enrollment' | 'grades';

interface Student {
    id: string;
    full_name: string;
    personal_code: string;
}

interface Enrollment {
    course_id: string;
    course_name?: string;
    course_schedules?: { grade: string };
    schedule_details?: string;
}

const fetchStudents = async (search: string): Promise<Student[]> => {
    const res = await api.get('/api/students', { params: { search, limit: 20 } });
    return res.data?.data || res.data || [];
};

const fetchEnrollments = async (studentId: string): Promise<Enrollment[]> => {
    const res = await api.get('/api/enrollments', { params: { student_id: studentId } });
    const data = res.data?.data || res.data || [];
    return data;
};

const fetchGrades = async (courseId: string, studentId: string) => {
    const units = ['Unidad 1', 'Unidad 2', 'Unidad 3', 'Unidad 4', 'Examen Final', 'Proyecto'];
    const results: Array<{ unit: string; score: number | string }> = [];

    for (const unit of units) {
        try {
            const res = await api.get('/api/grades', { params: { course_id: courseId, unit_name: unit } });
            const grades = res.data || [];
            const studentGrade = grades.find((g: any) => g.student_id === studentId);
            results.push({ unit, score: studentGrade?.score ?? '' });
        } catch {
            results.push({ unit, score: '' });
        }
    }
    return results;
};

interface CertificatesProps {
    isEmbedded?: boolean;
}

const Certificates = ({ isEmbedded = false }: CertificatesProps) => {
    const [search, setSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [certType, setCertType] = useState<CertType>('enrollment');
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [generating, setGenerating] = useState(false);

    const { data: students, isLoading: loadingStudents } = useQuery({
        queryKey: ['cert-students', search],
        queryFn: () => fetchStudents(search),
        enabled: search.length >= 2,
    });

    const { data: enrollments } = useQuery({
        queryKey: ['cert-enrollments', selectedStudent?.id],
        queryFn: () => fetchEnrollments(selectedStudent!.id),
        enabled: !!selectedStudent,
    });

    const handleGenerate = async () => {
        if (!selectedStudent) return;
        setGenerating(true);

        try {
            const selectedEnrollment = enrollments?.find((e: any) => e.course_id === selectedCourseId);
            const courseName = selectedEnrollment?.course_name;
            const grade = selectedEnrollment?.schedule_details?.split('-')[0]?.trim() || '';

            const data = {
                studentName: selectedStudent.full_name,
                personalCode: selectedStudent.personal_code,
                courseName: courseName || undefined,
                grade: grade || undefined,
            };

            if (certType === 'enrollment') {
                generateEnrollmentCertificate(data);
            } else {
                if (!selectedCourseId) {
                    alert('Selecciona un curso para generar constancia de notas.');
                    setGenerating(false);
                    return;
                }
                const grades = await fetchGrades(selectedCourseId, selectedStudent.id);
                generateGradesCertificate(data, grades);
            }
        } catch (err) {
            console.error('Error generating certificate:', err);
            alert('Error al generar la constancia.');
        }

        setGenerating(false);
    };

    return (
        <div className={`max-w-4xl mx-auto ${isEmbedded ? '' : 'pb-12 animate-in fade-in duration-500'}`}>
            {!isEmbedded && (
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-purple-500/10 rounded-2xl">
                        <GraduationCap className="h-7 w-7 text-purple-500" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Constancias y Certificados</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">Genera documentos oficiales para los estudiantes.</p>
                    </div>
                </div>
            )}

            {/* Step 1: Search Student */}
            <div className="glass-card p-6 mb-6">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">1. Buscar Estudiante</h3>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Escribe el nombre o código del estudiante..."
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none font-medium"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setSelectedStudent(null); }}
                    />
                </div>

                {loadingStudents && (
                    <div className="flex items-center gap-2 mt-3 text-slate-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Buscando...</span>
                    </div>
                )}

                {students && students.length > 0 && !selectedStudent && (
                    <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
                        {students.map((s: Student) => (
                            <button
                                key={s.id}
                                onClick={() => { setSelectedStudent(s); setSearch(s.full_name); }}
                                className="w-full text-left p-3 rounded-xl hover:bg-brand-blue/5 dark:hover:bg-white/5 transition-colors flex items-center justify-between group"
                            >
                                <div>
                                    <p className="font-semibold text-slate-800 dark:text-white group-hover:text-brand-blue transition-colors">{s.full_name}</p>
                                    <p className="text-xs text-slate-400">{s.personal_code || 'Sin código'}</p>
                                </div>
                                <span className="text-xs text-brand-blue font-bold opacity-0 group-hover:opacity-100 transition-opacity">Seleccionar</span>
                            </button>
                        ))}
                    </div>
                )}

                {selectedStudent && (
                    <div className="mt-3 p-3 bg-brand-blue/5 dark:bg-brand-blue/10 border border-brand-blue/20 rounded-xl flex items-center justify-between">
                        <div>
                            <p className="font-bold text-brand-blue">{selectedStudent.full_name}</p>
                            <p className="text-xs text-slate-500">{selectedStudent.personal_code || 'Sin código'}</p>
                        </div>
                        <button
                            onClick={() => { setSelectedStudent(null); setSearch(''); }}
                            className="text-xs text-slate-400 hover:text-rose-500 font-bold transition-colors"
                        >
                            Cambiar
                        </button>
                    </div>
                )}
            </div>

            {/* Step 2: Certificate Type */}
            {selectedStudent && (
                <div className="glass-card p-6 mb-6 animate-in fade-in duration-300">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">2. Tipo de Constancia</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                            onClick={() => setCertType('enrollment')}
                            className={`p-5 rounded-2xl border-2 transition-all text-left ${certType === 'enrollment'
                                ? 'border-brand-blue bg-brand-blue/5 dark:bg-brand-blue/10 shadow-[0_0_15px_rgba(13,89,242,0.15)]'
                                : 'border-slate-200 dark:border-white/10 hover:border-brand-blue/30'
                                }`}
                        >
                            <FileText className={`w-8 h-8 mb-2 ${certType === 'enrollment' ? 'text-brand-blue' : 'text-slate-400'}`} />
                            <p className="font-bold text-slate-900 dark:text-white">Constancia de Inscripción</p>
                            <p className="text-xs text-slate-500 mt-1">Certifica que el estudiante está inscrito en la institución.</p>
                        </button>
                        <button
                            onClick={() => setCertType('grades')}
                            className={`p-5 rounded-2xl border-2 transition-all text-left ${certType === 'grades'
                                ? 'border-purple-500 bg-purple-500/5 dark:bg-purple-500/10 shadow-[0_0_15px_rgba(127,13,242,0.15)]'
                                : 'border-slate-200 dark:border-white/10 hover:border-purple-500/30'
                                }`}
                        >
                            <GraduationCap className={`w-8 h-8 mb-2 ${certType === 'grades' ? 'text-purple-500' : 'text-slate-400'}`} />
                            <p className="font-bold text-slate-900 dark:text-white">Constancia de Notas</p>
                            <p className="text-xs text-slate-500 mt-1">Incluye el detalle de calificaciones por unidad.</p>
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Course Selection (for both types) */}
            {selectedStudent && enrollments && enrollments.length > 0 && (
                <div className="glass-card p-6 mb-6 animate-in fade-in duration-300">
                    <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        3. Seleccionar Curso {certType === 'enrollment' ? '(Opcional)' : '(Requerido)'}
                    </h3>
                    <select
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none font-medium appearance-none"
                        value={selectedCourseId}
                        onChange={e => setSelectedCourseId(e.target.value)}
                    >
                        <option value="">-- Sin curso específico --</option>
                        {enrollments.map((e: any) => (
                            <option key={e.course_id} value={e.course_id}>
                                {e.course_name || e.course_id}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Generate Button */}
            {selectedStudent && (
                <div className="flex justify-center animate-in fade-in duration-300">
                    <button
                        onClick={handleGenerate}
                        disabled={generating || (certType === 'grades' && !selectedCourseId)}
                        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-blue to-brand-purple text-white font-bold rounded-2xl shadow-[0_0_25px_rgba(13,89,242,0.4)] hover:shadow-[0_0_35px_rgba(13,89,242,0.5)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                    >
                        {generating ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Generando...</>
                        ) : (
                            <><Download className="w-5 h-5" /> Generar Constancia</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

export default Certificates;
