import React from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { type AppVersionInfo } from '../../services/updaterService';

interface UpdateBannerProps {
    versionInfo: AppVersionInfo;
    onOpenModal: () => void;
    onDismiss: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
    versionInfo,
    onOpenModal,
    onDismiss
}) => {
    return (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[120] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/30 shadow-2xl shadow-black/50 backdrop-blur-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-brand-blue/20 border border-brand-blue/30 text-brand-teal flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-teal bg-brand-teal/10 px-2 py-0.5 rounded-md">
                                Actualización v{versionInfo.version}
                            </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">
                            Hay una nueva versión disponible de la app
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={onOpenModal}
                        className="py-1.5 px-3 bg-gradient-to-r from-brand-blue to-brand-teal hover:from-blue-600 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-blue/20 flex items-center gap-1 active:scale-95"
                    >
                        <span>Ver</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                        onClick={onDismiss}
                        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                        aria-label="Descartar por ahora"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};
