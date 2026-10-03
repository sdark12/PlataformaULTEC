import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface CycleSelectorPillsProps {
    cycles: number[];
    selectedYear: 'ALL' | number;
    onSelectYear: (year: 'ALL' | number) => void;
    maxVisiblePills?: number;
    className?: string;
    showLabelPrefix?: boolean;
    allLabel?: string;
}

/**
 * Componente híbrido inteligente para selector de ciclo lectivo:
 * - Si hay pocos ciclos (<= maxVisiblePills), muestra píldoras directas [Todos] [Ciclo 2027] [Ciclo 2026].
 * - Si hay más ciclos, muestra los más recientes y agrupa los históricos en un selector compacto [Más ciclos ▾].
 * Garantiza escalabilidad indefinida sin desbordar el layout ni saturar la barra de filtros.
 */
export const CycleSelectorPills: React.FC<CycleSelectorPillsProps> = ({
    cycles,
    selectedYear,
    onSelectYear,
    maxVisiblePills = 2,
    className = '',
    showLabelPrefix = true,
    allLabel = 'Todos',
}) => {
    if (!cycles || cycles.length <= 1) {
        return null;
    }

    const prefix = showLabelPrefix ? 'Ciclo ' : '';
    const shouldGroup = cycles.length > maxVisiblePills;
    const recentCycles = shouldGroup ? cycles.slice(0, maxVisiblePills) : cycles;
    const olderCycles = shouldGroup ? cycles.slice(maxVisiblePills) : [];
    const isOlderSelected = shouldGroup && typeof selectedYear === 'number' && olderCycles.includes(selectedYear);

    return (
        <div 
            className={`flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 shrink-0 ${className}`}
        >
            {/* Opción Todos */}
            <button
                type="button"
                onClick={() => onSelectYear('ALL')}
                className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all ${
                    selectedYear === 'ALL'
                        ? 'bg-brand-blue text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
                {allLabel}
            </button>

            {/* Píldoras de Ciclos Recientes */}
            {recentCycles.map((year) => {
                const isActive = selectedYear === year;
                return (
                    <button
                        key={year}
                        type="button"
                        onClick={() => onSelectYear(year)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all ${
                            isActive
                                ? 'bg-brand-blue text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        {prefix}{year}
                    </button>
                );
            })}

            {/* Menú Desplegable Compacto para Ciclos Históricos */}
            {shouldGroup && olderCycles.length > 0 && (
                <div className="relative inline-flex items-center">
                    <select
                        aria-label="Seleccionar ciclo lectivo histórico"
                        value={isOlderSelected ? selectedYear : ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                                onSelectYear(Number(val));
                            }
                        }}
                        className={`appearance-none text-[11px] font-bold py-1 pl-2.5 pr-6 rounded-lg transition-all cursor-pointer border outline-none ${
                            isOlderSelected
                                ? 'bg-brand-blue text-white border-brand-blue shadow-xs'
                                : 'bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent'
                        }`}
                    >
                        <option 
                            value="" 
                            disabled={!isOlderSelected}
                            className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold"
                        >
                            {isOlderSelected ? `${prefix}${selectedYear}` : 'Más ciclos...'}
                        </option>
                        {olderCycles.map((year) => (
                            <option 
                                key={year} 
                                value={year}
                                className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold"
                            >
                                {prefix}{year}
                            </option>
                        ))}
                    </select>
                    <ChevronDown 
                        className={`w-3 h-3 absolute right-1.5 pointer-events-none transition-colors ${
                            isOlderSelected ? 'text-white' : 'text-slate-400'
                        }`} 
                    />
                </div>
            )}
        </div>
    );
};

export default CycleSelectorPills;
