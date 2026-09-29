import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Clock, LogOut, RefreshCw } from 'lucide-react';

interface IdleTimerContextType {
    resetTimer: () => void;
}

const IdleTimerContext = createContext<IdleTimerContextType | null>(null);

// Constantes de tiempo de sesión (en milisegundos)
const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutos de inactividad
const WARNING_DURATION_MS = 2 * 60 * 1000; // 2 minutos de cuenta regresiva previa

export const IdleTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [showWarning, setShowWarning] = useState(false);
    const [secondsRemaining, setSecondsRemaining] = useState(120);

    const lastActivityRef = useRef<number>(Date.now());
    const warningTimerRef = useRef<any>(null);
    const countdownIntervalRef = useRef<any>(null);

    // Cierre de sesión automático por inactividad
    const handleAutoLogout = useCallback((reason: string = 'idle_timeout') => {
        setShowWarning(false);
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        localStorage.clear();
        window.location.href = `/login?reason=${reason}`;
    }, []);

    // Reiniciar temporizadores ante actividad del usuario
    const resetTimer = useCallback(() => {
        lastActivityRef.current = Date.now();

        if (showWarning) {
            setShowWarning(false);
        }

        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }

        if (warningTimerRef.current) {
            clearTimeout(warningTimerRef.current);
        }

        // Solo activar temporizador si hay una sesión activa
        const token = localStorage.getItem('token');
        if (!token) return;

        // Iniciar temporizador hacia la advertencia (a los 28 minutos)
        const timeUntilWarning = IDLE_LIMIT_MS - WARNING_DURATION_MS;
        warningTimerRef.current = setTimeout(() => {
            setShowWarning(true);
            setSecondsRemaining(Math.floor(WARNING_DURATION_MS / 1000));

            // Iniciar cuenta regresiva en segundos para el modal
            countdownIntervalRef.current = setInterval(() => {
                setSecondsRemaining((prev) => {
                    if (prev <= 1) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                        handleAutoLogout('idle_timeout');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }, timeUntilWarning);
    }, [showWarning, handleAutoLogout]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        resetTimer();

        // Throttled event listener para no saturar CPU
        let throttleTimeout: any = null;
        const onUserActivity = () => {
            if (!throttleTimeout) {
                throttleTimeout = setTimeout(() => {
                    throttleTimeout = null;
                    // Solo reiniciar si la advertencia no está abierta
                    if (!showWarning) {
                        resetTimer();
                    }
                }, 2000);
            }
        };

        const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
        activityEvents.forEach((event) => {
            window.addEventListener(event, onUserActivity, { passive: true });
        });

        return () => {
            if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            if (throttleTimeout) clearTimeout(throttleTimeout);

            activityEvents.forEach((event) => {
                window.removeEventListener(event, onUserActivity);
            });
        };
    }, [resetTimer, showWarning]);

    const formatCountdown = (secs: number) => {
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        return `${mins}:${remSecs < 10 ? '0' : ''}${remSecs}`;
    };

    return (
        <IdleTimerContext.Provider value={{ resetTimer }}>
            {children}

            {/* Modal de Advertencia Preventiva de Inactividad */}
            {showWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 border border-amber-300/40 dark:border-amber-700/40 shadow-2xl text-center relative overflow-hidden">
                        {/* Glow effect */}
                        <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

                        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800">
                            <Clock className="w-8 h-8 animate-pulse" />
                        </div>

                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                            ¿Sigues utilizando la plataforma?
                        </h3>

                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
                            Por políticas de seguridad y protección de datos institucionales, tu sesión se cerrará automáticamente en:
                        </p>

                        <div className="inline-block px-5 py-2.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl font-mono text-2xl font-black border border-amber-200 dark:border-amber-800 mb-6 shadow-inner">
                            {formatCountdown(secondsRemaining)}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={resetTimer}
                                className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Continuar Trabajando
                            </button>

                            <button
                                onClick={() => handleAutoLogout('user_initiated')}
                                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Salir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </IdleTimerContext.Provider>
    );
};

export const useIdleTimer = () => {
    const context = useContext(IdleTimerContext);
    if (!context) {
        throw new Error('useIdleTimer must be used within an IdleTimerProvider');
    }
    return context;
};
