import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().min(5, "El nombre de usuario/correo electrónico es muy corto."),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
    full_name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    role: z.enum(['student', 'instructor', 'secretary', 'admin', 'superadmin']),
    phone: z.string().optional(),
    student_id: z.string().uuid("ID de estudiante inválido").optional().nullable().or(z.literal('')),
    branch_id: z.string().uuid("ID de sede inválido").optional().nullable().or(z.literal('')),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    full_name: z.string().min(3, "El nombre debe tener al menos 3 caracteres.").optional(),
    email: z.string().min(5, "El nombre de usuario/correo electrónico es muy corto.").optional(),
    role: z.enum(['student', 'instructor', 'secretary', 'admin', 'superadmin']).optional(),
    phone: z.string().optional(),
    active: z.boolean().optional(),
    student_id: z.string().uuid("ID de estudiante inválido").optional().nullable().or(z.literal('')),
    branch_id: z.string().uuid("ID de sede inválido").optional().nullable().or(z.literal('')),
  }),
});
