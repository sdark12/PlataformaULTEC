import { useState, useEffect } from 'react';

/**
 * Hook para retrasar la actualización de un valor hasta que haya pasado un tiempo sin cambios.
 * Ideal para optimizar inputs de búsqueda y evitar ráfagas de peticiones al servidor.
 * 
 * @param value Valor a debouncificar
 * @param delay Retardo en milisegundos (por defecto 300ms)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export default useDebounce;
