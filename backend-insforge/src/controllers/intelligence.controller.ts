import { Request, Response } from 'express';
import { adminClient } from '../config/insforge';
import NodeCache from 'node-cache';
import { getEffectiveBranchId } from '../utils/branch.utils';

// Cache for intelligence calculations (3 minutes TTL)
const intelligenceCache = new NodeCache({ stdTTL: 180, checkperiod: 200 });

/**
 * Helper to compute days overdue from a year-month string like "2026-08"
 */
function getDaysOverdue(monthStr: string): number {
    try {
        const parts = monthStr.split('-');
        if (parts.length < 2) return 0;
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        // Due date is approximately the 10th of that month
        const dueDate = new Date(year, month - 1, 10);
        const today = new Date();
        const diffTime = today.getTime() - dueDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    } catch {
        return 0;
    }
}

/**
 * Helper to resolve course UUIDs from either a UUID string, course name, and/or academic year
 */
async function resolveCourseIds(
    courseParam?: any, 
    branchId?: string | null, 
    academicYearParam?: any
): Promise<string[] | null> {
    const hasYear = academicYearParam !== undefined && academicYearParam !== null && academicYearParam !== 'all' && academicYearParam !== '';
    const parsedYear = hasYear ? parseInt(String(academicYearParam), 10) : null;
    const hasCourse = courseParam && courseParam !== 'all' && courseParam !== 'undefined' && courseParam !== 'null';

    if (!hasCourse && !hasYear) {
        return null; // Sin filtro de curso ni de ciclo
    }

    // Caso 1: Se especificó un curso (UUID o nombre textual)
    if (hasCourse) {
        const trimmed = String(courseParam).trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);

        try {
            let query = adminClient
                .from('courses')
                .select('id, academic_year');

            if (isUuid) {
                query = query.eq('id', trimmed);
            } else {
                query = query.ilike('name', trimmed);
            }

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            if (hasYear && parsedYear !== null && !isNaN(parsedYear)) {
                query = query.eq('academic_year', parsedYear);
            }

            const { data, error } = await query;
            if (error) {
                console.warn('Warning looking up course in resolveCourseIds:', error);
                return [];
            }
            return (data || []).map((c: any) => c.id);
        } catch (err) {
            console.error('Error resolving course IDs:', err);
            return [];
        }
    }

    // Caso 2: No se especificó curso, pero SÍ se especificó ciclo escolar (academic_year)
    if (hasYear && parsedYear !== null && !isNaN(parsedYear)) {
        try {
            let query = adminClient
                .from('courses')
                .select('id')
                .eq('academic_year', parsedYear);

            if (branchId) {
                query = query.eq('branch_id', branchId);
            }

            const { data, error } = await query;
            if (error) {
                console.warn('Warning looking up courses by academic year in resolveCourseIds:', error);
                return [];
            }
            return (data || []).map((c: any) => c.id);
        } catch (err) {
            console.error('Error resolving courses by academic year:', err);
            return [];
        }
    }

    return null;
}

// =========================================================================
// 1. EARLY WARNING SYSTEM (EWS) - SEMÁFORO DE RETENCIÓN ESTUDIANTIL
// =========================================================================
export const getEarlyWarningReport = async (req: Request, res: Response) => {
    const branchId = getEffectiveBranchId(req);
    const { course_id, risk_level, search, force_refresh, academic_year } = req.query;

    const cacheKey = `ews_${branchId || 'all'}_${course_id || 'all'}_${academic_year || 'all'}`;
    if (!force_refresh) {
        const cached = intelligenceCache.get(cacheKey);
        if (cached) {
            return res.json(filterEwsResults(cached, risk_level as string, search as string));
        }
    }

    try {
        const matchedCourseIds = await resolveCourseIds(course_id, branchId, academic_year);
        if (matchedCourseIds !== null && matchedCourseIds.length === 0) {
            // Se especificó un curso o ciclo pero no coincidió con ninguno en la base de datos
            return res.json({
                summary: {
                    total_students: 0,
                    critical_count: 0,
                    moderate_count: 0,
                    low_count: 0,
                    critical_pct: 0,
                    moderate_pct: 0,
                    low_pct: 0,
                    avg_retention_index: 100,
                },
                students: []
            });
        }

        // 1. Fetch active students with active enrollments
        let studentQuery = adminClient
            .from('students')
            .select(`
                id,
                full_name,
                personal_code,
                academy_code,
                status,
                branch_id,
                phone,
                guardian_name,
                guardian_phone,
                branches (id, name),
                enrollments!inner (
                    id,
                    course_id,
                    is_active,
                    courses (id, name, academic_year)
                )
            `)
            .eq('status', 'active')
            .eq('enrollments.is_active', true);

        if (branchId) {
            studentQuery = studentQuery.eq('branch_id', branchId);
        }
        if (matchedCourseIds && matchedCourseIds.length > 0) {
            studentQuery = studentQuery.in('enrollments.course_id', matchedCourseIds);
        }

        const { data: rawStudents, error: studentsError } = await studentQuery;
        if (studentsError) throw studentsError;

        if (!rawStudents || rawStudents.length === 0) {
            const emptyResult = {
                summary: {
                    total_students: 0,
                    critical_count: 0,
                    moderate_count: 0,
                    low_count: 0,
                    critical_pct: 0,
                    moderate_pct: 0,
                    low_pct: 0,
                    avg_retention_index: 100,
                },
                students: []
            };
            return res.json(emptyResult);
        }

        // Deduplicate students (an active student might have multiple active enrollments)
        const studentMap = new Map<string, any>();
        rawStudents.forEach((row: any) => {
            if (!studentMap.has(row.id)) {
                studentMap.set(row.id, {
                    id: row.id,
                    full_name: row.full_name,
                    code: row.personal_code || row.academy_code || `UT-${row.id.slice(0, 6)}`,
                    branch_id: row.branch_id,
                    branch_name: row.branches?.name || 'Sede Central',
                    phone: row.phone,
                    guardian_name: row.guardian_name,
                    guardian_phone: row.guardian_phone,
                    courses: [],
                    enrollment_ids: []
                });
            }
            const s = studentMap.get(row.id);
            const enrollList = Array.isArray(row.enrollments)
                ? row.enrollments
                : (row.enrollments ? [row.enrollments] : []);

            enrollList.forEach((e: any) => {
                if (e.courses?.name && !s.courses.includes(e.courses.name)) {
                    s.courses.push(e.courses.name);
                }
                if (e.id && !s.enrollment_ids.includes(e.id)) {
                    s.enrollment_ids.push(e.id);
                }
            });
        });

        const studentList = Array.from(studentMap.values());
        const studentIds = studentList.map(s => s.id);
        const allEnrollmentIds = studentList.flatMap(s => s.enrollment_ids);

        // 2. Fetch Attendance in batch (isolated to matched courses if filtered)
        let attendanceQuery = adminClient
            .from('attendance')
            .select('student_id, status, date, course_id')
            .in('student_id', studentIds);

        if (matchedCourseIds && matchedCourseIds.length > 0) {
            attendanceQuery = attendanceQuery.in('course_id', matchedCourseIds);
        }

        const { data: attendanceData } = await attendanceQuery.order('date', { ascending: false });

        const attendanceMap = new Map<string, { total: number; present: number; absent: number; consecutiveAbsences: number }>();
        if (attendanceData) {
            for (const att of attendanceData) {
                if (!attendanceMap.has(att.student_id)) {
                    attendanceMap.set(att.student_id, { total: 0, present: 0, absent: 0, consecutiveAbsences: 0 });
                }
                const stat = attendanceMap.get(att.student_id)!;
                stat.total += 1;
                const isPresent = att.status === 'PRESENT' || att.status === 'LATE' || att.status === 'EXCUSED';
                if (isPresent) {
                    stat.present += 1;
                } else if (att.status === 'ABSENT') {
                    stat.absent += 1;
                    if (stat.present === 0) {
                        // Consecutive absences from most recent records
                        stat.consecutiveAbsences += 1;
                    }
                }
            }
        }

        // 3. Fetch Grades in batch (isolated to matched courses if filtered)
        let gradesQuery = adminClient
            .from('grades')
            .select('student_id, score, course_id')
            .in('student_id', studentIds);

        if (matchedCourseIds && matchedCourseIds.length > 0) {
            gradesQuery = gradesQuery.in('course_id', matchedCourseIds);
        }

        const { data: gradesData } = await gradesQuery;

        const gradesMap = new Map<string, { totalScore: number; count: number; failingCount: number }>();
        if (gradesData) {
            for (const gr of gradesData) {
                if (!gradesMap.has(gr.student_id)) {
                    gradesMap.set(gr.student_id, { totalScore: 0, count: 0, failingCount: 0 });
                }
                const gm = gradesMap.get(gr.student_id)!;
                const score = Number(gr.score) || 0;
                gm.totalScore += score;
                gm.count += 1;
                if (score < 60) gm.failingCount += 1;
            }
        }

        // 4. Fetch Financial Status (debt & overdue months) in batch
        const financialMap = new Map<string, { overdueCount: number; totalDebt: number }>();
        if (allEnrollmentIds.length > 0) {
            const { data: finData } = await adminClient
                .from('financial_status')
                .select('enrollment_id, amount_due, amount_paid, status, month')
                .in('enrollment_id', allEnrollmentIds)
                .in('status', ['PENDING', 'OVERDUE']);

            if (finData) {
                // Map enrollment_id back to student_id
                const enrollmentToStudent = new Map<string, string>();
                studentList.forEach(s => {
                    s.enrollment_ids.forEach((eId: string) => enrollmentToStudent.set(eId, s.id));
                });

                for (const item of finData) {
                    const studentId = enrollmentToStudent.get(item.enrollment_id);
                    if (!studentId) continue;

                    if (!financialMap.has(studentId)) {
                        financialMap.set(studentId, { overdueCount: 0, totalDebt: 0 });
                    }
                    const fm = financialMap.get(studentId)!;
                    const remaining = Math.max(0, Number(item.amount_due || 0) - Number(item.amount_paid || 0));
                    if (remaining > 0) {
                        fm.overdueCount += 1;
                        fm.totalDebt += remaining;
                    }
                }
            }
        }

        // 5. Fetch Open Severe Discipline Incidents in batch
        const disciplineMap = new Map<string, number>();
        const { data: discData } = await adminClient
            .from('discipline_incidents')
            .select('student_id, severity, resolved')
            .in('student_id', studentIds)
            .eq('resolved', false);

        if (discData) {
            for (const d of discData) {
                if (d.severity === 'high' || d.severity === 'medium') {
                    disciplineMap.set(d.student_id, (disciplineMap.get(d.student_id) || 0) + 1);
                }
            }
        }

        // 6. Fetch Student Interventions in batch
        const interventionMap = new Map<string, { count: number; latest: any }>();
        const { data: intervData } = await adminClient
            .from('student_interventions')
            .select('*')
            .in('student_id', studentIds)
            .order('created_at', { ascending: false });

        if (intervData) {
            for (const it of intervData) {
                if (!interventionMap.has(it.student_id)) {
                    interventionMap.set(it.student_id, { count: 0, latest: it });
                }
                interventionMap.get(it.student_id)!.count += 1;
            }
        }

        // 7. Calculate IRE (Índice de Retención Escolar: 0 - 100) per Student
        const evaluatedStudents = studentList.map(student => {
            const att = attendanceMap.get(student.id) || { total: 0, present: 0, absent: 0, consecutiveAbsences: 0 };
            const attendancePct = att.total > 0 ? Math.round((att.present / att.total) * 100) : 100;

            const grd = gradesMap.get(student.id) || { totalScore: 0, count: 0, failingCount: 0 };
            const averageGrade = grd.count > 0 ? Math.round((grd.totalScore / grd.count) * 10) / 10 : 85;

            const fin = financialMap.get(student.id) || { overdueCount: 0, totalDebt: 0 };
            const discSevereCount = disciplineMap.get(student.id) || 0;
            const interv = interventionMap.get(student.id);

            // Factor 1: Asistencia (40 puntos máx)
            let attendanceScore = 40;
            if (att.total > 0) {
                if (attendancePct >= 85) attendanceScore = 40;
                else if (attendancePct >= 75) attendanceScore = 30;
                else if (attendancePct >= 65) attendanceScore = 18;
                else attendanceScore = 6;
                // Penalización por ausencias consecutivas
                if (att.consecutiveAbsences >= 3) attendanceScore = Math.max(0, attendanceScore - 12);
            }

            // Factor 2: Rendimiento Académico (35 puntos máx)
            let academicScore = 35;
            if (grd.count > 0) {
                if (averageGrade >= 80) academicScore = 35;
                else if (averageGrade >= 70) academicScore = 27;
                else if (averageGrade >= 60) academicScore = 17;
                else academicScore = 5;
                // Penalización por materias reprobadas
                if (grd.failingCount > 0) academicScore = Math.max(0, academicScore - (grd.failingCount * 6));
            }

            // Factor 3: Salud Financiera (20 puntos máx)
            let financialScore = 20;
            if (fin.overdueCount === 0) financialScore = 20;
            else if (fin.overdueCount === 1) financialScore = 12;
            else if (fin.overdueCount === 2) financialScore = 5;
            else financialScore = 0;

            // Factor 4: Conducta (5 puntos máx)
            let disciplineScore = 5;
            if (discSevereCount === 1) disciplineScore = 2;
            else if (discSevereCount > 1) disciplineScore = 0;

            // IRE Total Ponderado (0 - 100)
            const ireScore = Math.max(0, Math.min(100, attendanceScore + academicScore + financialScore + disciplineScore));

            // Categoría de Riesgo
            let riskLevel: 'critical' | 'moderate' | 'low' = 'low';
            if (ireScore < 60 || attendancePct < 60 || averageGrade < 50 || fin.overdueCount >= 3) {
                riskLevel = 'critical';
            } else if (ireScore < 80 || attendancePct < 75 || averageGrade < 65 || fin.overdueCount >= 1) {
                riskLevel = 'moderate';
            }

            // Razones clave de riesgo para el dashboard
            const riskTriggers: string[] = [];
            if (attendancePct < 75) riskTriggers.push(`Baja asistencia (${attendancePct}%)`);
            if (att.consecutiveAbsences >= 3) riskTriggers.push(`${att.consecutiveAbsences} faltas consecutivas`);
            if (averageGrade < 65) riskTriggers.push(`Promedio bajo (${averageGrade} pts)`);
            if (grd.failingCount > 0) riskTriggers.push(`${grd.failingCount} materias reprobadas`);
            if (fin.overdueCount >= 1) riskTriggers.push(`${fin.overdueCount} mes(es) en mora (Q${fin.totalDebt})`);
            if (discSevereCount > 0) riskTriggers.push(`${discSevereCount} reporte(s) de conducta abiertos`);

            return {
                id: student.id,
                full_name: student.full_name,
                code: student.code,
                branch_id: student.branch_id,
                branch_name: student.branch_name,
                courses: student.courses,
                phone: student.phone,
                guardian_name: student.guardian_name,
                guardian_phone: student.guardian_phone,
                ire_score: ireScore,
                risk_level: riskLevel,
                risk_triggers: riskTriggers,
                factors: {
                    attendance: {
                        percentage: attendancePct,
                        total_sessions: att.total,
                        absent_sessions: att.absent,
                        consecutive_absences: att.consecutiveAbsences,
                        score: attendanceScore,
                        max_score: 40
                    },
                    academic: {
                        average_grade: averageGrade,
                        failing_units: grd.failingCount,
                        evaluated_units: grd.count,
                        score: academicScore,
                        max_score: 35
                    },
                    financial: {
                        overdue_months: fin.overdueCount,
                        total_debt: fin.totalDebt,
                        score: financialScore,
                        max_score: 20
                    },
                    discipline: {
                        open_severe_incidents: discSevereCount,
                        score: disciplineScore,
                        max_score: 5
                    }
                },
                interventions: {
                    total_count: interv?.count || 0,
                    latest: interv?.latest || null
                }
            };
        });

        // Sort by risk priority: Critical first, then Moderate, then Low; then by lowest IRE score
        evaluatedStudents.sort((a, b) => {
            const riskWeight = { critical: 0, moderate: 1, low: 2 };
            if (riskWeight[a.risk_level] !== riskWeight[b.risk_level]) {
                return riskWeight[a.risk_level] - riskWeight[b.risk_level];
            }
            return a.ire_score - b.ire_score;
        });

        // Summary KPI calculations
        const totalCount = evaluatedStudents.length;
        const criticalCount = evaluatedStudents.filter(s => s.risk_level === 'critical').length;
        const moderateCount = evaluatedStudents.filter(s => s.risk_level === 'moderate').length;
        const lowCount = evaluatedStudents.filter(s => s.risk_level === 'low').length;
        const avgIre = totalCount > 0 
            ? Math.round((evaluatedStudents.reduce((sum, s) => sum + s.ire_score, 0) / totalCount) * 10) / 10 
            : 100;

        const payload = {
            summary: {
                total_students: totalCount,
                critical_count: criticalCount,
                moderate_count: moderateCount,
                low_count: lowCount,
                critical_pct: totalCount > 0 ? Math.round((criticalCount / totalCount) * 100) : 0,
                moderate_pct: totalCount > 0 ? Math.round((moderateCount / totalCount) * 100) : 0,
                low_pct: totalCount > 0 ? Math.round((lowCount / totalCount) * 100) : 0,
                avg_retention_index: avgIre,
            },
            students: evaluatedStudents
        };

        intelligenceCache.set(cacheKey, payload);

        res.json(filterEwsResults(payload, risk_level as string, search as string));

    } catch (error: any) {
        console.error('Error calculating Early Warning System report:', error);
        res.status(500).json({ message: 'Error al generar el reporte de alerta temprana', error: error?.message });
    }
};

/**
 * Filter helper for client queries
 */
function filterEwsResults(data: any, riskLevel?: string, search?: string) {
    let filteredStudents = [...data.students];

    if (riskLevel && riskLevel !== 'all') {
        filteredStudents = filteredStudents.filter(s => s.risk_level === riskLevel);
    }

    if (search && search.trim() !== '') {
        const q = search.toLowerCase().trim();
        filteredStudents = filteredStudents.filter(s =>
            s.full_name.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q) ||
            (s.guardian_name && s.guardian_name.toLowerCase().includes(q))
        );
    }

    return {
        summary: data.summary,
        students: filteredStudents
    };
}

// =========================================================================
// 2. DEBT AGING & FINANCIAL HEALTH (CARTERA VENCIDA & PROYECCIONES)
// =========================================================================
export const getDebtAgingReport = async (req: Request, res: Response) => {
    const branchId = getEffectiveBranchId(req);
    const { course_id, force_refresh, academic_year } = req.query;

    const cacheKey = `debt_aging_${branchId || 'all'}_${course_id || 'all'}_${academic_year || 'all'}`;
    if (!force_refresh) {
        const cached = intelligenceCache.get(cacheKey);
        if (cached) return res.json(cached);
    }

    try {
        const matchedCourseIds = await resolveCourseIds(course_id, branchId, academic_year);
        if (matchedCourseIds !== null && matchedCourseIds.length === 0) {
            // Se especificó un curso o ciclo pero no coincidió con ninguno en la base de datos
            return res.json({
                summary: {
                    total_debt: 0,
                    total_debtors: 0,
                    total_students: 0,
                    delinquency_rate: 0,
                    current_month_expected: 0,
                    current_month_collected: 0,
                    collection_rate_pct: 0,
                    next_month_projection: 0
                },
                aging_buckets: [],
                top_debtors: [],
                branch_comparison: []
            });
        }

        // 1. Fetch active enrollments with course fee and student data
        let enrollQuery = adminClient
            .from('enrollments')
            .select(`
                id,
                student_id,
                course_id,
                branch_id,
                enrollment_date,
                is_active,
                students (
                    id, 
                    full_name, 
                    personal_code, 
                    phone, 
                    guardian_name, 
                    guardian_phone, 
                    branch_id
                ),
                courses (id, name, monthly_fee, academic_year),
                branches (id, name)
            `)
            .eq('is_active', true);

        if (branchId) {
            enrollQuery = enrollQuery.eq('branch_id', branchId);
        }
        if (matchedCourseIds && matchedCourseIds.length > 0) {
            enrollQuery = enrollQuery.in('course_id', matchedCourseIds);
        }

        const { data: enrollments, error: enrollError } = await enrollQuery;
        if (enrollError) throw enrollError;

        const totalActiveEnrollments = enrollments?.length || 0;
        const enrollmentIds = enrollments?.map(e => e.id) || [];

        // 2. Expected monthly income based on active enrollments
        const currentMonthExpected = enrollments?.reduce((sum, e: any) => {
            return sum + (Number(e.courses?.monthly_fee) || 0);
        }, 0) || 0;

        // 3. Collected this month in TUITION
        const currentMonthStart = new Date();
        currentMonthStart.setDate(1);
        currentMonthStart.setHours(0, 0, 0, 0);

        let paymentsQuery = adminClient
            .from('payments')
            .select(`
                amount,
                enrollment_id,
                payment_date,
                payment_type,
                enrollments!inner (branch_id)
            `)
            .gte('payment_date', currentMonthStart.toISOString())
            .eq('payment_type', 'TUITION');

        if (branchId) {
            paymentsQuery = paymentsQuery.eq('enrollments.branch_id', branchId);
        }

        if (matchedCourseIds !== null && enrollmentIds.length > 0) {
            paymentsQuery = paymentsQuery.in('enrollment_id', enrollmentIds);
        }

        const { data: paymentsData } = (matchedCourseIds !== null && enrollmentIds.length === 0)
            ? { data: [] }
            : await paymentsQuery;

        const paymentsList: any[] = (paymentsData as any) || [];
        const currentMonthCollected = paymentsList.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

        const collectionRate = currentMonthExpected > 0 
            ? Math.min(100, Math.round((currentMonthCollected / currentMonthExpected) * 1000) / 10) 
            : 0;

        // 4. Overdue records from financial_status
        let finQuery = adminClient
            .from('financial_status')
            .select(`
                id,
                enrollment_id,
                month,
                amount_due,
                amount_paid,
                status
            `)
            .in('status', ['PENDING', 'OVERDUE']);

        if (enrollmentIds.length > 0) {
            finQuery = finQuery.in('enrollment_id', enrollmentIds);
        } else {
            // No active enrollments
            return res.json({
                summary: {
                    total_debt: 0,
                    total_debtors: 0,
                    delinquency_rate: 0,
                    current_month_expected: currentMonthExpected,
                    current_month_collected: currentMonthCollected,
                    collection_rate_pct: collectionRate,
                    next_month_projection: currentMonthExpected
                },
                aging_buckets: [],
                top_debtors: [],
                branch_comparison: []
            });
        }

        const { data: overdueRecords, error: finError } = await finQuery;
        if (finError) throw finError;

        // Map enrollments to students and branches
        const enrollmentMap = new Map<string, any>();
        enrollments?.forEach(e => enrollmentMap.set(e.id, e));

        // Group into Aging Buckets:
        // Bucket 0: Current / 0-30 days
        // Bucket 1: 31-60 days
        // Bucket 2: 61-90 days
        // Bucket 3: > 90 days
        const buckets = {
            days_0_30: { label: '1 a 30 días (Mora Leve)', amount: 0, count: 0, studentIds: new Set<string>() },
            days_31_60: { label: '31 a 60 días (Mora Media)', amount: 0, count: 0, studentIds: new Set<string>() },
            days_61_90: { label: '61 a 90 días (Mora Alta)', amount: 0, count: 0, studentIds: new Set<string>() },
            days_over_90: { label: 'Más de 90 días (Crítica)', amount: 0, count: 0, studentIds: new Set<string>() }
        };

        // Per-student total debt tracking for Top Debtors
        const studentDebtMap = new Map<string, {
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
        }>();

        // Branch-level comparison tracking (for SuperAdmin)
        const branchStatsMap = new Map<string, { branch_id: string; branch_name: string; total_debt: number; debtors: Set<string>; expected: number }>();

        // Initialize branch stats from active enrollments
        enrollments?.forEach((e: any) => {
            const bId = e.branch_id || 'unassigned';
            const bName = e.branches?.name || 'Sede';
            if (!branchStatsMap.has(bId)) {
                branchStatsMap.set(bId, { branch_id: bId, branch_name: bName, total_debt: 0, debtors: new Set(), expected: 0 });
            }
            branchStatsMap.get(bId)!.expected += (Number(e.courses?.monthly_fee) || 0);
        });

        let grandTotalDebt = 0;
        const allDebtorsSet = new Set<string>();

        overdueRecords?.forEach((record: any) => {
            const enroll: any = enrollmentMap.get(record.enrollment_id);
            if (!enroll || !enroll.students) return;

            const remaining = Math.max(0, Number(record.amount_due || 0) - Number(record.amount_paid || 0));
            if (remaining <= 0) return;

            grandTotalDebt += remaining;
            const student = enroll.students;
            allDebtorsSet.add(student.id);

            const daysOverdue = getDaysOverdue(record.month);

            // Assign to bucket
            if (daysOverdue <= 30) {
                buckets.days_0_30.amount += remaining;
                buckets.days_0_30.count += 1;
                buckets.days_0_30.studentIds.add(student.id);
            } else if (daysOverdue <= 60) {
                buckets.days_31_60.amount += remaining;
                buckets.days_31_60.count += 1;
                buckets.days_31_60.studentIds.add(student.id);
            } else if (daysOverdue <= 90) {
                buckets.days_61_90.amount += remaining;
                buckets.days_61_90.count += 1;
                buckets.days_61_90.studentIds.add(student.id);
            } else {
                buckets.days_over_90.amount += remaining;
                buckets.days_over_90.count += 1;
                buckets.days_over_90.studentIds.add(student.id);
            }

            // Track student debt
            if (!studentDebtMap.has(student.id)) {
                studentDebtMap.set(student.id, {
                    student_id: student.id,
                    full_name: student.full_name,
                    code: student.personal_code || `UT-${student.id.slice(0, 6)}`,
                    phone: student.phone || '',
                    guardian_name: student.guardian_name || '',
                    guardian_phone: student.guardian_phone || '',
                    branch_name: enroll.branches?.name || 'Sede',
                    courses: [enroll.courses?.name].filter(Boolean),
                    total_debt: 0,
                    overdue_months: [],
                    oldest_due_days: 0
                });
            }
            const sd = studentDebtMap.get(student.id)!;
            sd.total_debt += remaining;
            sd.overdue_months.push(record.month);
            sd.oldest_due_days = Math.max(sd.oldest_due_days, daysOverdue);

            // Branch stats
            const bId = enroll.branch_id || 'unassigned';
            if (branchStatsMap.has(bId)) {
                const bs = branchStatsMap.get(bId)!;
                bs.total_debt += remaining;
                bs.debtors.add(student.id);
            }
        });

        // Top 15 debtors sorted by highest debt
        const topDebtors = Array.from(studentDebtMap.values())
            .sort((a, b) => b.total_debt - a.total_debt)
            .slice(0, 15);

        // Format aging buckets array
        const agingBuckets = [
            {
                key: '0_30',
                label: buckets.days_0_30.label,
                amount: Math.round(buckets.days_0_30.amount * 100) / 100,
                student_count: buckets.days_0_30.studentIds.size,
                percentage: grandTotalDebt > 0 ? Math.round((buckets.days_0_30.amount / grandTotalDebt) * 1000) / 10 : 0
            },
            {
                key: '31_60',
                label: buckets.days_31_60.label,
                amount: Math.round(buckets.days_31_60.amount * 100) / 100,
                student_count: buckets.days_31_60.studentIds.size,
                percentage: grandTotalDebt > 0 ? Math.round((buckets.days_31_60.amount / grandTotalDebt) * 1000) / 10 : 0
            },
            {
                key: '61_90',
                label: buckets.days_61_90.label,
                amount: Math.round(buckets.days_61_90.amount * 100) / 100,
                student_count: buckets.days_61_90.studentIds.size,
                percentage: grandTotalDebt > 0 ? Math.round((buckets.days_61_90.amount / grandTotalDebt) * 1000) / 10 : 0
            },
            {
                key: 'over_90',
                label: buckets.days_over_90.label,
                amount: Math.round(buckets.days_over_90.amount * 100) / 100,
                student_count: buckets.days_over_90.studentIds.size,
                percentage: grandTotalDebt > 0 ? Math.round((buckets.days_over_90.amount / grandTotalDebt) * 1000) / 10 : 0
            }
        ];

        // Format branch comparison
        const branchComparison = Array.from(branchStatsMap.values()).map(bs => ({
            branch_id: bs.branch_id,
            branch_name: bs.branch_name,
            total_debt: Math.round(bs.total_debt * 100) / 100,
            debtors_count: bs.debtors.size,
            expected_income: Math.round(bs.expected * 100) / 100
        }));

        const totalUniqueStudents = new Set(enrollments?.map(e => e.student_id)).size;
        const delinquencyRate = totalUniqueStudents > 0 
            ? Math.round((allDebtorsSet.size / totalUniqueStudents) * 1000) / 10 
            : 0;

        const payload = {
            summary: {
                total_debt: Math.round(grandTotalDebt * 100) / 100,
                total_debtors: allDebtorsSet.size,
                total_students: totalUniqueStudents,
                delinquency_rate: delinquencyRate,
                current_month_expected: Math.round(currentMonthExpected * 100) / 100,
                current_month_collected: Math.round(currentMonthCollected * 100) / 100,
                collection_rate_pct: collectionRate,
                next_month_projection: Math.round(currentMonthExpected * 100) / 100
            },
            aging_buckets: agingBuckets,
            top_debtors: topDebtors,
            branch_comparison: branchComparison
        };

        intelligenceCache.set(cacheKey, payload);

        res.json(payload);

    } catch (error: any) {
        console.error('Error calculating Debt Aging report:', error);
        res.status(500).json({ message: 'Error al generar el reporte de cartera vencida', error: error?.message });
    }
};

// =========================================================================
// 3. STUDENT INTERVENTIONS (CRUD DE BITÁCORA Y RETENCIÓN)
// =========================================================================

/**
 * GET /api/intelligence/interventions/:studentId
 */
export const getStudentInterventions = async (req: Request, res: Response) => {
    const { studentId } = req.params;

    try {
        const { data, error } = await adminClient
            .from('student_interventions')
            .select(`
                *,
                author:profiles!created_by(id, full_name, role)
            `)
            .eq('student_id', studentId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json(data || []);
    } catch (error: any) {
        console.error('Error fetching student interventions:', error);
        res.status(500).json({ message: 'Error al obtener bitácora de intervenciones', error: error?.message });
    }
};

/**
 * POST /api/intelligence/interventions
 */
export const createStudentIntervention = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;
    const branchId = getEffectiveBranchId(req);
    const {
        student_id,
        intervention_type,
        notes,
        commitment,
        follow_up_date,
        status = 'OPEN'
    } = req.body;

    if (!student_id || !intervention_type || !notes) {
        return res.status(400).json({ message: 'Estudiante, tipo de intervención y notas son obligatorios' });
    }

    try {
        const { data, error } = await adminClient
            .from('student_interventions')
            .insert({
                student_id,
                branch_id: branchId || req.currentUser?.branch_id,
                created_by: userId,
                intervention_type,
                notes,
                commitment: commitment || null,
                follow_up_date: follow_up_date || null,
                status
            })
            .select(`
                *,
                author:profiles!created_by(id, full_name, role)
            `)
            .single();

        if (error) throw error;

        // Invalidate intelligence cache so UI reflects the new intervention
        intelligenceCache.flushAll();

        res.status(201).json(data);
    } catch (error: any) {
        console.error('Error creating student intervention:', error);
        res.status(500).json({ message: 'Error al registrar la intervención', error: error?.message });
    }
};

/**
 * PATCH /api/intelligence/interventions/:id
 */
export const updateStudentIntervention = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, commitment, follow_up_date, notes } = req.body;

    try {
        const updateData: any = {
            updated_at: new Date().toISOString()
        };
        if (status) updateData.status = status;
        if (commitment !== undefined) updateData.commitment = commitment;
        if (follow_up_date !== undefined) updateData.follow_up_date = follow_up_date;
        if (notes !== undefined) updateData.notes = notes;

        const { data, error } = await adminClient
            .from('student_interventions')
            .update(updateData)
            .eq('id', id)
            .select(`
                *,
                author:profiles!created_by(id, full_name, role)
            `)
            .single();

        if (error) throw error;

        intelligenceCache.flushAll();

        res.json(data);
    } catch (error: any) {
        console.error('Error updating student intervention:', error);
        res.status(500).json({ message: 'Error al actualizar la intervención', error: error?.message });
    }
};
