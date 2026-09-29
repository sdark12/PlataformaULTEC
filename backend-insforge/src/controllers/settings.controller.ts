import { Request, Response } from 'express';
import { adminClient } from '../config/insforge';
import { verifySmtpConnection, sendTestEmail } from '../services/email.service';

// ─── In-memory cache ───
let settingsCache: Record<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Superadmin-only settings:
 * Regular admins cannot alter these critical global, academic, or financial parameters.
 */
export const SUPERADMIN_ONLY_SETTINGS = new Set<string>([
    // Accesos y Gobernanza
    'allow_student_portal',
    'allow_parent_portal',
    'system_maintenance_mode',
    'system_maintenance_message',

    // Parámetros Académicos Centrales
    'total_grade_units',
    'grade_unit_names',
    'grade_unit_cutoff_months',
    'default_course_duration_months',
    'minimum_passing_grade',
    'allow_instructor_grade_edits',

    // Reglas Financieras Críticas
    'default_currency_symbol',
    'grace_period_days',
    'late_fee_percentage',
    'restrict_grades_by_payment',
    'restrict_future_payments_if_debt',
]);

/**
 * Human-readable labels for settings diff presentation in audit logs.
 */
export const SETTING_LABELS: Record<string, string> = {
    institution_name: 'Nombre de la Institución',
    institution_phone: 'Teléfono Institucional',
    institution_email: 'Email Institucional',
    institution_address: 'Dirección Institucional',
    institution_logo_url: 'Logo Institucional',
    institution_seal_url: 'Sello / Firma de Dirección',
    total_grade_units: 'Total de Unidades Evaluativas',
    grade_unit_names: 'Nombres de Unidades',
    grade_unit_cutoff_months: 'Meses de Corte por Unidad',
    default_course_duration_months: 'Duración Estándar de Cursos (Meses)',
    minimum_passing_grade: 'Nota Mínima de Aprobación',
    allow_instructor_grade_edits: 'Permitir Edición de Notas a Docentes',
    restrict_grades_by_payment: 'Restringir Boletas por Pago',
    restrict_future_payments_if_debt: 'Bloquear Pagos Futuros si hay Deuda',
    grace_period_days: 'Días de Gracia para Pagos',
    late_fee_percentage: 'Porcentaje de Mora Mensual',
    allow_student_portal: 'Habilitar Portal de Estudiantes',
    allow_parent_portal: 'Habilitar Portal de Padres de Familia',
    default_currency_symbol: 'Símbolo de Moneda',
    system_maintenance_mode: 'Modo Mantenimiento del Sistema',
    system_maintenance_message: 'Mensaje de Modo Mantenimiento',
    merit_points_attendance_present: 'Puntos por Asistencia Puntual',
    merit_points_grade_excellent: 'Puntos por Calificación Excelente (>=90)',
    merit_points_grade_good: 'Puntos por Buena Calificación (>=80)',
    merit_enable_auto_attendance: 'Automatización de Méritos por Asistencia',
    merit_enable_auto_grades: 'Automatización de Méritos por Notas'
};

/**
 * Default settings — used when the DB has no value for a key.
 */
const DEFAULTS: Record<string, string> = {
    // Institution
    institution_name: 'Ultra Tecnología',
    institution_phone: '',
    institution_email: '',
    institution_address: '',
    institution_logo_url: '',
    institution_seal_url: '',

    // Academic
    total_grade_units: '4',
    grade_unit_names: 'Unidad 1,Unidad 2,Unidad 3,Unidad 4',
    grade_unit_cutoff_months: '3,6,8,10',
    default_course_duration_months: '11',
    minimum_passing_grade: '60',
    allow_instructor_grade_edits: 'true',

    // Payment restrictions & rules
    restrict_grades_by_payment: 'true',
    restrict_future_payments_if_debt: 'true',
    grace_period_days: '5',
    late_fee_percentage: '0',

    // General & Portals
    allow_student_portal: 'true',
    allow_parent_portal: 'true',
    default_currency_symbol: 'Q',

    // Governance & Maintenance
    system_maintenance_mode: 'false',
    system_maintenance_message: 'La plataforma se encuentra en mantenimiento programado. Regresaremos en breve.',

    // Gamificación / Méritos
    merit_points_attendance_present: '2',
    merit_points_grade_excellent: '10',
    merit_points_grade_good: '5',
    merit_enable_auto_attendance: 'true',
    merit_enable_auto_grades: 'true',
};

/**
 * Load all settings from DB merged with defaults.
 */
const loadSettings = async (): Promise<Record<string, string>> => {
    const now = Date.now();
    if (settingsCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return settingsCache;
    }

    try {
        const { data, error } = await adminClient
            .from('system_settings')
            .select('key, value');

        if (error) throw error;

        const merged = { ...DEFAULTS };
        data?.forEach((row: any) => {
            merged[row.key] = row.value;
        });

        settingsCache = merged;
        cacheTimestamp = now;
        return merged;
    } catch (err) {
        console.error('Error loading settings, using defaults:', err);
        return { ...DEFAULTS };
    }
};

/**
 * Public helper: get a single setting value (used by other controllers).
 */
export const getSetting = async (key: string): Promise<string> => {
    const settings = await loadSettings();
    return settings[key] ?? DEFAULTS[key] ?? '';
};

/**
 * Public helper: get a boolean setting.
 */
export const getSettingBool = async (key: string): Promise<boolean> => {
    const val = await getSetting(key);
    return val === 'true' || val === '1';
};

/**
 * Public helper: get a number setting.
 */
export const getSettingNumber = async (key: string): Promise<number> => {
    const val = await getSetting(key);
    return Number(val) || 0;
};

// ─── API Endpoints ───

/**
 * GET /api/settings — returns all settings as an object.
 */
export const getSettings = async (_req: Request, res: Response) => {
    try {
        const settings = await loadSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ message: 'Error retrieving settings' });
    }
};

/**
 * GET /api/settings/audit-history — returns recent setting updates with user and DIFF details.
 */
export const getSettingsAuditHistory = async (req: Request, res: Response) => {
    try {
        const userRole = req.currentUser?.role;
        if (!userRole || !['admin', 'superadmin'].includes(userRole)) {
            return res.status(403).json({ message: 'No autorizado' });
        }

        const { data, error } = await adminClient
            .from('audit_logs')
            .select(`
                id,
                user_id,
                action,
                entity,
                entity_id,
                old_data,
                new_data,
                ip_address,
                created_at,
                metadata,
                user:profiles!user_id(id, full_name, email, role)
            `)
            .eq('action', 'SETTINGS_UPDATE')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        res.json(data || []);
    } catch (err: any) {
        console.error('Error fetching settings audit history:', err);
        res.status(500).json({ message: 'Error retrieving settings audit history', error: err?.message });
    }
};

/**
 * PUT /api/settings — bulk update settings.
 * Enforces strict RBAC: only superadmin can modify critical academic, financial, or access parameters.
 * Automatically generates a DIFF audit log.
 */
export const updateSettings = async (req: Request, res: Response) => {
    const role = req.currentUser?.role;
    if (!role || !['admin', 'superadmin'].includes(role)) {
        return res.status(403).json({ message: 'Solo administradores pueden cambiar la configuración' });
    }

    const updates: Record<string, string> = req.body;

    if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ message: 'Invalid payload' });
    }

    try {
        const currentSettings = await loadSettings();
        const isSuperAdmin = role === 'superadmin';

        // 1. RBAC Guard: If user is not superadmin, prevent modifying restricted settings
        if (!isSuperAdmin) {
            for (const key of SUPERADMIN_ONLY_SETTINGS) {
                if (updates[key] !== undefined) {
                    const currentVal = currentSettings[key] !== undefined ? String(currentSettings[key]) : (DEFAULTS[key] ?? '');
                    const incomingVal = String(updates[key]);
                    if (currentVal !== incomingVal) {
                        const label = SETTING_LABELS[key] || key;
                        return res.status(403).json({
                            message: `Acceso restringido: El parámetro "${label}" solo puede ser modificado por un Superadministrador.`
                        });
                    }
                }
            }
        }

        // 2. Calculate DIFF between current and incoming settings
        const diffs: Array<{ key: string; label: string; old_value: string; new_value: string }> = [];
        for (const [key, value] of Object.entries(updates)) {
            const oldVal = currentSettings[key] !== undefined ? String(currentSettings[key]) : (DEFAULTS[key] ?? '');
            const newVal = String(value);
            if (oldVal !== newVal) {
                diffs.push({
                    key,
                    label: SETTING_LABELS[key] || key,
                    old_value: oldVal,
                    new_value: newVal
                });
            }
        }

        // If no settings changed, return early
        if (diffs.length === 0) {
            return res.json(currentSettings);
        }

        // 3. Synchronize evaluative units in grades & subgrade_categories if unit names changed
        if (updates.grade_unit_names !== undefined) {
            const oldUnitNamesStr = await getSetting('grade_unit_names');
            const oldUnitNames = oldUnitNamesStr.split(',').map(s => s.trim()).filter(Boolean);
            const newUnitNames = String(updates.grade_unit_names).split(',').map(s => s.trim()).filter(Boolean);

            for (let i = 0; i < Math.min(oldUnitNames.length, newUnitNames.length); i++) {
                const oldName = oldUnitNames[i];
                const newName = newUnitNames[i];
                if (oldName && newName && oldName !== newName) {
                    console.log(`[settings] Renaming evaluative unit "${oldName}" -> "${newName}" in grades and subgrades`);
                    await adminClient
                        .from('grades')
                        .update({ unit_name: newName })
                        .eq('unit_name', oldName);

                    await adminClient
                        .from('subgrade_categories')
                        .update({ unit_name: newName })
                        .eq('unit_name', oldName);
                }
            }
        }

        // 4. Upsert each modified setting into database
        for (const diff of diffs) {
            const { error } = await adminClient
                .from('system_settings')
                .upsert(
                    { key: diff.key, value: diff.new_value, updated_at: new Date().toISOString() },
                    { onConflict: 'key' }
                );
            if (error) throw error;
        }

        // 5. Invalidate in-memory cache immediately
        settingsCache = null;
        cacheTimestamp = 0;

        // 6. Record detailed DIFF Audit Log
        const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
        const ipAddress = rawIp.replace(/^::ffff:/, '');

        try {
            await adminClient.from('audit_logs').insert([{
                user_id: req.currentUser?.id || null,
                branch_id: req.currentUser?.branch_id || null,
                action: 'SETTINGS_UPDATE',
                entity: 'system_settings',
                entity_id: 'global',
                old_data: { changes: diffs.map(d => ({ key: d.key, label: d.label, value: d.old_value })) },
                new_data: { changes: diffs.map(d => ({ key: d.key, label: d.label, value: d.new_value })) },
                ip_address: ipAddress,
                metadata: {
                    total_changes: diffs.length,
                    changed_keys: diffs.map(d => d.key),
                    user_role: req.currentUser?.role,
                    user_email: req.currentUser?.email
                }
            }]);
            console.log(`[AUDIT] Recorded SETTINGS_UPDATE with ${diffs.length} changes by ${req.currentUser?.email} (${role})`);
        } catch (auditErr) {
            console.error('[AUDIT] Failed to save settings audit log:', auditErr);
        }

        // 7. Return refreshed settings
        const freshSettings = await loadSettings();
        res.json(freshSettings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Error updating settings' });
    }
};

/**
 * POST /api/settings/upload-branding
 * Uploads institutional logo or director's digital seal.
 */
export const uploadBrandingAsset = async (req: Request, res: Response) => {
    const role = req.currentUser?.role;
    if (!role || !['admin', 'superadmin'].includes(role)) {
        return res.status(403).json({ message: 'No autorizado para subir elementos de identidad institucional' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No se subió ningún archivo' });
    }

    const type = req.body.type === 'seal' ? 'seal' : 'logo';
    const key = type === 'seal' ? 'institution_seal_url' : 'institution_logo_url';
    const label = type === 'seal' ? 'Sello / Firma de Dirección' : 'Logo Institucional';
    const fileUrl = `/api/uploads/${req.file.filename}`;

    try {
        const currentSettings = await loadSettings();
        const oldVal = currentSettings[key] || '';

        const { error } = await adminClient
            .from('system_settings')
            .upsert(
                { key, value: fileUrl, updated_at: new Date().toISOString() },
                { onConflict: 'key' }
            );

        if (error) throw error;

        // Invalidate cache
        settingsCache = null;
        cacheTimestamp = 0;

        // Audit Log
        const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
        const ipAddress = rawIp.replace(/^::ffff:/, '');

        try {
            await adminClient.from('audit_logs').insert([{
                user_id: req.currentUser?.id || null,
                branch_id: req.currentUser?.branch_id || null,
                action: 'SETTINGS_UPDATE',
                entity: 'system_settings',
                entity_id: key,
                old_data: { [key]: oldVal },
                new_data: { [key]: fileUrl },
                ip_address: ipAddress,
                metadata: {
                    type,
                    label,
                    filename: req.file.filename,
                    user_email: req.currentUser?.email
                }
            }]);
        } catch (auditErr) {
            console.error('[AUDIT] Error logging branding upload:', auditErr);
        }

        res.json({
            ok: true,
            key,
            url: fileUrl,
            message: `${label} actualizado exitosamente.`
        });
    } catch (err: any) {
        console.error('Error updating branding asset:', err);
        res.status(500).json({ message: 'Error al guardar la imagen institucional', error: err?.message });
    }
};

/**
 * GET /api/settings/smtp-status
 * Checks the live connectivity and authentication state of the SMTP server.
 */
export const getSmtpStatus = async (req: Request, res: Response) => {
    const role = req.currentUser?.role;
    if (!role || !['admin', 'superadmin'].includes(role)) {
        return res.status(403).json({ message: 'No autorizado' });
    }

    try {
        const status = await verifySmtpConnection();
        res.json(status);
    } catch (err: any) {
        console.error('Error checking SMTP status:', err);
        res.status(500).json({ ok: false, message: err?.message || 'Error al comprobar servidor SMTP' });
    }
};

/**
 * POST /api/settings/test-email
 * Sends a live diagnostic test email. SuperAdmin only.
 */
export const testEmailDiagnostic = async (req: Request, res: Response) => {
    const role = req.currentUser?.role;
    if (role !== 'superadmin') {
        return res.status(403).json({ message: 'Solo superadministradores pueden ejecutar pruebas del servidor de correo' });
    }

    const recipient = (req.body.recipientEmail || req.currentUser?.email || '').trim();
    if (!recipient || !recipient.includes('@')) {
        return res.status(400).json({ message: 'Dirección de correo electrónico inválida' });
    }

    try {
        const result = await sendTestEmail(recipient);
        if (!result.ok) {
            return res.status(500).json({ ok: false, message: result.error || 'Error al enviar correo de prueba' });
        }

        res.json({
            ok: true,
            message: `Correo de prueba enviado exitosamente a ${recipient}`,
            messageId: result.messageId,
            previewUrl: result.previewUrl
        });
    } catch (err: any) {
        console.error('Error in testEmailDiagnostic:', err);
        res.status(500).json({ ok: false, message: err?.message || 'Error interno al procesar correo de prueba' });
    }
};

