import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(5, "El nombre de usuario/correo electrónico es muy corto."),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
  }),
});

export const adminResetPasswordSchema = z.object({
  body: z.object({
    userId: z.string().uuid("ID de usuario inválido."),
    newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres."),
  }),
});
