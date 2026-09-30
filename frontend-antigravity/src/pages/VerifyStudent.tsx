import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
    CheckCircle2, 
    XCircle, 
    ShieldCheck, 
    BookOpen, 
    Building2, 
    Calendar,
    ExternalLink
} from 'lucide-react';
import { verifyStudentPublic, type VerifyStudentData } from '../features/academic/studentVerifyService';

export const VerifyStudent: React.FC = () => {
    const { identifier } = useParams<{ identifier: string }>();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<VerifyStudentData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!identifier) {
            setError('Código o identificador de estudiante no especificado.');
            setLoading(false);
            return;
        }

        const fetchVerification = async () => {
            try {
                const res = await verifyStudentPublic(identifier);
                if (res.valid) {
                    setData(res);
                } else {
                    setError(res.message || 'La credencial no es válida.');
                }
            } catch (err: any) {
                console.error('Error verifying student credential:', err);
                setError(err.response?.data?.message || 'Estudiante no encontrado en los registros institucionales de ULTEC.');
            } finally {
                setLoading(false);
            }
        };

        fetchVerification();
    }, [identifier]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-brand-blue selection:text-white">
            {/* Background elements */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,192,244,0.15),rgba(255,255,255,0))] pointer-events-none" />

            <div className="relative w-full max-w-lg">
                {/* Header Brand */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-blue/10 border border-brand-blue/20 text-brand-teal text-xs font-bold uppercase tracking-wider mb-3">
                        <ShieldCheck className="w-4 h-4 text-brand-teal" />
                        <span>Validación Oficial de Credencial</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        ULTRA TECNOLOGÍA
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        Centro de Formación Técnica y Tecnológica
                    </p>
                </div>

                {/* Main Card */}
                <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                    {loading ? (
                        <div className="py-16 flex flex-col items-center justify-center gap-4 text-slate-400">
                            <div className="w-10 h-10 border-4 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin" />
                            <p className="text-sm font-medium">Consultando registros oficiales en tiempo real...</p>
                        </div>
                    ) : error ? (
                        <div className="py-8 flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                                <XCircle className="w-8 h-8" />
                            </div>
                            <h2 className="text-xl font-bold text-white">Credencial No Encontrada</h2>
                            <p className="text-sm text-slate-400 max-w-md">
                                {error}
                            </p>
                            <div className="pt-4">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
                                >
                                    <span>Ir al Portal Principal</span>
                                    <ExternalLink className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>
                    ) : data ? (
                        <div className="space-y-6">
                            {/* Verification Badge */}
                            <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
                                data.is_active 
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            }`}>
                                <CheckCircle2 className="w-6 h-6 shrink-0" />
                                <div>
                                    <h3 className="text-sm font-bold tracking-tight">
                                        {data.is_active ? 'Estudiante Oficial y Activo' : 'Registro de Estudiante Encontrado'}
                                    </h3>
                                    <p className="text-xs opacity-90">
                                        {data.is_active 
                                            ? 'Matrícula vigente en el período lectivo actual.' 
                                            : 'El estudiante no cuenta con cursos activos en este ciclo.'}
                                    </p>
                                </div>
                            </div>

                            {/* Student Profile Overview */}
                            <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white font-black text-xl shadow-lg shrink-0">
                                    {data.full_name?.charAt(0)?.toUpperCase() || 'E'}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-black text-white truncate">{data.full_name}</h2>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs font-mono font-bold text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded-md border border-brand-teal/20">
                                            {data.student_code}
                                        </span>
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                            data.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                        }`}>
                                            {data.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 flex flex-col justify-between">
                                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                        <Building2 className="w-3.5 h-3.5 text-brand-teal" />
                                        <span className="font-semibold uppercase tracking-wider text-[10px]">Sede Asignada</span>
                                    </div>
                                    <span className="text-white font-bold text-sm truncate">{data.branch_name}</span>
                                </div>

                                <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 flex flex-col justify-between">
                                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                                        <Calendar className="w-3.5 h-3.5 text-brand-blue" />
                                        <span className="font-semibold uppercase tracking-wider text-[10px]">Período</span>
                                    </div>
                                    <span className="text-white font-bold text-sm truncate">{data.cycle}</span>
                                </div>
                            </div>

                            {/* Active Courses */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                                    <BookOpen className="w-3.5 h-3.5 text-brand-teal" />
                                    <span>Cursos Inscritos Activos ({data.courses.length})</span>
                                </div>
                                {data.courses && data.courses.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {data.courses.map((course, idx) => (
                                            <div key={idx} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                                                <span className="text-xs font-bold text-white">{course}</span>
                                                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                    En Curso
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-500 italic p-3 rounded-xl bg-slate-950/40 border border-slate-800/60">
                                        No hay cursos activos matriculados en este momento.
                                    </p>
                                )}
                            </div>

                            {/* Physical Card Stamping */}
                            {data.physical_card?.is_delivered ? (
                                <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center gap-3">
                                    <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-teal-300">Credencial Física Oficial Entregada</p>
                                        <p className="text-[11px] text-teal-400/80">Entregada formalmente en plantel por {data.physical_card.delivered_by || 'Administración'}.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
                                    <ShieldCheck className="w-5 h-5 text-brand-teal shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-300">Verificación Digital Activa</p>
                                        <p className="text-[11px] text-slate-500">Credencial institucional en línea vinculada a la base de datos de ULTEC.</p>
                                    </div>
                                </div>
                            )}

                            {/* Verification Footer Stamp */}
                            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                                <span>Verificado: {new Date(data.verified_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="font-mono text-[10px]">ID: {data.student_id?.slice(0, 8)}</span>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Footer Back Button */}
                <div className="text-center mt-6">
                    <Link 
                        to="/login"
                        className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1"
                    >
                        <span>© {new Date().getFullYear()} Plataforma ULTEC • Portal Académico</span>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default VerifyStudent;
