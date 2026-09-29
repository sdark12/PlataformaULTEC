import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import axios from 'axios';
import { APP_CONFIG } from '../config/appConfig';

export interface AppVersionInfo {
    version: string;
    versionCode: number;
    minVersion: string;
    releaseDate: string;
    downloadUrl: string;
    fileName: string;
    fileSize: number;
    title: string;
    releaseNotes: string[];
    isCritical: boolean;
}

export interface CheckUpdateResult {
    hasUpdate: boolean;
    currentVersion: string;
    currentVersionCode: number;
    latestVersion: AppVersionInfo | null;
    isNativeAndroid: boolean;
}

export interface DownloadProgressData {
    progress: number; // 0 to 100
    bytesDownloaded: number;
    totalBytes: number;
}

// Interfaz para el plugin nativo de instalación de Android
interface AppUpdaterPluginNative {
    getAppInfo(): Promise<{ versionName: string; versionCode: number; packageName: string }>;
    canRequestPackageInstalls(): Promise<{ canInstall: boolean }>;
    openInstallPermissionSettings(): Promise<{ opened: boolean }>;
    downloadAndInstall(options: { url: string }): Promise<{ success: boolean; filePath: string }>;
    installDownloadedApk(): Promise<{ success?: boolean; needsPermission?: boolean }>;
    addListener(
        eventName: 'downloadProgress',
        listenerFunc: (data: DownloadProgressData) => void
    ): Promise<{ remove: () => Promise<void> }>;
    addListener(
        eventName: 'downloadComplete',
        listenerFunc: (data: { success: boolean; fileSize: number; filePath: string }) => void
    ): Promise<{ remove: () => Promise<void> }>;
    addListener(
        eventName: 'downloadError',
        listenerFunc: (data: { error: string }) => void
    ): Promise<{ remove: () => Promise<void> }>;
}

const AppUpdater = registerPlugin<AppUpdaterPluginNative>('AppUpdater');

/**
 * Compara dos versiones semánticas (ej. "1.0.5" vs "1.0.4")
 * Retorna > 0 si v1 > v2, < 0 si v1 < v2, 0 si son iguales
 */
export function compareSemver(v1: string, v2: string): number {
    const clean = (s: string) => (s || '0').trim().toLowerCase().replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const parts1 = clean(v1);
    const parts2 = clean(v2);
    const len = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < len; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}

/**
 * Obtiene la información de la versión actualmente instalada en el dispositivo
 * Utiliza @capacitor/app oficial en Android nativo y recurre a APP_CONFIG como respaldo sincronizado.
 */
export async function getInstalledAppInfo(): Promise<{ versionName: string; versionCode: number; isNative: boolean }> {
    const isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

    if (isNative) {
        // 1. Intentar con el plugin oficial de Capacitor (@capacitor/app)
        try {
            const appInfo = await App.getInfo();
            if (appInfo && appInfo.version) {
                const cleanVersion = appInfo.version.trim().replace(/^v/, '');
                return {
                    versionName: cleanVersion,
                    versionCode: parseInt(appInfo.build, 10) || APP_CONFIG.buildNumber,
                    isNative: true
                };
            }
        } catch (err) {
            console.warn('No se pudo obtener versión con @capacitor/app:', err);
        }

        // 2. Intentar con AppUpdaterPlugin personalizado
        try {
            const info = await AppUpdater.getAppInfo();
            if (info && info.versionName) {
                const cleanVersion = info.versionName.trim().replace(/^v/, '');
                return {
                    versionName: cleanVersion,
                    versionCode: Number(info.versionCode) || APP_CONFIG.buildNumber,
                    isNative: true
                };
            }
        } catch (err) {
            console.warn('No se pudo obtener versión nativa con AppUpdater:', err);
        }
    }

    // 3. Respaldo centralizado (Web o fallback móvil)
    return {
        versionName: APP_CONFIG.version.trim().replace(/^v/, ''),
        versionCode: APP_CONFIG.buildNumber,
        isNative
    };
}

/**
 * Verifica con el servidor si existe una nueva versión disponible
 */
export async function checkForUpdate(): Promise<CheckUpdateResult> {
    const installed = await getInstalledAppInfo();
    const apiUrl = APP_CONFIG.apiUrl;

    try {
        // Consultar endpoint público de versión del servidor con timestamp para evitar caché
        const response = await axios.get<AppVersionInfo>(`${apiUrl}/api/app-version/latest`, {
            params: { _t: Date.now() },
            timeout: 10000
        });

        const latest = response.data;
        let hasUpdate = false;

        // Regla estricta: Solo alertar si el servidor tiene un número de versión superior
        const isHigherSemver = compareSemver(latest.version, installed.versionName) > 0;
        const isHigherCode = latest.versionCode > installed.versionCode;

        if (installed.isNative) {
            // En Android nativo, debe tener un versionCode mayor o semver mayor
            hasUpdate = isHigherCode || isHigherSemver;
        } else {
            // En web, evaluar por semver
            hasUpdate = isHigherSemver;
        }

        // CANDADO DE SEGURIDAD:
        // Si la versión instalada es IGUAL o MAYOR a la del servidor, NUNCA mostrar que hay actualización
        if (compareSemver(installed.versionName, latest.version) >= 0 && installed.versionCode >= latest.versionCode) {
            hasUpdate = false;
        }

        return {
            hasUpdate,
            currentVersion: installed.versionName,
            currentVersionCode: installed.versionCode,
            latestVersion: latest,
            isNativeAndroid: installed.isNative
        };
    } catch (error) {
        console.error('Error al verificar actualización en el servidor:', error);
        return {
            hasUpdate: false,
            currentVersion: installed.versionName,
            currentVersionCode: installed.versionCode,
            latestVersion: null,
            isNativeAndroid: installed.isNative
        };
    }
}

/**
 * Verifica si Android permite la instalación de apps desde fuentes desconocidas
 */
export async function canInstallUnknownApps(): Promise<boolean> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        return true;
    }
    try {
        const res = await AppUpdater.canRequestPackageInstalls();
        return res.canInstall;
    } catch {
        return true;
    }
}

/**
 * Abre los ajustes de Android para habilitar la instalación de la app
 */
export async function openInstallSettings(): Promise<void> {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        await AppUpdater.openInstallPermissionSettings();
    }
}

/**
 * Inicia la descarga e instalación del APK nativo con reporte de progreso
 */
export async function startNativeUpdate(
    downloadUrl: string,
    onProgress: (progress: DownloadProgressData) => void
): Promise<{ success: boolean }> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
        // En navegador web, descargar archivo directamente
        window.open(downloadUrl, '_blank');
        return { success: true };
    }

    let progressListener: { remove: () => Promise<void> } | null = null;

    try {
        progressListener = await AppUpdater.addListener('downloadProgress', (data) => {
            onProgress(data);
        });

        await AppUpdater.downloadAndInstall({ url: downloadUrl });
        return { success: true };
    } finally {
        if (progressListener) {
            await progressListener.remove();
        }
    }
}

/**
 * Reintenta lanzar el instalador si el archivo ya fue descargado
 */
export async function retryLaunchInstaller(): Promise<{ success?: boolean; needsPermission?: boolean }> {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        return await AppUpdater.installDownloadedApk();
    }
    return { success: true };
}
