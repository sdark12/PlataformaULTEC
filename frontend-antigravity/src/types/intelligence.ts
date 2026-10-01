export type RiskLevel = 'critical' | 'moderate' | 'low';

export type InterventionType = 
    | 'PHONE_CALL' 
    | 'WHATSAPP' 
    | 'IN_PERSON_MEETING' 
    | 'PAYMENT_AGREEMENT' 
    | 'ACADEMIC_TUTORING';

export type InterventionStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DROPPED';

export interface RiskFactorBreakdown {
    attendance: {
        percentage: number;
        total_sessions: number;
        absent_sessions: number;
        consecutive_absences: number;
        score: number;
        max_score: number;
    };
    academic: {
        average_grade: number;
        failing_units: number;
        evaluated_units: number;
        score: number;
        max_score: number;
    };
    financial: {
        overdue_months: number;
        total_debt: number;
        score: number;
        max_score: number;
    };
    discipline: {
        open_severe_incidents: number;
        score: number;
        max_score: number;
    };
}

export interface StudentIntervention {
    id: string;
    student_id: string;
    branch_id?: string;
    created_by?: string;
    intervention_type: InterventionType;
    notes: string;
    commitment?: string;
    follow_up_date?: string;
    status: InterventionStatus;
    created_at: string;
    updated_at: string;
    author?: {
        id: string;
        full_name: string;
        role: string;
    };
}

export interface StudentRiskProfile {
    id: string;
    full_name: string;
    code: string;
    branch_id: string;
    branch_name: string;
    courses: string[];
    phone?: string;
    guardian_name?: string;
    guardian_phone?: string;
    ire_score: number;
    risk_level: RiskLevel;
    risk_triggers: string[];
    factors: RiskFactorBreakdown;
    interventions: {
        total_count: number;
        latest: StudentIntervention | null;
    };
}

export interface EarlyWarningSummary {
    total_students: number;
    critical_count: number;
    moderate_count: number;
    low_count: number;
    critical_pct: number;
    moderate_pct: number;
    low_pct: number;
    avg_retention_index: number;
}

export interface EarlyWarningResponse {
    summary: EarlyWarningSummary;
    students: StudentRiskProfile[];
}

export interface AgingBucket {
    key: string;
    label: string;
    amount: number;
    student_count: number;
    percentage: number;
}

export interface TopDebtor {
    student_id: string;
    full_name: string;
    code: string;
    phone: string;
    guardian_name: string;
    guardian_phone: string;
    branch_name: string;
    courses: string[];
    total_debt: number;
    overdue_months: string[];
    oldest_due_days: number;
}

export interface BranchComparison {
    branch_id: string;
    branch_name: string;
    total_debt: number;
    debtors_count: number;
    expected_income: number;
}

export interface DebtAgingSummary {
    total_debt: number;
    total_debtors: number;
    total_students: number;
    delinquency_rate: number;
    current_month_expected: number;
    current_month_collected: number;
    collection_rate_pct: number;
    next_month_projection: number;
}

export interface DebtAgingResponse {
    summary: DebtAgingSummary;
    aging_buckets: AgingBucket[];
    top_debtors: TopDebtor[];
    branch_comparison: BranchComparison[];
}
