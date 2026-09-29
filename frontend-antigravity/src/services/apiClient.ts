import axios from 'axios';

// Stitch: API Client & Cache Layer
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor (Auth Token & Multi-Branch Scoping)
api.interceptors.request.use((config: any) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
    }

    const branchId = localStorage.getItem('selected_branch_id');
    if (branchId && branchId !== 'all' && branchId !== 'undefined') {
        config.headers = config.headers || {};
        config.headers['X-Branch-Id'] = branchId;
    }

    return config;
});

// Response Interceptor (Error Handling)
api.interceptors.response.use(
    (response: any) => response,
    (error: any) => {
        const isLoginRequest = error.config?.url?.includes('/auth/login');
        const errorCode = error.response?.data?.code;

        // Revocación inmediata: Cuenta desactivada por administración
        if (error.response?.status === 403 && errorCode === 'ACCOUNT_DEACTIVATED') {
            localStorage.clear();
            window.location.href = '/login?reason=deactivated';
            return Promise.reject(error);
        }

        // Modo Mantenimiento o Portal Deshabilitado por Gobernanza
        if ((error.response?.status === 503 || error.response?.status === 403) && (errorCode === 'MAINTENANCE_MODE' || errorCode === 'PORTAL_DISABLED')) {
            const msg = error.response?.data?.message || '';
            if (msg) sessionStorage.setItem('maintenance_message', msg);
            localStorage.clear();
            const reason = errorCode === 'MAINTENANCE_MODE' ? 'maintenance' : 'portal_disabled';
            window.location.href = `/login?reason=${reason}`;
            return Promise.reject(error);
        }

        // Sesión expirada o no autorizada
        if (error.response?.status === 401 && !isLoginRequest) {
            localStorage.clear();
            const reason = errorCode === 'TOKEN_EXPIRED' ? 'session_expired' : 'unauthorized';
            window.location.href = `/login?reason=${reason}`;
            return Promise.reject(error);
        }

        return Promise.reject(error);
    }
);

export default api;
