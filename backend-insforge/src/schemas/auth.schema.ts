import { z } from 'zod';
import { validatePasswordPolicy } from '../utils/passwordPolicy';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(5, "El nombre de usuario/correo electrónico es muy corto."),
    password: z.string().min(1, "La contraseña es requerida."),
  }),
});

export const adminResetPasswordSchema = z.object({
  body: z.object({
    userId: z.string().uuid("ID de usuario inválido."),
    newPassword: z.string().superRefine((val, ctx) => {
      const res = validatePasswordPolicy(val);
      if (!res.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Contraseña no segura: ${res.errors.join(' ')}`
        });
      }
    }),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "La contraseña actual es requerida."),
    newPassword: z.string().superRefine((val, ctx) => {
      const res = validatePasswordPolicy(val);
      if (!res.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Contraseña no segura: ${res.errors.join(' ')}`
        });
      }
    }),
  }),
});
