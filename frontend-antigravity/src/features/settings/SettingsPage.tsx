import React, { useEffect, useState } from 'react';
import { getSettings, updateSettings } from './settingsService';
import type { SystemSettings } from './settingsService';
import { Settings, Save, Loader2, Building2, GraduationCap, DollarSign, ToggleLeft } from 'lucide-react';

const SettingsPage: React.FC = () => {
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

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
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
        } catch (error) {
            console.error("Error saving settings:", error);
            showNotification("Error al guardar la configuración", "error");
        } finally {
            setSaving(false);
        }
    };

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px]">
                <Loader2 className="w-8 h-8 text-brand-blue animate-spin" />
            </div>
        );
    }

    if (!settings) {
        return <div className="p-6 text-red-500">Error: No se pudo cargar la configuración.</div>;
    }

    return (
        <div className="p-6 max-w-6xl mx-auto pb-24">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <Settings className="w-7 h-7 text-brand-blue" />
                        Configuración del Sistema
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Administre la configuración global de la plataforma, preferencias institucionales y reglas de negocio.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-brand-blue hover:bg-brand-blue/90 text-white px-5 py-2.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-sm shadow-brand-blue/20"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Guardar Cambios
                </button>
            </div>

            {notification && (
                <div className={`mb-6 p-4 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2 ${
                    notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                    <span className="font-semibold">{notification.message}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* ─── INSTITUCIÓN ─── */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Building2 className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <Building2 className="w-5 h-5 text-brand-blue" />
                            Datos Institucionales
                        </h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nombre de la Institución</label>
                                <input
                                    type="text"
                                    name="institution_name"
                                    value={settings.institution_name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm dark:bg-slate-700 dark:text-white"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Teléfono</label>
                                    <input
                                        type="text"
                                        name="institution_phone"
                                        value={settings.institution_phone}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm dark:bg-slate-700 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Email Contacto</label>
                                    <input
                                        type="email"
                                        name="institution_email"
                                        value={settings.institution_email}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm dark:bg-slate-700 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Dirección Principal</label>
                                <input
                                    type="text"
                                    name="institution_address"
                                    value={settings.institution_address}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm dark:bg-slate-700 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── ACADÉMICO ─── */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <GraduationCap className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <GraduationCap className="w-5 h-5 text-emerald-500" />
                            Configuración Académica
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Cantidad de Unidades (Bimestres)</label>
                                    <input
                                        type="number"
                                        name="total_grade_units"
                                        value={settings.total_grade_units}
                                        onChange={handleChange}
                                        min="1" max="10"
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm dark:bg-slate-700 dark:text-white"
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1">Cuántas notas parciales componen un curso completo.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Duración mes/curso (default)</label>
                                    <input
                                        type="number"
                                        name="default_course_duration_months"
                                        value={settings.default_course_duration_months}
                                        onChange={handleChange}
                                        min="1" max="24"
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm dark:bg-slate-700 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nombres de Unidades Evaluativas (Separadas por comas)</label>
                                <input
                                    type="text"
                                    name="grade_unit_names"
                                    value={settings.grade_unit_names}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm dark:bg-slate-700 dark:text-white"
                                />
                                <p className="text-[11px] text-slate-500 mt-1">Ej: Unidad 1,Unidad 2,Unidad 3,Unidad 4</p>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Meses de pago límite para desbloquear bloque/unidad (Separados por comas)</label>
                                <input
                                    type="text"
                                    name="grade_unit_cutoff_months"
                                    value={settings.grade_unit_cutoff_months || ''}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm dark:bg-slate-700 dark:text-white font-mono"
                                />
                                <p className="text-[11px] text-slate-500 mt-1">Si colocas "3,6,8,10", la Unidad 1 se verá si han pagado 3 meses de colegiatura, la 2 si pagaron 6 meses, etc.</p>
                            </div>
                            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nota Mínima (Aprobación)</label>
                                        <input
                                            type="number"
                                            name="minimum_passing_grade"
                                            value={settings.minimum_passing_grade}
                                            onChange={handleChange}
                                            min="0" max="100"
                                            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm dark:bg-slate-700 dark:text-white"
                                        />
                                    </div>
                                    <div className="flex flex-col justify-center">
                                        <label className="flex items-center gap-2 cursor-pointer pt-6">
                                            <input
                                                type="checkbox"
                                                name="allow_instructor_grade_edits"
                                                checked={settings.allow_instructor_grade_edits === 'true'}
                                                onChange={handleChange}
                                                className="w-5 h-5 text-brand-blue rounded border-slate-300 focus:ring-brand-blue"
                                            />
                                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                Permitir a profesores editar notas
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── FINANZAS & RESTRICCIONES ─── */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <DollarSign className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <DollarSign className="w-5 h-5 text-amber-500" />
                            Finanzas y Restricciones
                        </h2>
                        
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Moneda</label>
                                    <input
                                        type="text"
                                        name="default_currency_symbol"
                                        value={settings.default_currency_symbol}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm dark:bg-slate-700 dark:text-white"
                                        placeholder="Q"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Días Gracias (Pago)</label>
                                    <input
                                        type="number"
                                        name="grace_period_days"
                                        value={settings.grace_period_days}
                                        onChange={handleChange}
                                        min="0"
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm dark:bg-slate-700 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">% Mora Mensual</label>
                                    <input
                                        type="number"
                                        name="late_fee_percentage"
                                        value={settings.late_fee_percentage}
                                        onChange={handleChange}
                                        min="0"
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue text-sm dark:bg-slate-700 dark:text-white"
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-3 pt-2">
                                <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <div className="pt-1">
                                        <input
                                            type="checkbox"
                                            name="restrict_grades_by_payment"
                                            checked={settings.restrict_grades_by_payment === 'true'}
                                            onChange={handleChange}
                                            className="w-5 h-5 text-brand-blue rounded border-slate-300 focus:ring-brand-blue"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-white">Restringir boleta de calificaciones</h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                                            Estudiantes/padres solo verán notas proporcionales a los pagos.
                                        </p>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <div className="pt-1">
                                        <input
                                            type="checkbox"
                                            name="restrict_future_payments_if_debt"
                                            checked={settings.restrict_future_payments_if_debt === 'true'}
                                            onChange={handleChange}
                                            className="w-5 h-5 text-emerald-500 rounded border-slate-300 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-white">Bloquear meses futuros si hay deuda</h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                                            Solo se muestran pagos del mes atrasado.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── ACCESOS GLOBALES ─── */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <ToggleLeft className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
                            <ToggleLeft className="w-5 h-5 text-purple-500" />
                            Accesos Globales
                        </h2>
                        
                        <div className="space-y-4">
                            <label className="flex items-center justify-between cursor-pointer p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">Portal de Estudiantes</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Permitir inicio de sesión a estudiantes</p>
                                </div>
                                <input
                                    type="checkbox"
                                    name="allow_student_portal"
                                    checked={settings.allow_student_portal === 'true'}
                                    onChange={handleChange}
                                    className="w-5 h-5 text-brand-blue rounded border-slate-300 focus:ring-brand-blue"
                                />
                            </label>

                            <label className="flex items-center justify-between cursor-pointer p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">Portal de Padres</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Permitir inicio de sesión a padres</p>
                                </div>
                                <input
                                    type="checkbox"
                                    name="allow_parent_portal"
                                    checked={settings.allow_parent_portal === 'true'}
                                    onChange={handleChange}
                                    className="w-5 h-5 text-brand-blue rounded border-slate-300 focus:ring-brand-blue"
                                />
                            </label>
                            
                            <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 text-xs text-blue-700 dark:text-blue-300">
                                <span className="font-bold">Nota:</span> Si desactivas el acceso a un portal, los usuarios no podrán entrar al sistema hasta que lo reactives (útil para mantenimiento).
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default SettingsPage;
