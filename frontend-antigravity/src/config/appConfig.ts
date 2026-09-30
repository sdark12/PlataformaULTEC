/**
 * Configuración centralizada de versión y metadatos de la aplicación
 * Fuente única de la verdad sincronizada con package.json, build.gradle y el servidor VPS.
 */
export const APP_CONFIG = {
    appName: 'Plataforma ULTEC',
    version: '1.1.23',
    buildNumber: 33,
    releaseDate: '2026-09-29',
    apiUrl: import.meta.env.VITE_API_URL || 'https://plataformaultec.duckdns.org',

    apkDownloadUrl: 'https://plataformaultec.duckdns.org/downloads/PlataformaULTEC.apk'
};
