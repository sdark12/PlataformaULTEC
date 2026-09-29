import { useState, useEffect, useRef, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
    X, Camera, CheckCircle2, AlertCircle, RefreshCw, Volume2, VolumeX, 
    Keyboard, Clock, ShieldCheck, Settings
} from 'lucide-react';
import type { AttendanceRecord } from '../attendanceService';

interface QrAttendanceScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    students: AttendanceRecord[];
    onStudentScanned: (studentId: string, status: 'PRESENT' | 'LATE', remarks?: string) => void;
    courseName?: string;
    selectedDate: string;
    schedules?: any[];
    selectedScheduleId?: string;
}

// Generador de tonos sintetizados para feedback sonoro sin depender de assets externos
const playBeep = (type: 'success' | 'late' | 'excused' | 'warning' = 'success') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
            // Tono alegre y armónico: A5 -> D6
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.25);
        } else if (type === 'late') {
            // Tono de aviso puntual suave (doble tono descendente)
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(650, ctx.currentTime);
            osc.frequency.setValueAtTime(440, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.35);
        } else if (type === 'excused') {
            // Tono campanada suave
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
        } else {
            // Advertencia (grave)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(260, ctx.currentTime);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        }
    } catch {
        // Ignorar si el navegador bloquea audio context
    }
};

const QrAttendanceScannerModal = ({
    isOpen,
    onClose,
    students,
    onStudentScanned,
    courseName,
    selectedDate,
    schedules = [],
    selectedScheduleId = '',
}: QrAttendanceScannerModalProps) => {
    const [scannerError, setScannerError] = useState<string | null>(null);
    const [lastScannedResult, setLastScannedResult] = useState<{
        type: 'PRESENT' | 'LATE' | 'EXCUSED' | 'ERROR';
        name?: string;
        message: string;
        time: string;
    } | null>(null);
    const [manualCode, setManualCode] = useState('');
    const [isMuted, setIsMuted] = useState(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [isScanning, setIsScanning] = useState(false);
    const [retryTrigger, setRetryTrigger] = useState(0);
    const [showConfig, setShowConfig] = useState(false);

    // Modo de registro: AUTO (evalúa tolerancia), FORCE_PRESENT o FORCE_LATE
    const [scanMode, setScanMode] = useState<'AUTO' | 'FORCE_PRESENT' | 'FORCE_LATE'>('AUTO');
    const [toleranceMinutes, setToleranceMinutes] = useState<number>(10);

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const isPausedRef = useRef<boolean>(false);
    const readerElementId = 'qr-attendance-reader';

    // Determinar horario relevante para obtener la hora de inicio de la clase
    const relevantSchedule = useMemo(() => {
        if (selectedScheduleId) {
            const found = schedules.find((s: any) => s.id === selectedScheduleId);
            if (found) return found;
        }

        // Si no hay seleccionado, buscar por día de la semana
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const dateObj = new Date(selectedDate + 'T00:00:00');
        const dayName = dayNames[dateObj.getDay()];

        const matchDay = schedules.find((s: any) => 
            s.day_of_week && (s.day_of_week.includes(dayName) || s.day_of_week.includes('Lunes a Viernes'))
        );
        if (matchDay) return matchDay;

        return schedules[0] || null;
    }, [schedules, selectedScheduleId, selectedDate]);

    // Hora de inicio de referencia en formato HH:MM (por defecto la del horario o 14:00)
    const [courseStartTime, setCourseStartTime] = useState<string>('14:00');

    useEffect(() => {
        if (relevantSchedule?.start_time) {
            setCourseStartTime(relevantSchedule.start_time.slice(0, 5));
        }
    }, [relevantSchedule]);

    // Cálculo del límite de tolerancia para puntualidad
    // Ejemplo: inicio 14:00 + 10 min tolerancia = límite 14:10
    const punctualityInfo = useMemo(() => {
        const [h, m] = courseStartTime.split(':').map(Number);
        const startH = isNaN(h) ? 14 : h;
        const startM = isNaN(m) ? 0 : m;
        const startTotalMinutes = startH * 60 + startM;
        const limitTotalMinutes = startTotalMinutes + toleranceMinutes;

        const limitHours = Math.floor(limitTotalMinutes / 60) % 24;
        const limitMins = limitTotalMinutes % 60;

        const format12h = (hours: number, minutes: number) => {
            const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
            const h12 = hours % 12 || 12;
            return `${h12}:${String(minutes).padStart(2, '0')} ${ampm}`;
        };

        const startTimeFormatted = format12h(startH, startM);
        const limitFormatted = format12h(limitHours, limitMins);

        return {
            startTotalMinutes,
            limitTotalMinutes,
            startTimeFormatted,
            limitFormatted
        };
    }, [courseStartTime, toleranceMinutes]);

    // Evaluar si una hora actual es puntual o tarde según el horario y tolerancia
    const isArrivalLate = (dateObj: Date = new Date()): boolean => {
        if (scanMode === 'FORCE_PRESENT') return false;
        if (scanMode === 'FORCE_LATE') return true;

        const nowMinutes = dateObj.getHours() * 60 + dateObj.getMinutes();
        return nowMinutes > punctualityInfo.limitTotalMinutes;
    };

    // Parsear el string del QR para extraer el código o ID
    const extractStudentIdentifier = (decodedText: string): string => {
        let clean = decodedText.trim();
        if (clean.includes('/verify-student/')) {
            const parts = clean.split('/verify-student/');
            clean = decodeURIComponent(parts[parts.length - 1].split('?')[0].split('#')[0]);
        } else if (clean.includes('/verify/student/')) {
            const parts = clean.split('/verify/student/');
            clean = decodeURIComponent(parts[parts.length - 1].split('?')[0].split('#')[0]);
        }
        return clean.trim();
    };

    // Procesar el código escaneado
    const handleProcessScan = (rawText: string) => {
        if (isPausedRef.current) return;
        const identifier = extractStudentIdentifier(rawText);
        if (!identifier) return;

        isPausedRef.current = true;
        const now = new Date();
        const currentTime = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const shortTime = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        // Buscar coincidencia en la lista de alumnos del curso
        const idLower = identifier.toLowerCase();
        const matched = students.find((s) => {
            const sId = (s.student_id || '').toLowerCase();
            const sCode = (s.student_code || '').toLowerCase();
            const pCode = (s.personal_code || '').toLowerCase();
            const aCode = (s.academy_code || '').toLowerCase();

            return sId === idLower || sCode === idLower || pCode === idLower || aCode === idLower;
        });

        if (matched) {
            // Verificar si el estudiante cuenta con una justificación/excusa aprobada
            const hasApprovedExcusa = matched.status === 'EXCUSED' || 
                (matched.justification && matched.justification.status === 'APPROVED');

            if (hasApprovedExcusa) {
                if (!isMuted) playBeep('excused');
                const reason = matched.justification?.description || matched.justification?.reason_type || 'Excusa justificada';
                setLastScannedResult({
                    type: 'EXCUSED',
                    name: matched.student_name,
                    message: `🛡️ Cuenta con Excusa Aprobada (${reason}). Se conserva su estado.`,
                    time: currentTime
                });
                setTimeout(() => { isPausedRef.current = false; }, 2000);
                return;
            }

            // Evaluar puntualidad (Presente vs. Tarde)
            const late = isArrivalLate(now);
            const assignedStatus: 'PRESENT' | 'LATE' = late ? 'LATE' : 'PRESENT';
            const remarks = late 
                ? `Llegada tarde a las ${shortTime} (tolerancia máx. ${punctualityInfo.limitFormatted})`
                : `Presente a tiempo por QR a las ${shortTime}`;

            onStudentScanned(matched.student_id, assignedStatus, remarks);

            if (assignedStatus === 'PRESENT') {
                if (!isMuted) playBeep('success');
                setLastScannedResult({
                    type: 'PRESENT',
                    name: matched.student_name,
                    message: `🟢 Marcado como Presente (A tiempo: ${shortTime})`,
                    time: currentTime
                });
            } else {
                if (!isMuted) playBeep('late');
                setLastScannedResult({
                    type: 'LATE',
                    name: matched.student_name,
                    message: `🟡 Marcado como Tarde (${shortTime} • Posterior a ${punctualityInfo.limitFormatted})`,
                    time: currentTime
                });
            }
        } else {
            if (!isMuted) playBeep('warning');
            setLastScannedResult({
                type: 'ERROR',
                message: `El carnet "${identifier}" no pertenece a este curso`,
                time: currentTime
            });
        }

        // Pausa breve para evitar lecturas duplicadas en ráfaga
        setTimeout(() => {
            isPausedRef.current = false;
        }, 1800);
    };

    // Inicializar cámara
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const initCamera = async () => {
            setScannerError(null);
            try {
                await new Promise((r) => setTimeout(r, 200));
                if (!document.getElementById(readerElementId)) return;

                if (scannerRef.current) {
                    try {
                        await scannerRef.current.stop();
                    } catch {}
                }

                const scanner = new Html5Qrcode(readerElementId);
                scannerRef.current = scanner;

                const config = {
                    fps: 12,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                };

                try {
                    await scanner.start(
                        { facingMode: facingMode },
                        config,
                        (decodedText) => {
                            if (isMounted) handleProcessScan(decodedText);
                        },
                        () => {}
                    );
                } catch (facingErr) {
                    console.warn('Fallback a lista de dispositivos de cámara:', facingErr);
                    const cameras = await Html5Qrcode.getCameras();
                    if (cameras && cameras.length > 0) {
                        const selectedCam = cameras.find((cam) =>
                            facingMode === 'environment'
                                ? (cam.label.toLowerCase().includes('back') || cam.label.toLowerCase().includes('trasera'))
                                : (cam.label.toLowerCase().includes('front') || cam.label.toLowerCase().includes('frontal'))
                        ) || cameras[0];

                        await scanner.start(
                            selectedCam.id,
                            config,
                            (decodedText) => {
                                if (isMounted) handleProcessScan(decodedText);
                            },
                            () => {}
                        );
                    } else {
                        throw facingErr;
                    }
                }

                if (isMounted) setIsScanning(true);
            } catch (err: any) {
                console.error('Error al iniciar la cámara:', err);
                if (isMounted) {
                    setScannerError('No se pudo acceder a la cámara. Por favor autoriza los permisos de cámara en tu dispositivo o usa la entrada manual abajo.');
                    setIsScanning(false);
                }
            }
        };

        initCamera();

        return () => {
            isMounted = false;
            if (scannerRef.current) {
                scannerRef.current.stop().then(() => {
                    scannerRef.current?.clear();
                }).catch(() => {});
            }
        };
    }, [isOpen, facingMode, retryTrigger]);

    const handleSwitchCamera = () => {
        setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualCode.trim()) return;
        handleProcessScan(manualCode.trim());
        setManualCode('');
    };

    // Estadísticas en tiempo real durante el escaneo
    const scanStats = useMemo(() => {
        const total = students.length;
        const present = students.filter(s => s.status === 'PRESENT').length;
        const late = students.filter(s => s.status === 'LATE').length;
        const excused = students.filter(s => s.status === 'EXCUSED').length;
        const pending = students.filter(s => s.status === 'PENDING' || s.status === 'ABSENT').length;
        return { total, present, late, excused, pending };
    }, [students]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
                
                {/* Header */}
                <div className="px-4 py-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
                    <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl shrink-0">
                            <Camera className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-1.5 truncate">
                                <span>Pase de Lista QR</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    EN VIVO
                                </span>
                            </h3>
                            <p className="text-[11px] text-slate-400 truncate">
                                {courseName || 'Curso Activo'} • {selectedDate}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                        <button
                            type="button"
                            onClick={() => setShowConfig(!showConfig)}
                            className={`p-2 rounded-xl transition-colors ${
                                showConfig ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                            }`}
                            title="Ajustar horario y tolerancia"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsMuted(!isMuted)}
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors"
                            title={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
                        >
                            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                        </button>
                        <button
                            type="button"
                            onClick={handleSwitchCamera}
                            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-xl transition-colors"
                            title="Cambiar cámara frontal / trasera"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Barra de Regla de Puntualidad y Modos Rápidos */}
                <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Clase: <strong className="text-white">{punctualityInfo.startTimeFormatted}</strong></span>
                        <span className="text-slate-500">•</span>
                        <span>Tolerancia hasta: <strong className="text-emerald-400">{punctualityInfo.limitFormatted}</strong></span>
                    </div>

                    {/* Selector de Modo */}
                    <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-xl border border-slate-800">
                        <button
                            type="button"
                            onClick={() => setScanMode('AUTO')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                scanMode === 'AUTO' 
                                    ? 'bg-blue-600 text-white shadow-sm' 
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                            title="Aplica Presente hasta el límite y Tarde después"
                        >
                            🎯 Auto (10m tol.)
                        </button>
                        <button
                            type="button"
                            onClick={() => setScanMode('FORCE_PRESENT')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                scanMode === 'FORCE_PRESENT' 
                                    ? 'bg-emerald-600 text-white shadow-sm' 
                                    : 'text-slate-400 hover:text-emerald-400'
                            }`}
                            title="Fuerza Presente a todos"
                        >
                            🟢 Presente
                        </button>
                        <button
                            type="button"
                            onClick={() => setScanMode('FORCE_LATE')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                scanMode === 'FORCE_LATE' 
                                    ? 'bg-amber-600 text-white shadow-sm' 
                                    : 'text-slate-400 hover:text-amber-400'
                            }`}
                            title="Fuerza Tarde a todos"
                        >
                            🟡 Tarde
                        </button>
                    </div>
                </div>

                {/* Panel Desplegable de Ajuste de Horario y Tolerancia */}
                {showConfig && (
                    <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 grid grid-cols-2 gap-3 text-xs animate-in slide-in-from-top-2 duration-150">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Hora de Inicio del Curso</label>
                            <input
                                type="time"
                                value={courseStartTime}
                                onChange={(e) => setCourseStartTime(e.target.value)}
                                className="w-full mt-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Minutos de Tolerancia</label>
                            <div className="flex items-center gap-1.5 mt-1">
                                {[5, 10, 15, 20].map((min) => (
                                    <button
                                        key={min}
                                        type="button"
                                        onClick={() => setToleranceMinutes(min)}
                                        className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${
                                            toleranceMinutes === min
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                                        }`}
                                    >
                                        +{min}m
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Cámara Viewport */}
                <div className="relative bg-slate-950 flex flex-col items-center justify-center min-h-[280px] overflow-hidden">
                    <div id={readerElementId} className="w-full max-w-[340px] overflow-hidden rounded-2xl" />

                    {/* Marco visual sobre el lector */}
                    {isScanning && !scannerError && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-56 h-56 border-2 border-dashed border-blue-400/70 rounded-2xl relative shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-xl" />
                                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-xl" />
                                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-xl" />
                                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-xl" />
                                {/* Laser line animada */}
                                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse shadow-[0_0_8px_#38bdf8]" />
                            </div>
                        </div>
                    )}

                    {scannerError && (
                        <div className="p-6 text-center text-slate-400 space-y-3 max-w-sm">
                            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                            <p className="text-xs text-amber-300 font-semibold">{scannerError}</p>
                            <button
                                type="button"
                                onClick={() => setRetryTrigger((c) => c + 1)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all active:scale-95"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Reintentar conexión con cámara</span>
                            </button>
                            <p className="text-[11px] text-slate-500">Puedes ingresar el código personal del carnet en el campo de texto inferior.</p>
                        </div>
                    )}
                </div>

                {/* Resumen de Conteo en Vivo */}
                <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>{scanStats.present} Presentes</span>
                        </span>
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <span>{scanStats.late} Tardes</span>
                        </span>
                        {scanStats.excused > 0 && (
                            <span className="flex items-center gap-1 text-blue-400 font-bold">
                                <span className="w-2 h-2 rounded-full bg-blue-400" />
                                <span>{scanStats.excused} Excusas</span>
                            </span>
                        )}
                    </div>
                    <span className="text-slate-400 font-medium">
                        Pendientes: <strong className="text-slate-200">{scanStats.pending}</strong> / {scanStats.total}
                    </span>
                </div>

                {/* Feedback del último escaneo */}
                {lastScannedResult && (
                    <div className={`mx-4 my-2 px-3.5 py-2.5 rounded-2xl border text-xs flex items-center space-x-2.5 transition-all ${
                        lastScannedResult.type === 'PRESENT'
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            : lastScannedResult.type === 'LATE'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                            : lastScannedResult.type === 'EXCUSED'
                            ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                            : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    }`}>
                        {lastScannedResult.type === 'PRESENT' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        ) : lastScannedResult.type === 'LATE' ? (
                            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                        ) : lastScannedResult.type === 'EXCUSED' ? (
                            <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                            {lastScannedResult.name && (
                                <p className="font-bold text-white text-xs truncate">{lastScannedResult.name}</p>
                            )}
                            <p className="text-[11px] leading-tight">{lastScannedResult.message}</p>
                        </div>
                    </div>
                )}

                {/* Entrada manual / Lector de pistola USB */}
                <div className="p-3.5 border-t border-slate-800 bg-slate-950/70 mt-auto">
                    <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Keyboard className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Escanear con pistola USB o ingresar código de carnet..."
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 text-slate-100 rounded-xl text-xs outline-none focus:border-blue-500 placeholder:text-slate-500"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/30 transition-all shrink-0"
                        >
                            Registrar
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default QrAttendanceScannerModal;
