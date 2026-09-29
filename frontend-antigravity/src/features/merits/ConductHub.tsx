import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Award, ShieldAlert, Sparkles } from 'lucide-react';
import MeritsAdmin from './MeritsAdmin';
import DisciplineModule from '../academic/DisciplineModule';

interface ConductHubProps {
    defaultTab?: 'merits' | 'discipline';
}

const ConductHub = ({ defaultTab }: ConductHubProps) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const queryTab = searchParams.get('tab');

    const [activeTab, setActiveTab] = useState<'merits' | 'discipline'>(
        defaultTab || (queryTab === 'discipline' ? 'discipline' : 'merits')
    );

    useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab);
        } else if (queryTab === 'discipline' || queryTab === 'merits') {
            setActiveTab(queryTab);
        }
    }, [queryTab, defaultTab]);

    const handleTabChange = (tab: 'merits' | 'discipline') => {
        setActiveTab(tab);
        setSearchParams({ tab });
    };

    return (
        <div className="max-w-7xl mx-auto pb-32 sm:pb-16 animate-in fade-in duration-300">
            {/* Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 print:hidden pt-2">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-gradient-to-tr from-amber-500/15 to-purple-600/15 border border-amber-500/20 rounded-2xl shadow-sm shrink-0">
                        <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-amber-500 dark:text-amber-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                Conducta y Méritos
                            </h1>
                            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                COMUNIDAD
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            Reconocimientos de méritos estudiantiles, tienda de recompensas y control de incidencias disciplinarias.
                        </p>
                    </div>
                </div>
            </div>

            {/* Segmented Switcher for Tabs */}
            <div className="p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 mb-6 sm:mb-8 max-w-xl grid grid-cols-2 gap-1.5 shadow-inner print:hidden">
                <button
                    onClick={() => handleTabChange('merits')}
                    className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] ${
                        activeTab === 'merits'
                            ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <Award className="w-4 h-4 shrink-0" />
                    <span className="truncate">Méritos y Premios</span>
                </button>
                <button
                    onClick={() => handleTabChange('discipline')}
                    className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-200 active:scale-[0.98] ${
                        activeTab === 'discipline'
                            ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span className="truncate">Disciplina y Faltas</span>
                </button>
            </div>

            {/* Tab Views */}
            <div className={activeTab === 'merits' ? 'block' : 'hidden'}>
                <MeritsAdmin />
            </div>

            <div className={activeTab === 'discipline' ? 'block' : 'hidden'}>
                <DisciplineModule />
            </div>
        </div>
    );
};

export default ConductHub;
