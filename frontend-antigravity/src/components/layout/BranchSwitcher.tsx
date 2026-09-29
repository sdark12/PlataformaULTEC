import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Globe, ChevronDown, Check, Settings, Loader2 } from 'lucide-react';
import { useBranch } from '../../context/BranchContext';

export const BranchSwitcher = () => {
    const {
        branches,
        isLoadingBranches,
        selectedBranchId,
        selectedBranchName,
        isAllBranches,
        canSwitchBranch,
        setSelectedBranchId
    } = useBranch();

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside or Escape
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    if (isLoadingBranches && branches.length === 0) {
        return (
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-teal" />
                <span>Cargando sedes...</span>
            </div>
        );
    }

    // Regular users (non-superadmin) cannot switch branches: show read-only indicator
    if (!canSwitchBranch) {
        return (
            <div 
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-300 shadow-sm"
                title={`Sede asignada: ${selectedBranchName}`}
            >
                <Building2 className="h-3.5 w-3.5 text-brand-teal shrink-0" />
                <span className="truncate max-w-[130px] font-semibold">{selectedBranchName}</span>
                <span className="text-[10px] text-slate-400 font-normal hidden lg:inline"> (Asignada)</span>
            </div>
        );
    }

    // SuperAdmin switchable dropdown
    return (
        <div className="relative shrink-0" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border shadow-sm ${
                    isAllBranches
                        ? 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-brand-teal/10 text-brand-blue dark:text-brand-teal border-brand-teal/40 hover:border-brand-teal hover:shadow-[0_0_12px_rgba(37,192,244,0.25)]'
                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:border-emerald-500 hover:shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                }`}
                title="Cambiar ámbito regional o sede de trabajo (SuperAdmin)"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                {isAllBranches ? (
                    <Globe className="h-3.5 w-3.5 text-brand-teal shrink-0 animate-pulse" />
                ) : (
                    <Building2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                )}
                <span className="truncate max-w-[95px] xs:max-w-[120px] sm:max-w-[150px] md:max-w-[180px]">
                    {selectedBranchName}
                </span>
                <ChevronDown
                    className={`h-3 w-3 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180 text-brand-teal' : ''
                    }`}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Ámbito de Gestión
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-blue/15 text-brand-teal font-bold uppercase tracking-wider">
                                SuperAdmin
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                            Filtra métricas y registros por sede o consolida todos los datos globales.
                        </p>
                    </div>

                    {/* All Branches (Consolidated) Option */}
                    <div className="p-1">
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedBranchId('all');
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                                isAllBranches
                                    ? 'bg-brand-blue/15 text-brand-blue dark:text-brand-teal font-semibold shadow-inner'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                            }`}
                        >
                            <div className="flex items-center space-x-2.5 min-w-0">
                                <div className="p-1.5 rounded-lg bg-blue-500/10 text-brand-teal shrink-0">
                                    <Globe className="h-4 w-4" />
                                </div>
                                <div className="truncate">
                                    <div className="text-xs font-bold leading-tight">Todas las Sedes</div>
                                    <div className="text-[10px] text-slate-400 leading-tight">
                                        Consolidado institucional global
                                    </div>
                                </div>
                            </div>
                            {isAllBranches && <Check className="h-4 w-4 text-brand-teal shrink-0 ml-2" />}
                        </button>
                    </div>

                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                    {/* Regional Branches Section */}
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        <span>Sedes Registradas ({branches.length})</span>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1 p-1 custom-scrollbar">
                        {branches.map((branch) => {
                            const isSelected = selectedBranchId === branch.id;
                            return (
                                <button
                                    key={branch.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedBranchId(branch.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                                        isSelected
                                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold shadow-inner'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                                    }`}
                                >
                                    <div className="flex items-center space-x-2.5 min-w-0">
                                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                                            <Building2 className="h-4 w-4" />
                                        </div>
                                        <div className="truncate">
                                            <div className="text-xs font-medium leading-tight truncate">
                                                {branch.name}
                                            </div>
                                            <div className="text-[10px] text-slate-400 flex items-center space-x-2 mt-0.5">
                                                {branch.students_count !== undefined && (
                                                    <span>👥 {branch.students_count} alumnos</span>
                                                )}
                                                {branch.courses_count !== undefined && (
                                                    <span>📚 {branch.courses_count} cursos</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {isSelected && <Check className="h-4 w-4 text-emerald-500 shrink-0 ml-2" />}
                                </button>
                            );
                        })}

                        {branches.length === 0 && (
                            <div className="py-4 text-center text-xs text-slate-400">
                                No se encontraron sedes activas.
                            </div>
                        )}
                    </div>

                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                    {/* Manage Branches Link */}
                    <div className="p-1">
                        <Link
                            to="/branches"
                            onClick={() => setIsOpen(false)}
                            className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-brand-teal hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                        >
                            <Settings className="h-3.5 w-3.5" />
                            <span>Administrar Sedes y Sucursales</span>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchSwitcher;
