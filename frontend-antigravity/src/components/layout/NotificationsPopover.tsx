import { useState, useRef, useEffect } from 'react';
import { Bell, Check, DollarSign, GraduationCap, Info, Trash2 } from 'lucide-react';
import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '../../hooks/useNotifications';

const getIconForType = (type: string) => {
    switch (type) {
        case 'PAYMENT':
            return <DollarSign className="h-4 w-4 text-emerald-500" />;
        case 'ENROLLMENT':
            return <GraduationCap className="h-4 w-4 text-blue-500" />;
        case 'DELETE':
            return <Trash2 className="h-4 w-4 text-red-500" />;
        case 'SYSTEM':
        default:
            return <Info className="h-4 w-4 text-slate-500" />;
    }
};

const formatTimeAgo = (dateStr: string) => {
    const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    const diffMins = Math.round(diff / 60000);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return rtf.format(-diffMins, 'minute');
    if (diffHours < 24) return rtf.format(-diffHours, 'hour');
    return rtf.format(-diffDays, 'day');
};

const NotificationsPopover = () => {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    const { data: notifications = [], isLoading } = useNotifications();
    const markAsReadMutation = useMarkNotificationAsRead();
    const markAllAsReadMutation = useMarkAllNotificationsAsRead();

    const unreadCount = notifications.filter(n => !n.is_read).length;

    // Handle clicking outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkAsRead = (id: number) => {
        markAsReadMutation.mutate(id);
    };

    const handleMarkAllAsRead = () => {
        markAllAsReadMutation.mutate();
    };

    return (
        <div className="relative" ref={popoverRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                aria-label="Notificaciones"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 h-4 w-4 flex items-center justify-center rounded-full bg-brand-danger text-[10px] font-bold text-white shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden z-50 transform origin-top-right transition-all animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/50">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="text-xs text-brand-blue hover:text-blue-600 dark:text-brand-teal dark:hover:text-teal-400 font-medium transition-colors"
                            >
                                Marcar todas leídas
                            </button>
                        )}
                    </div>

                    <div className="max-h-[28rem] overflow-y-auto custom-scrollbar">
                        {isLoading ? (
                            <div className="p-8 text-center text-sm text-slate-500">Cargando...</div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center flex flex-col items-center">
                                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                                    <Bell className="h-5 w-5 text-slate-400" />
                                </div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Todo al día</p>
                                <p className="text-xs text-slate-500 mt-1">No tienes nuevas notificaciones.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/80 cursor-default flex space-x-3 
                                            ${!notification.is_read ? 'bg-brand-blue/5 dark:bg-brand-teal/5' : ''}`
                                        }
                                    >
                                        <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0
                                            ${!notification.is_read ? 'bg-white dark:bg-slate-700 shadow-sm' : 'bg-slate-100 dark:bg-slate-800'}`}
                                        >
                                            {getIconForType(notification.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm ${!notification.is_read ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                                {notification.title}
                                            </p>
                                            <p className={`text-sm mt-0.5 line-clamp-2 ${!notification.is_read ? 'text-slate-600 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {notification.message}
                                            </p>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 uppercase tracking-wider font-medium">
                                                {formatTimeAgo(notification.created_at)}
                                            </p>
                                        </div>
                                        {!notification.is_read && (
                                            <div className="shrink-0 flex items-center">
                                                <button
                                                    onClick={() => handleMarkAsRead(notification.id)}
                                                    className="p-1.5 rounded-full hover:bg-brand-blue/10 dark:hover:bg-brand-teal/10 text-brand-blue dark:text-brand-teal transition-colors focus:outline-none focus:ring-2 focus:ring-brand-teal"
                                                    title="Marcar como leída"
                                                >
                                                    <Check className="h-3 w-3" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationsPopover;
