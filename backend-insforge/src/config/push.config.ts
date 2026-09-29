/**
 * Configuración Criptográfica VAPID para Web Push Notifications
 * Estándar W3C Web Push RFC 8292
 */
export const PUSH_CONFIG = {
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || 'BN8wAlZKsX8WetKHkUQsDw9s5r0QLPQLR3hZep6b_326BXwF08jV-j0w_AhTd83LeZQzwV6TEwhbe1P-cyeWOlQ',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || 'aQT28GsyrsNMTAZcVuI3Xq1ohW-EFz5ykfMOuU_Hwk0',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:soporte@plataformaultec.duckdns.org'
};
