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
}

export const getSettings = async (): Promise<SystemSettings> => {
    const response = await api.get('/api/settings');
    return response.data;
};

export const updateSettings = async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
    const response = await api.put('/api/settings', settings);
    return response.data;
};
