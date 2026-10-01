import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, TrendingUp, GraduationCap, Sparkles, ShieldAlert, Clock } from 'lucide-react';
import { getCurrentUser } from '../auth/authService';
import Reports from './Reports';
import StudentReports from '../academic/StudentReports';
import EarlyWarningDashboard from './EarlyWarningDashboard';
import DebtAgingDashboard from './DebtAgingDashboard';

interface ReportsHubProps {
    defaultTab?: 'financial' | 'students' | 'intelligence';
}

const ReportsHub = ({ defaultTab }: ReportsHubProps) => {
    const user = getCurrentUser();
    const isSecretary = user?.role === 'secretary';

    const [searchParams, setSearchParams] = useSearchParams();
    const queryTab = searchParams.get('tab');
    const querySub = searchParams.get('sub');

    const [activeTab, setActiveTab] = useState<'financial' | 'students' | 'intelligence'>(
        defaultTab || (queryTab === 'students' ? 'students' : queryTab === 'intelligence' ? 'intelligence' : 'financial')
    );

    const [intelligenceSubTab, setIntelligenceSubTab] = useState<'early_warning' | 'debt_aging'>(
        querySub === 'debt_aging' ? 'debt_aging' : 'early_warning'
    );

    useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab);
        } else if (queryTab === 'students' || queryTab === 'financial' || queryTab === 'intelligence') {
            setActiveTab(queryTab);
        }
        if (querySub === 'debt_aging' || querySub === 'early_warning') {
            setIntelligenceSubTab(querySub);
        }
    }, [queryTab, querySub, defaultTab]);

    const handleTabChange = (tab: 'financial' | 'students' | 'intelligence') => {
        setActiveTab(tab);
        const params: Record<string, string> = { tab };
        if (tab === 'intelligence') {
            params.sub = intelligenceSubTab;
        }
        setSearchParams(params);
    };

    const handleSubTabChange = (sub: 'early_warning' | 'debt_aging') => {
        setIntelligenceSubTab(sub);
        setSearchParams({ tab: 'intelligence', sub });
    };

    return (
        <div className="max-w-7xl mx-auto pb-32 sm:pb-16 animate-in fade-in duration-300">
            {/* Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 print:hidden pt-2">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-gradient-to-tr from-brand-blue/15 to-indigo-500/15 border border-brand-blue/20 rounded-2xl shadow-sm shrink-0">
                        <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 text-brand-blue dark:text-blue-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {isSecretary ? 'Centro de Reportes y Caja' : 'Centro de Inteligencia y Reportes'}
                            </h1>
                            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 border border-brand-blue/20">
                                {isSecretary ? 'TURNO DIARIO' : 'BI & ANALÍTICA'}
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {isSecretary 
                                ? 'Corte de caja de tu jornada, estadísticas de alumnos y seguimiento institucional.'
                                : 'Panel integral de inteligencia: semáforo de deserción escolar, análisis de cartera vencida e ingresos.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Segmented Switcher for Main Tabs */}
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 mb-6 sm:mb-8 max-w-2xl grid grid-cols-3 gap-1.5 shadow-inner print:hidden">
                {/* Financial */}
                <button
                    onClick={() => handleTabChange('financial')}
                    className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] ${
                        activeTab === 'financial'
                            ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isSecretary ? 'Mi Caja' : 'Financieros'}</span>
                </button>

                {/* Students */}
                <button
                    onClick={() => handleTabChange('students')}
                    className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] ${
                        activeTab === 'students'
                            ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <GraduationCap className="w-4 h-4 shrink-0" />
                    <span className="truncate">Alumnos</span>
                </button>

                {/* Intelligence & Early Warning */}
                <button
                    onClick={() => handleTabChange('intelligence')}
                    className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] relative ${
                        activeTab === 'intelligence'
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
                    <span className="truncate">Inteligencia BI</span>
                    <span className="hidden sm:inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                </button>
            </div>

            {/* Sub-navigation for Intelligence Tab */}
            {activeTab === 'intelligence' && (
                <div className="flex items-center gap-2 mb-6 p-1.5 bg-slate-200/60 dark:bg-slate-800/50 rounded-2xl max-w-md print:hidden">
                    <button
                        onClick={() => handleSubTabChange('early_warning')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            intelligenceSubTab === 'early_warning'
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                        <span>Alerta Temprana (EWS)</span>
                    </button>

                    <button
                        onClick={() => handleSubTabChange('debt_aging')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            intelligenceSubTab === 'debt_aging'
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Cartera Vencida (Aging)</span>
                    </button>
                </div>
            )}

            {/* Tab Views */}
            <div className={activeTab === 'financial' ? 'block' : 'hidden'}>
                <Reports />
            </div>

            <div className={activeTab === 'students' ? 'block' : 'hidden'}>
                <StudentReports />
            </div>

            {activeTab === 'intelligence' && (
                <div>
                    {intelligenceSubTab === 'early_warning' ? (
                        <EarlyWarningDashboard />
                    ) : (
                        <DebtAgingDashboard />
                    )}
                </div>
            )}
        </div>
    );
};

export default ReportsHub;
