import { ChevronDown } from 'lucide-react';

export interface CycleSelectorPillsProps<T extends number | string = number | string> {
    cycles: T[];
    selectedYear: 'ALL' | T;
    onSelectYear: (year: 'ALL' | T) => void;
    maxVisiblePills?: number;
    className?: string;
    showLabelPrefix?: boolean;
    allLabel?: string;
    activeVariant?: 'blue' | 'purple';
    hideIfSingle?: boolean;
}

/**
 * Componente híbrido inteligente para selector de ciclo lectivo:
 * - Si hay pocos ciclos (<= maxVisiblePills), muestra píldoras directas [Todos] [Ciclo 2027] [Ciclo 2026].
 * - Si hay más ciclos, muestra los más recientes y agrupa los históricos en un selector compacto [Más ciclos ▾].
 * Soporta ciclos numéricos o tipo string de forma retrocompatible.
 * Garantiza escalabilidad indefinida sin desbordar el layout ni saturar la barra de filtros.
 */
export function CycleSelectorPills<T extends number | string = number | string>({
    cycles,
    selectedYear,
    onSelectYear,
    maxVisiblePills = 2,
    className = '',
    showLabelPrefix = true,
    allLabel = 'Todos',
    activeVariant = 'blue',
    hideIfSingle = true,
}: CycleSelectorPillsProps<T>) {
    if (!cycles || (hideIfSingle && cycles.length <= 1) || cycles.length === 0) {
        return null;
    }

    const prefix = showLabelPrefix ? 'Ciclo ' : '';
    const shouldGroup = cycles.length > maxVisiblePills;
    const recentCycles = shouldGroup ? cycles.slice(0, maxVisiblePills) : cycles;
    const olderCycles = shouldGroup ? cycles.slice(maxVisiblePills) : [];
    const isOlderSelected = shouldGroup && selectedYear !== 'ALL' && olderCycles.some(c => String(c) === String(selectedYear));

    const activePillClass = activeVariant === 'purple'
        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xs'
        : 'bg-brand-blue text-white shadow-xs';

    const activeSelectClass = activeVariant === 'purple'
        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
        : 'bg-brand-blue text-white border-brand-blue shadow-xs';

    const inactivePillClass = 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';

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
                        ? activePillClass
                        : inactivePillClass
                }`}
            >
                {allLabel}
            </button>

            {/* Píldoras de Ciclos Recientes */}
            {recentCycles.map((year) => {
                const isActive = String(selectedYear) === String(year);
                return (
                    <button
                        key={String(year)}
                        type="button"
                        onClick={() => onSelectYear(year)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all ${
                            isActive
                                ? activePillClass
                                : inactivePillClass
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
                        value={isOlderSelected ? String(selectedYear) : ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                                const found = olderCycles.find(c => String(c) === val);
                                if (found !== undefined) {
                                    onSelectYear(found);
                                } else {
                                    onSelectYear(val as unknown as T);
                                }
                            }
                        }}
                        className={`appearance-none text-[11px] font-bold py-1 pl-2.5 pr-6 rounded-lg transition-all cursor-pointer border outline-none ${
                            isOlderSelected
                                ? activeSelectClass
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
                                key={String(year)} 
                                value={String(year)}
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
}

export default CycleSelectorPills;
