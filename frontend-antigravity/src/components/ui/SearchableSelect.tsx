import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder = 'Seleccione una opción...', required = false }) => {
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
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative" ref={containerRef}>
            {/* Input oculto para que el atributo "required" nativo del form funcione si no ha seleccionado nada */}
            {required && <input type="text" value={value} readOnly className="absolute opacity-0 pointer-events-none w-full h-full -z-10" required />}

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-4 py-3 bg-slate-50 border ${isOpen ? 'border-brand-blue ring-4 ring-brand-blue/10' : 'border-slate-200'} rounded-xl text-left transition-all hover:bg-slate-100 focus:outline-none`}
            >
                <span className={`block truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-blue transition-colors placeholder:text-slate-400"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <ul className="max-h-60 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        {filteredOptions.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-slate-500 text-center">No se encontraron resultados</li>
                        ) : (
                            filteredOptions.map((opt) => (
                                <li
                                    key={opt.value}
                                    onClick={() => {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                    }}
                                    className={`px-4 py-2.5 text-sm rounded-lg cursor-pointer flex items-center justify-between transition-colors ${value === opt.value
                                            ? 'bg-brand-blue/10 text-brand-blue font-bold'
                                            : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    {opt.label}
                                    {value === opt.value && <Check className="w-4 h-4 text-brand-blue" />}
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
