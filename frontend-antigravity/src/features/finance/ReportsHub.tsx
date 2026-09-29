import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, TrendingUp, GraduationCap } from 'lucide-react';
import { getCurrentUser } from '../auth/authService';
import Reports from './Reports';
import StudentReports from '../academic/StudentReports';

interface ReportsHubProps {
    defaultTab?: 'financial' | 'students';
}

const ReportsHub = ({ defaultTab }: ReportsHubProps) => {
    const user = getCurrentUser();
    const isSecretary = user?.role === 'secretary';

    const [searchParams, setSearchParams] = useSearchParams();
    const queryTab = searchParams.get('tab');

    const [activeTab, setActiveTab] = useState<'financial' | 'students'>(
        defaultTab || (queryTab === 'students' ? 'students' : 'financial')
    );

    useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab);
        } else if (queryTab === 'students' || queryTab === 'financial') {
            setActiveTab(queryTab);
        }
    }, [queryTab, defaultTab]);

    const handleTabChange = (tab: 'financial' | 'students') => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    return (
        <div className="max-w-7xl mx-auto pb-32 sm:pb-16 animate-in fade-in duration-300">
            {/* Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 print:hidden pt-2">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-gradient-to-tr from-brand-blue/15 to-emerald-500/15 border border-brand-blue/20 rounded-2xl shadow-sm shrink-0">
                        <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 text-brand-blue dark:text-blue-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {isSecretary ? 'Centro de Reportes y Caja' : 'Centro de Reportes'}
                            </h1>
                            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-400 border border-brand-blue/20">
                                {isSecretary ? 'TURNO DIARIO' : 'INTELIGENCIA'}
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {isSecretary 
                                ? 'Corte de caja de tu jornada y consulta de estadísticas de estudiantes.'
                                : 'Panel consolidado de análisis institucional: ingresos, morosidad, cortes de caja y demografía de alumnos.'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Segmented Switcher for Tabs */}
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 mb-6 sm:mb-8 max-w-xl grid grid-cols-2 gap-1.5 shadow-inner print:hidden">
                <button
                    onClick={() => handleTabChange('financial')}
                    className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] ${
                        activeTab === 'financial'
                            ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-blue-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <TrendingUp className="w-4 h-4 shrink-0" />
                    <span className="truncate">{isSecretary ? 'Mi Corte de Caja' : 'Reportes Financieros'}</span>
                </button>
                <button
                    onClick={() => handleTabChange('students')}
                    className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] ${
                        activeTab === 'students'
                            ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <GraduationCap className="w-4 h-4 shrink-0" />
                    <span className="truncate">Reporte de Alumnos</span>
                </button>
            </div>

            {/* Tab Views */}
            <div className={activeTab === 'financial' ? 'block' : 'hidden'}>
                <Reports />
            </div>

            <div className={activeTab === 'students' ? 'block' : 'hidden'}>
                <StudentReports />
            </div>
        </div>
    );
};

export default ReportsHub;
