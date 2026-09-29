import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
    Loader2, 
    FileText, 
    GraduationCap, 
    Search, 
    Download, 
    Check, 
    X, 
    AlertCircle,
    AlertTriangle,
    ShieldCheck,
    Clock,
    Send,
    Lock
} from 'lucide-react';
import api from '../../services/apiClient';
import { getCurrentUser } from '../auth/authService';
import { 
    getStudentReportCard, 
    getDocumentAuthorizationStatus, 
    requestDocumentAuthorization,
    updateDocumentAuthorization,
    trackDocumentDownload 
} from './gradeService';
import { getSettings } from '../settings/settingsService';
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
    enrollment_date?: string;
    academic_status?: string;
    is_active?: boolean;
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

const fetchGrades = async (courseId: string, studentId: string, customUnits?: string[]) => {
    try {
        const report = await getStudentReportCard(studentId);
        const courseData = report?.courses?.find((c: any) => String(c.course_id) === String(courseId));

        const defaultUnits = ['Bimestre 1', 'Bimestre 2', 'Bimestre 3', 'Bimestre 4'];
        const configured = (customUnits && customUnits.length > 0) ? customUnits : defaultUnits;

        // Collect all units configured, plus any distinct units present in the student's grades
        const allUnits = [...configured];
        if (courseData?.units && Array.isArray(courseData.units)) {
            courseData.units.forEach((u: any) => {
                if (u.unit_name && !allUnits.some(existing => existing.trim().toLowerCase() === u.unit_name.trim().toLowerCase())) {
                    allUnits.push(u.unit_name);
                }
            });
        }

        const results: Array<{ unit: string; score: number | string }> = [];
        for (const unit of allUnits) {
            const found = courseData?.units?.find((u: any) => 
                u.unit_name?.trim()?.toLowerCase() === unit.trim()?.toLowerCase()
            );
            const rawScore = found?.score;
            const score = (rawScore !== undefined && rawScore !== null && rawScore !== '') ? Number(rawScore) : '';
            results.push({ unit, score });
        }
        return results;
    } catch (err) {
        console.error('Error fetching student report grades for certificate:', err);
        const units = customUnits && customUnits.length > 0
            ? customUnits
            : ['Bimestre 1', 'Bimestre 2', 'Bimestre 3', 'Bimestre 4'];
        return units.map(unit => ({ unit, score: '' }));
    }
};

interface CertificatesProps {
    isEmbedded?: boolean;
}

const Certificates = ({ isEmbedded = false }: CertificatesProps) => {
    const user = getCurrentUser();
    const role = user?.role;
    const isSecretary = role === 'secretary';
    const isAdmin = ['admin', 'superadmin'].includes(role || '');
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [certType, setCertType] = useState<CertType>('enrollment');
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [generating, setGenerating] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Authorization modal state
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authReason, setAuthReason] = useState('');
    const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

    const { data: students, isLoading: loadingStudents } = useQuery({
        queryKey: ['cert-students', search],
        queryFn: () => fetchStudents(search),
        enabled: search.length >= 2,
    });

    const { data: enrollments, isLoading: loadingEnrollments } = useQuery({
        queryKey: ['cert-enrollments', selectedStudent?.id],
        queryFn: () => fetchEnrollments(selectedStudent!.id),
        enabled: !!selectedStudent,
    });

    // Auto-select course when enrollments load
    useEffect(() => {
        if (enrollments && enrollments.length > 0) {
            const active = enrollments.find(e => e.is_active);
            if (active) {
                setSelectedCourseId(active.course_id);
            } else {
                setSelectedCourseId(enrollments[0].course_id);
            }
        }
    }, [enrollments]);

    // Query authorization status for Constancia de Notas
    const { data: authData, refetch: refetchAuth } = useQuery({
        queryKey: ['grades_cert_auth_status', selectedStudent?.id],
        queryFn: async () => {
            // First check GRADES_CERTIFICATE
            const res = await getDocumentAuthorizationStatus(selectedStudent!.id, 'GRADES_CERTIFICATE');
            if (res?.status === 'APPROVED') return res;
            // Fallback check if REPORT_CARD was authorized for this student
            const reportRes = await getDocumentAuthorizationStatus(selectedStudent!.id, 'REPORT_CARD');
            if (reportRes?.status === 'APPROVED') return reportRes;
            return res;
        },
        enabled: !!selectedStudent && isSecretary,
        refetchInterval: 8000,
    });

    const authStatus = authData?.status || 'NONE'; // 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONSUMED'
    const downloadCount = authData?.download_count ?? (authData?.request?.download_count || 0);
    const maxDownloads = authData?.max_downloads ?? (authData?.request?.max_downloads || 3);
    const remainingDownloads = Math.max(0, maxDownloads - downloadCount);
    const isConsumed = authStatus === 'CONSUMED' || (isSecretary && authStatus === 'APPROVED' && remainingDownloads <= 0);
    const isGradesAuthorized = isAdmin || (authStatus === 'APPROVED' && !isConsumed);

    const { data: settings } = useQuery({
        queryKey: ['system_settings'],
        queryFn: getSettings,
    });

    const configuredUnits = useMemo(() => {
        if (!settings?.grade_unit_names) return undefined;
        return settings.grade_unit_names.split(',').map((u: string) => u.trim()).filter(Boolean);
    }, [settings?.grade_unit_names]);

    const handleSendAuthRequest = async () => {
        if (!selectedStudent) return;
        setIsSubmittingAuth(true);
        try {
            await requestDocumentAuthorization(
                selectedStudent.id, 
                authReason || 'Solicitud de emisión oficial de constancia de notas', 
                'GRADES_CERTIFICATE'
            );
            setIsAuthModalOpen(false);
            setAuthReason('');
            await refetchAuth();
            await queryClient.invalidateQueries({ queryKey: ['all-doc-authorizations'] });
            alert('¡Solicitud de autorización enviada con éxito a la Dirección General!');
        } catch (err: any) {
            console.error('Error al enviar solicitud:', err);
            alert(`Error al enviar solicitud: ${err?.response?.data?.message || err?.message || 'Error desconocido'}`);
        } finally {
            setIsSubmittingAuth(false);
        }
    };

    const handleAdminQuickAuthorize = async () => {
        if (!isAdmin || !selectedStudent) return;
        try {
            const res = await requestDocumentAuthorization(selectedStudent.id, 'Autorizado directamente por administración', 'GRADES_CERTIFICATE');
            if (res?.request?.id) {
                await updateDocumentAuthorization(res.request.id, 'APPROVED', 'Aprobado por administración');
            }
            await refetchAuth();
            await queryClient.invalidateQueries({ queryKey: ['all-doc-authorizations'] });
        } catch (err: any) {
            alert(`Error al autorizar: ${err?.message || 'Error desconocido'}`);
        }
    };

    const handleGenerate = async () => {
        if (!selectedStudent) return;

        // Security check for secretary role on grades certificate
        if (certType === 'grades' && !isGradesAuthorized) {
            alert(isConsumed
                ? 'Límite de 3 descargas alcanzado para esta constancia. Solicita una nueva autorización a Dirección.'
                : 'Por seguridad institucional, la emisión de constancias de notas por parte de secretaría requiere autorización previa de la Dirección General.');
            return;
        }

        setGenerating(true);
        setSuccessMessage(null);

        try {
            const selectedEnrollment = enrollments?.find((e: any) => e.course_id === selectedCourseId);
            const courseName = selectedEnrollment?.course_name;
            const grade = selectedEnrollment?.schedule_details?.split('-')[0]?.trim() || selectedEnrollment?.course_schedules?.grade || '';
            const yearMatch = courseName?.match(/\b(20\d{2})\b/);
            const cycleYear = yearMatch ? yearMatch[1] : (selectedEnrollment?.enrollment_date ? new Date(selectedEnrollment.enrollment_date).getFullYear().toString() : '');

            const data = {
                studentName: selectedStudent.full_name,
                personalCode: selectedStudent.personal_code,
                courseName: courseName || undefined,
                grade: grade || undefined,
                academicStatus: selectedEnrollment?.academic_status,
                cycleYear: cycleYear || undefined,
                isCompleted: selectedEnrollment?.academic_status === 'PROMOTED' || selectedEnrollment?.academic_status === 'GRADUATED'
            };

            if (certType === 'enrollment') {
                await generateEnrollmentCertificate(data);
                setSuccessMessage('¡Constancia de inscripción generada y descargada exitosamente!');
            } else {
                if (!selectedCourseId) {
                    alert('Por favor selecciona un curso específico para generar la constancia de notas.');
                    setGenerating(false);
                    return;
                }
                const grades = await fetchGrades(selectedCourseId, selectedStudent.id, configuredUnits);
                await generateGradesCertificate(data, grades);

                // Track download for secretary if an authorization was used
                if (isSecretary && authData?.request?.id) {
                    try {
                        await trackDocumentDownload(authData.request.id);
                        await refetchAuth();
                        await queryClient.invalidateQueries({ queryKey: ['all-doc-authorizations'] });
                    } catch (trackErr) {
                        console.warn('Error tracking certificate download:', trackErr);
                    }
                }

                setSuccessMessage('¡Constancia de notas generada y descargada exitosamente!');
            }
        } catch (err: any) {
            console.error('Error generating certificate:', err);
            alert(`Error al generar la constancia: ${err?.message || 'Error inesperado'}`);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className={`max-w-4xl mx-auto ${isEmbedded ? '' : 'pb-32 sm:pb-16 animate-in fade-in duration-300'}`}>
            {!isEmbedded && (
                <div className="flex items-center gap-3.5 mb-6 sm:mb-8">
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                        <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            Constancias y Certificados
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Genera documentos oficiales en PDF listos para imprimir o compartir.
                        </p>
                    </div>
                </div>
            )}

            {/* Success Toast / Notification */}
            {successMessage && (
                <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
                        <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{successMessage}</span>
                    </div>
                    <button
                        onClick={() => setSuccessMessage(null)}
                        className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg text-emerald-600 dark:text-emerald-400"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Step 1: Search Student */}
            <div className="bg-white dark:bg-slate-900/90 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 mb-6 transition-all">
                <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 text-xs flex items-center justify-center font-black">
                            1
                        </span>
                        Buscar Estudiante
                    </h3>
                    {selectedStudent && (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Seleccionado
                        </span>
                    )}
                </div>

                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Escribe el nombre o código del estudiante..."
                        className="w-full pl-11 pr-10 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none font-medium text-sm"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setSelectedStudent(null); setSuccessMessage(null); }}
                    />
                    {search && (
                        <button
                            onClick={() => { setSearch(''); setSelectedStudent(null); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {loadingStudents && (
                    <div className="flex items-center gap-2 mt-3 text-slate-400 text-xs sm:text-sm">
                        <Loader2 className="w-4 h-4 animate-spin text-brand-blue" />
                        <span>Buscando en el padrón de alumnos...</span>
                    </div>
                )}

                {students && students.length > 0 && !selectedStudent && (
                    <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl max-h-52 overflow-y-auto bg-white dark:bg-slate-800 shadow-md">
                        {students.map((s: Student) => (
                            <button
                                key={s.id}
                                onClick={() => { setSelectedStudent(s); setSearch(s.full_name); }}
                                className="w-full text-left p-3 hover:bg-brand-blue/5 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-bold text-xs flex items-center justify-center shrink-0">
                                        {s.full_name?.charAt(0)?.toUpperCase() || 'E'}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white text-sm group-hover:text-brand-blue dark:group-hover:text-blue-400 transition-colors">
                                            {s.full_name}
                                        </p>
                                        <p className="text-xs text-slate-400">
                                            Código: {s.personal_code || 'Sin código'}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 border border-brand-blue/20">
                                    Seleccionar
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {selectedStudent && (
                    <div className="mt-3 p-3.5 bg-brand-blue/5 dark:bg-brand-blue/10 border border-brand-blue/20 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-brand-blue/15 text-brand-blue dark:text-blue-400 font-black text-sm flex items-center justify-center shrink-0">
                                {selectedStudent.full_name?.charAt(0)?.toUpperCase() || 'E'}
                            </div>
                            <div>
                                <p className="font-bold text-slate-900 dark:text-white text-sm">{selectedStudent.full_name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Código Personal: {selectedStudent.personal_code || 'Sin código'}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setSelectedStudent(null); setSearch(''); setSelectedCourseId(''); }}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 font-bold transition-colors"
                        >
                            Cambiar
                        </button>
                    </div>
                )}
            </div>

            {/* Step 2: Certificate Type */}
            {selectedStudent && (
                <div className="bg-white dark:bg-slate-900/90 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 mb-6 animate-in fade-in duration-300">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 text-xs flex items-center justify-center font-black">
                            2
                        </span>
                        Tipo de Constancia
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                        <button
                            onClick={() => setCertType('enrollment')}
                            className={`p-4 sm:p-5 rounded-2xl border-2 transition-all text-left relative active:scale-[0.99] ${
                                certType === 'enrollment'
                                    ? 'border-brand-blue bg-brand-blue/5 dark:bg-brand-blue/10 shadow-sm'
                                    : 'border-slate-200 dark:border-slate-800 hover:border-brand-blue/30 bg-slate-50/50 dark:bg-slate-800/30'
                            }`}
                        >
                            {certType === 'enrollment' && (
                                <div className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-brand-blue text-white flex items-center justify-center shadow-sm">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                            )}
                            <FileText className={`w-7 h-7 mb-2.5 ${certType === 'enrollment' ? 'text-brand-blue' : 'text-slate-400'}`} />
                            <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Constancia de Inscripción</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Certifica que el estudiante está inscrito formalmente en la institución educativa.
                            </p>
                        </button>
                        <button
                            onClick={() => setCertType('grades')}
                            className={`p-4 sm:p-5 rounded-2xl border-2 transition-all text-left relative active:scale-[0.99] ${
                                certType === 'grades'
                                    ? 'border-purple-600 bg-purple-600/5 dark:bg-purple-600/10 shadow-sm'
                                    : 'border-slate-200 dark:border-slate-800 hover:border-purple-600/30 bg-slate-50/50 dark:bg-slate-800/30'
                            }`}
                        >
                            {certType === 'grades' && (
                                <div className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-sm">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                            )}
                            <GraduationCap className={`w-7 h-7 mb-2.5 ${certType === 'grades' ? 'text-purple-600' : 'text-slate-400'}`} />
                            <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Constancia de Notas</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Incluye el desglose oficial de notas por unidad para el curso seleccionado.
                            </p>
                        </button>
                    </div>
                </div>
            )}

            {/* Step 3: Course Selection */}
            {selectedStudent && (
                <div className="bg-white dark:bg-slate-900/90 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 mb-6 animate-in fade-in duration-300">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 text-xs flex items-center justify-center font-black">
                            3
                        </span>
                        <span>Seleccionar Curso {certType === 'enrollment' ? '(Opcional)' : '(Requerido para notas)'}</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        {certType === 'enrollment'
                            ? 'Puedes emitir la constancia general de la institución o especificar un curso.'
                            : 'Selecciona el curso del cual deseas extraer las notas por unidad (cursos actuales o completados).'}
                    </p>

                    {loadingEnrollments ? (
                        <div className="flex items-center gap-2 p-3 text-slate-400 text-xs sm:text-sm">
                            <Loader2 className="w-4 h-4 animate-spin text-brand-blue" />
                            <span>Cargando cursos del estudiante...</span>
                        </div>
                    ) : (
                        <div className="relative">
                            <select
                                className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue transition-all outline-none font-medium text-sm"
                                value={selectedCourseId}
                                onChange={e => setSelectedCourseId(e.target.value)}
                            >
                                <option value="" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                                    -- Sin curso específico / Institucional --
                                </option>
                                {enrollments?.map((e: any) => {
                                    const gradeText = e.course_schedules?.grade || (e.schedule_details ? e.schedule_details.split('-')[0].trim() : '');
                                    const statusText = e.academic_status === 'PROMOTED' 
                                        ? '✓ Aprobado / Promovido' 
                                        : (e.academic_status === 'GRADUATED' ? '🎓 Graduado' : (e.is_active ? '● En Curso' : 'Finalizado'));
                                    return (
                                        <option
                                            key={e.course_id}
                                            value={e.course_id}
                                            className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                                        >
                                            {e.course_name || e.course_id} {gradeText ? `(${gradeText})` : ''} — [{statusText}]
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}

                    {certType === 'grades' && !selectedCourseId && !loadingEnrollments && (
                        <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>Debes elegir un curso para poder generar la constancia con notas.</span>
                        </div>
                    )}
                </div>
            )}

            {/* Step 4: Institutional Authorization Status (Required for secretary on Constancia de Notas) */}
            {selectedStudent && certType === 'grades' && (
                <div className="bg-white dark:bg-slate-900/90 p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/80 dark:border-slate-800 mb-6 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <div className={`p-2.5 rounded-xl shrink-0 ${
                                isAdmin
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : isConsumed
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                        : isGradesAuthorized 
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                            : authStatus === 'PENDING'
                                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                            }`}>
                                {isAdmin ? (
                                    <ShieldCheck className="w-6 h-6" />
                                ) : isConsumed ? (
                                    <AlertTriangle className="w-6 h-6 text-rose-600" />
                                ) : isGradesAuthorized ? (
                                    <ShieldCheck className="w-6 h-6" />
                                ) : authStatus === 'PENDING' ? (
                                    <Clock className="w-6 h-6 animate-pulse" />
                                ) : (
                                    <Lock className="w-6 h-6" />
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                                        Validación Institucional de Dirección
                                    </h4>
                                    {isAdmin ? (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-white">
                                            Admin: Acceso Total
                                        </span>
                                    ) : isConsumed ? (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-600 text-white flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Límite Agotado (3/3)
                                        </span>
                                    ) : isGradesAuthorized ? (
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-white flex items-center gap-1">
                                                <Check className="w-3 h-3" /> Autorizada
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                                                {remainingDownloads} de {maxDownloads} descargas disponibles
                                            </span>
                                        </div>
                                    ) : authStatus === 'PENDING' ? (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500 text-white flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> En Revisión
                                        </span>
                                    ) : (
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500 text-white">
                                            Requiere Autorización
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                    {isAdmin ? (
                                        'Tienes privilegios directos de administración para emitir e imprimir esta constancia de notas.'
                                    ) : isConsumed ? (
                                        'Has alcanzado el límite máximo permitido de 3 descargas para esta autorización. Debes solicitar una nueva autorización a Dirección para volver a emitir.'
                                    ) : isGradesAuthorized ? (
                                        `La Dirección General ha aprobado la emisión. Te restan ${remainingDownloads} de ${maxDownloads} descargas permitidas.`
                                    ) : authStatus === 'PENDING' ? (
                                        'Se ha enviado una solicitud a la Dirección General. Podrás generar el documento tan pronto sea aprobada.'
                                    ) : (
                                        'Por seguridad y auditoría institucional, las secretarias deben solicitar aprobación a Dirección antes de emitir notas.'
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons for Authorization */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {isAdmin ? (
                                !isGradesAuthorized && (
                                    <button
                                        onClick={handleAdminQuickAuthorize}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                                    >
                                        <ShieldCheck className="w-4 h-4" />
                                        <span>Autorizar Inmediatamente</span>
                                    </button>
                                )
                            ) : (
                                (!isGradesAuthorized || isConsumed) && (
                                    <button
                                        onClick={() => setIsAuthModalOpen(true)}
                                        disabled={authStatus === 'PENDING'}
                                        className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-brand-blue hover:from-purple-700 hover:to-blue-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {authStatus === 'PENDING' ? (
                                            <>
                                                <Clock className="w-4 h-4 animate-spin" />
                                                <span>Pendiente de Dirección</span>
                                            </>
                                        ) : isConsumed ? (
                                            <>
                                                <ShieldCheck className="w-4 h-4" />
                                                <span>Solicitar Nueva Autorización (Agotada)</span>
                                            </>
                                        ) : (
                                            <>
                                                <ShieldCheck className="w-4 h-4" />
                                                <span>Solicitar Autorización a Dirección</span>
                                            </>
                                        )}
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 5: Generate Button */}
            {selectedStudent && (
                <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300 pt-2 pb-6">
                    <button
                        onClick={handleGenerate}
                        disabled={
                            generating || 
                            (certType === 'grades' && !selectedCourseId) ||
                            (certType === 'grades' && !isGradesAuthorized)
                        }
                        className="w-full sm:w-auto min-w-[280px] flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-lg"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Generando documento PDF...</span>
                            </>
                        ) : (
                            <>
                                <Download className="w-5 h-5" />
                                <span>
                                    {certType === 'grades' && isConsumed
                                        ? 'Bloqueado (Límite 3/3 Agotado)'
                                        : certType === 'grades' && !isGradesAuthorized
                                            ? 'Bloqueado (Requiere Autorización)'
                                            : 'Generar y Descargar Constancia'}
                                </span>
                            </>
                        )}
                    </button>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                        Documento oficial con folio digital y certificación electrónica institucional.
                    </p>
                </div>
            )}

            {/* Request Authorization Modal */}
            {isAuthModalOpen && selectedStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                                        Solicitar Autorización de Notas
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Para el alumno {selectedStudent.full_name}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAuthModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                                disabled={isSubmittingAuth}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/50 rounded-2xl text-xs text-purple-900 dark:text-purple-200 space-y-1">
                                <p className="font-bold flex items-center gap-1">
                                    <span>🛡️</span> Validación Institucional
                                </p>
                                <p className="leading-relaxed">
                                    Como secretaria, la emisión oficial de constancias de notas debe ser autorizada por la Dirección General antes de descargar el archivo oficial en PDF.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                                    Motivo de la solicitud (Opcional)
                                </label>
                                <textarea
                                    value={authReason}
                                    onChange={(e) => setAuthReason(e.target.value)}
                                    placeholder="Ej: Trámite de beca, solicitud de padres de familia, traslado de centro educativo..."
                                    rows={3}
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-purple-600 focus:outline-none transition-all resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                            <button
                                onClick={() => setIsAuthModalOpen(false)}
                                disabled={isSubmittingAuth}
                                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSendAuthRequest}
                                disabled={isSubmittingAuth}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-brand-blue hover:from-purple-700 hover:to-blue-600 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSubmittingAuth ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Enviando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>Enviar Solicitud a Dirección</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Certificates;
