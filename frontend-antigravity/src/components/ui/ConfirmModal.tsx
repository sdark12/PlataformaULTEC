import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, Save, Loader2, Check, X } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'primary' | 'success';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    description?: React.ReactNode;
    message?: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
    isLoading?: boolean;
    icon?: React.ReactNode;
    onConfirm: () => void;
    onClose?: () => void;
    onCancel?: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    description,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    variant = 'primary',
    isLoading = false,
    icon,
    onConfirm,
    onClose,
    onCancel,
}) => {
    if (!isOpen) return null;

    const handleClose = () => {
        if (onCancel) onCancel();
        else if (onClose) onClose();
    };

    const modalContent = description ?? message;

    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return {
                    iconBg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
                    confirmBtn: 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30 text-white',
                    defaultIcon: <Trash2 className="w-5 h-5" />,
                };
            case 'warning':
                return {
                    iconBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
                    confirmBtn: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30 text-white',
                    defaultIcon: <AlertTriangle className="w-5 h-5" />,
                };
            case 'success':
                return {
                    iconBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
                    confirmBtn: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 text-white',
                    defaultIcon: <Check className="w-5 h-5" />,
                };
            case 'primary':
            default:
                return {
                    iconBg: 'bg-blue-600/20 border-blue-500/30 text-blue-400',
                    confirmBtn: 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30 text-white',
                    defaultIcon: <Save className="w-5 h-5" />,
                };
        }
    };

    const styles = getVariantStyles();

    return createPortal(
        <div 
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleClose}
        >
            <div 
                className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with Icon and Close Button */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${styles.iconBg}`}>
                            {icon || styles.defaultIcon}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                            <h3 className="text-base sm:text-lg font-bold text-slate-100 leading-snug">
                                {title}
                            </h3>
                            <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                                {modalContent}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isLoading}
                        className="text-slate-500 hover:text-slate-300 p-1.5 rounded-xl hover:bg-slate-800 transition-colors shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isLoading}
                        className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-all text-center disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`flex-1 py-2.5 px-4 text-xs font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${styles.confirmBtn}`}
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Check className="w-4 h-4" />
                        )}
                        <span>{confirmText}</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmModal;
