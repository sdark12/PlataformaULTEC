import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

const initTransporter = async () => {
    if (transporter) return transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    } else {
        // Fallback for local testing
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.log('Testing Email Service Initialized. Using Ethereal: ', testAccount.user);
    }
    return transporter;
};

export const sendPasswordResetEmail = async (to: string, resetToken: string) => {
    try {
        const t = await initTransporter();
        
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

        const info = await t.sendMail({
            from: '"Ultra Tecnología" <soporte@ultratecnologia.edu>',
            to,
            subject: 'Recuperación de Contraseña',
            html: `
                <div style="font-family: Arial, sans-serif; max-w-width: 600px; margin: 0 auto; color: #333;">
                    <h2 style="color: #0d59f2;">Recuperación de Contraseña</h2>
                    <p>Has solicitado restablecer tu contraseña en Ultra Tecnología. Haz clic en el siguiente enlace para crear una nueva:</p>
                    <div style="margin: 30px 0;">
                        <a href="${resetLink}" style="padding: 12px 24px; background-color: #0d59f2; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Restablecer Contraseña</a>
                    </div>
                    <p>Si no fuiste tú, puedes ignorar este correo de forma segura.</p>
                </div>
            `,
        });

        console.log('Message sent: %s', info.messageId);
        if (info.messageId && !process.env.SMTP_HOST) {
            console.log('➡️ PREVIEW URL (Click to view email): %s', nodemailer.getTestMessageUrl(info));
        }
        
        return info;
    } catch (error) {
        console.error('Email sending failed:', error);
        throw error;
    }
};

export const sendPaymentConfirmationEmail = async (
    to: string, 
    studentName: string, 
    amount: number, 
    invoiceNumber: string,
    description: string
) => {
    try {
        const t = await initTransporter();

        const info = await t.sendMail({
            from: '"Ultra Tecnología" <soporte@ultratecnologia.edu>',
            to,
            subject: `Confirmación de Pago - Recibo ${invoiceNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #0d59f2; margin: 0;">¡Pago Confirmado!</h1>
                    </div>
                    
                    <p>Estimado(a) <strong>${studentName}</strong>,</p>
                    <p>Hemos recibido satisfactoriamente su más reciente pago. A continuación, un resumen de su transacción:</p>
                    
                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 5px 0; color: #475569;"><strong>No. de Recibo:</strong></td>
                                <td style="text-align: right; font-weight: bold; color: #1e293b;">${invoiceNumber}</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 0; color: #475569;"><strong>Concepto:</strong></td>
                                <td style="text-align: right; color: #1e293b;">${description}</td>
                            </tr>
                            <tr>
                                <td style="padding: 5px 0; color: #475569;"><strong>Monto Total:</strong></td>
                                <td style="text-align: right; font-weight: bold; font-size: 1.1em; color: #0d59f2;">Q.${amount.toFixed(2)}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <p style="color: #64748b; font-size: 0.9em;">Este es un mensaje generado automáticamente. El recibo oficial se encuentra disponible en su portal en cualquier momento.</p>
                    <p>Gracias por confiar en nosotros,</p>
                    <p><strong>El Equipo de Administración</strong></p>
                </div>
            `,
        });

        console.log('Payment Email sent: %s to %s', info.messageId, to);
        if (info.messageId && !process.env.SMTP_HOST) {
            console.log('➡️ PREVIEW URL (Payment): %s', nodemailer.getTestMessageUrl(info));
        }
        return info;
    } catch (error) {
        console.error('Error al enviar el correo de confirmación de pago:', error);
        return null;
    }
};

export const sendWelcomeEmail = async (
    to: string,
    fullName: string,
    role: string,
    temporalPassword?: string
) => {
    try {
        const t = await initTransporter();
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        
        const roleLabel = role === 'student' ? 'Estudiante' 
                        : role === 'instructor' ? 'Instructor(a)' 
                        : role === 'secretary' ? 'Secretario(a)' 
                        : 'Administrador(a)';

        const passSection = temporalPassword 
            ? `<div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
                 <p style="margin: 0; color: #475569; font-size: 0.9em;">Tu Contraseña Temporal:</p>
                 <p style="margin: 5px 0 0 0; font-size: 1.5em; font-weight: bold; font-family: monospace; letter-spacing: 2px; color: #0f172a;">${temporalPassword}</p>
                 <p style="margin: 10px 0 0 0; color: #ef4444; font-size: 0.8em;">Por seguridad, te recomendamos cambiarla en tu primer inicio de sesión.</p>
               </div>`
            : '';

        const info = await t.sendMail({
            from: '"Ultra Tecnología" <soporte@ultratecnologia.edu>',
            to,
            subject: '¡Bienvenido(a) a Insforge Campus!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #0d59f2; margin: 0;">¡Hola ${fullName}!</h1>
                    </div>
                    
                    <p>Nos emociona darte la bienvenida a nuestra plataforma. Tu cuenta ha sido configurada con acceso de <strong>${roleLabel}</strong>.</p>
                    
                    ${passSection}
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${frontendUrl}/login" style="padding: 12px 24px; background-color: #0d59f2; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Acceder a mi Cuenta</a>
                    </div>
                    
                    <p style="color: #64748b; font-size: 0.9em;">Si tienes alguna pregunta o problema para acceder, por favor contacta a la administración.</p>
                    <p><strong>El Equipo de Ultra Tecnología</strong></p>
                </div>
            `,
        });

        console.log('Welcome Email sent: %s to %s', info.messageId, to);
        if (info.messageId && !process.env.SMTP_HOST) {
            console.log('➡️ PREVIEW URL (Welcome): %s', nodemailer.getTestMessageUrl(info));
        }
        return info;
    } catch (error) {
        console.error('Error al enviar el correo de bienvenida:', error);
        return null; // Silent catch
    }
};

export const verifySmtpConnection = async (): Promise<{ ok: boolean; message: string; host?: string; port?: number }> => {
    try {
        const t = await initTransporter();
        await t.verify();
        return {
            ok: true,
            message: 'Conexión SMTP activa y autenticada correctamente.',
            host: process.env.SMTP_HOST || 'smtp.ethereal.email (Modo Pruebas)',
            port: Number(process.env.SMTP_PORT) || 587
        };
    } catch (error: any) {
        return {
            ok: false,
            message: error.message || 'Error al conectar con el servidor SMTP',
            host: process.env.SMTP_HOST || 'Desconocido',
            port: Number(process.env.SMTP_PORT) || 587
        };
    }
};

export const sendTestEmail = async (to: string): Promise<{ ok: boolean; messageId?: string; previewUrl?: string; error?: string }> => {
    try {
        const t = await initTransporter();
        const info = await t.sendMail({
            from: '"Ultra Tecnología" <soporte@ultratecnologia.edu>',
            to,
            subject: 'Prueba de Conexión SMTP - Plataforma ULTEC',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <div style="background: linear-gradient(135deg, #0d59f2, #10b981); padding: 24px; text-align: center; color: white;">
                        <h1 style="margin: 0; font-size: 22px; font-weight: bold;">Plataforma ULTEC</h1>
                        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Diagnóstico Oficial del Servidor de Correo</p>
                    </div>
                    <div style="padding: 24px; color: #1e293b; background-color: #ffffff;">
                        <h2 style="font-size: 16px; color: #0f172a; margin-top: 0;">¡Conexión SMTP Exitosa!</h2>
                        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                            Este correo de prueba confirma que el servicio de mensajería y notificaciones de <strong>Plataforma ULTEC</strong> está configurado y funcionando correctamente.
                        </p>
                        <div style="background-color: #f8fafc; border-left: 4px solid #10b981; border-radius: 0 8px 8px 0; padding: 14px 18px; margin: 20px 0; font-size: 13px; line-height: 1.6;">
                            <div><strong>Servidor SMTP:</strong> ${process.env.SMTP_HOST || 'smtp.ethereal.email (Pruebas)'}</div>
                            <div><strong>Puerto:</strong> ${process.env.SMTP_PORT || '587'}</div>
                            <div><strong>Destinatario de prueba:</strong> ${to}</div>
                            <div><strong>Fecha de verificación:</strong> ${new Date().toLocaleString()}</div>
                        </div>
                        <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
                            Las notificaciones automáticas de credenciales a nuevos alumnos, restablecimiento de contraseña y avisos académicos están operativas.
                        </p>
                    </div>
                </div>
            `
        });

        let previewUrl: string | undefined;
        if (info.messageId && !process.env.SMTP_HOST) {
            previewUrl = nodemailer.getTestMessageUrl(info) || undefined;
        }

        return { ok: true, messageId: info.messageId, previewUrl };
    } catch (error: any) {
        return { ok: false, error: error.message || 'Error al enviar el correo de prueba' };
    }
};

