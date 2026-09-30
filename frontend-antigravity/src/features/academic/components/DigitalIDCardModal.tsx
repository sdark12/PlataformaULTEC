import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
    X, ShieldCheck, RefreshCw, AlertCircle, CheckCircle2, Clock, 
    MapPin, Phone, Building2, Send, Loader2, Lock
} from 'lucide-react';
import { credentialsService, type StudentCredentialCard, type CredentialStatusResponse } from '../../../services/credentialsService';

interface DigitalIDCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    studentId?: string; // If omitted, defaults to 'me'
    studentName?: string;
}

export const DigitalIDCardModal: React.FC<DigitalIDCardModalProps> = ({
    isOpen,
    onClose,
    studentId = 'me',
    studentName
}) => {
    const [cardData, setCardData] = useState<StudentCredentialCard | null>(null);
    const [statusData, setStatusData] = useState<CredentialStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isFlipped, setIsFlipped] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

    // Request physical card modal state
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [requestType, setRequestType] = useState<'FIRST_TIME' | 'REPLACEMENT'>('FIRST_TIME');
    const [requestReason, setRequestReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

    // Cerrar al presionar la tecla Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;

        const loadData = async () => {
            setLoading(true);
            setError(null);
            setSubmitSuccessMsg(null);
            try {
                const [card, status] = await Promise.all([
                    credentialsService.getStudentCredentialCard(studentId),
                    credentialsService.getMyCredentialStatus(studentId === 'me' ? undefined : studentId)
                ]);

                setCardData(card);
                setStatusData(status);

                // Generate QR Code with high error correction
                if (card.verification_url) {
                    const qr = await QRCode.toDataURL(card.verification_url, {
                        width: 320,
                        margin: 1,
                        color: {
                            dark: '#030712',
                            light: '#ffffff'
                        }
                    });
                    setQrCodeUrl(qr);
                }
            } catch (err: any) {
                console.error('Error loading credential card:', err);
                setError(err.response?.data?.message || 'No se pudo cargar la credencial estudiantil.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [isOpen, studentId]);

    const handleSendPhysicalRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await credentialsService.requestPhysicalCredential({
                student_id: studentId === 'me' ? undefined : studentId,
                request_type: requestType,
                reason: requestReason.trim() || (requestType === 'FIRST_TIME' ? 'Primer carnet escolar' : 'Reposición de credencial')
            });

            setSubmitSuccessMsg(res.message);
            setShowRequestForm(false);
            // Refresh status
            const updatedStatus = await credentialsService.getMyCredentialStatus(studentId === 'me' ? undefined : studentId);
            setStatusData(updatedStatus);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Error al enviar la solicitud.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const request = statusData?.request;

    return (
        <div 
            className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex justify-center items-start p-3 sm:p-6 animate-in fade-in duration-200"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative w-full max-w-lg my-4 sm:my-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header - Sticky pinned at the top */}
                <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-blue">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-white">Carnet Digital Oficial</h3>
                            <p className="text-xs text-slate-400">Identificación Institucional en Pantalla</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-3.5 py-1.5 rounded-xl text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold border border-slate-700 shadow-sm active:scale-95"
                        title="Cerrar credencial (Esc)"
                    >
                        <span>Salir</span>
                        <X className="w-4 h-4 text-slate-400 group-hover:text-white" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 sm:p-6 space-y-6">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
                            <p className="text-xs font-semibold">Generando credencial digital segura...</p>
                        </div>
                    ) : error ? (
                        <div className="py-12 flex flex-col items-center text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <h4 className="text-base font-bold text-white">Credencial No Disponible</h4>
                            <p className="text-xs text-slate-400 max-w-xs">{error}</p>
                        </div>
                    ) : cardData && (
                        <>
                            {/* Interactive 3D Credential Card Container */}
                            <div className="flex flex-col items-center">
                                <div 
                                    className="relative w-full max-w-[340px] sm:max-w-[360px] aspect-[1/1.58] rounded-3xl p-5 text-white shadow-2xl transition-all duration-500 cursor-pointer select-none group border border-white/10 overflow-hidden flex flex-col justify-between"
                                    style={{
                                        background: 'linear-gradient(135deg, #091a3c 0%, #0d2858 45%, #051329 100%)'
                                    }}
                                    onClick={() => setIsFlipped(!isFlipped)}
                                    title="Toca para ver el reverso"
                                >
                                    {/* Holographic Watermark Texture & Shimmer Effect */}
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,192,244,0.2),rgba(255,255,255,0))] pointer-events-none" />
                                    <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/5 to-transparent rotate-45 pointer-events-none group-hover:translate-x-full transition-transform duration-1000" />

                                    {!isFlipped ? (
                                        /* ── CARNET FRENTE ── */
                                        <div className="relative z-10 flex flex-col justify-between h-full">
                                            {/* Institutional Brand Header */}
                                            <div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-brand-teal/90 block">
                                                            CENTRO TÉCNICO & TECNOLÓGICO
                                                        </span>
                                                        <h4 className="text-base font-black tracking-tight leading-none text-white mt-0.5">
                                                            ULTRA TECNOLOGÍA
                                                        </h4>
                                                    </div>
                                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center font-black text-xs text-white shadow-md border border-white/20">
                                                        UT
                                                    </div>
                                                </div>

                                                <div className="h-0.5 w-full bg-gradient-to-r from-brand-teal via-brand-blue to-transparent my-3 rounded-full opacity-60" />
                                            </div>

                                            {/* Photo & Main Identification */}
                                            <div className="flex items-center gap-3.5 my-auto">
                                                {/* Student Photo Frame */}
                                                <div className="relative shrink-0">
                                                    <div className="w-20 h-24 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-brand-teal/40 overflow-hidden flex items-center justify-center shadow-lg relative">
                                                        <span className="font-black text-3xl text-slate-300">
                                                            {(cardData.full_name || studentName || 'E').charAt(0)?.toUpperCase()}
                                                        </span>
                                                        {/* Digital Verification Checkmark */}
                                                        <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-white">
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Text Info */}
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-brand-teal/20 text-brand-teal border border-brand-teal/30 inline-block">
                                                        {cardData.student_code}
                                                    </span>
                                                    <h3 className="font-black text-sm text-white leading-snug line-clamp-2">
                                                        {cardData.full_name || studentName}
                                                    </h3>
                                                    <p className="text-[11px] font-bold text-slate-300 truncate">
                                                        {cardData.course_name}
                                                    </p>
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                                        <Building2 className="w-3 h-3 text-brand-blue shrink-0" />
                                                        <span className="truncate">{cardData.branch_name}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer with High-Res QR & Validity Stamp */}
                                            <div className="pt-2 border-t border-white/10 flex items-end justify-between gap-3">
                                                <div className="space-y-0.5">
                                                    <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-semibold">
                                                        Vigencia Oficial
                                                    </span>
                                                    <p className="text-xs font-black text-emerald-400">
                                                        {cardData.cycle}
                                                    </p>
                                                    <span className="text-[9px] text-slate-400 block">
                                                        Válido hasta: {cardData.valid_until}
                                                    </span>
                                                </div>

                                                {/* Dynamic Server QR */}
                                                {qrCodeUrl && (
                                                    <div className="p-1 rounded-xl bg-white shadow-md shrink-0">
                                                        <img 
                                                            src={qrCodeUrl} 
                                                            alt="QR de Validación Institucional" 
                                                            className="w-14 h-14 rounded-lg"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── CARNET REVERSO ── */
                                        <div className="relative z-10 flex flex-col justify-between h-full text-slate-200">
                                            <div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-black text-brand-teal text-[10px] uppercase tracking-widest">
                                                        INFORMACIÓN DE SEGURIDAD
                                                    </span>
                                                    <span className="text-[9px] font-mono text-slate-400">
                                                        {cardData.student_code}
                                                    </span>
                                                </div>
                                                <div className="h-0.5 w-full bg-white/10 my-2" />
                                            </div>

                                            {/* Emergency contact info */}
                                            <div className="space-y-2.5 my-auto bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                                                <div className="flex items-start gap-2 text-xs">
                                                    <Phone className="w-3.5 h-3.5 text-brand-teal mt-0.5 shrink-0" />
                                                    <div className="min-w-0">
                                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Contacto de Emergencia</span>
                                                        <p className="font-bold text-white text-xs truncate">
                                                            {cardData.emergency_contact?.name || 'Dirección / Secretaría'} ({cardData.emergency_contact?.relationship || 'Tutor'})
                                                        </p>
                                                        <p className="text-[11px] text-brand-teal font-mono">
                                                            {cardData.emergency_contact?.phone || cardData.branch_phone || 'PBX: 2200-0000'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-2 text-xs pt-1.5 border-t border-white/5">
                                                    <MapPin className="w-3.5 h-3.5 text-brand-blue mt-0.5 shrink-0" />
                                                    <div className="min-w-0">
                                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Plantel Educativo</span>
                                                        <p className="font-semibold text-white text-[11px] truncate">{cardData.branch_name}</p>
                                                        {cardData.branch_address && <p className="text-[10px] text-slate-400 truncate">{cardData.branch_address}</p>}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Institutional Rules */}
                                            <div className="space-y-2 text-center pt-2 border-t border-white/10">
                                                <p className="text-[9px] leading-tight text-slate-400 italic">
                                                    "Esta credencial digital acredita la pertenencia activa a Ultra Tecnología. Su uso es personal e intransferible."
                                                </p>
                                                {/* Simulated Barcode */}
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <div className="h-5 w-44 bg-white/90 rounded px-1 flex items-center justify-between">
                                                        {[4, 2, 6, 1, 3, 5, 2, 7, 2, 4, 1, 6, 3, 5, 2, 6, 1, 4, 3, 7, 2].map((w, i) => (
                                                            <div key={i} className="bg-black h-full" style={{ width: `${w * 1.5}px` }} />
                                                        ))}
                                                    </div>
                                                    <span className="font-mono text-[9px] text-slate-400 tracking-widest">{cardData.student_code}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => setIsFlipped(!isFlipped)}
                                    className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-brand-teal hover:underline font-semibold"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>Toca la credencial para voltearla ({isFlipped ? 'Ver Frente' : 'Ver Reverso'})</span>
                                </button>
                            </div>

                            {/* Security Notice: Strict Anti-Print / Anti-Download Rule */}
                            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-400">
                                <Lock className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                                <div className="leading-relaxed">
                                    <strong className="text-slate-200">Seguridad Institucional:</strong> Esta es tu credencial digital para identificación en pantalla. Por normativa de seguridad, <strong>los carnets físicos oficiales de PVC solo son emitidos y entregados presencialmente por la Administración</strong>.
                                </div>
                            </div>

                            {/* Physical Card Request Status Widget */}
                            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                        <span>🪪</span> Trámite de Carnet Físico
                                    </h4>
                                    {request ? (
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                            request.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                            request.status === 'READY' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse' :
                                            'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        }`}>
                                            {request.status === 'DELIVERED' ? 'Entregado en Plantel' :
                                             request.status === 'READY' ? '¡Listo para Recoger!' : 'En Revisión'}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-slate-500 font-semibold">Sin solicitud activa</span>
                                    )}
                                </div>

                                {submitSuccessMsg && (
                                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                                        <span>{submitSuccessMsg}</span>
                                    </div>
                                )}

                                {request?.status === 'READY' ? (
                                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-500/15 to-indigo-500/15 border border-blue-500/30 space-y-1.5">
                                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                                            <span>🎉</span> ¡Tu carnet oficial está listo!
                                        </p>
                                        <p className="text-[11px] text-slate-300">
                                            Tu credencial oficial ha sido impresa y autorizada. Por favor acércate a la <strong>Secretaría de tu sede</strong> para que te sea entregada presencialmente.
                                        </p>
                                    </div>
                                ) : request?.status === 'PENDING' ? (
                                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                                        <p className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" /> Solicitud en proceso de emisión
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                            Recibida el {new Date(request.requested_at).toLocaleDateString('es-ES')}. La Secretaría está validando tu expediente para la impresión oficial.
                                        </p>
                                    </div>
                                ) : request?.status === 'DELIVERED' ? (
                                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                                        <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Carnet físico entregado oficialmente
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                            Entregado presencialmente en sede el {new Date(request.delivered_at || '').toLocaleDateString('es-ES')} por {request.delivered_by || 'Administración'}.
                                        </p>
                                    </div>
                                ) : null}

                                {/* Request button if no active request or if delivered and wants replacement */}
                                {(!request || request.status === 'DELIVERED' || request.status === 'REJECTED') && (
                                    !showRequestForm ? (
                                        <button
                                            onClick={() => setShowRequestForm(true)}
                                            className="w-full py-2.5 px-4 rounded-xl bg-brand-blue hover:bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-brand-blue/20"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                            <span>{request?.status === 'DELIVERED' ? 'Solicitar Reposición de Carnet' : 'Solicitar Carnet Físico a Administración'}</span>
                                        </button>
                                    ) : (
                                        <form onSubmit={handleSendPhysicalRequest} className="space-y-3 pt-2 border-t border-slate-800">
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-300 block mb-1">Tipo de Solicitud</label>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => setRequestType('FIRST_TIME')}
                                                        className={`p-2 rounded-xl font-bold border transition-colors ${
                                                            requestType === 'FIRST_TIME'
                                                                ? 'bg-brand-blue/20 border-brand-blue text-brand-teal'
                                                                : 'bg-slate-900 border-slate-800 text-slate-400'
                                                        }`}
                                                    >
                                                        Primer Carnet
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRequestType('REPLACEMENT')}
                                                        className={`p-2 rounded-xl font-bold border transition-colors ${
                                                            requestType === 'REPLACEMENT'
                                                                ? 'bg-brand-blue/20 border-brand-blue text-brand-teal'
                                                                : 'bg-slate-900 border-slate-800 text-slate-400'
                                                        }`}
                                                    >
                                                        Reposición / Pérdida
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-[11px] font-bold text-slate-300 block mb-1">Observaciones / Motivo (Opcional)</label>
                                                <input
                                                    type="text"
                                                    value={requestReason}
                                                    onChange={(e) => setRequestReason(e.target.value)}
                                                    placeholder="Ej: Inicio de ciclo lectivo, reposición..."
                                                    className="w-full px-3 py-2 bg-slate-900 rounded-xl border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-blue"
                                                />
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowRequestForm(false)}
                                                    className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={isSubmitting}
                                                    className="flex-1 py-2 rounded-xl bg-brand-blue hover:bg-blue-600 text-xs font-bold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                                                >
                                                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                    <span>Confirmar Solicitud</span>
                                                </button>
                                            </div>
                                        </form>
                                    )
                                )}
                            </div>

                            {/* Bottom Exit Button */}
                            <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-2 border border-slate-700/60 shadow-sm active:scale-95"
                                >
                                    <X className="w-4 h-4 text-slate-400" />
                                    <span>Cerrar Credencial</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
