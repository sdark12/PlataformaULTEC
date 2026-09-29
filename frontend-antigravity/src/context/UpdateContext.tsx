import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
    type AppVersionInfo, 
    checkForUpdate, 
    getInstalledAppInfo 
} from '../services/updaterService';
import { APP_CONFIG } from '../config/appConfig';
import { AppUpdateModal } from '../components/common/AppUpdateModal';
import { UpdateBanner } from '../components/common/UpdateBanner';

interface UpdateContextType {
    hasUpdate: boolean;
    currentVersion: string;
    currentVersionCode: number;
    latestVersion: AppVersionInfo | null;
    isNativeAndroid: boolean;
    isChecking: boolean;
    lastChecked: Date | null;
    checkUpdates: (manual?: boolean) => Promise<boolean>;
    openUpdateModal: () => void;
    closeUpdateModal: () => void;
}

const UpdateContext = createContext<UpdateContextType | undefined>(undefined);

export const UpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hasUpdate, setHasUpdate] = useState(false);
    const [currentVersion, setCurrentVersion] = useState(APP_CONFIG.version);
    const [currentVersionCode, setCurrentVersionCode] = useState(APP_CONFIG.buildNumber);
    const [latestVersion, setLatestVersion] = useState<AppVersionInfo | null>(null);
    const [isNativeAndroid, setIsNativeAndroid] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showBanner, setShowBanner] = useState(false);

    // Inicializar y verificar versión
    const runCheck = async (manual = false): Promise<boolean> => {
        setIsChecking(true);
        try {
            const installed = await getInstalledAppInfo();
            setCurrentVersion(installed.versionName);
            setCurrentVersionCode(installed.versionCode);
            setIsNativeAndroid(installed.isNative);

            const result = await checkForUpdate();
            setHasUpdate(result.hasUpdate);
            setLatestVersion(result.latestVersion);
            setLastChecked(new Date());

            if (result.hasUpdate) {
                if (manual) {
                    setIsModalOpen(true);
                } else {
                    // Si es automática, mostrar banner (a menos que sea crítica)
                    if (result.latestVersion?.isCritical) {
                        setIsModalOpen(true);
                    } else {
                        setShowBanner(true);
                    }
                }
                return true;
            } else {
                if (manual) {
                    // Opcional: el llamador puede mostrar toast de que está al día
                }
                return false;
            }
        } catch (err) {
            console.error('Error al comprobar actualizaciones:', err);
            return false;
        } finally {
            setIsChecking(false);
        }
    };

    useEffect(() => {
        // Verificar 2 segundos después de montar la aplicación
        const timer = setTimeout(() => {
            runCheck(false);
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    const openUpdateModal = () => {
        setShowBanner(false);
        setIsModalOpen(true);
    };

    const closeUpdateModal = () => {
        setIsModalOpen(false);
    };

    return (
        <UpdateContext.Provider
            value={{
                hasUpdate,
                currentVersion,
                currentVersionCode,
                latestVersion,
                isNativeAndroid,
                isChecking,
                lastChecked,
                checkUpdates: runCheck,
                openUpdateModal,
                closeUpdateModal
            }}
        >
            {children}

            {/* Banner flotante de actualización */}
            {showBanner && latestVersion && hasUpdate && (
                <UpdateBanner
                    versionInfo={latestVersion}
                    onOpenModal={openUpdateModal}
                    onDismiss={() => setShowBanner(false)}
                />
            )}

            {/* Modal de descarga e instalación */}
            <AppUpdateModal
                isOpen={isModalOpen}
                onClose={closeUpdateModal}
                versionInfo={latestVersion}
                currentVersion={currentVersion}
                isNativeAndroid={isNativeAndroid}
                hasUpdate={hasUpdate}
                onCheckAgain={() => runCheck(true)}
                isChecking={isChecking}
            />
        </UpdateContext.Provider>
    );
};

export const useAppUpdate = () => {
    const context = useContext(UpdateContext);
    if (!context) {
        throw new Error('useAppUpdate debe ser utilizado dentro de un UpdateProvider');
    }
    return context;
};
