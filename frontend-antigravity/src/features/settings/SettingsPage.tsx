import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSettings, updateSettings, getSettingsAuditHistory } from './settingsService';
import type { SystemSettings, SettingsAuditLog } from './settingsService';
import { 
    Settings, Save, Loader2, Building2, GraduationCap, 
    DollarSign, ToggleLeft, Award, User, Phone, Mail, 
    MapPin, CheckCircle2, AlertCircle, Shield, Sparkles,
    Smartphone, Download, RefreshCw, CheckCircle,
    Lock, ShieldAlert, ShieldCheck, Wrench, History, Clock, ArrowRight
} from 'lucide-react';
import UserProfile from '../../pages/UserProfile';
import { useAppUpdate } from '../../context/UpdateContext';
import { getCurrentUser } from '../auth/authService';

const SettingsPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get('tab');
    const activeTab = tabParam === 'profile' ? 'profile' : tabParam === 'updates' ? 'updates' : 'system';
    
    const currentUser = getCurrentUser();
    const isSuperAdmin = currentUser?.role === 'superadmin';

    const { 
        hasUpdate, 
        currentVersion, 
        latestVersion, 
        isChecking, 
        lastChecked, 
        isNativeAndroid, 
        checkUpdates, 
        openUpdateModal 
    } = useAppUpdate();

    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [auditLogs, setAuditLogs] = useState<SettingsAuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingAudit, setLoadingAudit] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const fetchAuditHistory = async () => {
        setLoadingAudit(true);
        try {
            const data = await getSettingsAuditHistory();
            setAuditLogs(data);
        } catch (err) {
            console.error("Error loading settings audit history:", err);
        } finally {
            setLoadingAudit(false);
        }
    };

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await getSettings();
                setSettings(data);
            } catch (error) {
                console.error("Error loading settings:", error);
                showNotification("Error al cargar la configuración", "error");
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
        fetchAuditHistory();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const val = type === 'checkbox' ? String((e.target as HTMLInputElement).checked) : value;

        setSettings(prev => prev ? { ...prev, [name]: val } : null);
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            const updated = await updateSettings(settings);
            setSettings(updated);
            showNotification("Configuración guardada correctamente", "success");
            fetchAuditHistory();
        } catch (error: any) {
            console.error("Error saving settings:", error);
            const msg = error.response?.data?.message || "Error al guardar la configuración";
            showNotification(msg, "error");
        } finally {
            setSaving(false);
        }
    };

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-full min-h-[400px] gap-3">
                <Loader2 className="w-10 h-10 text-brand-blue animate-spin" />
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Cargando configuración...</p>
            </div>
        );
    }

    if (!settings) {
        return (
            <div className="p-6 text-center">
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40 max-w-md mx-auto font-semibold">
                    Error: No se pudo cargar la configuración del sistema.
                </div>
            </div>
        );
    }

    return (
        <div className="p-3.5 sm:p-6 max-w-6xl mx-auto pb-36 sm:pb-28 animate-in fade-in duration-300">
            {/* Floating Toast Notification */}
            {notification && (
                <div className="fixed top-5 right-5 z-[130] animate-in slide-in-from-top-3 fade-in duration-300 max-w-md">
                    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold backdrop-blur-md ${
                        notification.type === 'success' 
                            ? 'bg-emerald-500/95 text-white border-emerald-400 shadow-emerald-500/20' 
                            : 'bg-rose-500/95 text-white border-rose-400 shadow-rose-500/20'
                    }`}>
                        {notification.type === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        )}
                        <span className="leading-snug">{notification.message}</span>
                    </div>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 sm:mb-6 gap-4">
                <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/25 ring-4 ring-blue-500/10">
                        {activeTab === 'profile' ? (
                            <User className="w-6 h-6" />
                        ) : activeTab === 'updates' ? (
                            <Smartphone className="w-6 h-6" />
                        ) : (
                            <Settings className="w-6 h-6" />
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                {activeTab === 'profile' ? 'Mi Perfil y Cuenta' : activeTab === 'updates' ? 'Actualizaciones de la App' : 'Configuración del Sistema'}
                            </h1>
                            {activeTab === 'system' && (
                                <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                                    isSuperAdmin 
                                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' 
                                        : 'bg-blue-500/10 text-brand-blue border border-brand-blue/20'
                                }`}>
                                    {isSuperAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                                    <span>{isSuperAdmin ? 'SuperAdmin' : 'Admin Sede'}</span>
                                </span>
                            )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
                            {activeTab === 'profile'
                                ? 'Administre sus datos personales y credenciales de acceso como administrador.'
                                : activeTab === 'updates'
                                ? 'Verifique y descargue las versiones más recientes de la aplicación móvil y el sistema.'
                                : 'Ajuste la configuración institucional, reglas académicas, finanzas, gobernanza y accesos.'}
                        </p>
                    </div>
                </div>

                {activeTab === 'system' && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="hidden sm:flex bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-3 rounded-2xl font-bold transition-all items-center justify-center gap-2.5 shadow-lg shadow-blue-500/25 active:scale-95 disabled:opacity-50 shrink-0 border border-white/10"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 stroke-[2.5]" />}
                        <span>Guardar Cambios</span>
                    </button>
                )}
            </div>

            {/* Segmented Control Tabs */}
            <div className="grid grid-cols-3 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl mb-6 border border-slate-200/80 dark:border-slate-700/60 shadow-inner gap-1">
                <button
                    onClick={() => setSearchParams({ tab: 'system' })}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'system'
                            ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-brand-teal shadow-md'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <Settings className="w-4 h-4 shrink-0" />
                    <span className="truncate">Configuración</span>
                </button>
                <button
                    onClick={() => setSearchParams({ tab: 'profile' })}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                        activeTab === 'profile'
                            ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-brand-teal shadow-md'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <User className="w-4 h-4 shrink-0" />
                    <span className="truncate">Mi Perfil</span>
                </button>
                <button
                    onClick={() => setSearchParams({ tab: 'updates' })}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all relative ${
                        activeTab === 'updates'
                            ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-brand-teal shadow-md'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <span className="truncate">Actualizaciones</span>
                    {hasUpdate && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute top-2 right-2" />
                    )}
                </button>
            </div>

            {activeTab === 'profile' ? (
                <UserProfile />
            ) : activeTab === 'updates' ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Tarjeta de estado de actualización */}
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                                    hasUpdate
                                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-500/20'
                                        : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/20'
                                }`}>
                                    {hasUpdate ? <Sparkles className="w-7 h-7 animate-pulse" /> : <CheckCircle className="w-7 h-7" />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white">
                                        {hasUpdate ? '¡Nueva versión disponible!' : 'Tu aplicación está al día'}
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                        {hasUpdate 
                                            ? `Se encuentra disponible la versión oficial v${latestVersion?.version} para su descarga.`
                                            : `Actualmente cuentas con la versión v${currentVersion}, la cual cuenta con las últimas mejoras.`}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => checkUpdates(true)}
                                disabled={isChecking}
                                className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
                            >
                                <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-brand-blue' : ''}`} />
                                <span>{isChecking ? 'Verificando en servidor...' : 'Buscar Actualizaciones'}</span>
                            </button>
                        </div>

                        {/* Detalles de la versión instalada vs disponible */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Versión Instalada
                                </span>
                                <span className="text-base font-black text-slate-900 dark:text-white">
                                    v{currentVersion}
                                </span>
                                <span className="text-[11px] text-slate-500 block mt-1">
                                    {isNativeAndroid ? 'Aplicación Nativa Android' : 'Plataforma Web'}
                                </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Versión en Servidor
                                </span>
                                <span className="text-base font-black text-brand-blue dark:text-brand-teal">
                                    v{latestVersion?.version || currentVersion}
                                </span>
                                <span className="text-[11px] text-slate-500 block mt-1">
                                    Lanzamiento: {latestVersion?.releaseDate || '2026-09-20'}
                                </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/50">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                    Última Verificación
                                </span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    {lastChecked ? lastChecked.toLocaleTimeString() : 'Hace un momento'}
                                </span>
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-1">
                                    Servidor En Línea
                                </span>
                            </div>
                        </div>

                        {/* Botón de acción destacado si hay actualización */}
                        {hasUpdate && latestVersion && (
                            <div className="p-5 rounded-2xl bg-gradient-to-r from-brand-blue/10 via-indigo-600/10 to-brand-purple/10 border border-brand-blue/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                        ¿Listo para actualizar a la v{latestVersion.version}?
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Incluye mejoras en boletas multianuales, constancias adaptativas y certificación antifraude.
                                    </p>
                                </div>
                                <button
                                    onClick={openUpdateModal}
                                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-brand-blue to-brand-teal hover:from-blue-600 hover:to-teal-500 text-white font-bold rounded-xl text-xs sm:text-sm shadow-lg shadow-brand-blue/25 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>Descargar e Instalar Ahora</span>
                                </button>
                            </div>
                        )}

                        {/* Enlace directo a descarga de APK */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                            <span>¿Deseas descargar el instalador APK directamente para instalarlo en otro dispositivo?</span>
                            <a
                                href="https://plataformaultec.duckdns.org/downloads/PlataformaULTEC.apk"
                                download="PlataformaULTEC.apk"
                                className="flex items-center gap-1.5 text-brand-blue dark:text-brand-teal font-bold hover:underline"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Descargar PlataformaULTEC.apk (5.1 MB)</span>
                            </a>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    {/* Role Guard Warning Banner for Standard Admins */}
                    {!isSuperAdmin && (
                        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3.5 text-amber-900 dark:text-amber-200 text-xs sm:text-sm animate-in fade-in shadow-sm">
                            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold block text-sm mb-0.5">Modo Administrador de Sede</span>
                                <span className="opacity-95 leading-relaxed">
                                    Has iniciado sesión con el rol de <strong>Administrador</strong>. Puedes editar los datos de contacto institucional y puntos de mérito. Las políticas académicas centrales, finanzas duras, habilitación de portales y Modo Mantenimiento están reservados exclusivamente para el <strong>Superadministrador</strong>.
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Quick Jump Section Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => scrollToSection('sec-institution')}
                            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-brand-blue/40 shadow-sm shrink-0 flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                            <Building2 className="w-3.5 h-3.5 text-blue-500" />
                            <span>Institución</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollToSection('sec-academic')}
                            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-brand-blue/40 shadow-sm shrink-0 flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                            <GraduationCap className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Académico</span>
                            {!isSuperAdmin && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollToSection('sec-finance')}
                            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-brand-blue/40 shadow-sm shrink-0 flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                            <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                            <span>Finanzas</span>
                            {!isSuperAdmin && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollToSection('sec-access')}
                            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-brand-blue/40 shadow-sm shrink-0 flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                            <ToggleLeft className="w-3.5 h-3.5 text-purple-500" />
                            <span>Accesos</span>
                            {!isSuperAdmin && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollToSection('sec-governance')}
                            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-brand-blue/40 shadow-sm shrink-0 flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                            <Wrench className="w-3.5 h-3.5 text-rose-500" />
                            <span>Gobernanza</span>
                            {!isSuperAdmin && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollToSection('sec-gamification')}
                            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-brand-blue/40 shadow-sm shrink-0 flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                            <Award className="w-3.5 h-3.5 text-teal-500" />
                            <span>Gamificación</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => scrollToSection('sec-audit')}
                            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-brand-blue/40 shadow-sm shrink-0 flex items-center gap-1.5 active:scale-95 transition-all"
                        >
                            <History className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Historial DIFF</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                
                {/* ─── INSTITUCIÓN ─── */}
                <div id="sec-institution" className="bg-white dark:bg-slate-900/90 rounded-3xl shadow-sm hover:shadow-md border border-slate-200/80 dark:border-slate-800/90 p-5 sm:p-6 overflow-hidden relative group transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-brand-blue">
                        <Building2 className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5 mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-brand-blue flex items-center justify-center">
                                <Building2 className="w-4 h-4" />
                            </div>
                            <span>Datos Institucionales</span>
                        </h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Nombre de la Institución
                                </label>
                                <div className="relative">
                                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        name="institution_name"
                                        value={settings.institution_name}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm text-slate-900 dark:text-white min-h-[44px]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                                <div>
                                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Teléfono de Contacto
                                    </label>
                                    <div className="relative">
                                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            name="institution_phone"
                                            value={settings.institution_phone}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm text-slate-900 dark:text-white min-h-[44px]"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Email de Contacto
                                    </label>
                                    <div className="relative">
                                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="email"
                                            name="institution_email"
                                            value={settings.institution_email}
                                            onChange={handleChange}
                                            className="w-full pl-10 pr-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm text-slate-900 dark:text-white min-h-[44px]"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Dirección Principal
                                </label>
                                <div className="relative">
                                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        name="institution_address"
                                        value={settings.institution_address}
                                        onChange={handleChange}
                                        className="w-full pl-10 pr-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm text-slate-900 dark:text-white min-h-[44px]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── ACADÉMICO ─── */}
                <div id="sec-academic" className="bg-white dark:bg-slate-900/90 rounded-3xl shadow-sm hover:shadow-md border border-slate-200/80 dark:border-slate-800/90 p-5 sm:p-6 overflow-hidden relative group transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-emerald-500">
                        <GraduationCap className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                    <GraduationCap className="w-4 h-4" />
                                </div>
                                <span>Configuración Académica</span>
                            </h2>
                            {!isSuperAdmin && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[11px] font-black">
                                    <Lock className="w-3 h-3" />
                                    <span>SuperAdmin</span>
                                </span>
                            )}
                        </div>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                                <div>
                                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Unidades Evaluativas
                                    </label>
                                    <input
                                        type="number"
                                        name="total_grade_units"
                                        disabled={!isSuperAdmin}
                                        value={settings.total_grade_units}
                                        onChange={handleChange}
                                        min="1" max="10"
                                        className="w-full px-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm text-slate-900 dark:text-white min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Notas parciales por curso (ej: 4 bimestres).</p>
                                </div>
                                <div>
                                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Duración mes/curso
                                    </label>
                                    <input
                                        type="number"
                                        name="default_course_duration_months"
                                        disabled={!isSuperAdmin}
                                        value={settings.default_course_duration_months}
                                        onChange={handleChange}
                                        min="1" max="24"
                                        className="w-full px-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm text-slate-900 dark:text-white min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Meses estándar de duración.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Nombres de Unidades (separadas por comas)
                                </label>
                                <input
                                    type="text"
                                    name="grade_unit_names"
                                    disabled={!isSuperAdmin}
                                    value={settings.grade_unit_names}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm text-slate-900 dark:text-white min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Ej: Bimestre 1,Bimestre 2,Bimestre 3,Bimestre 4</p>
                            </div>

                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Meses pagados para desbloquear unidades
                                </label>
                                <input
                                    type="text"
                                    name="grade_unit_cutoff_months"
                                    disabled={!isSuperAdmin}
                                    value={settings.grade_unit_cutoff_months || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm text-slate-900 dark:text-white font-mono min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Ej: "3,6,8,10" para condicionar cada bloque a cuotas pagadas.</p>
                            </div>

                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 items-center">
                                    <div>
                                        <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            Nota Mínima de Aprobación
                                        </label>
                                        <input
                                            type="number"
                                            name="minimum_passing_grade"
                                            disabled={!isSuperAdmin}
                                            value={settings.minimum_passing_grade}
                                            onChange={handleChange}
                                            min="0" max="100"
                                            className="w-full px-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm text-slate-900 dark:text-white min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <label className={`flex items-center justify-between sm:justify-start gap-3 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all min-h-[44px] ${
                                        !isSuperAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            name="allow_instructor_grade_edits"
                                            disabled={!isSuperAdmin}
                                            checked={settings.allow_instructor_grade_edits === 'true'}
                                            onChange={handleChange}
                                            className="w-5 h-5 text-brand-blue rounded-lg border-slate-300 dark:border-slate-600 focus:ring-brand-blue disabled:cursor-not-allowed"
                                        />
                                        <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                                            Permitir a docentes editar notas
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── FINANZAS & RESTRICCIONES ─── */}
                <div id="sec-finance" className="bg-white dark:bg-slate-900/90 rounded-3xl shadow-sm hover:shadow-md border border-slate-200/80 dark:border-slate-800/90 p-5 sm:p-6 overflow-hidden relative group transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-amber-500">
                        <DollarSign className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                    <DollarSign className="w-4 h-4" />
                                </div>
                                <span>Finanzas y Restricciones</span>
                            </h2>
                            {!isSuperAdmin && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[11px] font-black">
                                    <Lock className="w-3 h-3" />
                                    <span>SuperAdmin</span>
                                </span>
                            )}
                        </div>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
                                <div>
                                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Moneda
                                    </label>
                                    <input
                                        type="text"
                                        name="default_currency_symbol"
                                        disabled={!isSuperAdmin}
                                        value={settings.default_currency_symbol}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm text-slate-900 dark:text-white min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                                        placeholder="Q"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Días de Gracia
                                    </label>
                                    <input
                                        type="number"
                                        name="grace_period_days"
                                        disabled={!isSuperAdmin}
                                        value={settings.grace_period_days}
                                        onChange={handleChange}
                                        min="0"
                                        className="w-full px-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm text-slate-900 dark:text-white min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        % Mora Mensual
                                    </label>
                                    <input
                                        type="number"
                                        name="late_fee_percentage"
                                        disabled={!isSuperAdmin}
                                        value={settings.late_fee_percentage}
                                        onChange={handleChange}
                                        min="0"
                                        className="w-full px-4 py-2.5 sm:py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm text-slate-900 dark:text-white min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-3 pt-2">
                                <label className={`flex items-start gap-3.5 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${
                                    !isSuperAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                                }`}>
                                    <div className="pt-0.5">
                                        <input
                                            type="checkbox"
                                            name="restrict_grades_by_payment"
                                            disabled={!isSuperAdmin}
                                            checked={settings.restrict_grades_by_payment === 'true'}
                                            onChange={handleChange}
                                            className="w-5 h-5 text-brand-blue rounded-lg border-slate-300 dark:border-slate-600 focus:ring-brand-blue disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                            Restringir boleta de calificaciones
                                        </h3>
                                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                                            Estudiantes/padres solo verán notas proporcionales a las cuotas pagadas.
                                        </p>
                                    </div>
                                </label>

                                <label className={`flex items-start gap-3.5 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${
                                    !isSuperAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                                }`}>
                                    <div className="pt-0.5">
                                        <input
                                            type="checkbox"
                                            name="restrict_future_payments_if_debt"
                                            disabled={!isSuperAdmin}
                                            checked={settings.restrict_future_payments_if_debt === 'true'}
                                            onChange={handleChange}
                                            className="w-5 h-5 text-emerald-500 rounded-lg border-slate-300 dark:border-slate-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                            Bloquear meses futuros si hay deuda
                                        </h3>
                                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                                            Fuerza el pago de mensualidades atrasadas antes de adelantar pagos.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── ACCESOS GLOBALES ─── */}
                <div id="sec-access" className="bg-white dark:bg-slate-900/90 rounded-3xl shadow-sm hover:shadow-md border border-slate-200/80 dark:border-slate-800/90 p-5 sm:p-6 overflow-hidden relative group transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-purple-500">
                        <ToggleLeft className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                                    <ToggleLeft className="w-4 h-4" />
                                </div>
                                <span>Accesos Globales</span>
                            </h2>
                            {!isSuperAdmin && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[11px] font-black">
                                    <Lock className="w-3 h-3" />
                                    <span>SuperAdmin</span>
                                </span>
                            )}
                        </div>
                        
                        <div className="space-y-3">
                            <label className={`flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${
                                !isSuperAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                            }`}>
                                <div>
                                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                        Portal de Estudiantes
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Permitir inicio de sesión a alumnos
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    name="allow_student_portal"
                                    disabled={!isSuperAdmin}
                                    checked={settings.allow_student_portal === 'true'}
                                    onChange={handleChange}
                                    className="w-5 h-5 text-brand-blue rounded-lg border-slate-300 dark:border-slate-600 focus:ring-brand-blue disabled:cursor-not-allowed"
                                />
                            </label>

                            <label className={`flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all ${
                                !isSuperAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                            }`}>
                                <div>
                                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                        Portal de Padres de Familia
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Permitir inicio de sesión a tutores
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    name="allow_parent_portal"
                                    disabled={!isSuperAdmin}
                                    checked={settings.allow_parent_portal === 'true'}
                                    onChange={handleChange}
                                    className="w-5 h-5 text-brand-blue rounded-lg border-slate-300 dark:border-slate-600 focus:ring-brand-blue disabled:cursor-not-allowed"
                                />
                            </label>
                            
                            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
                                <Shield className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                                <span>
                                    <span className="font-bold">Control Central:</span> Al desactivar un portal, los usuarios verán una pantalla de cierre temporal al intentar acceder.
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── GOBERNANZA & MODO MANTENIMIENTO ─── */}
                <div id="sec-governance" className="bg-white dark:bg-slate-900/90 rounded-3xl shadow-sm hover:shadow-md border border-slate-200/80 dark:border-slate-800/90 p-5 sm:p-6 overflow-hidden relative group transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-rose-500">
                        <Wrench className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                                    <Wrench className="w-4 h-4" />
                                </div>
                                <span>Gobernanza y Modo Mantenimiento</span>
                            </h2>
                            {!isSuperAdmin && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 text-[11px] font-black">
                                    <Lock className="w-3 h-3" />
                                    <span>SuperAdmin</span>
                                </span>
                            )}
                        </div>

                        <div className="space-y-4">
                            {/* Visual State Banner */}
                            {settings.system_maintenance_mode === 'true' ? (
                                <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-900 dark:text-rose-200 flex items-start gap-3">
                                    <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                                    <div>
                                        <span className="font-black block text-sm mb-0.5">MODO MANTENIMIENTO ACTIVO</span>
                                        <p className="text-xs leading-relaxed opacity-90">
                                            La plataforma se encuentra bloqueada para estudiantes, padres y docentes. Solo las cuentas de administración pueden navegar y operar.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex items-center gap-2.5 text-xs font-semibold">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span>Plataforma Operativa Normal: Todos los servicios y accesos habilitados.</span>
                                </div>
                            )}

                            <label className={`flex items-start justify-between gap-4 p-4 rounded-2xl border transition-all ${
                                settings.system_maintenance_mode === 'true'
                                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/60'
                                    : 'border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            } ${!isSuperAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                                <div>
                                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                        Activar Modo Mantenimiento
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                                        Interrumpe el acceso general para mantenimiento de base de datos o cierres de ciclo.
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    name="system_maintenance_mode"
                                    disabled={!isSuperAdmin}
                                    checked={settings.system_maintenance_mode === 'true'}
                                    onChange={handleChange}
                                    className="w-5 h-5 text-rose-600 rounded-lg border-slate-300 dark:border-slate-600 focus:ring-rose-500 disabled:cursor-not-allowed"
                                />
                            </label>

                            <div>
                                <label className="block text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Mensaje Informativo para la Comunidad
                                </label>
                                <textarea
                                    name="system_maintenance_message"
                                    disabled={!isSuperAdmin}
                                    value={settings.system_maintenance_message || ''}
                                    onChange={handleChange}
                                    rows={2}
                                    placeholder="La plataforma se encuentra en mantenimiento programado..."
                                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-xs sm:text-sm text-slate-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                                />
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Este mensaje se mostrará en pantalla completa a los usuarios durante el mantenimiento.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── GAMIFICACIÓN y MÉRITOS ─── */}
                <div id="sec-gamification" className="bg-white dark:bg-slate-900/90 rounded-3xl shadow-sm hover:shadow-md border border-slate-200/80 dark:border-slate-800/90 p-5 sm:p-6 overflow-hidden relative col-span-1 lg:col-span-2 transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-brand-teal">
                        <Award className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5 mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-brand-teal flex items-center justify-center">
                                <Award className="w-4 h-4" />
                            </div>
                            <span>Gamificación y Puntos de Mérito</span>
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                            {/* Toggles */}
                            <div className="space-y-3">
                                <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Automatización de Méritos
                                </h3>
                                
                                <label className="flex items-start justify-between gap-3 cursor-pointer p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                                    <div>
                                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                            Puntos por Asistencia
                                        </h4>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            Asignar puntos automáticamente al marcar PRESENT
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        name="merit_enable_auto_attendance"
                                        checked={settings.merit_enable_auto_attendance === 'true'}
                                        onChange={handleChange}
                                        className="w-5 h-5 text-brand-blue rounded-lg border-slate-300 dark:border-slate-600 focus:ring-brand-blue"
                                    />
                                </label>

                                <label className="flex items-start justify-between gap-3 cursor-pointer p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                                    <div>
                                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                            Puntos por Calificaciones
                                        </h4>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                            Asignar puntos automáticamente en notas altas (&gt;=80)
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        name="merit_enable_auto_grades"
                                        checked={settings.merit_enable_auto_grades === 'true'}
                                        onChange={handleChange}
                                        className="w-5 h-5 text-brand-blue rounded-lg border-slate-300 dark:border-slate-600 focus:ring-brand-blue"
                                    />
                                </label>
                            </div>

                            {/* Point Configuration values */}
                            <div className="space-y-3">
                                <h3 className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Puntos Otorgados
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Por Asistencia
                                        </label>
                                        <input
                                            type="number"
                                            name="merit_points_attendance_present"
                                            value={settings.merit_points_attendance_present}
                                            onChange={handleChange}
                                            min="0"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 text-sm text-slate-900 dark:text-white min-h-[44px]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Excelente (&gt;=90)
                                        </label>
                                        <input
                                            type="number"
                                            name="merit_points_grade_excellent"
                                            value={settings.merit_points_grade_excellent}
                                            onChange={handleChange}
                                            min="0"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 text-sm text-slate-900 dark:text-white min-h-[44px]"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Buena (&gt;=80)
                                        </label>
                                        <input
                                            type="number"
                                            name="merit_points_grade_good"
                                            value={settings.merit_points_grade_good}
                                            onChange={handleChange}
                                            min="0"
                                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl focus:ring-2 focus:ring-brand-blue/20 text-sm text-slate-900 dark:text-white min-h-[44px]"
                                        />
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-700 dark:text-teal-300 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-brand-teal shrink-0" />
                                    <span>
                                        <span className="font-bold">Gamificación Activa:</span> Los alumnos se motivan al ver su progreso y recompensas tangibles.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── HISTORIAL DE AUDITORÍA DE CONFIGURACIÓN (DIFFS) ─── */}
                <div id="sec-audit" className="bg-white dark:bg-slate-900/90 rounded-3xl shadow-sm hover:shadow-md border border-slate-200/80 dark:border-slate-800/90 p-5 sm:p-6 overflow-hidden relative col-span-1 lg:col-span-2 transition-all">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-indigo-500">
                        <History className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                            <div>
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                                        <History className="w-4 h-4" />
                                    </div>
                                    <span>Trazabilidad y Auditoría de Cambios (DIFFs Recientes)</span>
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    Registro inmutable de modificaciones en parámetros institucionales, académicos y de gobernanza.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={fetchAuditHistory}
                                disabled={loadingAudit}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all self-start sm:self-auto"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin text-brand-blue' : ''}`} />
                                <span>Actualizar Registro</span>
                            </button>
                        </div>

                        {loadingAudit && auditLogs.length === 0 ? (
                            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                                <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
                                <span className="text-xs font-semibold">Cargando registros de auditoría...</span>
                            </div>
                        ) : auditLogs.length === 0 ? (
                            <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Configuración Estable</h4>
                                <p className="text-xs text-slate-500 mt-0.5">Los próximos cambios guardados generarán un registro detallado en esta sección.</p>
                            </div>
                        ) : (
                            <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                                {auditLogs.map((log) => {
                                    const oldChanges = log.old_data?.changes || [];
                                    const newChanges = log.new_data?.changes || [];
                                    const dateFormatted = new Date(log.created_at).toLocaleString();

                                    return (
                                        <div
                                            key={log.id}
                                            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-3 transition-all hover:border-brand-blue/30"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/50 dark:border-slate-700/50">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                                                        {log.user?.full_name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                            {log.user?.full_name || log.metadata?.user_name || 'Administrador'}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-2">
                                                            ({log.user?.email || log.metadata?.user_email || 'correo no registrado'})
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                                    <span className={`px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[10px] ${
                                                        (log.user?.role || log.metadata?.user_role) === 'superadmin'
                                                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                                            : 'bg-blue-500/10 text-brand-blue border border-brand-blue/20'
                                                    }`}>
                                                        {log.user?.role || log.metadata?.user_role || 'admin'}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-slate-400">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{dateFormatted}</span>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* DIFF Presentation */}
                                            <div className="space-y-1.5">
                                                {newChanges.map((change, idx) => {
                                                    const oldItem = oldChanges.find(o => o.key === change.key);
                                                    const oldVal = oldItem?.value ?? '';
                                                    const newVal = change.value ?? '';
                                                    const label = change.label || change.key;

                                                    return (
                                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-white dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800 gap-1.5">
                                                            <span className="font-bold text-slate-700 dark:text-slate-300 sm:max-w-xs truncate">
                                                                {label}
                                                            </span>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="text-rose-600 dark:text-rose-400 line-through bg-rose-500/10 px-2 py-0.5 rounded text-[11px]">
                                                                    {oldVal === '' ? '(vacío)' : oldVal}
                                                                </span>
                                                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-[11px]">
                                                                    {newVal === '' ? '(vacío)' : newVal}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Floating Bottom Save Button for Mobile */}
            {activeTab === 'system' && (
                <div className="fixed bottom-14 left-0 right-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent z-40 sm:hidden pointer-events-none">
                    <div className="max-w-md mx-auto pointer-events-auto">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-bold flex items-center justify-center gap-2.5 shadow-2xl shadow-blue-500/40 active:scale-[0.98] transition-all border border-white/10 text-sm"
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 stroke-[2.5]" />}
                            <span>Guardar Cambios</span>
                        </button>
                    </div>
                </div>
            )}
                </>
            )}
        </div>
    );
};

export default SettingsPage;
