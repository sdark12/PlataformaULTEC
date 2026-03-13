import { z } from 'zod';

export const createCourseSchema = z.object({
  body: z.object({
    name: z.string().min(3, "El nombre del curso debe tener al menos 3 caracteres."),
    description: z.string().optional().nullable(),
    monthly_fee: z.number().min(0, "La mensualidad no puede ser negativa."),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    branch_id: z.string().uuid("ID de sede inválido").optional().nullable(),
  }),
});

export const updateCourseSchema = z.object({
  body: z.object({
    name: z.string().min(3, "El nombre del curso debe tener al menos 3 caracteres.").optional(),
    description: z.string().optional().nullable(),
    monthly_fee: z.number().min(0, "La mensualidad no puede ser negativa.").optional(),
    is_active: z.boolean().optional(),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
  }),
});

export const createCourseScheduleSchema = z.object({
  body: z.object({
    grade: z.string().min(1, "El grado/sección es requerido."),
    day_of_week: z.string().min(1, "El día de la semana es requerido."),
    start_time: z.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)$/, "Hora de inicio inválida (HH:MM)."),
    end_time: z.string().regex(/^([01]\d|2[0-3]):?([0-5]\d)$/, "Hora de fin inválida (HH:MM)."),
  }),
});

export const createStudentSchema = z.object({
  body: z.object({
    full_name: z.string().min(3, "El nombre completo debe tener al menos 3 caracteres."),
    birth_date: z.string().optional().nullable(),
    gender: z.string().optional().nullable(),
    identification_document: z.string().optional().nullable(),
    nationality: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    guardian_name: z.string().optional().nullable(),
    guardian_phone: z.string().optional().nullable(),
    guardian_email: z.string().optional().nullable(),
    guardian_relationship: z.string().optional().nullable(),
    emergency_contact_name: z.string().optional().nullable(),
    emergency_contact_phone: z.string().optional().nullable(),
    medical_notes: z.string().optional().nullable(),
    previous_school: z.string().optional().nullable(),
    personal_code: z.string().optional().nullable(),
    user_id: z.string().uuid("ID de usuario inválido").optional().nullable().or(z.literal('')),
    branch_id: z.string().uuid("ID de sede inválido").optional().nullable(),
  }),
});

export const updateStudentSchema = z.object({
  body: z.object({
    full_name: z.string().min(3).optional(),
    birth_date: z.string().optional().nullable(),
    gender: z.string().optional().nullable(),
    identification_document: z.string().optional().nullable(),
    nationality: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    guardian_name: z.string().optional().nullable(),
    guardian_phone: z.string().optional().nullable(),
    guardian_email: z.string().optional().nullable(),
    guardian_relationship: z.string().optional().nullable(),
    emergency_contact_name: z.string().optional().nullable(),
    emergency_contact_phone: z.string().optional().nullable(),
    medical_notes: z.string().optional().nullable(),
    previous_school: z.string().optional().nullable(),
    personal_code: z.string().optional().nullable(),
    user_id: z.string().uuid("ID de usuario inválido").optional().nullable().or(z.literal('')),
  }),
});
