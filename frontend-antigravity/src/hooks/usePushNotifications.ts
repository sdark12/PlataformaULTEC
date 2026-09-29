import { useState, useEffect, useCallback } from 'react';
import { pushNotificationService } from '../services/pushNotificationService';

export const usePushNotifications = () => {
    const isSupported = pushNotificationService.isSupported();
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
    const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isActionPending, setIsActionPending] = useState<boolean>(false);

    const checkStatus = useCallback(async () => {
        if (!isSupported) {
            setPermission('unsupported');
            setIsSubscribed(false);
            setIsLoading(false);
            return;
        }

        const perm = pushNotificationService.getPermissionState();
        setPermission(perm);

        const sub = await pushNotificationService.isSubscribed();
        setIsSubscribed(sub);
        setIsLoading(false);
    }, [isSupported]);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    const subscribe = async (): Promise<{ success: boolean; message: string }> => {
        setIsActionPending(true);
        try {
            const res = await pushNotificationService.subscribe();
            await checkStatus();
            return res;
        } finally {
            setIsActionPending(false);
        }
    };

    const unsubscribe = async (): Promise<{ success: boolean; message: string }> => {
        setIsActionPending(true);
        try {
            const res = await pushNotificationService.unsubscribe();
            await checkStatus();
            return res;
        } finally {
            setIsActionPending(false);
        }
    };

    const sendTest = async (): Promise<{ success: boolean; message: string }> => {
        setIsActionPending(true);
        try {
            return await pushNotificationService.sendTestPush();
        } finally {
            setIsActionPending(false);
        }
    };

    return {
        isSupported,
        permission,
        isSubscribed,
        isLoading,
        isActionPending,
        subscribe,
        unsubscribe,
        sendTest,
        refreshStatus: checkStatus
    };
};
