import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SearchableOption {
    value: string;
    label: string;
    subLabel?: string;
    badge?: string;
}

interface SearchableSelectProps {
    options: SearchableOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
    options, 
    value, 
    onChange, 
    placeholder = 'Seleccione una opción...', 
    searchPlaceholder = 'Buscar...',
    required = false,
    disabled = false,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    // Cerrar al hacer click afuera
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Foco en el buscador al abrir
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        } else {
            setSearchTerm(''); // Limpiar búsqueda al cerrar
        }
    }, [isOpen]);

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (opt.badge && opt.badge.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className={`relative ${isOpen ? 'z-[100]' : 'z-10'} ${className}`} ref={containerRef}>
            {required && <input type="text" value={value} readOnly className="absolute opacity-0 pointer-events-none w-full h-full -z-10" required tabIndex={-1} />}

            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-4 py-3 bg-white/70 dark:bg-slate-900/80 border ${
                    isOpen 
                        ? 'border-brand-blue ring-4 ring-brand-blue/20 dark:border-blue-500' 
                        : 'border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                } rounded-xl text-left transition-all backdrop-blur-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                <div className="flex items-center space-x-2 truncate flex-1 mr-2">
                    {selectedOption ? (
                        <div className="truncate flex items-center gap-2">
                            <span className="font-semibold text-slate-800 dark:text-white truncate">
                                {selectedOption.label}
                            </span>
                            {selectedOption.badge && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20 shrink-0">
                                    {selectedOption.badge}
                                </span>
                            )}
                            {selectedOption.subLabel && (
                                <span className="text-xs text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
                                    ({selectedOption.subLabel})
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-slate-400 dark:text-slate-500 truncate text-sm">
                            {placeholder}
                        </span>
                    )}
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                    {selectedOption && !disabled && (
                        <span
                            role="button"
                            aria-label="Limpiar selección"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-[110] left-0 right-0 w-full mt-2 bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl shadow-black/80 border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
                                placeholder={searchPlaceholder}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {options.length > 5 && (
                            <div className="flex justify-between items-center px-1 pt-2 text-[11px] text-slate-400 font-medium">
                                <span>Filtrando opciones</span>
                                <span>{filteredOptions.length} de {options.length}</span>
                            </div>
                        )}
                    </div>
                    <ul className="max-h-60 overflow-y-auto p-1.5 space-y-1 bg-white dark:bg-[#0f172a] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                        {filteredOptions.length === 0 ? (
                            <li className="px-4 py-6 text-sm text-slate-400 text-center flex flex-col items-center justify-center">
                                <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2 stroke-1" />
                                <span>No se encontraron coincidencias</span>
                                {searchTerm && <span className="text-xs text-slate-500 mt-0.5 italic">"{searchTerm}"</span>}
                            </li>
                        ) : (
                            filteredOptions.map((opt) => {
                                const isSelected = value === opt.value;
                                return (
                                    <li
                                        key={opt.value}
                                        onClick={() => {
                                            onChange(opt.value);
                                            setIsOpen(false);
                                        }}
                                        className={`px-3.5 py-2.5 text-sm rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                                            isSelected
                                                ? 'bg-brand-blue/15 text-brand-blue dark:text-blue-400 font-bold border border-brand-blue/20'
                                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex flex-col truncate pr-2">
                                            <span className="truncate">{opt.label}</span>
                                            {opt.subLabel && (
                                                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate font-normal">
                                                    {opt.subLabel}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-2 shrink-0">
                                            {opt.badge && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                                                    {opt.badge}
                                                </span>
                                            )}
                                            {isSelected && <Check className="w-4 h-4 text-brand-blue dark:text-blue-400" />}
                                        </div>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
