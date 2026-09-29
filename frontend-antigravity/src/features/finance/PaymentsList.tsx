import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPayments, createPayment, updatePayment, deletePayment, getStudentStatement } from '../../features/finance/paymentService';
import { getEnrollments } from '../../features/academic/academicService';
import { downloadInvoicePdf } from '../../features/finance/invoiceService';
import { getBranches } from '../../features/branches/branchesService';
import { getCurrentUser } from '../../features/auth/authService';
import { 
    Plus, Loader2, Edit2, Trash2, Search, CheckCircle, 
    Printer, X, Building2, Download, TrendingUp, Calendar, Check, 
    Sparkles, ChevronLeft, ChevronRight, RotateCcw, Users, FileText, 
    ArrowUpRight, RefreshCw, Banknote, CreditCard
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import StudentStatementModal from './StudentStatementModal';
import BulkPaymentModal from './BulkPaymentModal';
import { SyncFeesModal } from './SyncFeesModal';
import * as XLSX from 'xlsx';
import { saveWorkbook } from '../../utils/fileDownloader';


interface SelectedCourse {
    enrollment_id: string;
    course_name: string;
    base_fee?: number;
    unit_discount?: number;
    amount: string;
    discount: string;
    payment_description?: string;
}

const PaymentsList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirmPayment, setDeleteConfirmPayment] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [newPayment, setNewPayment] = useState({ student_id: '', courses: [] as SelectedCourse[], method: 'CASH', reference_number: '', description: '', tuition_months: [''], payment_type: 'TUITION', branch_id: '' });
    const [selectedPayment, setSelectedPayment] = useState<any>(null);
    const [lastInvoice, setLastInvoice] = useState<{ id: number; invoice_number: string } | null>(null);
    const [downloadingPaymentId, setDownloadingPaymentId] = useState<string | null>(null);

    const handleDownloadPaymentReceipt = async (payment: any) => {
        try {
            setDownloadingPaymentId(payment.id);
            await downloadInvoicePdf(payment.id, payment.student_name || 'recibo');
        } catch (err: any) {
            console.error('Error al descargar recibo:', err);
            alert(err.response?.data?.message || 'No se pudo descargar el comprobante en este momento.');
        } finally {
            setDownloadingPaymentId(null);
        }
    };

    // Toolbar & Statement States
    const [statementStudent, setStatementStudent] = useState<{ id: string; name: string } | null>(null);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [isStatementSearchOpen, setIsStatementSearchOpen] = useState(false);
    const [statementSearchTerm, setStatementSearchTerm] = useState('');

    const { data: payments, isLoading } = useQuery({
        queryKey: ['payments'],
        queryFn: getPayments,
    });

    const user = getCurrentUser();
    const isSecretary = user?.role === 'secretary';

    const { data: branches } = useQuery({
        queryKey: ['branches-list'],
        queryFn: getBranches,
        enabled: !user?.branch_id && isModalOpen
    });

    const { data: enrollments } = useQuery({
        queryKey: ['enrollments'],
        queryFn: getEnrollments,
        enabled: isModalOpen || isStatementSearchOpen || isBulkModalOpen
    });

    const createMutation = useMutation({
        mutationFn: createPayment,
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['pendingPaymentsReport'] });
            queryClient.invalidateQueries({ queryKey: ['financialReport'] });
            if (data.invoice_id) {
                setLastInvoice({ id: data.invoice_id, invoice_number: data.invoice_number || 'REC-NEW' });
            } else {
                setIsModalOpen(false);
                setNewPayment({ student_id: '', courses: [], method: 'CASH', reference_number: '', description: '', tuition_months: [''], payment_type: 'TUITION', branch_id: '' });
            }
            setSearchTerm('');
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || "Error al registrar pago");
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: any) => updatePayment(selectedPayment.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['pendingPaymentsReport'] });
            queryClient.invalidateQueries({ queryKey: ['financialReport'] });
            setIsModalOpen(false);
            setSelectedPayment(null);
            setSearchTerm('');
            setNewPayment({ student_id: '', courses: [], method: 'CASH', reference_number: '', description: '', tuition_months: [''], payment_type: 'TUITION', branch_id: '' });
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || "Error al actualizar pago");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deletePayment,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            queryClient.invalidateQueries({ queryKey: ['pendingPaymentsReport'] });
            queryClient.invalidateQueries({ queryKey: ['financialReport'] });
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || "Error al eliminar pago");
        }
    });

    const handleDelete = (payment: any) => {
        setDeleteConfirmPayment(payment);
    };

    const confirmDeletePayment = () => {
        if (deleteConfirmPayment) {
            deleteMutation.mutate(deleteConfirmPayment.id || deleteConfirmPayment);
            setDeleteConfirmPayment(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedPayment && (!newPayment.student_id || newPayment.courses.length === 0)) {
            alert('Debe seleccionar un estudiante y al menos un curso a pagar.');
            return;
        }

        // Validate all courses have an amount
        if (newPayment.courses.some(c => c.amount === '' || Number(c.amount) < 0)) {
            alert('Por favor ingrese un monto válido para todos los cursos seleccionados.');
            return;
        }

        const tMonthRaw = newPayment.payment_type === 'TUITION' ? newPayment.tuition_months.filter(m => m !== '').join(', ') : undefined;
        let formattedMonths = '';
        if (tMonthRaw) {
            formattedMonths = tMonthRaw.split(', ').map(m => {
                if (m.match(/^\d{4}-\d{2}$/)) {
                    const d = new Date(m + '-01T00:00:00');
                    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(/^./, (str) => str.toUpperCase());
                }
                return m;
            }).join(', ');
        }

        const data = {
            student_id: newPayment.student_id,
            courses: newPayment.courses.map(c => {
                let generatedDesc = c.payment_description;
                if (!generatedDesc) {
                    if (newPayment.payment_type === 'TUITION') {
                        generatedDesc = formattedMonths
                            ? `Colegiatura de ${formattedMonths} - ${c.course_name}`
                            : `Colegiatura - ${c.course_name}`;
                    } else if (newPayment.payment_type === 'ENROLLMENT') {
                        generatedDesc = `Inscripción - ${c.course_name}`;
                    } else if (newPayment.payment_type === 'UNIFORM') {
                        generatedDesc = `Uniforme - ${c.course_name}`;
                    } else if (newPayment.payment_type === 'MATERIALS') {
                        generatedDesc = `Materiales - ${c.course_name}`;
                    } else {
                        generatedDesc = `Pago - ${c.course_name}`;
                    }
                }
                return {
                    enrollment_id: c.enrollment_id,
                    amount: Number(c.amount),
                    discount: Number(c.discount || '0'),
                    payment_description: generatedDesc
                };
            }),
            method: newPayment.method,
            reference_number: newPayment.reference_number,
            description: newPayment.description,
            tuition_month: tMonthRaw,
            payment_type: newPayment.payment_type,
            branch_id: newPayment.branch_id || undefined
        };

        if (selectedPayment) {
            updateMutation.mutate(data);
        } else {
            createMutation.mutate(data);
        }
    };

    const handleEdit = (payment: any) => {
        setSelectedPayment(payment);
        const base = Number(payment.amount) + Number(payment.discount || 0);
        setNewPayment({
            student_id: payment.student_id || '',
            courses: payment.enrollment_id ? [{
                enrollment_id: payment.enrollment_id,
                course_name: payment.course_name,
                base_fee: base,
                amount: payment.amount.toString(),
                discount: payment.discount ? payment.discount.toString() : '0'
            }] : [],
            method: payment.method,
            reference_number: payment.reference_number || '',
            description: payment.description || '',
            tuition_months: payment.tuition_month ? payment.tuition_month.split(', ') : [''],
            payment_type: payment.payment_type || 'TUITION',
            branch_id: payment.branch_id || ''
        });
        setSearchTerm(payment.student_name || '');
        setIsModalOpen(true);
    };

    const handleNewPayment = () => {
        setSelectedPayment(null);
        setLastInvoice(null);
        setSearchTerm('');
        setNewPayment({ student_id: '', courses: [], method: 'CASH', reference_number: '', description: '', tuition_months: [''], payment_type: 'TUITION', branch_id: '' });
        setIsModalOpen(true);
    };

    const uniqueStudents = Array.from(new Map(enrollments?.map((e: any) => [e.student_id, e])).values());

    const filteredStudents = uniqueStudents.filter((e: any) =>
        e.student_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handlePayFromStatement = (studentId: string, studentName: string, pendingCourses: any[]) => {
        setSelectedPayment(null);
        setLastInvoice(null);
        setSearchTerm(studentName);
        setNewPayment({
            student_id: studentId,
            courses: pendingCourses.map(pc => ({
                enrollment_id: pc.enrollment_id,
                course_name: pc.course_name,
                amount: String(pc.pending_amount || pc.monthly_fee || '150'),
                discount: '0'
            })),
            method: 'CASH',
            reference_number: '',
            description: 'Liquidación de Saldo Pendiente',
            tuition_months: [''],
            payment_type: 'TUITION',
            branch_id: ''
        });
        setStatementStudent(null);
        setIsModalOpen(true);
    };

    const handleOpenStatement = (payment: any) => {
        const studentId = payment.student_id || (enrollments as any[])?.find((e: any) => e.id === payment.enrollment_id)?.student_id;
        if (studentId) {
            setStatementStudent({ id: studentId, name: payment.student_name });
        } else {
            const match = (uniqueStudents as any[]).find((s: any) => s.student_name?.toLowerCase() === (payment.student_name || '').toLowerCase());
            if (match) {
                setStatementStudent({ id: match.student_id, name: match.student_name });
            } else {
                alert(`No se pudo asociar el identificador del alumno para ${payment.student_name}.`);
            }
        }
    };

    const studentEnrollments = enrollments?.filter((e: any) => e.student_id === newPayment.student_id) || [];

    const [selectedYear, setSelectedYear] = useState<number>(2026);
    const [useManualMonthInput, setUseManualMonthInput] = useState(false);

    // Fetch student statement to detect paid and pending months
    const { data: studentStatement } = useQuery({
        queryKey: ['studentStatement', newPayment.student_id],
        queryFn: () => getStudentStatement(newPayment.student_id),
        enabled: !!newPayment.student_id && isModalOpen
    });

    // Set of paid months
    const paidMonthsSet = useMemo(() => {
        const set = new Set<string>();
        if (!studentStatement?.payments) return set;
        studentStatement.payments.forEach(p => {
            if (p.payment_type === 'TUITION' && p.tuition_month) {
                p.tuition_month.split(/[,;]\s*/).forEach(m => {
                    const match = m.trim().match(/^(\d{4}-\d{2})/);
                    if (match) set.add(match[1]);
                });
            }
        });
        return set;
    }, [studentStatement]);

    // Current month string
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Earliest start month
    const earliestStartMonth = useMemo(() => {
        if (!studentStatement?.courses || studentStatement.courses.length === 0) return `${selectedYear}-01`;
        let earliest = `${selectedYear}-01`;
        studentStatement.courses.forEach(c => {
            const d = c.start_date || c.enrollment_date;
            if (d) {
                const ym = d.substring(0, 7);
                if (ym < earliest) earliest = ym;
            }
        });
        return earliest;
    }, [studentStatement, selectedYear]);

    // List of pending months up to current month
    const pendingMonthsList = useMemo(() => {
        const list: string[] = [];
        if (!newPayment.student_id) return list;

        const [startYear, startMonth] = earliestStartMonth.split('-').map(Number);
        const [currYear, currMonth] = currentMonthStr.split('-').map(Number);

        const d = new Date(startYear, startMonth - 1, 1);
        const limitDate = new Date(currYear, currMonth - 1, 1);

        while (d <= limitDate) {
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!paidMonthsSet.has(ym)) {
                list.push(ym);
            }
            d.setMonth(d.getMonth() + 1);
        }
        return list;
    }, [earliestStartMonth, currentMonthStr, paidMonthsSet, newPayment.student_id]);

    const MONTH_NAMES = [
        { num: '01', short: 'Ene', name: 'Enero' },
        { num: '02', short: 'Feb', name: 'Febrero' },
        { num: '03', short: 'Mar', name: 'Marzo' },
        { num: '04', short: 'Abr', name: 'Abril' },
        { num: '05', short: 'May', name: 'Mayo' },
        { num: '06', short: 'Jun', name: 'Junio' },
        { num: '07', short: 'Jul', name: 'Julio' },
        { num: '08', short: 'Ago', name: 'Agosto' },
        { num: '09', short: 'Sep', name: 'Septiembre' },
        { num: '10', short: 'Oct', name: 'Octubre' },
        { num: '11', short: 'Nov', name: 'Noviembre' },
        { num: '12', short: 'Dic', name: 'Diciembre' }
    ];

    const updateTuitionMonths = (monthsList: string[]) => {
        const validMonths = monthsList.filter(m => m.trim() !== '');
        const count = validMonths.length || 1;

        setNewPayment(prev => {
            const prevValid = prev.tuition_months.filter(m => m !== '').length || 1;

            const updatedCourses = prev.courses.map(c => {
                const unitBase = c.base_fee !== undefined ? c.base_fee : (Number(c.amount) / prevValid);
                const unitDisc = c.unit_discount !== undefined ? c.unit_discount : (Number(c.discount || 0) / prevValid);

                const totalCourseBase = unitBase * count;
                const totalCourseDisc = unitDisc * count;
                const totalCourseNet = Math.max(0, totalCourseBase - totalCourseDisc);

                return {
                    ...c,
                    base_fee: unitBase,
                    unit_discount: unitDisc,
                    discount: totalCourseDisc > 0 ? String(totalCourseDisc) : '0',
                    amount: String(totalCourseNet)
                };
            });

            return {
                ...prev,
                tuition_months: monthsList,
                courses: updatedCourses
            };
        });
    };

    const handleMonthChipClick = (targetMonthKey: string) => {
        if (paidMonthsSet.has(targetMonthKey)) return;

        // If clicking a month already selected
        if (newPayment.tuition_months.includes(targetMonthKey)) {
            const remaining = newPayment.tuition_months.filter(m => m < targetMonthKey);
            updateTuitionMonths(remaining);
            return;
        }

        // Chronological order rule:
        const earliestPending = pendingMonthsList[0] || targetMonthKey;
        const startKey = earliestPending < targetMonthKey ? earliestPending : targetMonthKey;

        const [startYear, startM] = startKey.split('-').map(Number);
        const [targetYear, targetM] = targetMonthKey.split('-').map(Number);

        const d = new Date(startYear, startM - 1, 1);
        const end = new Date(targetYear, targetM - 1, 1);

        const monthsToSelect: string[] = [];
        while (d <= end) {
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!paidMonthsSet.has(ym)) {
                monthsToSelect.push(ym);
            }
            d.setMonth(d.getMonth() + 1);
        }

        const merged = Array.from(new Set([...newPayment.tuition_months.filter(m => m !== ''), ...monthsToSelect])).sort();
        updateTuitionMonths(merged);
    };

    const handlePayNextPending = () => {
        const next = pendingMonthsList[0];
        if (next) {
            updateTuitionMonths([next]);
        }
    };

    const handlePayUpToCurrent = () => {
        if (pendingMonthsList.length > 0) {
            updateTuitionMonths([...pendingMonthsList]);
        }
    };

    const handleClearMonths = () => {
        updateTuitionMonths([]);
    };

    // Auto select first pending month when statement is loaded
    useEffect(() => {
        if (!newPayment.student_id || !studentStatement) return;
        const currentMonths = newPayment.tuition_months.filter(m => m !== '');
        if (currentMonths.length === 0 && pendingMonthsList.length > 0) {
            updateTuitionMonths([pendingMonthsList[0]]);
        }
    }, [newPayment.student_id, studentStatement, pendingMonthsList]);

    const selectStudent = (studentId: string, studentName: string) => {
        const studentEnrolls = enrollments?.filter((en: any) => en.student_id === studentId) || [];
        const initialCourses: SelectedCourse[] = studentEnrolls.map((en: any) => {
            const rawFee = Number(en.monthly_fee || 150);
            let disc = 0;
            if (en.scholarship_type === 'PERCENTAGE' && Number(en.scholarship_amount) > 0) {
                disc = (rawFee * Number(en.scholarship_amount)) / 100;
            } else if (en.scholarship_type === 'FIXED_AMOUNT' && Number(en.scholarship_amount) > 0) {
                disc = Number(en.scholarship_amount);
            }
            const net = Math.max(0, rawFee - disc);
            return {
                enrollment_id: en.id,
                course_name: en.course_name,
                base_fee: rawFee,
                unit_discount: disc,
                discount: disc > 0 ? String(disc) : '0',
                amount: String(net)
            };
        });

        setNewPayment(prev => ({
            ...prev,
            student_id: studentId,
            courses: initialCourses,
            tuition_months: []
        }));
        setSearchTerm(studentName);
        setIsDropdownOpen(false);
    };

    const handleCourseToggle = (enrollment: any) => {
        setNewPayment(prev => {
            const exists = prev.courses.some(c => c.enrollment_id === enrollment.id);
            if (exists) {
                return { ...prev, courses: prev.courses.filter(c => c.enrollment_id !== enrollment.id) };
            } else {
                const count = prev.tuition_months.filter(m => m !== '').length || 1;
                const rawFee = Number(enrollment.monthly_fee || 150);
                let disc = 0;
                if (enrollment.scholarship_type === 'PERCENTAGE' && Number(enrollment.scholarship_amount) > 0) {
                    disc = (rawFee * Number(enrollment.scholarship_amount)) / 100;
                } else if (enrollment.scholarship_type === 'FIXED_AMOUNT' && Number(enrollment.scholarship_amount) > 0) {
                    disc = Number(enrollment.scholarship_amount);
                }
                const net = Math.max(0, (rawFee - disc) * count);
                return {
                    ...prev,
                    courses: [...prev.courses, {
                        enrollment_id: enrollment.id,
                        course_name: enrollment.course_name,
                        base_fee: rawFee,
                        unit_discount: disc,
                        discount: (disc * count) > 0 ? String(disc * count) : '0',
                        amount: String(net)
                    }]
                };
            }
        });
    };

    const handleBaseFeeChange = (enrollment_id: string, value: string) => {
        const count = newPayment.tuition_months.filter(m => m !== '').length || 1;
        setNewPayment(prev => ({
            ...prev,
            courses: prev.courses.map(c => {
                if (c.enrollment_id !== enrollment_id) return c;
                const unitBase = Number(value) || 0;
                const unitDisc = c.unit_discount !== undefined ? c.unit_discount : (Number(c.discount || 0) / count);
                const totalBase = unitBase * count;
                const totalDisc = unitDisc * count;
                const net = Math.max(0, totalBase - totalDisc);
                return {
                    ...c,
                    base_fee: unitBase,
                    unit_discount: unitDisc,
                    discount: totalDisc > 0 ? String(totalDisc) : '0',
                    amount: String(net)
                };
            })
        }));
    };

    const handleDiscountChange = (enrollment_id: string, value: string) => {
        const count = newPayment.tuition_months.filter(m => m !== '').length || 1;
        setNewPayment(prev => ({
            ...prev,
            courses: prev.courses.map(c => {
                if (c.enrollment_id !== enrollment_id) return c;
                const totalDisc = Number(value) || 0;
                const unitDisc = totalDisc / count;
                const unitBase = c.base_fee !== undefined ? c.base_fee : (Number(c.amount) / count + unitDisc);
                const totalBase = unitBase * count;
                const net = Math.max(0, totalBase - totalDisc);
                return {
                    ...c,
                    base_fee: unitBase,
                    unit_discount: unitDisc,
                    discount: value,
                    amount: String(net)
                };
            })
        }));
    };

    const calculateTotal = () => {
        return newPayment.courses.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    };

    const calculateTotalBase = () => {
        return newPayment.courses.reduce((sum, c) => {
            const count = newPayment.tuition_months.filter(m => m !== '').length || 1;
            const base = c.base_fee !== undefined ? (c.base_fee * count) : (Number(c.amount) + Number(c.discount || 0));
            return sum + base;
        }, 0);
    };

    const calculateTotalDiscount = () => {
        return newPayment.courses.reduce((sum, c) => sum + (Number(c.discount) || 0), 0);
    };

    // Helper to format tuition months compactly
    const renderTuitionMonthsBadge = (tuitionMonthStr: string | null | undefined) => {
        if (!tuitionMonthStr) return null;
        const items = tuitionMonthStr.split(/[,;]\s*/).map(m => m.trim()).filter(Boolean);
        if (items.length === 0) return null;

        const formatMonthShort = (str: string) => {
            if (str.match(/^\d{4}-\d{2}$/)) {
                const d = new Date(str + '-01T00:00:00');
                return d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
            }
            return str;
        };

        if (items.length <= 2) {
            return (
                <div className="flex flex-wrap gap-1">
                    {items.map((m, idx) => (
                        <span key={idx} className="text-[11px] text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700/80 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80">
                            {formatMonthShort(m)}
                        </span>
                    ))}
                </div>
            );
        }

        const first = formatMonthShort(items[0]);
        const last = formatMonthShort(items[items.length - 1]);
        const allFormatted = items.map(formatMonthShort).join(', ');

        return (
            <span 
                title={`Meses incluidos: ${allFormatted}`}
                className="text-[11px] text-blue-600 dark:text-blue-400 font-bold border border-blue-500/30 px-2.5 py-0.5 rounded-full bg-blue-500/10 cursor-help inline-flex items-center gap-1 shadow-sm"
            >
                <span>{items.length} meses</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">({first} &rarr; {last})</span>
            </span>
        );
    };

    // Filter & Pagination States
    const [tableSearchTerm, setTableSearchTerm] = useState('');
    const [datePeriod, setDatePeriod] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [methodFilter, setMethodFilter] = useState<'ALL' | 'CASH' | 'TRANSFER' | 'CARD'>('ALL');
    const [filterType, setFilterType] = useState<'ALL' | 'TUITION' | 'OTHER'>('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    const formatLocalYYYYMMDD = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const filteredPayments = useMemo(() => {
        if (!payments) return [];
        const now = new Date();
        const todayStr = formatLocalYYYYMMDD(now);
        const yDate = new Date();
        yDate.setDate(yDate.getDate() - 1);
        const yesterdayStr = formatLocalYYYYMMDD(yDate);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        return payments.filter((p: any) => {
            // Type filter
            if (filterType === 'TUITION' && p.payment_type !== 'TUITION') return false;
            if (filterType === 'OTHER' && p.payment_type === 'TUITION') return false;

            // Method filter
            if (methodFilter !== 'ALL') {
                if (methodFilter === 'TRANSFER') {
                    if (p.method !== 'TRANSFER' && p.method !== 'DEPOSIT') return false;
                } else if (p.method !== methodFilter) {
                    return false;
                }
            }

            // Date period filter (Solo para Administradores; Secretaría ya viene filtrada a hoy desde el backend)
            if (!isSecretary) {
                const pDate = new Date(p.payment_date);
                const pDateStr = formatLocalYYYYMMDD(pDate);

                if (datePeriod === 'TODAY' && pDateStr !== todayStr) return false;
                if (datePeriod === 'YESTERDAY' && pDateStr !== yesterdayStr) return false;
                if (datePeriod === 'WEEK' && pDate < sevenDaysAgo) return false;
                if (datePeriod === 'MONTH' && (pDate.getFullYear() !== now.getFullYear() || pDate.getMonth() !== now.getMonth())) return false;
                if (datePeriod === 'CUSTOM') {
                    if (customStartDate && pDateStr < customStartDate) return false;
                    if (customEndDate && pDateStr > customEndDate) return false;
                }
            }

            // Search filter
            if (tableSearchTerm.trim()) {
                const term = tableSearchTerm.toLowerCase();
                const studentMatch = (p.student_name || '').toLowerCase().includes(term);
                const courseMatch = (p.course_name || '').toLowerCase().includes(term);
                const descMatch = (p.description || '').toLowerCase().includes(term);
                const refMatch = (p.reference_number || '').toLowerCase().includes(term);
                const monthMatch = (p.tuition_month || '').toLowerCase().includes(term);
                const amountMatch = String(p.amount || '').includes(term);
                if (!studentMatch && !courseMatch && !descMatch && !refMatch && !monthMatch && !amountMatch) {
                    return false;
                }
            }

            return true;
        });
    }, [payments, filterType, methodFilter, datePeriod, customStartDate, customEndDate, tableSearchTerm]);

    // Reset pagination to page 1 on filter/search change
    useEffect(() => {
        setCurrentPage(1);
    }, [tableSearchTerm, datePeriod, customStartDate, customEndDate, methodFilter, filterType, pageSize]);

    const totalPages = Math.ceil(filteredPayments.length / pageSize) || 1;
    const paginatedPayments = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredPayments.slice(start, start + pageSize);
    }, [filteredPayments, currentPage, pageSize]);

    // Metrics
    const totalCollectedAll = payments?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
    const filteredTotalAmount = useMemo(() => {
        return filteredPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    }, [filteredPayments]);

    const filteredCashAmount = useMemo(() => {
        return filteredPayments.filter((p: any) => p.method === 'CASH').reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    }, [filteredPayments]);

    const filteredTransferAmount = useMemo(() => {
        return filteredPayments.filter((p: any) => p.method === 'TRANSFER' || p.method === 'DEPOSIT').reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    }, [filteredPayments]);

    const filteredCardAmount = useMemo(() => {
        return filteredPayments.filter((p: any) => p.method === 'CARD').reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
    }, [filteredPayments]);

    const tuitionCount = payments?.filter((p: any) => p.payment_type === 'TUITION').length || 0;
    const otherCount = payments?.filter((p: any) => p.payment_type !== 'TUITION').length || 0;
    const isFiltered = Boolean(tableSearchTerm.trim() || datePeriod !== 'ALL' || methodFilter !== 'ALL' || filterType !== 'ALL');

    const exportToExcel = async () => {
        if (!filteredPayments || filteredPayments.length === 0) {
            alert('No hay registros de pagos para exportar con los filtros seleccionados.');
            return;
        }

        const dataToExport = filteredPayments.map((p: any) => {
            const typeMap: any = {
                'TUITION': 'Mensualidad',
                'ENROLLMENT': 'Inscripción',
                'UNIFORM': 'Uniforme',
                'MATERIALS': 'Materiales',
                'OTHER': 'Otro'
            };
            
            let formattedMonth = '';
            if (p.payment_type === 'TUITION' && p.tuition_month) {
                formattedMonth = p.tuition_month.split(', ').map((m: string) => m.match(/^\d{4}-\d{2}$/)
                    ? new Date(m + '-01T00:00:00').toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
                    : m).join(', ');
            }

            return {
                'ID Pago': p.id,
                'Estudiante': p.student_name,
                'Curso': p.course_name,
                'Concepto': typeMap[p.payment_type] || p.payment_type,
                'Mes(es)': formattedMonth,
                'Descripción': p.description || '',
                'Monto (Q)': Number(p.amount),
                'Descuento (Q)': Number(p.discount || 0),
                'Método': p.method === 'CASH' ? 'Efectivo' : (p.method === 'TRANSFER' || p.method === 'DEPOSIT') ? 'Transferencia/Depósito' : p.method === 'CARD' ? 'Tarjeta' : p.method,
                'Referencia': p.reference_number || '',
                'Fecha de Pago': new Date(p.payment_date).toLocaleDateString(),
                'Registrado Por': p.created_by_name || ''
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Pagos");
        const suffix = datePeriod !== 'ALL' ? `_${datePeriod.toLowerCase()}` : '';
        await saveWorkbook(workbook, `Reporte_Pagos${suffix}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Gestión Financiera</h2>
                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">Control de ingresos, colegiaturas y caja operativa.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={exportToExcel}
                        title="Exportar a Excel los datos filtrados"
                        className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-sm active:scale-95 font-semibold text-xs md:text-sm"
                    >
                        <Download className="h-4 w-4" />
                        <span>Exportar ({filteredPayments.length})</span>
                    </button>
                    <button
                        onClick={() => setIsStatementSearchOpen(true)}
                        title="Consultar Estado de Cuenta de un Estudiante"
                        className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-brand-teal hover:bg-teal-600 text-white rounded-xl transition-all shadow-sm active:scale-95 font-semibold text-xs md:text-sm"
                    >
                        <FileText className="h-4 w-4" />
                        <span>Estado de Cuenta</span>
                    </button>
                    <button
                        onClick={() => setIsBulkModalOpen(true)}
                        title="Cobro Masivo por Curso/Grupo"
                        className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-brand-purple hover:bg-purple-600 text-white rounded-xl transition-all shadow-sm active:scale-95 font-semibold text-xs md:text-sm"
                    >
                        <Users className="h-4 w-4" />
                        <span>Cobro por Grupo</span>
                    </button>
                    <button
                        onClick={() => setIsSyncModalOpen(true)}
                        title="Conciliar y Sincronizar Cuotas del Mes"
                        className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-sm active:scale-95 font-semibold text-xs md:text-sm"
                    >
                        <RefreshCw className="h-4 w-4" />
                        <span>Conciliar Cuotas</span>
                    </button>
                    <button
                        onClick={handleNewPayment}
                        className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-gradient-to-r from-brand-purple to-brand-blue text-white rounded-xl hover:opacity-95 transition-all shadow-md shadow-brand-purple/25 active:scale-95 font-semibold text-xs md:text-sm"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Registrar Pago</span>
                    </button>
                </div>
            </div>

            {/* Stitch Financial Summary Card */}
            <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-black border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 md:p-6 shadow-xl overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-teal/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                                {isSecretary ? 'Cobrado Hoy por Ti' : (isFiltered ? 'Total Filtrado' : 'Total Recaudado')}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" /> {isSecretary ? 'Turno en vivo' : (isFiltered ? 'Vista Filtrada' : '+8.4%')}
                            </span>
                        </div>
                        <div className="text-3xl md:text-4xl font-black text-brand-teal tracking-tight flex items-baseline gap-2">
                            <span>Q{filteredTotalAmount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</span>
                            {isFiltered && (
                                <span className="text-xs font-semibold text-slate-400">
                                    (de Q{totalCollectedAll.toLocaleString('es-GT', { minimumFractionDigits: 2 })} histórico)
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                            <span>Cobros listados: <strong className="text-white">{filteredPayments.length}</strong></span>
                            <span>•</span>
                            <span>Colegiaturas: <strong className="text-white">{filteredPayments.filter((p: any) => p.payment_type === 'TUITION').length}</strong></span>
                        </div>
                    </div>

                    {/* Desglose rápido por método (Arqueo de Caja) */}
                    <div className="grid grid-cols-3 gap-2.5 w-full lg:w-auto">
                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center min-w-[100px]">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <Banknote className="h-3 w-3 text-emerald-400" /> Efectivo
                            </span>
                            <span className="text-sm font-black text-emerald-400 mt-1">
                                Q{filteredCashAmount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center min-w-[100px]">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-blue-400" /> Bancos
                            </span>
                            <span className="text-sm font-black text-blue-400 mt-1">
                                Q{filteredTransferAmount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/5 flex flex-col items-center justify-center min-w-[100px]">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <CreditCard className="h-3 w-3 text-purple-400" /> Tarjeta
                            </span>
                            <span className="text-sm font-black text-purple-400 mt-1">
                                Q{filteredCardAmount.toLocaleString('es-GT', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comprehensive Toolbar: Search, Period Chips, Method & Type */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-3xl p-4 shadow-sm space-y-3.5">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* Real-time Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={tableSearchTerm}
                            onChange={(e) => setTableSearchTerm(e.target.value)}
                            placeholder="Buscar por estudiante, curso, recibo o referencia..."
                            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                        {tableSearchTerm && (
                            <button
                                onClick={() => setTableSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded-full"
                                title="Limpiar búsqueda"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Method Dropdown */}
                    <div className="flex items-center gap-2">
                        <select
                            value={methodFilter}
                            onChange={(e) => setMethodFilter(e.target.value as any)}
                            className="px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
                        >
                            <option value="ALL">Todos los Métodos</option>
                            <option value="CASH">💵 Efectivo</option>
                            <option value="TRANSFER">🏦 Transferencia / Depósito</option>
                            <option value="CARD">💳 Tarjeta</option>
                        </select>
                    </div>
                </div>

                {/* Second row: Period selector and Type Tabs */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
                    {/* Date Period Chips (Solo para Administradores; Secretaría tiene vista exclusiva de turno diario) */}
                    {isSecretary ? (
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold shadow-sm">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>Turno Diario Activo</span>
                                <span className="text-[11px] text-emerald-400/80 font-normal">
                                    (Cobros de Hoy)
                                </span>
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" /> Periodo:
                            </span>
                            {[
                                { key: 'ALL', label: 'Todos' },
                                { key: 'TODAY', label: 'Hoy' },
                                { key: 'YESTERDAY', label: 'Ayer' },
                                { key: 'WEEK', label: 'Esta Semana' },
                                { key: 'MONTH', label: 'Este Mes' },
                                { key: 'CUSTOM', label: 'Personalizado' },
                            ].map((period) => (
                                <button
                                    key={period.key}
                                    onClick={() => setDatePeriod(period.key as any)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                        datePeriod === period.key
                                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                                            : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                                    }`}
                                >
                                    {period.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Type Filter Chips (Colegiaturas vs Otros) */}
                    <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 custom-scrollbar">
                        <button
                            onClick={() => setFilterType('ALL')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                filterType === 'ALL'
                                    ? 'bg-brand-blue text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                            }`}
                        >
                            Todos ({payments?.length || 0})
                        </button>
                        <button
                            onClick={() => setFilterType('TUITION')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                filterType === 'TUITION'
                                    ? 'bg-brand-blue text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                            }`}
                        >
                            Colegiaturas ({tuitionCount})
                        </button>
                        <button
                            onClick={() => setFilterType('OTHER')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                filterType === 'OTHER'
                                    ? 'bg-brand-blue text-white shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-750'
                            }`}
                        >
                            Inscripción y Otros ({otherCount})
                        </button>
                    </div>
                </div>

                {/* Custom Date Range Picker Accordion (Solo para Administrador) */}
                {!isSecretary && datePeriod === 'CUSTOM' && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Desde:</label>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Hasta:</label>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30"
                            />
                        </div>
                        {(customStartDate || customEndDate) && (
                            <button
                                onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                                className="text-xs text-rose-500 hover:underline font-semibold ml-auto"
                            >
                                Limpiar Fechas
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Mobile Cards Feed */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
                {paginatedPayments.map((payment: any) => (
                    <div
                        key={`mob-${payment.id}`}
                        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/5 rounded-2xl p-4 shadow-sm space-y-3"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <button
                                    onClick={() => handleOpenStatement(payment)}
                                    className="font-bold text-sm text-slate-900 dark:text-white hover:text-brand-teal transition-colors text-left flex items-center gap-1"
                                    title="Ver Estado de Cuenta"
                                >
                                    <span className="truncate">{payment.student_name}</span>
                                    <ArrowUpRight className="h-3 w-3 text-brand-teal shrink-0" />
                                </button>
                                <p className="text-xs text-slate-500 truncate">{payment.course_name}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <span className="text-base font-black text-brand-teal">Q{payment.amount}</span>
                                <span className="block text-[10px] text-slate-400 font-semibold">{payment.method}</span>
                            </div>
                        </div>

                        {/* Concept with compact months badge */}
                        <div className="space-y-1 pt-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-[10px] font-bold">
                                    {payment.payment_type === 'TUITION' ? 'Mensualidad' :
                                        payment.payment_type === 'ENROLLMENT' ? 'Inscripción' :
                                        payment.payment_type === 'UNIFORM' ? 'Uniforme' :
                                        payment.payment_type === 'MATERIALS' ? 'Materiales' : 'Otro'}
                                </span>
                                {payment.payment_type === 'TUITION' && renderTuitionMonthsBadge(payment.tuition_month)}
                            </div>
                            {payment.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{payment.description}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-xs text-slate-400">
                            <span>Fecha: <strong className="text-slate-300">{new Date(payment.payment_date).toLocaleDateString()}</strong></span>
                            {payment.reference_number && (
                                <span>Ref: <strong className="text-slate-300">{payment.reference_number}</strong></span>
                            )}
                        </div>

                        {/* Action buttons (Clean and always visible) */}
                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
                            <button
                                onClick={() => handleDownloadPaymentReceipt(payment)}
                                disabled={downloadingPaymentId === payment.id}
                                className="px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 dark:text-blue-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50"
                                title="Descargar Recibo Oficial"
                            >
                                {downloadingPaymentId === payment.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Printer className="h-3.5 w-3.5" />
                                )}
                                <span>Recibo</span>
                            </button>
                            <button
                                onClick={() => handleOpenStatement(payment)}
                                className="px-2.5 py-1.5 bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                                title="Estado de Cuenta"
                            >
                                <FileText className="h-3.5 w-3.5" />
                                <span>Estado</span>
                            </button>
                            <button
                                onClick={() => handleEdit(payment)}
                                className="p-1.5 text-slate-400 hover:text-amber-400 bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors"
                                title="Editar Pago"
                            >
                                <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => handleDelete(payment)}
                                className="p-1.5 text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"
                                title="Eliminar Pago"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
                {paginatedPayments.length === 0 && (
                    <div className="text-center py-12 text-slate-400 text-sm bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/5">
                        No se encontraron pagos con los filtros aplicados.
                    </div>
                )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block glass-card rounded-3xl overflow-hidden shadow-xl border border-slate-200/80 dark:border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/50">
                            <tr>
                                <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Estudiante</th>
                                <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Curso</th>
                                <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Concepto</th>
                                <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Monto</th>
                                <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Método</th>
                                <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest">Fecha</th>
                                <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 bg-white/50 dark:bg-transparent">
                            {paginatedPayments.map((payment: any) => (
                                <tr key={payment.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => handleOpenStatement(payment)}
                                            className="font-bold text-slate-900 dark:text-white hover:text-brand-teal transition-colors text-left flex items-center gap-1.5 group/name"
                                            title="Ver Estado de Cuenta y Solvencia"
                                        >
                                            <span>{payment.student_name}</span>
                                            <ArrowUpRight className="h-3.5 w-3.5 text-brand-teal opacity-0 group-hover/name:opacity-100 transition-opacity" />
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">
                                        {payment.course_name}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${payment.payment_type === 'TUITION' ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/20' :
                                                payment.payment_type === 'ENROLLMENT' ? 'bg-brand-purple/10 text-brand-purple border-brand-purple/20' :
                                                    payment.payment_type === 'UNIFORM' ? 'bg-brand-teal/10 text-brand-teal border-brand-teal/20' :
                                                        payment.payment_type === 'MATERIALS' ? 'bg-brand-warning/10 text-brand-warning border-brand-warning/20' :
                                                            'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                                                }`}>
                                                {payment.payment_type === 'TUITION' ? 'Mensualidad' :
                                                    payment.payment_type === 'ENROLLMENT' ? 'Inscripción' :
                                                        payment.payment_type === 'UNIFORM' ? 'Uniforme' :
                                                            payment.payment_type === 'MATERIALS' ? 'Materiales' : 'Otro'}
                                            </span>
                                            {payment.payment_type === 'TUITION' && renderTuitionMonthsBadge(payment.tuition_month)}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                                            {payment.description || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-brand-success bg-brand-success/10 px-2.5 py-1 rounded-lg inline-block border border-brand-success/20">
                                            Q{payment.amount}
                                        </div>
                                        {Number(payment.discount) > 0 && (
                                            <div className="text-xs font-bold text-brand-danger bg-brand-danger/10 px-2 py-0.5 rounded-md inline-block mt-1 border border-brand-danger/20 block w-max">
                                                Desc: Q{payment.discount}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                        <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg whitespace-nowrap">
                                            {payment.method === 'CASH' ? '💵 Efectivo' : (payment.method === 'TRANSFER' || payment.method === 'DEPOSIT') ? '🏦 Transferencia' : payment.method === 'CARD' ? '💳 Tarjeta' : payment.method}
                                        </span>
                                        {payment.reference_number && (
                                            <span className="block text-[10px] text-slate-400 mt-1 font-mono">
                                                Ref: {payment.reference_number}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                                        {new Date(payment.payment_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {/* Actions: Always visible, elegant and clear */}
                                        <div className="flex items-center justify-end space-x-1.5">
                                            <button
                                                onClick={() => handleDownloadPaymentReceipt(payment)}
                                                disabled={downloadingPaymentId === payment.id}
                                                className="p-2 text-blue-500 hover:text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-all disabled:opacity-50"
                                                title="Descargar / Imprimir Recibo Oficial"
                                            >
                                                {downloadingPaymentId === payment.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                                ) : (
                                                    <Printer className="h-4 w-4" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleOpenStatement(payment)}
                                                className="p-2 text-teal-600 dark:text-brand-teal bg-brand-teal/10 hover:bg-brand-teal/20 rounded-xl transition-all"
                                                title="Estado de Cuenta y Solvencia"
                                            >
                                                <FileText className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(payment)}
                                                className="p-2 text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 bg-slate-100 dark:bg-slate-800/80 hover:bg-amber-500/10 rounded-xl transition-all"
                                                title="Editar Pago"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(payment)}
                                                className="p-2 text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-all"
                                                title="Eliminar / Anular Pago"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {paginatedPayments.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">
                                        No se encontraron pagos con los filtros o término de búsqueda aplicado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Mostrando <strong className="text-slate-800 dark:text-white">{filteredPayments.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> a <strong className="text-slate-800 dark:text-white">{Math.min(currentPage * pageSize, filteredPayments.length)}</strong> de <strong className="text-slate-800 dark:text-white">{filteredPayments.length}</strong> pagos
                        {isFiltered && <span className="ml-1 text-slate-400">(filtrados de {payments?.length || 0})</span>}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Page Size Selector */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span>Filas:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                            >
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>
                        </div>

                        {/* Page Navigation */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Página Anterior"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage >= totalPages}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Página Siguiente"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        {lastInvoice ? (
                            <div className="text-center p-8">
                                <div className="flex justify-center mb-6">
                                    <div className="bg-brand-success/20 p-4 rounded-full border border-brand-success/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                                        <CheckCircle className="h-16 w-16 text-brand-success" />
                                    </div>
                                </div>
                                <h3 className="text-3xl font-bold text-slate-900 mb-2">¡Pago Registrado!</h3>
                                <p className="text-slate-500 mb-8 font-medium">El pago se ha procesado correctamente y la factura ha sido generada.</p>

                                <div className="space-y-4">
                                    <button
                                        onClick={() => downloadInvoicePdf(lastInvoice.id, lastInvoice.invoice_number)}
                                        className="w-full flex items-center justify-center space-x-2 py-4 bg-brand-blue text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(13,89,242,0.3)] active:scale-95 text-lg"
                                    >
                                        <Printer className="h-6 w-6" />
                                        <span>Imprimir Factura / Recibo</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsModalOpen(false);
                                            setLastInvoice(null);
                                            setNewPayment({ student_id: '', courses: [], method: 'CASH', reference_number: '', description: '', tuition_months: [''], payment_type: 'TUITION', branch_id: '' });
                                        }}
                                        className="w-full py-4 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors text-lg"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="bg-gradient-to-r from-brand-blue to-brand-teal p-6 text-white border-b border-white/10 shrink-0">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className="text-2xl font-bold">{selectedPayment ? 'Editar Pago' : 'Registrar Pago'}</h3>
                                            <p className="text-blue-100 text-sm mt-1">{selectedPayment ? 'Modifique los datos del cobro.' : 'Genere un nuevo cobro.'}</p>
                                        </div>
                                        <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors">
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>
                                </div>
                                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                                    {!user?.branch_id && !selectedPayment && (
                                        <div>
                                            <label className="text-sm font-semibold text-slate-700 ml-1 flex items-center">
                                                <Building2 className="h-4 w-4 mr-1 text-slate-400" />
                                                Sede *
                                            </label>
                                            <select
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-700"
                                                value={newPayment.branch_id}
                                                onChange={(e) => setNewPayment({ ...newPayment, branch_id: e.target.value })}
                                                required={!user?.branch_id}
                                            >
                                                <option value="">Seleccione una sede...</option>
                                                {branches?.map((branch: any) => (
                                                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {!selectedPayment && (
                                        <div className="relative">
                                            <label className="block text-sm font-semibold text-slate-700 ml-1">Estudiante</label>
                                            <div className="relative mt-2">
                                                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-brand-blue transition-colors" />
                                                <input
                                                    type="text"
                                                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all placeholder:text-slate-400"
                                                    placeholder="Buscar estudiante..."
                                                    value={searchTerm}
                                                    onChange={(e) => {
                                                        setSearchTerm(e.target.value);
                                                        setIsDropdownOpen(true);
                                                        setNewPayment({ ...newPayment, student_id: '', courses: [] });
                                                    }}
                                                    onFocus={() => setIsDropdownOpen(true)}
                                                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                                />
                                            </div>

                                            {isDropdownOpen && (
                                                <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto overflow-hidden animate-in fade-in slide-in-from-top-1">
                                                    {filteredStudents && filteredStudents.length > 0 ? (
                                                        filteredStudents.map((e: any) => (
                                                            <div
                                                                key={e.student_id}
                                                                className="px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors"
                                                                onClick={() => selectStudent(e.student_id, e.student_name)}
                                                            >
                                                                <div className="font-bold text-slate-900 dark:text-white">{e.student_name}</div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="px-5 py-4 text-sm text-slate-500 text-center bg-slate-50/50">No se encontraron resultados</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {!selectedPayment && newPayment.student_id && studentEnrollments.length > 0 && (
                                        <div className="bg-slate-50 dark:bg-slate-800/40 p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                                            {studentEnrollments.length === 1 ? (
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs uppercase font-extrabold text-slate-500 dark:text-slate-400 tracking-wider">
                                                            Curso Asignado
                                                        </span>
                                                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                                                            {studentEnrollments[0].course_name}
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                                Cuota / Monto Base (Q)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                required
                                                                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20"
                                                                value={newPayment.courses[0]?.base_fee ?? newPayment.courses[0]?.amount ?? studentEnrollments[0].monthly_fee ?? 150}
                                                                onChange={(e) => handleBaseFeeChange(studentEnrollments[0].id, e.target.value)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-rose-600 dark:text-rose-400 mb-1.5 flex items-center justify-between">
                                                                <span>Descuento / Beca (Q)</span>
                                                                <span className="text-[10px] bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded font-bold">Resta al total</span>
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                placeholder="0.00"
                                                                className="w-full px-3.5 py-2.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 rounded-xl font-bold text-rose-600 dark:text-rose-400 outline-none focus:ring-2 focus:ring-rose-500/20"
                                                                value={newPayment.courses[0]?.discount || ''}
                                                                onChange={(e) => handleDiscountChange(studentEnrollments[0].id, e.target.value)}
                                                            />
                                                        </div>
                                                    </div>

                                                    {Number(newPayment.courses[0]?.discount || 0) > 0 && (
                                                        <div className="flex items-center justify-between text-xs px-3.5 py-2 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-900/40">
                                                            <span>Descuento aplicado al alumno:</span>
                                                            <strong className="font-extrabold">- Q{Number(newPayment.courses[0]?.discount).toFixed(2)}</strong>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="text-xs font-extrabold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                                                            Cursos del Estudiante ({studentEnrollments.length})
                                                        </label>
                                                        <span className="text-[11px] text-slate-400">Marca los cursos a cobrar</span>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {studentEnrollments.map((enrollment: any) => {
                                                            const selectedCourse = newPayment.courses.find(c => c.enrollment_id === enrollment.id);
                                                            const isSelected = !!selectedCourse;

                                                            return (
                                                                <div key={enrollment.id} className={`p-3.5 rounded-xl border transition-all ${isSelected ? 'bg-white dark:bg-slate-900 border-brand-blue/40 shadow-sm' : 'border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30 opacity-70'}`}>
                                                                    <label className="flex items-center space-x-3 cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="w-4 h-4 text-brand-blue rounded border-slate-300 focus:ring-brand-blue"
                                                                            checked={isSelected}
                                                                            onChange={() => handleCourseToggle(enrollment)}
                                                                        />
                                                                        <span className="text-sm font-bold text-slate-800 dark:text-white">{enrollment.course_name}</span>
                                                                    </label>

                                                                    {isSelected && (
                                                                        <div className="grid grid-cols-2 gap-3 mt-3 pl-7">
                                                                            <div>
                                                                                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Cuota (Q)</label>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    required
                                                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-white"
                                                                                    value={selectedCourse.base_fee ?? selectedCourse.amount}
                                                                                    onChange={(e) => handleBaseFeeChange(enrollment.id, e.target.value)}
                                                                                />
                                                                            </div>
                                                                            <div>
                                                                                <label className="block text-[11px] font-bold text-rose-500 dark:text-rose-400 mb-1 flex items-center justify-between">
                                                                                    <span>Descuento (Q)</span>
                                                                                    <span className="text-[10px] text-rose-400">Resta</span>
                                                                                </label>
                                                                                <input
                                                                                    type="number"
                                                                                    min="0"
                                                                                    placeholder="0.00"
                                                                                    className="w-full px-3 py-2 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-lg text-sm font-bold text-rose-600 dark:text-rose-400"
                                                                                    value={selectedCourse.discount}
                                                                                    onChange={(e) => handleDiscountChange(enrollment.id, e.target.value)}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 ml-1">Tipo de Cobro</label>
                                            <select
                                                required
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-slate-700"
                                                value={newPayment.payment_type}
                                                onChange={(e) => setNewPayment({ ...newPayment, payment_type: e.target.value })}
                                            >
                                                <option value="TUITION">Mensualidad</option>
                                                <option value="ENROLLMENT">Inscripción</option>
                                                <option value="UNIFORM">Uniforme(s)</option>
                                                <option value="MATERIALS">Materiales</option>
                                                <option value="OTHER">Otro concepto</option>
                                            </select>
                                        </div>
                                    </div>

                                    {newPayment.payment_type === 'TUITION' && (
                                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                                            {/* Header: Año y Contador */}
                                            <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-700/80 pb-2.5">
                                                <div className="flex items-center space-x-2">
                                                    <Calendar className="h-4 w-4 text-brand-blue shrink-0" />
                                                    <span className="text-sm font-bold text-slate-800 dark:text-white">
                                                        Meses de Colegiatura
                                                    </span>
                                                    {newPayment.tuition_months.filter(m => m !== '').length > 0 && (
                                                        <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-brand-blue text-white shadow-sm">
                                                            {newPayment.tuition_months.filter(m => m !== '').length} {newPayment.tuition_months.filter(m => m !== '').length === 1 ? 'mes' : 'meses'}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Selector de Año Compacto */}
                                                <div className="flex items-center space-x-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-sm">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedYear(y => y - 1)}
                                                        className="p-1 text-slate-500 hover:text-brand-blue dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                                        title="Año anterior"
                                                    >
                                                        <ChevronLeft className="h-3.5 w-3.5" />
                                                    </button>
                                                    <span className="text-xs font-black text-slate-800 dark:text-white px-1.5 select-none">
                                                        {selectedYear}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedYear(y => y + 1)}
                                                        className="p-1 text-slate-500 hover:text-brand-blue dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                                        title="Año siguiente"
                                                    >
                                                        <ChevronRight className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Atajos Rápidos Compactos */}
                                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                                {pendingMonthsList.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={handlePayNextPending}
                                                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-bold border border-amber-500/30 transition-all active:scale-95"
                                                    >
                                                        <Sparkles className="h-3 w-3 text-amber-500" />
                                                        <span>Siguiente ({MONTH_NAMES.find(m => `${selectedYear}-${m.num}` === pendingMonthsList[0])?.short || pendingMonthsList[0]})</span>
                                                    </button>
                                                )}

                                                {pendingMonthsList.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={handlePayUpToCurrent}
                                                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue dark:text-blue-300 rounded-lg text-xs font-bold border border-brand-blue/30 transition-all active:scale-95"
                                                    >
                                                        <Sparkles className="h-3 w-3" />
                                                        <span>Pendientes ({pendingMonthsList.length})</span>
                                                    </button>
                                                )}

                                                {newPayment.tuition_months.filter(m => m !== '').length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={handleClearMonths}
                                                        className="inline-flex items-center space-x-1 px-2 py-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg text-xs font-semibold transition-colors"
                                                    >
                                                        <RotateCcw className="h-3 w-3" />
                                                        <span>Limpiar</span>
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => setUseManualMonthInput(!useManualMonthInput)}
                                                    className="text-[11px] text-slate-400 hover:text-brand-blue underline ml-auto py-1"
                                                >
                                                    {useManualMonthInput ? 'Cuadrícula' : 'Modo manual'}
                                                </button>
                                            </div>

                                            {/* Vista Manual o Parrilla Visual */}
                                            {useManualMonthInput ? (
                                                <div className="space-y-2 pt-1">
                                                    {newPayment.tuition_months.map((month, index) => (
                                                        <div key={index} className="flex items-center space-x-2">
                                                            <input
                                                                type="month"
                                                                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20 text-sm"
                                                                value={month}
                                                                onChange={(e) => {
                                                                    const copy = [...newPayment.tuition_months];
                                                                    copy[index] = e.target.value;
                                                                    updateTuitionMonths(copy);
                                                                }}
                                                            />
                                                            {newPayment.tuition_months.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const copy = newPayment.tuition_months.filter((_, i) => i !== index);
                                                                        updateTuitionMonths(copy);
                                                                    }}
                                                                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => updateTuitionMonths([...newPayment.tuition_months, ''])}
                                                        className="flex items-center space-x-1 text-xs text-brand-blue font-bold px-2 py-1 hover:bg-brand-blue/10 rounded-lg transition-colors"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                        <span>Agregar mes manual</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div>
                                                    {/* Grid de 12 Meses Compacto y Uniforme (4 cols móvil, 6 cols desktop) */}
                                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 sm:gap-2">
                                                        {MONTH_NAMES.map((m) => {
                                                            const monthKey = `${selectedYear}-${m.num}`;
                                                            const isPaid = paidMonthsSet.has(monthKey);
                                                            const isSelected = newPayment.tuition_months.includes(monthKey);
                                                            const isCurrent = monthKey === currentMonthStr;
                                                            const isPending = pendingMonthsList.includes(monthKey);

                                                            return (
                                                                <button
                                                                    key={m.num}
                                                                    type="button"
                                                                    disabled={isPaid}
                                                                    onClick={() => handleMonthChipClick(monthKey)}
                                                                    className={`h-11 sm:h-12 w-full rounded-xl flex flex-col items-center justify-center p-1 border transition-all ${
                                                                        isPaid
                                                                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400 opacity-60 cursor-not-allowed'
                                                                            : isSelected
                                                                            ? 'bg-brand-blue text-white border-brand-blue shadow-md shadow-brand-blue/30 scale-[1.02] z-10'
                                                                            : isPending
                                                                            ? 'bg-amber-500/10 border-amber-500/35 text-amber-700 dark:text-amber-300 hover:border-amber-400 hover:bg-amber-500/20 active:scale-95'
                                                                            : isCurrent
                                                                            ? 'bg-blue-500/5 border-brand-blue/70 dark:border-brand-blue/80 ring-1 ring-brand-blue/50 text-brand-blue dark:text-blue-300 hover:bg-blue-500/15 active:scale-95'
                                                                            : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/70 text-slate-700 dark:text-slate-300 hover:border-brand-blue/60 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95'
                                                                    }`}
                                                                >
                                                                    <span className={`text-xs font-black uppercase tracking-wider leading-none ${isSelected ? 'text-white' : ''}`}>
                                                                        {m.short}
                                                                    </span>

                                                                    <div className="mt-1 leading-none">
                                                                        {isPaid ? (
                                                                            <span className="flex items-center text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                                                                <Check className="h-2.5 w-2.5 mr-0.5 inline" />
                                                                                Pagado
                                                                            </span>
                                                                        ) : isSelected ? (
                                                                            <span className="flex items-center text-[9px] font-black text-white">
                                                                                <Check className="h-2.5 w-2.5 mr-0.5 inline stroke-[3]" />
                                                                                Cobrar
                                                                            </span>
                                                                        ) : isPending ? (
                                                                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                                                                                Pendiente
                                                                            </span>
                                                                        ) : isCurrent ? (
                                                                            <span className="text-[9px] font-bold text-brand-blue dark:text-blue-400">
                                                                                Actual
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[9px] text-slate-400 dark:text-slate-500">
                                                                                Disponible
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Leyenda Compacta */}
                                                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 dark:text-slate-400 pt-2 px-1 gap-2 border-t border-slate-200/60 dark:border-slate-700/60 mt-2">
                                                        <div className="flex items-center space-x-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                                                            <span>Pagado</span>
                                                        </div>
                                                        <div className="flex items-center space-x-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                                                            <span>Pendiente</span>
                                                        </div>
                                                        <div className="flex items-center space-x-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-brand-blue inline-block"></span>
                                                            <span>Cobrar</span>
                                                        </div>
                                                        <div className="flex items-center space-x-1.5">
                                                            <span className="w-2 h-2 rounded-full ring-2 ring-brand-blue inline-block"></span>
                                                            <span>Mes actual</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                Total a Pagar (Q)
                                            </label>
                                            {calculateTotalDiscount() > 0 && (
                                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                                                    Descuento: - Q{calculateTotalDiscount().toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-4 top-3 font-black text-slate-400 text-xl select-none">Q</span>
                                            <input
                                                type="text"
                                                readOnly
                                                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-brand-success text-2xl focus:outline-none"
                                                value={calculateTotal().toFixed(2)}
                                            />
                                        </div>
                                        {calculateTotalDiscount() > 0 && (
                                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1 pt-1">
                                                <span>Subtotal: Q{calculateTotalBase().toFixed(2)}</span>
                                                <span>Descuento: - Q{calculateTotalDiscount().toFixed(2)}</span>
                                                <strong className="text-brand-success font-extrabold">Neto a cobrar: Q{calculateTotal().toFixed(2)}</strong>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 ml-1">Método de Pago</label>
                                        <select
                                            required
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-slate-700"
                                            value={newPayment.method}
                                            onChange={(e) => setNewPayment({ ...newPayment, method: e.target.value })}
                                        >
                                            <option value="CASH">Efectivo</option>
                                            <option value="TRANSFER">Transferencia</option>
                                            <option value="CARD">Tarjeta</option>
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Descripción</label>
                                            <input
                                                type="text"
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all placeholder:text-slate-400 text-slate-800 dark:text-white"
                                                placeholder="Ej. Colegiatura, Inscripción..."
                                                value={newPayment.description}
                                                onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">Referencia (Opcional)</label>
                                            <input
                                                type="text"
                                                className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all placeholder:text-slate-400 text-slate-800 dark:text-white"
                                                placeholder="No. Boleta / Transacción"
                                                value={newPayment.reference_number}
                                                onChange={(e) => setNewPayment({ ...newPayment, reference_number: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex space-x-4 pt-6 mt-4 border-t border-slate-100 dark:border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setIsModalOpen(false)}
                                            className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={createMutation.isPending || updateMutation.isPending}
                                            className="flex-1 px-6 py-3 bg-brand-blue text-white font-bold rounded-xl hover:bg-blue-600 shadow-[0_0_15px_rgba(13,89,242,0.3)] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                                        >
                                            {createMutation.isPending || updateMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>{selectedPayment ? 'Actualizar Pago' : 'Registrar Pago'}</span>}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Modal de Búsqueda para Estado de Cuenta */}
            {isStatementSearchOpen && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
                    <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-brand-teal/10 text-brand-teal">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Estado de Cuenta</h3>
                                    <p className="text-xs text-slate-500">Selecciona un estudiante para ver su solvencia e historial</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setIsStatementSearchOpen(false); setStatementSearchTerm(''); }}
                                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre de estudiante..."
                                value={statementSearchTerm}
                                onChange={(e) => setStatementSearchTerm(e.target.value)}
                                autoFocus
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal text-slate-900 dark:text-white placeholder-slate-400"
                            />
                        </div>

                        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100 dark:divide-slate-800/50">
                            {uniqueStudents
                                .filter((s: any) => s.student_name?.toLowerCase().includes(statementSearchTerm.toLowerCase()))
                                .slice(0, 30)
                                .map((student: any) => (
                                    <button
                                        key={student.student_id}
                                        onClick={() => {
                                            setStatementStudent({ id: student.student_id, name: student.student_name });
                                            setIsStatementSearchOpen(false);
                                            setStatementSearchTerm('');
                                        }}
                                        className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition text-left group"
                                    >
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-brand-teal transition-colors">
                                                {student.student_name}
                                            </p>
                                            <p className="text-xs text-slate-400">{student.course_name || 'Estudiante activo'}</p>
                                        </div>
                                        <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-brand-teal group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                                    </button>
                                ))}
                            {uniqueStudents.filter((s: any) => s.student_name?.toLowerCase().includes(statementSearchTerm.toLowerCase())).length === 0 && (
                                <div className="text-center py-8 text-xs text-slate-400">
                                    No se encontraron estudiantes que coincidan con "{statementSearchTerm}".
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal de Estado de Cuenta y Solvencia */}
            <StudentStatementModal
                isOpen={!!statementStudent}
                studentId={statementStudent?.id || null}
                studentName={statementStudent?.name}
                onClose={() => setStatementStudent(null)}
                onPayBalance={handlePayFromStatement}
            />

            {/* Modal de Cobro Masivo por Grupo */}
            <BulkPaymentModal
                isOpen={isBulkModalOpen}
                onClose={() => setIsBulkModalOpen(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['payments'] });
                }}
            />

            {/* Modal de Conciliación de Cuotas */}
            <SyncFeesModal
                isOpen={isSyncModalOpen}
                onClose={() => setIsSyncModalOpen(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['payments'] });
                    queryClient.invalidateQueries({ queryKey: ['pendingPaymentsReport'] });
                    queryClient.invalidateQueries({ queryKey: ['financialReport'] });
                }}
            />

            {/* Modal de Confirmación para Eliminar Pago */}
            <ConfirmModal
                isOpen={!!deleteConfirmPayment}
                title="¿Eliminar Registro de Pago?"
                description={
                    <div className="space-y-1.5">
                        <p>¿Estás seguro de eliminar este registro de pago por <strong className="text-rose-400">Q{Number(deleteConfirmPayment?.total_amount || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}</strong>?</p>
                        <p className="text-[11px] text-slate-400">Esta acción no se puede deshacer y revertirá los estados financieros asociados al recibo.</p>
                    </div>
                }
                confirmText="Sí, Eliminar"
                cancelText="Cancelar"
                variant="danger"
                isLoading={deleteMutation.isPending}
                onConfirm={confirmDeletePayment}
                onClose={() => setDeleteConfirmPayment(null)}
            />
        </div>
    );
};

export default PaymentsList;
