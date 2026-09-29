import { z } from 'zod';
import { validatePasswordPolicy } from '../utils/passwordPolicy';

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().min(5, "El nombre de usuario/correo electrónico es muy corto."),
    password: z.string().superRefine((val, ctx) => {
      const res = validatePasswordPolicy(val);
      if (!res.isValid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Contraseña no segura: ${res.errors.join(' ')}`
        });
      }
    }),
    full_name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    role: z.enum(['student', 'instructor', 'secretary', 'admin', 'superadmin', 'parent']),
    phone: z.string().optional(),
    student_id: z.string().uuid("ID de estudiante inválido").optional().nullable().or(z.literal('')),
    branch_id: z.string().uuid("ID de sede inválido").optional().nullable().or(z.literal('')),
    student_links: z.array(z.object({
      student_id: z.string(),
      relationship: z.string().optional()
    })).optional().nullable(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    full_name: z.string().min(3, "El nombre debe tener al menos 3 caracteres.").optional(),
    email: z.string().min(5, "El nombre de usuario/correo electrónico es muy corto.").optional(),
    role: z.enum(['student', 'instructor', 'secretary', 'admin', 'superadmin', 'parent']).optional(),
    phone: z.string().optional(),
    active: z.boolean().optional(),
    student_id: z.string().uuid("ID de estudiante inválido").optional().nullable().or(z.literal('')),
    branch_id: z.string().uuid("ID de sede inválido").optional().nullable().or(z.literal('')),
    student_links: z.array(z.object({
      student_id: z.string(),
      relationship: z.string().optional()
    })).optional().nullable(),
  }),
});
