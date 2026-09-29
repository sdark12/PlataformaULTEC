import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, 
    ExternalLink, 
    Download, 
    Copy, 
    Check, 
    Maximize2, 
    Minimize2,
    Video, 
    FileText, 
    Image as ImageIcon, 
    BookOpen, 
    Play
} from 'lucide-react';

export interface ViewableResource {
    id?: string;
    title: string;
    description?: string;
    file_url: string;
    resource_type?: string;
    created_at?: string;
    courses?: { id?: string; name: string };
    author?: { full_name: string };
}

interface MediaViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    resource: ViewableResource | null;
}

// Helper to extract YouTube video ID from various URL formats
export const getYouTubeId = (url?: string): string | null => {
    if (!url) return null;
    const cleanUrl = url.trim();
    const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
    const match = cleanUrl.match(regExp);
    return match ? match[1] : null;
};

export const isYouTubeUrl = (url?: string): boolean => {
    return Boolean(getYouTubeId(url));
};

export const getFullResourceUrl = (url?: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    const backendUrl = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${backendUrl}${cleanPath}`;
};

const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
    isOpen,
    onClose,
    resource
}) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Close on Escape key press
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen || !resource) return null;

    const fullUrl = getFullResourceUrl(resource.file_url);
    const youtubeId = getYouTubeId(resource.file_url);
    const isYouTube = Boolean(youtubeId);

    // Detect format
    const lowerUrl = (resource.file_url || '').toLowerCase();
    const isDirectVideo = !isYouTube && (
        resource.resource_type === 'video' ||
        ['.mp4', '.webm', '.mov', '.mkv', '.ogg'].some(ext => lowerUrl.includes(ext))
    );
    const isPdf = resource.resource_type === 'document' && lowerUrl.includes('.pdf');
    const isImage = resource.resource_type === 'image' || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].some(ext => lowerUrl.includes(ext));

    const handleCopy = () => {
        navigator.clipboard.writeText(fullUrl).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2500);
        }).catch(() => {
            alert(`Enlace: ${fullUrl}`);
        });
    };

    const handleOpenExternal = () => {
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
    };

    const handleOpenYouTubeApp = () => {
        if (!youtubeId) return;
        // In Android, intent scheme or standard https link opens native app
        const ytAppUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
        window.open(ytAppUrl, '_system');
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div 
                className={`w-full bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
                    isFullscreen ? 'max-w-full h-full rounded-none' : 'max-w-4xl max-h-[92vh]'
                }`}
            >
                {/* Header Bar */}
                <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                            isYouTube || isDirectVideo 
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' 
                                : isPdf 
                                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                                : isImage
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                : 'bg-brand-blue/15 text-brand-blue border border-brand-blue/20'
                        }`}>
                            {isYouTube || isDirectVideo ? (
                                <Video className="w-5 h-5" />
                            ) : isPdf ? (
                                <FileText className="w-5 h-5" />
                            ) : isImage ? (
                                <ImageIcon className="w-5 h-5" />
                            ) : (
                                <BookOpen className="w-5 h-5" />
                            )}
                        </div>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm sm:text-base font-black text-white truncate max-w-sm sm:max-w-md" title={resource.title}>
                                    {resource.title}
                                </h3>
                                {resource.courses?.name && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 truncate max-w-[150px]">
                                        {resource.courses.name}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                {isYouTube ? 'Video de YouTube' : isDirectVideo ? 'Video MP4 / Local' : isPdf ? 'Documento PDF' : isImage ? 'Imagen Didáctica' : 'Enlace Web / Recurso'}
                                {resource.author?.full_name ? ` • Subido por ${resource.author.full_name}` : ''}
                            </p>
                        </div>
                    </div>

                    {/* Action buttons in header */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors hidden sm:flex"
                            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                        >
                            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>

                        <button
                            type="button"
                            onClick={handleCopy}
                            className={`p-2 rounded-xl transition-colors ${
                                isCopied 
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white'
                            }`}
                            title="Copiar enlace"
                        >
                            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors"
                            title="Cerrar (Esc)"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto bg-slate-950 p-2 sm:p-4 flex flex-col items-center justify-center">
                    {/* 1. YOUTUBE PLAYER */}
                    {isYouTube && youtubeId && (
                        <div className="w-full flex flex-col items-center space-y-3">
                            <div className="w-full aspect-video max-h-[68vh] rounded-2xl overflow-hidden shadow-2xl bg-black border border-slate-800 relative">
                                <iframe
                                    src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`}
                                    title={resource.title}
                                    className="w-full h-full border-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                />
                            </div>

                            {/* Mobile action bar for YouTube */}
                            <div className="flex flex-wrap items-center justify-between gap-2 w-full pt-1 px-1">
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Play className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                                    <span>Reproducción protegida YouTube</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleOpenYouTubeApp}
                                        className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all active:scale-95 cursor-pointer"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Abrir en YouTube App</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. DIRECT HTML5 VIDEO */}
                    {isDirectVideo && (
                        <div className="w-full flex flex-col items-center space-y-3">
                            <div className="w-full max-h-[68vh] rounded-2xl overflow-hidden shadow-2xl bg-black border border-slate-800 flex items-center justify-center">
                                <video
                                    src={fullUrl}
                                    controls
                                    autoPlay
                                    playsInline
                                    className="w-full max-h-[68vh] object-contain rounded-2xl"
                                >
                                    Tu navegador no soporta la reproducción de video HTML5.
                                </video>
                            </div>
                            <div className="flex items-center justify-between w-full pt-1 px-1">
                                <span className="text-xs text-slate-400">Video MP4 en calidad nativa</span>
                                <a
                                    href={fullUrl}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Descargar Video</span>
                                </a>
                            </div>
                        </div>
                    )}

                    {/* 3. PDF VIEWER */}
                    {isPdf && (
                        <div className="w-full flex flex-col space-y-3 h-full">
                            <div className="w-full h-[62vh] sm:h-[68vh] rounded-2xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-800">
                                <iframe
                                    src={`${fullUrl}#toolbar=1&navpanes=0`}
                                    title={resource.title}
                                    className="w-full h-full border-0 bg-white"
                                />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                                <span className="text-xs text-slate-400">Visor interactivo de documentos PDF</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleOpenExternal}
                                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>Abrir en nueva pestaña</span>
                                    </button>
                                    <a
                                        href={fullUrl}
                                        download
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Descargar PDF</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. IMAGE LIGHTBOX */}
                    {isImage && (
                        <div className="w-full flex flex-col items-center space-y-3">
                            <div className="max-h-[68vh] flex items-center justify-center p-2 rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-2xl">
                                <img
                                    src={fullUrl}
                                    alt={resource.title}
                                    className="max-h-[65vh] w-auto object-contain rounded-xl"
                                />
                            </div>
                            <div className="flex items-center justify-between w-full pt-1 px-1">
                                <span className="text-xs text-slate-400">Visualización de alta resolución</span>
                                <a
                                    href={fullUrl}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Guardar Imagen</span>
                                </a>
                            </div>
                        </div>
                    )}

                    {/* 5. GENERAL WEB LINK / OTHER DOCUMENT */}
                    {!isYouTube && !isDirectVideo && !isPdf && !isImage && (
                        <div className="w-full max-w-lg py-12 px-6 flex flex-col items-center text-center space-y-4 bg-slate-900/80 rounded-3xl border border-slate-800 shadow-xl my-auto">
                            <div className="w-16 h-16 rounded-2xl bg-brand-blue/15 text-brand-blue flex items-center justify-center border border-brand-blue/20">
                                <BookOpen className="w-8 h-8" />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-white mb-1">{resource.title}</h4>
                                <p className="text-xs text-slate-400 max-w-sm">
                                    Este recurso es un enlace externo o un formato para descarga directa.
                                </p>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-left w-full break-all font-mono text-xs text-brand-teal">
                                {fullUrl}
                            </div>

                            <div className="flex items-center gap-3 w-full pt-2">
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                                >
                                    {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                    <span>{isCopied ? 'Enlace Copiado' : 'Copiar Enlace'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleOpenExternal}
                                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-brand-blue to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-brand-blue/20"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    <span>Visitar Enlace</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Notes Bar */}
                {resource.description && (
                    <div className="px-5 py-3 bg-slate-900 border-t border-slate-800/80 text-xs text-slate-400 shrink-0 flex items-start gap-2">
                        <span className="font-bold text-slate-300 shrink-0">Indicaciones:</span>
                        <p className="line-clamp-2 leading-relaxed text-slate-400">{resource.description}</p>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default MediaViewerModal;
