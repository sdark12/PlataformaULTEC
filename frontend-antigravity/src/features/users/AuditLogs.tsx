import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from './auditService';
import { Loader2, ShieldAlert, Clock, User, Database, Globe, Search, Filter } from 'lucide-react';

const AuditLogs = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState('ALL');

    const { data: logs, isLoading, isError } = useQuery({
        queryKey: ['audit-logs'],
        queryFn: getAuditLogs,
    });

    const getActionBadge = (action: string) => {
        switch (action) {
            case 'POST':
                return <span className="px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded text-xs font-bold w-16 text-center">CREAR</span>;
            case 'PUT':
            case 'PATCH':
                return <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs font-bold w-16 text-center">EDITAR</span>;
            case 'DELETE':
                return <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-xs font-bold w-16 text-center">BORRAR</span>;
            default:
                return <span className="px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded text-xs font-bold w-16 text-center">{action}</span>;
        }
    };

    const getEntityName = (entity: string) => {
        const mapping: Record<string, string> = {
            'students': 'Estudiantes',
            'payments': 'Pagos',
            'invoices': 'Facturas',
            'users': 'Usuarios',
            'grades': 'Notas',
            'subgrades': 'Subnotas',
            'courses': 'Cursos',
            'auth': 'Autenticación'
        };
        return mapping[entity] || entity;
    };

    const filteredLogs = logs?.filter((log) => {
        const matchesSearch = 
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
            log.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.user?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.user?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
            
        const matchesAction = filterAction === 'ALL' || log.action === filterAction;
        
        return matchesSearch && matchesAction;
    });

    return (
        <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-indigo-500" />
                        Registro de Auditoría
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Historial de acciones críticas realizadas en el sistema.
                    </p>
                </div>
            </div>

            <div className="glass-card mb-6 p-4 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por usuario, entidad o acción..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-blue outline-none transition-colors text-slate-700 dark:text-slate-100 placeholder-slate-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative w-full sm:w-48">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <select
                        className="w-full pl-9 pr-4 py-2.5 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-blue outline-none transition-colors text-slate-700 dark:text-slate-100 appearance-none"
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                    >
                        <option value="ALL">Todas las acciones</option>
                        <option value="POST">Creaciones (POST)</option>
                        <option value="PUT">Ediciones (PUT)</option>
                        <option value="DELETE">Eliminaciones (DELETE)</option>
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
                </div>
            ) : isError ? (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-center border border-red-100 dark:border-red-900/50">
                    Ocurrió un error al cargar el registro de auditoría. Permisos insuficientes o problema de red.
                </div>
            ) : filteredLogs && filteredLogs.length > 0 ? (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha / Hora</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuario</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Acción</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Módulo AFECTADO</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Detalles / IP</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                <span className="text-sm font-medium">
                                                    {new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(log.created_at))}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5" />
                                                    {log.user?.full_name || 'Sistema / Anonimo'}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 ml-5">
                                                    {log.user?.email || '-'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {getActionBadge(log.action)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
                                                <Database className="w-4 h-4 text-indigo-400" />
                                                {getEntityName(log.entity)}
                                                {log.entity_id && (
                                                    <span className="text-xs ml-1 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-300">
                                                        ID: {log.entity_id}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 max-w-xs">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                    <Globe className="w-3.5 h-3.5" /> {log.ip_address}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
                    <ShieldAlert className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">No se encontraron registros</h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md">
                        {searchTerm || filterAction !== 'ALL' 
                            ? 'No hay logs que coincidan con tu búsqueda.' 
                            : 'El historial de auditoría está vacío por ahora. Las acciones empezarán a registrarse pronto.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default AuditLogs;
