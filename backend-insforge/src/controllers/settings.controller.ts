import { Request, Response } from 'express';
import { adminClient } from '../config/insforge';

// ─── In-memory cache ───
let settingsCache: Record<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Default settings — used when the DB has no value for a key.
 */
const DEFAULTS: Record<string, string> = {
    // Institution
    institution_name: 'Ultra Tecnología',
    institution_phone: '',
    institution_email: '',
    institution_address: '',

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

    // General
    allow_student_portal: 'true',
    allow_parent_portal: 'true',
    default_currency_symbol: 'Q',
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
        const { data, error } = await adminClient.database
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
 * PUT /api/settings — bulk update settings.
 * Body: { key1: value1, key2: value2, ... }
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
        // Upsert each setting
        const entries = Object.entries(updates);
        for (const [key, value] of entries) {
            const { error } = await adminClient.database
                .from('system_settings')
                .upsert(
                    { key, value: String(value), updated_at: new Date().toISOString() },
                    { onConflict: 'key' }
                );
            if (error) throw error;
        }

        // Invalidate cache
        settingsCache = null;
        cacheTimestamp = 0;

        // Return updated settings
        const settings = await loadSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Error updating settings' });
    }
};
