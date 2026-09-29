import api from '../../services/apiClient';

export interface SystemSettings {
    institution_name: string;
    institution_phone: string;
    institution_email: string;
    institution_address: string;
    total_grade_units: string;
    grade_unit_names: string;
    grade_unit_cutoff_months: string;
    default_course_duration_months: string;
    minimum_passing_grade: string;
    allow_instructor_grade_edits: string;
    restrict_grades_by_payment: string;
    restrict_future_payments_if_debt: string;
    grace_period_days: string;
    late_fee_percentage: string;
    allow_student_portal: string;
    allow_parent_portal: string;
    default_currency_symbol: string;

    // Institución
    institution_logo_url?: string;
    institution_seal_url?: string;

    // Gobernanza y Modo Mantenimiento
    system_maintenance_mode: string;
    system_maintenance_message: string;

    // Gamificación / Méritos
    merit_points_attendance_present: string;
    merit_points_grade_excellent: string;
    merit_points_grade_good: string;
    merit_enable_auto_attendance: string;
    merit_enable_auto_grades: string;
}

export interface SmtpStatusResponse {
    ok: boolean;
    message: string;
    host?: string;
    port?: number;
}

export interface TestEmailResponse {
    ok: boolean;
    message: string;
    messageId?: string;
    previewUrl?: string;
}

export interface SettingsDiffItem {
    key: string;
    label?: string;
    value: string;
}

export interface SettingsAuditLog {
    id: string;
    user_id: string;
    action: string;
    entity: string;
    entity_id: string;
    old_data: { changes?: SettingsDiffItem[] } | null;
    new_data: { changes?: SettingsDiffItem[] } | null;
    ip_address: string;
    created_at: string;
    metadata?: {
        total_changes?: number;
        changed_keys?: string[];
        user_role?: string;
        user_email?: string;
        user_name?: string;
    };
    user?: {
        id: string;
        full_name: string;
        email: string;
        role: string;
    };
}

export const getSettings = async (): Promise<SystemSettings> => {
    const response = await api.get('/api/settings');
    return response.data;
};

export const updateSettings = async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
    const response = await api.put('/api/settings', settings);
    return response.data;
};

export const getSettingsAuditHistory = async (): Promise<SettingsAuditLog[]> => {
    const response = await api.get('/api/settings/audit-history');
    return response.data;
};

export const uploadBrandingAsset = async (file: File, type: 'logo' | 'seal'): Promise<{ ok: boolean; key: string; url: string; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    const response = await api.post('/api/settings/upload-branding', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const getSmtpStatus = async (): Promise<SmtpStatusResponse> => {
    const response = await api.get('/api/settings/smtp-status');
    return response.data;
};

export const sendTestEmail = async (recipientEmail: string): Promise<TestEmailResponse> => {
    const response = await api.post('/api/settings/test-email', { recipientEmail });
    return response.data;
};

