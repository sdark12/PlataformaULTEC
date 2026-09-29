import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
    getLeaderboard, 
    awardPoints, 
    awardPointsBulk,
    getRewards, 
    createReward, 
    updateReward, 
    deleteReward, 
    getStudentBalance,
    getClaims,
    deliverClaim,
    cancelClaim,
    type LeaderboardEntry, 
    type Reward,
    type MeritTransaction,
    type RewardClaim
} from './meritsService';
import { getCourses, type Course } from '../academic/academicService';
import { 
    Award, 
    Trophy, 
    Plus, 
    Edit2, 
    Trash2, 
    Search, 
    Coins, 
    Gift, 
    History, 
    PlusCircle, 
    MinusCircle, 
    Loader2, 
    X,
    Save,
    CheckCircle2,
    Clock,
    XCircle,
    Users,
    Printer,
    Sparkles,
    Check,
    AlertCircle,
    ShoppingBag,
    Crown,
    RotateCcw
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';

export const getStudentLeague = (pts: number) => {
    if (pts >= 500) return { name: 'Platino', badge: '👑 Platino', min: 500, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/40' };
    if (pts >= 250) return { name: 'Oro', badge: '🥇 Oro', min: 250, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40' };
    if (pts >= 100) return { name: 'Plata', badge: '🥈 Plata', min: 100, color: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 border-slate-300 dark:border-slate-600' };
    return { name: 'Bronce', badge: '🥉 Bronce', min: 0, color: 'text-amber-800 dark:text-amber-500 bg-amber-50/70 dark:bg-amber-950/20 border-amber-300/40' };
};

const PRESETS = [
    { label: '+10 Participación', points: 10, desc: 'Participación activa y constructiva en clase' },
    { label: '+15 Tarea Destacada', points: 15, desc: 'Entrega destacada y puntual de tarea o proyecto' },
    { label: '+10 Compañerismo', points: 10, desc: 'Apoyo y colaboración ejemplar con compañeros' },
    { label: '+50 Ganador Debate / Concurso', points: 50, desc: '1er Lugar en dinámica de debate o concurso académico' },
    { label: '-10 Falta de Conducta', points: -10, desc: 'Penalización por conducta o retraso reiterado' },
];

const BULK_PRESETS = [
    { label: '🏆 Ganadores Debate (+50)', points: 50, desc: '1er Lugar: Ganadores de Dinámica de Debate' },
    { label: '🥈 2do Lugar / Debate (+25)', points: 25, desc: 'Participación Destacada y Subcampeón de Debate' },
    { label: '🌟 Dinámica de Equipo (+20)', points: 20, desc: 'Trabajo colaborativo y dinámica grupal en clase' },
    { label: '📚 Proyecto Práctico (+15)', points: 15, desc: 'Entrega destacada de proyecto práctico grupal' },
    { label: '⭐ Asistencia y Puntualidad (+10)', points: 10, desc: 'Puntualidad y asistencia a la sesión completa' }
];

const MeritsAdmin: React.FC = () => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [claims, setClaims] = useState<RewardClaim[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'students' | 'claims' | 'rewards'>('students');

    // Filters for students
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedLeague, setSelectedLeague] = useState<string>('all');
    const [filterOnlyWithBalance, setFilterOnlyWithBalance] = useState(false);

    // Filters for claims
    const [claimStatusFilter, setClaimStatusFilter] = useState<'all' | 'pending' | 'delivered' | 'cancelled'>('all');
    const [claimSearch, setClaimSearch] = useState('');

    // Detailed student view
    const [selectedStudent, setSelectedStudent] = useState<LeaderboardEntry | null>(null);
    const [studentHistory, setStudentHistory] = useState<MeritTransaction[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Modals
    const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
    const [awardPointsVal, setAwardPointsVal] = useState(10);
    const [awardDesc, setAwardDesc] = useState('');
    const [isSubmittingAward, setIsSubmittingAward] = useState(false);

    // Bulk award modal with student/team selection
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [bulkCourseId, setBulkCourseId] = useState('');
    const [bulkCourseStudents, setBulkCourseStudents] = useState<LeaderboardEntry[]>([]);
    const [loadingBulkStudents, setLoadingBulkStudents] = useState(false);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [bulkStudentSearch, setBulkStudentSearch] = useState('');
    const [bulkPointsVal, setBulkPointsVal] = useState(50);
    const [bulkDesc, setBulkDesc] = useState('1er Lugar: Ganadores de Dinámica de Debate');
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
    const [bulkSuccessNotice, setBulkSuccessNotice] = useState<string | null>(null);

    // Honor Roll Preview & Print Modal
    const [isHonorRollModalOpen, setIsHonorRollModalOpen] = useState(false);
    const [honorRollCourseId, setHonorRollCourseId] = useState('');
    const [honorRollStudents, setHonorRollStudents] = useState<LeaderboardEntry[]>([]);
    const [loadingHonorRoll, setLoadingHonorRoll] = useState(false);

    // Reward modal
    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
    const [editingReward, setEditingReward] = useState<Reward | null>(null);
    const [rewardTitle, setRewardTitle] = useState('');
    const [rewardDesc, setRewardDesc] = useState('');
    const [rewardPoints, setRewardPoints] = useState(50);
    const [rewardStock, setRewardStock] = useState<string>('');
    const [rewardImage, setRewardImage] = useState('');
    const [isSubmittingReward, setIsSubmittingReward] = useState(false);
    const [deleteRewardConfirm, setDeleteRewardConfirm] = useState<{ id: string; title: string } | null>(null);
    const [deliverClaimConfirm, setDeliverClaimConfirm] = useState<{ id: string; studentName: string; rewardTitle: string } | null>(null);
    const [isDeletingReward, setIsDeletingReward] = useState(false);
    const [isDeliveringClaim, setIsDeliveringClaim] = useState(false);

    // Feedback
    const [notice, setNotice] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showNotice = (msg: string, type: 'success' | 'error' = 'success') => {
        setNotice({ msg, type });
        setTimeout(() => setNotice(null), 4000);
    };

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const [lead, rew, clm, crs] = await Promise.all([
                getLeaderboard(selectedCourseId || undefined),
                getRewards(),
                getClaims(),
                getCourses().catch(() => [])
            ]);
            setLeaderboard(lead);
            setRewards(rew);
            setClaims(clm);
            setCourses(crs);
        } catch (error) {
            console.error("Error loading administrative merits data:", error);
            showNotice("Error al cargar datos de méritos", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, [selectedCourseId]);

    // Refresh claims tab
    const reloadClaims = async () => {
        try {
            const clm = await getClaims();
            setClaims(clm);
        } catch (error) {
            console.error("Error refreshing claims:", error);
        }
    };

    // Fetch students when bulk course changes
    useEffect(() => {
        if (!bulkCourseId) {
            setBulkCourseStudents([]);
            setSelectedStudentIds([]);
            setBulkSuccessNotice(null);
            return;
        }

        const fetchCourseStudents = async () => {
            try {
                setLoadingBulkStudents(true);
                setBulkSuccessNotice(null);
                const students = await getLeaderboard(bulkCourseId);
                setBulkCourseStudents(students);
                // Select all students by default
                setSelectedStudentIds(students.map(s => s.id));
            } catch (err) {
                console.error("Error fetching course students for bulk award:", err);
                showNotice("Error al cargar los estudiantes del curso", "error");
            } finally {
                setLoadingBulkStudents(false);
            }
        };

        fetchCourseStudents();
    }, [bulkCourseId]);

    // Fetch students for Honor Roll preview modal
    useEffect(() => {
        if (!isHonorRollModalOpen) return;
        const fetchHonorRoll = async () => {
            try {
                setLoadingHonorRoll(true);
                const res = await getLeaderboard(honorRollCourseId || undefined);
                setHonorRollStudents(res);
            } catch (err) {
                console.error("Error loading honor roll:", err);
            } finally {
                setLoadingHonorRoll(false);
            }
        };
        fetchHonorRoll();
    }, [isHonorRollModalOpen, honorRollCourseId]);

    // Bulk selection helpers
    const handleToggleStudentSelection = (id: string) => {
        setSelectedStudentIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSelectAllBulk = () => {
        setSelectedStudentIds(bulkCourseStudents.map(s => s.id));
    };

    const handleDeselectAllBulk = () => {
        setSelectedStudentIds([]);
    };

    const handleInvertBulkSelection = () => {
        setSelectedStudentIds(prev => 
            bulkCourseStudents.filter(s => !prev.includes(s.id)).map(s => s.id)
        );
    };

    // Close modals on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isHonorRollModalOpen) setIsHonorRollModalOpen(false);
                if (isBulkModalOpen) setIsBulkModalOpen(false);
                if (isAwardModalOpen) setIsAwardModalOpen(false);
                if (isRewardModalOpen) setIsRewardModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isHonorRollModalOpen, isBulkModalOpen, isAwardModalOpen, isRewardModalOpen]);

    // Load student history on selection
    const handleSelectStudent = async (student: LeaderboardEntry) => {
        setSelectedStudent(student);
        setLoadingHistory(true);
        try {
            const data = await getStudentBalance(student.id);
            setStudentHistory(data.transactions);
        } catch (err) {
            console.error("Error fetching student history:", err);
            showNotice("Error al cargar historial del estudiante", "error");
        } finally {
            setLoadingHistory(false);
        }
    };

    // Manual Award Submission
    const handleAwardPointsSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudent) return;
        if (!awardDesc.trim()) {
            alert('Por favor, escribe una descripción.');
            return;
        }

        setIsSubmittingAward(true);
        try {
            await awardPoints({
                student_id: selectedStudent.id,
                points: Number(awardPointsVal),
                description: awardDesc
            });

            showNotice(`¡Puntos asignados exitosamente a ${selectedStudent.full_name}!`);
            setIsAwardModalOpen(false);
            setAwardDesc('');
            
            // Reload history and leaderboard
            await handleSelectStudent(selectedStudent);
            const updatedLead = await getLeaderboard(selectedCourseId || undefined);
            setLeaderboard(updatedLead);
        } catch (error) {
            console.error("Error manually awarding points:", error);
            showNotice("Error al asignar puntos manualmente", "error");
        } finally {
            setIsSubmittingAward(false);
        }
    };

    // Bulk Award Submission
    const handleBulkAwardSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bulkCourseId) {
            alert('Por favor selecciona un curso.');
            return;
        }
        if (selectedStudentIds.length === 0) {
            alert('Debes seleccionar al menos a un estudiante para otorgar los puntos.');
            return;
        }
        if (!bulkDesc.trim()) {
            alert('Por favor escribe un motivo.');
            return;
        }

        setIsSubmittingBulk(true);
        try {
            const res = await awardPointsBulk({
                student_ids: selectedStudentIds,
                points: Number(bulkPointsVal),
                description: bulkDesc
            });

            const successMsg = `¡Puntos asignados exitosamente a ${selectedStudentIds.length} estudiante(s)!`;
            showNotice(res.message || successMsg);
            setBulkSuccessNotice(successMsg);
            
            // Reload leaderboard and students in the current bulk course
            const [updatedLead, updatedCourseStudents] = await Promise.all([
                getLeaderboard(selectedCourseId || undefined),
                getLeaderboard(bulkCourseId)
            ]);
            setLeaderboard(updatedLead);
            setBulkCourseStudents(updatedCourseStudents);
        } catch (error: any) {
            console.error("Error bulk awarding points:", error);
            showNotice(error.response?.data?.message || "Error al asignar puntos masivamente", "error");
        } finally {
            setIsSubmittingBulk(false);
        }
    };

    // Rewards CRUD logic
    const handleOpenCreateReward = () => {
        setEditingReward(null);
        setRewardTitle('');
        setRewardDesc('');
        setRewardPoints(50);
        setRewardStock('');
        setRewardImage('');
        setIsRewardModalOpen(true);
    };

    const handleOpenEditReward = (reward: Reward) => {
        setEditingReward(reward);
        setRewardTitle(reward.title);
        setRewardDesc(reward.description || '');
        setRewardPoints(reward.points_required);
        setRewardStock(reward.stock !== null ? String(reward.stock) : '');
        setRewardImage(reward.image_url || '');
        setIsRewardModalOpen(true);
    };

    const handleSaveReward = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rewardTitle.trim() || rewardPoints <= 0) {
            alert("Completa los campos obligatorios.");
            return;
        }

        setIsSubmittingReward(true);
        try {
            const payload = {
                title: rewardTitle,
                description: rewardDesc || undefined,
                points_required: Number(rewardPoints),
                stock: rewardStock.trim() !== '' ? Number(rewardStock) : null,
                image_url: rewardImage || undefined,
                is_active: true
            };

            if (editingReward) {
                await updateReward(editingReward.id, payload);
                showNotice("Recompensa actualizada correctamente.");
            } else {
                await createReward(payload);
                showNotice("Nueva recompensa creada exitosamente.");
            }

            setIsRewardModalOpen(false);
            const updatedRewards = await getRewards();
            setRewards(updatedRewards);
        } catch (error) {
            console.error("Error saving reward:", error);
            showNotice("Error al guardar recompensa", "error");
        } finally {
            setIsSubmittingReward(false);
        }
    };

    const handleDeleteReward = (rewardId: string, title: string) => {
        setDeleteRewardConfirm({ id: rewardId, title });
    };

    const confirmDeleteReward = async () => {
        if (!deleteRewardConfirm) return;
        setIsDeletingReward(true);
        try {
            await deleteReward(deleteRewardConfirm.id);
            showNotice("Recompensa eliminada.");
            const updatedRewards = await getRewards();
            setRewards(updatedRewards);
            setDeleteRewardConfirm(null);
        } catch (error) {
            console.error("Error deleting reward:", error);
            showNotice("Error al eliminar recompensa", "error");
        } finally {
            setIsDeletingReward(false);
        }
    };

    // Claims operations
    const handleDeliverClaim = (claimId: string, studentName: string, rewardTitle: string) => {
        setDeliverClaimConfirm({ id: claimId, studentName, rewardTitle });
    };

    const confirmDeliverClaim = async () => {
        if (!deliverClaimConfirm) return;
        setIsDeliveringClaim(true);
        try {
            await deliverClaim(deliverClaimConfirm.id);
            showNotice(`¡Premio entregado a ${deliverClaimConfirm.studentName}!`);
            await reloadClaims();
            setDeliverClaimConfirm(null);
        } catch (error) {
            console.error("Error delivering claim:", error);
            showNotice("Error al marcar la entrega", "error");
        } finally {
            setIsDeliveringClaim(false);
        }
    };

    const handleCancelClaim = async (claimId: string, studentName: string, rewardTitle: string) => {
        const reason = window.prompt(`Ingresa el motivo de cancelación para "${rewardTitle}" y reembolsar los puntos a ${studentName}:`, "Sin stock físico o solicitud de cancelación");
        if (reason === null) return; // Cancelled prompt

        try {
            await cancelClaim(claimId, reason);
            showNotice(`Canje cancelado. Puntos reembolsados a ${studentName}.`);
            await reloadClaims();
            const [updatedLead, updatedRew] = await Promise.all([
                getLeaderboard(selectedCourseId || undefined),
                getRewards()
            ]);
            setLeaderboard(updatedLead);
            setRewards(updatedRew);
        } catch (error) {
            console.error("Error cancelling claim:", error);
            showNotice("Error al cancelar y reembolsar", "error");
        }
    };

    // Filtered leaderboard
    const filteredLeaderboard = leaderboard.filter(student => {
        const matchesSearch = 
            student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (student.academy_code && student.academy_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (student.personal_code && student.personal_code.toLowerCase().includes(searchQuery.toLowerCase()));

        const studentLeague = getStudentLeague(student.balance).name;
        const matchesLeague = selectedLeague === 'all' || studentLeague === selectedLeague;
        const matchesBalance = !filterOnlyWithBalance || student.balance > 0;

        return matchesSearch && matchesLeague && matchesBalance;
    });

    // Filtered claims
    const filteredClaims = claims.filter(claim => {
        const matchesStatus = claimStatusFilter === 'all' || claim.status === claimStatusFilter;
        const studentName = claim.student?.full_name || '';
        const academyCode = claim.student?.academy_code || claim.student?.personal_code || '';
        const rewardName = claim.reward?.title || claim.description;
        const matchesQuery = 
            studentName.toLowerCase().includes(claimSearch.toLowerCase()) ||
            academyCode.toLowerCase().includes(claimSearch.toLowerCase()) ||
            rewardName.toLowerCase().includes(claimSearch.toLowerCase());

        return matchesStatus && matchesQuery;
    });

    // KPI Metrics calculation
    const totalPointsCirculating = leaderboard.reduce((acc, curr) => acc + (curr.balance > 0 ? curr.balance : 0), 0);
    const topStudent = leaderboard.length > 0 ? leaderboard[0] : null;
    const pendingClaims = claims.filter(c => c.status === 'pending');
    const activeRewards = rewards.filter(r => r.is_active);

    const handleOpenHonorRollModal = () => {
        setHonorRollCourseId(selectedCourseId || '');
        setIsHonorRollModalOpen(true);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px]">
                <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-24 font-sans animate-in fade-in duration-300">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2.5">
                        <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-brand-teal shrink-0" />
                        <span>Control de Méritos y Gamificación</span>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-xs sm:text-sm">
                        Monitoree los puntos oficiales, gestione canjes y entregas físicas de premios, y motive el rendimiento estudiantil.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => {
                            setBulkSuccessNotice(null);
                            setIsBulkModalOpen(true);
                        }}
                        className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 cursor-pointer min-h-[40px]"
                        title="Asignar puntos a grupos o equipos de alumnos"
                    >
                        <Users className="w-4 h-4" />
                        <span>Asignación Grupal</span>
                    </button>

                    <button
                        onClick={handleOpenHonorRollModal}
                        className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 cursor-pointer min-h-[40px]"
                        title="Ver e imprimir Cuadro de Honor institucional"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Cuadro de Honor</span>
                    </button>

                    {activeTab === 'rewards' && (
                        <button
                            onClick={handleOpenCreateReward}
                            className="w-full sm:w-auto bg-brand-blue hover:bg-brand-blue/90 text-white px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm shadow-brand-blue/20 cursor-pointer min-h-[40px]"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Nuevo Premio</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Notice banner */}
            {notice && (
                <div className={`p-3.5 sm:p-4 rounded-xl font-semibold animate-in slide-in-from-top-2 flex items-center justify-between shadow-sm ${
                    notice.type === 'success' 
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40' 
                        : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
                }`}>
                    <span className="flex items-center gap-2 text-xs sm:text-sm">
                        {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500 shrink-0" />}
                        <span>{notice.msg}</span>
                    </span>
                </div>
            )}

            {/* 4 KPI Summary Metric Cards (Compact 2x2 on mobile) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {/* 1. Puntos en Circulación */}
                <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-3 sm:p-5 rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-4">
                    <div className="p-2.5 sm:p-3.5 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-xl sm:rounded-2xl border border-amber-200/60 dark:border-amber-800/30 shrink-0">
                        <Coins className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Puntos Totales</p>
                        <p className="text-base sm:text-2xl font-black text-slate-800 dark:text-white mt-0.5 truncate">
                            {totalPointsCirculating.toLocaleString()} <span className="text-[10px] sm:text-xs font-bold text-slate-400">pts</span>
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate hidden xs:block">Saldo neto estudiantil</p>
                    </div>
                </div>

                {/* 2. Estudiante Líder */}
                <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-3 sm:p-5 rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-4">
                    <div className="p-2.5 sm:p-3.5 bg-yellow-50 dark:bg-yellow-950/40 text-yellow-500 rounded-xl sm:rounded-2xl border border-yellow-200/60 dark:border-yellow-800/30 shrink-0">
                        <Crown className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Líder General</p>
                        <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-white mt-0.5 truncate" title={topStudent?.full_name || 'Sin alumnos'}>
                            {topStudent ? topStudent.full_name : 'Ninguno'}
                        </p>
                        <p className="text-[10px] sm:text-[11px] font-extrabold text-brand-teal truncate">
                            {topStudent ? `${topStudent.balance} pts` : '0 pts'}
                        </p>
                    </div>
                </div>

                {/* 3. Canjes Pendientes */}
                <div 
                    onClick={() => setActiveTab('claims')} 
                    className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-3 sm:p-5 rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-4 cursor-pointer hover:border-brand-teal transition-all group"
                >
                    <div className="p-2.5 sm:p-3.5 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-xl sm:rounded-2xl border border-rose-200/60 dark:border-rose-800/30 group-hover:scale-105 transition-transform shrink-0">
                        <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Canjes Pendientes</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-base sm:text-2xl font-black text-slate-800 dark:text-white">{pendingClaims.length}</span>
                            {pendingClaims.length > 0 && (
                                <span className="px-1.5 py-0.2 text-[9px] font-extrabold rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                                    Por entregar
                                </span>
                            )}
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-brand-blue group-hover:underline mt-0.5 truncate">Ver solicitudes →</p>
                    </div>
                </div>

                {/* 4. Catálogo Activo */}
                <div 
                    onClick={() => setActiveTab('rewards')}
                    className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-3 sm:p-5 rounded-2xl shadow-sm flex items-center gap-2.5 sm:gap-4 cursor-pointer hover:border-brand-blue transition-all group"
                >
                    <div className="p-2.5 sm:p-3.5 bg-blue-50 dark:bg-blue-950/40 text-blue-500 rounded-xl sm:rounded-2xl border border-blue-200/60 dark:border-blue-800/30 group-hover:scale-105 transition-transform shrink-0">
                        <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">Premios Tienda</p>
                        <p className="text-base sm:text-2xl font-black text-slate-800 dark:text-white mt-0.5">{activeRewards.length}</p>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">Disponibles</p>
                    </div>
                </div>
            </div>

            {/* Tab navigation (Mobile Scrollable Segmented Bar) */}
            <div className="bg-slate-100 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
                <button
                    onClick={() => { setActiveTab('students'); setSelectedStudent(null); }}
                    className={`py-2.5 px-3.5 sm:px-5 font-bold text-xs sm:text-sm tracking-wide rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap flex-1 sm:flex-none ${
                        activeTab === 'students' 
                            ? 'bg-white dark:bg-slate-800 text-brand-teal shadow-sm border border-slate-200/50 dark:border-slate-700/50' 
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border border-transparent'
                    }`}
                >
                    <Trophy className="w-4 h-4 shrink-0" />
                    <span>Estudiantes y Puntos</span>
                </button>

                <button
                    onClick={() => setActiveTab('claims')}
                    className={`py-2.5 px-3.5 sm:px-5 font-bold text-xs sm:text-sm tracking-wide rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap flex-1 sm:flex-none relative ${
                        activeTab === 'claims' 
                            ? 'bg-white dark:bg-slate-800 text-brand-teal shadow-sm border border-slate-200/50 dark:border-slate-700/50' 
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border border-transparent'
                    }`}
                >
                    <ShoppingBag className="w-4 h-4 shrink-0" />
                    <span>Solicitudes y Canjes</span>
                    {pendingClaims.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black shrink-0">
                            {pendingClaims.length}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('rewards')}
                    className={`py-2.5 px-3.5 sm:px-5 font-bold text-xs sm:text-sm tracking-wide rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap flex-1 sm:flex-none ${
                        activeTab === 'rewards' 
                            ? 'bg-white dark:bg-slate-800 text-brand-teal shadow-sm border border-slate-200/50 dark:border-slate-700/50' 
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border border-transparent'
                    }`}
                >
                    <Gift className="w-4 h-4 shrink-0" />
                    <span>Gestión de Premios</span>
                </button>
            </div>

            {/* TAB CONTENT: STUDENTS & RANKING */}
            {activeTab === 'students' && (
                <div className="space-y-6 sm:space-y-8">

                    {/* TOP-3 GAMIFIED PODIUM BANNER */}
                    {leaderboard.length >= 2 && (
                        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-brand-blue/30 dark:from-slate-950 dark:via-slate-900 dark:to-brand-teal/10 rounded-3xl p-4 sm:p-8 text-white border border-slate-700/50 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                <Trophy className="w-48 sm:w-64 h-48 sm:h-64 text-brand-teal" />
                            </div>

                            <div className="relative z-10">
                                <div className="text-center max-w-md mx-auto mb-5 sm:mb-8">
                                    <span className="px-3 py-1 rounded-full bg-brand-teal/20 text-brand-teal border border-brand-teal/30 text-[10px] sm:text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5 mb-1.5">
                                        <Sparkles className="w-3.5 h-3.5" /> Podio de Honor Académico
                                    </span>
                                    <h2 className="text-lg sm:text-2xl font-black">Top 3 Estudiantes con Mayor Mérito</h2>
                                </div>

                                {/* Podium Layout: On mobile Champion on top full-width, 2nd & 3rd side by side. On sm+ Olympic 3-column layout */}
                                <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3 sm:gap-4 sm:items-end max-w-3xl mx-auto">
                                    
                                    {/* 1st Place (Winner) - displayed first on mobile */}
                                    {leaderboard[0] && (
                                        <div className="order-1 sm:order-2 bg-gradient-to-b from-yellow-500/20 via-amber-500/10 to-yellow-600/5 backdrop-blur-md border-2 border-yellow-400/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-center flex flex-col items-center shadow-xl relative sm:-translate-y-4 hover:scale-[1.01] transition-transform">
                                            <div className="absolute -top-3.5 px-3 py-0.5 rounded-full bg-yellow-400 text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                                                <Crown className="w-3.5 h-3.5" /> Campeón Actual
                                            </div>
                                            <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 font-black text-xl sm:text-2xl flex items-center justify-center shadow-xl mb-2 sm:mb-3 ring-4 ring-yellow-400/40">
                                                1🥇
                                            </div>
                                            <p className="font-black text-sm sm:text-base text-yellow-300 truncate max-w-full px-2" title={leaderboard[0].full_name}>
                                                {leaderboard[0].full_name}
                                            </p>
                                            <span className="px-2 py-0.5 rounded-md bg-yellow-400/20 font-mono text-[10px] sm:text-[11px] text-yellow-200 mt-1 font-black border border-yellow-400/30">
                                                {leaderboard[0].academy_code || leaderboard[0].personal_code || 'Sin código'}
                                            </span>
                                            <div className="mt-2.5 sm:mt-4 flex items-center gap-1.5 text-yellow-300 font-black text-xl sm:text-2xl">
                                                <Coins className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-400" />
                                                {leaderboard[0].balance} <span className="text-xs text-yellow-200/70">pts</span>
                                            </div>
                                            <span className="text-[10px] sm:text-xs font-black text-yellow-400 mt-0.5 uppercase tracking-wider">
                                                {getStudentLeague(leaderboard[0].balance).badge}
                                            </span>
                                        </div>
                                    )}

                                    {/* 2nd and 3rd Places: on mobile placed in 2-column grid */}
                                    <div className="order-2 grid grid-cols-2 gap-2.5 sm:contents">
                                        {/* 2nd Place */}
                                        {leaderboard[1] && (
                                            <div className="sm:order-1 bg-white/5 backdrop-blur-md border border-slate-500/20 rounded-2xl p-3 sm:p-5 text-center flex flex-col items-center hover:bg-white/10 transition-all">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-300 text-slate-900 font-black text-base sm:text-lg flex items-center justify-center shadow-lg mb-2 sm:mb-3 ring-4 ring-slate-400/30">
                                                    2🥈
                                                </div>
                                                <p className="font-extrabold text-xs sm:text-sm text-white truncate max-w-full px-1" title={leaderboard[1].full_name}>
                                                    {leaderboard[1].full_name}
                                                </p>
                                                <span className="px-1.5 py-0.5 rounded-md bg-white/10 font-mono text-[9px] sm:text-[10px] text-slate-300 mt-1 font-bold truncate max-w-full">
                                                    {leaderboard[1].academy_code || leaderboard[1].personal_code || 'Sin código'}
                                                </span>
                                                <div className="mt-2 sm:mt-3 flex items-center gap-1 text-slate-200 font-black text-sm sm:text-base">
                                                    <Coins className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-brand-teal" />
                                                    {leaderboard[1].balance} <span className="text-[9px] sm:text-[10px] text-slate-400">pts</span>
                                                </div>
                                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5">
                                                    Liga {getStudentLeague(leaderboard[1].balance).name}
                                                </span>
                                            </div>
                                        )}

                                        {/* 3rd Place */}
                                        {leaderboard[2] && (
                                            <div className="sm:order-3 bg-white/5 backdrop-blur-md border border-amber-700/20 rounded-2xl p-3 sm:p-5 text-center flex flex-col items-center hover:bg-white/10 transition-all">
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-amber-600 text-amber-50 font-black text-base sm:text-lg flex items-center justify-center shadow-lg mb-2 sm:mb-3 ring-4 ring-amber-600/30">
                                                    3🥉
                                                </div>
                                                <p className="font-extrabold text-xs sm:text-sm text-white truncate max-w-full px-1" title={leaderboard[2].full_name}>
                                                    {leaderboard[2].full_name}
                                                </p>
                                                <span className="px-1.5 py-0.5 rounded-md bg-white/10 font-mono text-[9px] sm:text-[10px] text-amber-200 mt-1 font-bold truncate max-w-full">
                                                    {leaderboard[2].academy_code || leaderboard[2].personal_code || 'Sin código'}
                                                </span>
                                                <div className="mt-2 sm:mt-3 flex items-center gap-1 text-amber-200 font-black text-sm sm:text-base">
                                                    <Coins className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-brand-teal" />
                                                    {leaderboard[2].balance} <span className="text-[9px] sm:text-[10px] text-slate-400">pts</span>
                                                </div>
                                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5">
                                                    Liga {getStudentLeague(leaderboard[2].balance).name}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filter controls row */}
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row gap-2.5 sm:gap-3 items-stretch md:items-center justify-between">
                        
                        {/* Search field */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o código..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
                            />
                        </div>

                        {/* Dropdowns */}
                        <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3">
                            
                            {/* Course filter */}
                            <select
                                value={selectedCourseId}
                                onChange={e => setSelectedCourseId(e.target.value)}
                                className="px-2.5 sm:px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-brand-blue/20 cursor-pointer min-h-[38px]"
                            >
                                <option value="">Todos los Cursos</option>
                                {courses.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>

                            {/* League filter */}
                            <select
                                value={selectedLeague}
                                onChange={e => setSelectedLeague(e.target.value)}
                                className="px-2.5 sm:px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-brand-blue/20 cursor-pointer min-h-[38px]"
                            >
                                <option value="all">Todas las Ligas</option>
                                <option value="Platino">👑 Platino (500+)</option>
                                <option value="Oro">🥇 Oro (250-499)</option>
                                <option value="Plata">🥈 Plata (100-249)</option>
                                <option value="Bronce">🥉 Bronce (0-99)</option>
                            </select>
                        </div>

                        {/* Only with balance checkbox */}
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none whitespace-nowrap self-start md:self-center">
                            <input
                                type="checkbox"
                                checked={filterOnlyWithBalance}
                                onChange={e => setFilterOnlyWithBalance(e.target.checked)}
                                className="rounded border-slate-300 text-brand-teal focus:ring-brand-teal"
                            />
                            Con saldo &gt; 0
                        </label>
                    </div>

                    {/* Main Content Grid: Leaderboard + History Inspector */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        
                        {/* Leaderboard list */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-sm">
                                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/70 dark:bg-slate-900/20 flex justify-between text-xs font-black text-slate-400 uppercase tracking-wider">
                                    <span>Pos. / Estudiante / Código ULTEC</span>
                                    <span>Liga & Puntos</span>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[600px] overflow-y-auto custom-scrollbar">
                                    {filteredLeaderboard.length === 0 ? (
                                        <p className="text-center py-12 text-slate-400 text-sm">No se encontraron estudiantes con los filtros seleccionados.</p>
                                    ) : (
                                        filteredLeaderboard.map((student, idx) => {
                                            const isSelected = selectedStudent?.id === student.id;
                                            const league = getStudentLeague(student.balance);
                                            const officialCode = student.academy_code || student.personal_code;

                                            return (
                                                <div 
                                                    key={student.id}
                                                    onClick={() => handleSelectStudent(student)}
                                                    className={`px-5 py-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                                                        isSelected 
                                                            ? 'bg-brand-blue/10 dark:bg-brand-blue/5 border-l-4 border-brand-teal' 
                                                            : 'hover:bg-slate-50 dark:hover:bg-slate-750/30'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <span className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-black text-xs ${
                                                            idx === 0 
                                                                ? 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600 border border-yellow-300/40' 
                                                                : idx === 1 
                                                                ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 border border-slate-300/40' 
                                                                : idx === 2 
                                                                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 border border-amber-300/40' 
                                                                : 'text-slate-400 bg-slate-50 dark:bg-slate-800'
                                                        }`}>
                                                            {idx + 1}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-sm text-slate-800 dark:text-white leading-snug truncate">{student.full_name}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                {officialCode ? (
                                                                    <span className="px-2 py-0.5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-cyan-300 font-mono text-[10px] font-black border border-brand-blue/20">
                                                                        {officialCode}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400">Sin código</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${league.color}`}>
                                                            {league.badge}
                                                        </span>
                                                        <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-1 min-w-[70px] justify-end">
                                                            <Coins className="w-4 h-4 text-brand-teal" />
                                                            {student.balance} <span className="text-[10px] text-slate-400 font-bold">pts</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Detailed view (History & Manual adjustments) */}
                        <div className="space-y-6">
                            {selectedStudent ? (
                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-3xl shadow-sm space-y-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                                        <History className="w-24 h-24" />
                                    </div>

                                    <div className="relative z-10 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Estudiante Seleccionado</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${getStudentLeague(selectedStudent.balance).color}`}>
                                                    {getStudentLeague(selectedStudent.balance).badge}
                                                </span>
                                                <button
                                                    onClick={() => setSelectedStudent(null)}
                                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                    title="Cerrar panel de estudiante"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <h3 className="font-black text-lg text-slate-800 dark:text-white">{selectedStudent.full_name}</h3>
                                        <p className="text-xs font-mono font-bold text-brand-blue dark:text-teal-300">
                                            {selectedStudent.academy_code || selectedStudent.personal_code || 'Sin código registrado'}
                                        </p>

                                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50 mt-3">
                                            <span className="text-xs text-slate-400">Saldo Disponible:</span>
                                            <span className="font-extrabold text-base text-brand-teal flex items-center gap-1">
                                                <Coins className="w-4 h-4" />
                                                {selectedStudent.balance} pts
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <button
                                        onClick={() => setIsAwardModalOpen(true)}
                                        className="w-full bg-brand-teal/20 text-brand-teal hover:bg-brand-teal/30 border border-brand-teal/20 px-4 py-2.5 rounded-xl font-black text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                    >
                                        <Award className="w-4 h-4" />
                                        ASIGNAR / DEDUCIR PUNTOS
                                    </button>

                                    {/* Student point ledger log */}
                                    <div className="space-y-3 pt-2">
                                        <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Historial de Transacciones</h4>
                                        
                                        {loadingHistory ? (
                                            <div className="flex justify-center py-6">
                                                <Loader2 className="w-6 h-6 animate-spin text-brand-teal" />
                                            </div>
                                        ) : studentHistory.length === 0 ? (
                                            <p className="text-xs text-slate-400 py-4 text-center">Sin transacciones registradas.</p>
                                        ) : (
                                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                                {studentHistory.map(tx => {
                                                    const isPositive = tx.points > 0;
                                                    return (
                                                        <div 
                                                            key={tx.id} 
                                                            className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl flex items-center justify-between gap-2 border border-slate-100 dark:border-slate-700/20"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-[11px] text-slate-700 dark:text-slate-300 leading-snug truncate">{tx.description}</p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[9px] text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</span>
                                                                    {tx.transaction_type === 'claim' && (
                                                                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md ${
                                                                            tx.status === 'delivered' 
                                                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                                : tx.status === 'cancelled'
                                                                                ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                                                        }`}>
                                                                            {tx.status === 'delivered' ? 'Entregado' : tx.status === 'cancelled' ? 'Cancelado' : 'Por entregar'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <span className={`font-black text-xs shrink-0 ${
                                                                isPositive ? 'text-emerald-500' : 'text-orange-500'
                                                            }`}>
                                                                {isPositive ? '+' : ''}{tx.points} pts
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center text-slate-400">
                                    <History className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                    <p className="font-bold text-sm">Selecciona un estudiante</p>
                                    <p className="text-xs text-slate-500 mt-1">Haz clic sobre un alumno de la lista para ver su historial completo y gestionar sus puntos.</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}

            {/* TAB CONTENT: SOLICITUDES Y CANJES */}
            {activeTab === 'claims' && (
                <div className="space-y-6">
                    
                    {/* Claims filters bar */}
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center justify-between">
                        <div className="relative flex-1 sm:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por alumno, código o premio..."
                                value={claimSearch}
                                onChange={e => setClaimSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20"
                            />
                        </div>

                        {/* Status filter tabs */}
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold overflow-x-auto no-scrollbar">
                            {(['all', 'pending', 'delivered', 'cancelled'] as const).map(st => (
                                <button
                                    key={st}
                                    onClick={() => setClaimStatusFilter(st)}
                                    className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap flex-1 sm:flex-none text-center ${
                                        claimStatusFilter === st 
                                            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                                >
                                    {st === 'all' ? 'Todos' : st === 'pending' ? 'Pendientes ⏳' : st === 'delivered' ? 'Entregados ✅' : 'Cancelados ❌'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Claims list */}
                    {filteredClaims.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-12 rounded-3xl text-center text-slate-400">
                            <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                            <p className="font-bold text-sm">No hay solicitudes de canje con este filtro.</p>
                            <p className="text-xs text-slate-500 mt-1">Los alumnos pueden canjear premios desde su panel de Méritos cuando tengan saldo suficiente.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredClaims.map(claim => {
                                const isPending = claim.status === 'pending';
                                const isDelivered = claim.status === 'delivered';
                                const isCancelled = claim.status === 'cancelled';
                                const studentName = claim.student?.full_name || 'Estudiante';
                                const officialCode = claim.student?.academy_code || claim.student?.personal_code;
                                const rewardTitle = claim.reward?.title || claim.description.replace('Canje de Premio: ', '');

                                return (
                                    <div 
                                        key={claim.id}
                                        className={`bg-white dark:bg-slate-800 border rounded-2xl p-5 shadow-sm transition-all flex flex-col justify-between gap-4 ${
                                            isPending 
                                                ? 'border-amber-300 dark:border-amber-700/60 bg-amber-50/10' 
                                                : isDelivered 
                                                ? 'border-slate-200 dark:border-slate-700/80' 
                                                : 'border-slate-200 dark:border-slate-800 opacity-70'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/40 flex items-center justify-center shrink-0 overflow-hidden">
                                                    {claim.reward?.image_url ? (
                                                        <img src={claim.reward.image_url} alt={rewardTitle} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Gift className="w-6 h-6 text-brand-teal" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-extrabold text-sm text-slate-800 dark:text-white leading-snug truncate" title={rewardTitle}>
                                                        {rewardTitle}
                                                    </h4>
                                                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                                                        {studentName}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {officialCode && (
                                                            <span className="px-2 py-0.5 rounded-md bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-cyan-300 font-mono text-[10px] font-black border border-brand-blue/20">
                                                                {officialCode}
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-slate-400">
                                                            {new Date(claim.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <span className="font-black text-sm text-orange-500 flex items-center justify-end gap-1">
                                                    <Coins className="w-3.5 h-3.5" />
                                                    {claim.points} pts
                                                </span>
                                                <div className="mt-1">
                                                    {isPending && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60 flex items-center gap-1">
                                                            <Clock className="w-3 h-3" /> Pendiente
                                                        </span>
                                                    )}
                                                    {isDelivered && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/60 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" /> Entregado
                                                        </span>
                                                    )}
                                                    {isCancelled && (
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 flex items-center gap-1">
                                                            <XCircle className="w-3 h-3" /> Cancelado
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Delivery Info or Action Buttons */}
                                        <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3 flex items-center justify-between">
                                            {isPending ? (
                                                <div className="flex items-center gap-2 w-full">
                                                    <button
                                                        onClick={() => handleDeliverClaim(claim.id, studentName, rewardTitle)}
                                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                                    >
                                                        <Check className="w-4 h-4" /> Marcar Entregado
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelClaim(claim.id, studentName, rewardTitle)}
                                                        className="bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-slate-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 font-bold py-2 px-3 rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
                                                        title="Cancelar canje y reembolsar puntos"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" /> Reembolsar
                                                    </button>
                                                </div>
                                            ) : isDelivered ? (
                                                <p className="text-[10px] text-slate-400">
                                                    Entregado {claim.delivered_at ? `el ${new Date(claim.delivered_at).toLocaleDateString()}` : ''} 
                                                    {claim.deliverer?.full_name ? ` por ${claim.deliverer.full_name}` : ''}
                                                </p>
                                            ) : (
                                                <p className="text-[10px] text-slate-400 italic">
                                                    Puntos devueltos a la cuenta del estudiante.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: REWARDS */}
            {activeTab === 'rewards' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {rewards.length === 0 ? (
                        <div className="col-span-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-3xl text-center text-slate-400">
                            <Gift className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                            <p className="font-bold text-sm">No has creado premios para la tienda aún.</p>
                            <p className="text-xs text-slate-500 mt-1">Presiona "Nuevo Premio" en la esquina superior para comenzar.</p>
                        </div>
                    ) : (
                        rewards.map((reward) => (
                            <div 
                                key={reward.id} 
                                className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700/80 p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                            >
                                <div className="h-36 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-900/60 rounded-2xl flex items-center justify-center mb-4 relative overflow-hidden border border-slate-200/40 dark:border-slate-700/20">
                                    {reward.image_url ? (
                                        <img 
                                            src={reward.image_url} 
                                            alt={reward.title}
                                            className="object-cover w-full h-full" 
                                        />
                                    ) : (
                                        <Gift className="w-12 h-12 text-brand-teal/40" />
                                    )}
                                    
                                    <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md text-brand-teal font-black text-xs px-2.5 py-1.5 rounded-full flex items-center gap-1">
                                        <Coins className="w-3.5 h-3.5" />
                                        <span>{reward.points_required} pts</span>
                                    </div>
                                </div>

                                <div className="space-y-1.5 flex-1">
                                    <h3 className="font-extrabold text-slate-800 dark:text-white line-clamp-1">{reward.title}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed min-h-[32px]">{reward.description || 'Sin descripción'}</p>
                                </div>

                                <div className="mt-5 border-t border-slate-100 dark:border-slate-700/50 pt-4 flex items-center justify-between gap-4">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                        {reward.stock === null ? 'Ilimitado ♾️' : `Stock: ${reward.stock} uds`}
                                    </span>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleOpenEditReward(reward)}
                                            className="p-2 text-slate-400 hover:text-brand-blue hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteReward(reward.id, reward.title)}
                                            className="p-2 text-slate-400 hover:text-brand-danger hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* MODAL: MANUAL AWARD ADJUSTMENT WITH PRESETS */}
            {isAwardModalOpen && selectedStudent && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsAwardModalOpen(false);
                    }}
                >
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 overflow-hidden relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button
                            onClick={() => setIsAwardModalOpen(false)}
                            className="absolute top-4 right-4 sm:top-5 sm:right-5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg p-1.5 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-3 bg-brand-teal/15 rounded-2xl text-brand-teal">
                                <Award className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-slate-800 dark:text-white">Otorgar Méritos / Puntos</h3>
                                <p className="text-xs text-slate-400">Asignar o deducir puntos a {selectedStudent.full_name}</p>
                            </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="mb-4">
                            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Plantillas Rápidas (1 Clic)</label>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                {PRESETS.map((p, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                            setAwardPointsVal(p.points);
                                            setAwardDesc(p.desc);
                                        }}
                                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-brand-blue/10 dark:hover:bg-brand-blue/20 hover:border-brand-blue/40 text-[10px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <form onSubmit={handleAwardPointsSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cantidad de Puntos</label>
                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setAwardPointsVal(prev => prev - 5)}
                                        className="p-2 text-slate-500 hover:text-brand-blue active:scale-90 transition-all rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                                    >
                                        <MinusCircle className="w-5 h-5" />
                                    </button>
                                    <input
                                        type="number"
                                        value={awardPointsVal}
                                        onChange={e => setAwardPointsVal(Number(e.target.value))}
                                        className="w-full text-center font-black text-2xl text-slate-800 dark:text-white bg-transparent outline-none border-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setAwardPointsVal(prev => prev + 5)}
                                        className="p-2 text-slate-500 hover:text-brand-blue active:scale-90 transition-all rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                                    >
                                        <PlusCircle className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1.5 text-center">Valores negativos aplican deducción de puntos por penalización.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Descripción / Motivo *</label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Ej: Excelente participación en el debate, proyecto destacado, etc..."
                                    value={awardDesc}
                                    onChange={e => setAwardDesc(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-2xl bg-transparent text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAwardModalOpen(false)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer min-h-[42px]"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingAward}
                                    className="flex-1 bg-brand-teal hover:bg-brand-teal/90 text-slate-950 font-black py-2.5 rounded-xl text-xs shadow-lg shadow-brand-teal/20 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[42px]"
                                >
                                    {isSubmittingAward ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Guardar Puntos</span>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL: BULK / TEAM AWARDING */}
            {isBulkModalOpen && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setIsBulkModalOpen(false);
                            setBulkSuccessNotice(null);
                        }
                    }}
                >
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 overflow-hidden relative animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <button
                            onClick={() => {
                                setIsBulkModalOpen(false);
                                setBulkSuccessNotice(null);
                            }}
                            className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg p-1 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-4 shrink-0">
                            <div className="p-3 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-2xl">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-slate-800 dark:text-white">Asignación Grupal y por Equipos</h3>
                                <p className="text-xs text-slate-400">Premia a un curso completo o selecciona equipos/alumnos específicos (debates, dinámicas)</p>
                            </div>
                        </div>

                        {/* Success & Invert Selection Banner */}
                        {bulkSuccessNotice && (
                            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span>{bulkSuccessNotice}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleInvertBulkSelection();
                                        setBulkPointsVal(25);
                                        setBulkDesc('2do Lugar / Participación Destacada en Debate');
                                        setBulkSuccessNotice(null);
                                    }}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
                                    title="Seleccionar el equipo contrario para premiarlos con otro puntaje"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Invertir Selección (Premiar al Otro Equipo)</span>
                                </button>
                            </div>
                        )}

                        <form onSubmit={handleBulkAwardSubmit} className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                            {/* Course selection */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Curso Destino *</label>
                                <select
                                    required
                                    value={bulkCourseId}
                                    onChange={e => setBulkCourseId(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20 cursor-pointer"
                                >
                                    <option value="">Selecciona un curso...</option>
                                    {courses.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Student / Team selection list */}
                            {bulkCourseId && (
                                <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 bg-slate-50/70 dark:bg-slate-900/40">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                Alumnos a premiar:
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-brand-blue/15 text-brand-blue">
                                                {selectedStudentIds.length} de {bulkCourseStudents.length} seleccionados
                                            </span>
                                        </div>

                                        {/* Selection buttons */}
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllBulk}
                                                className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                                            >
                                                Todos
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleDeselectAllBulk}
                                                className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
                                            >
                                                Ninguno
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleInvertBulkSelection}
                                                className="px-2.5 py-1 text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 transition-colors flex items-center gap-1 cursor-pointer"
                                                title="Invertir selección (cambia los seleccionados por los no seleccionados)"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                Invertir
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quick student filter input */}
                                    {bulkCourseStudents.length > 6 && (
                                        <div className="relative mb-2.5">
                                            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar alumno en este curso..."
                                                value={bulkStudentSearch}
                                                onChange={e => setBulkStudentSearch(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-brand-blue"
                                            />
                                        </div>
                                    )}

                                    {/* Students Checklist */}
                                    {loadingBulkStudents ? (
                                        <div className="py-8 flex justify-center items-center text-slate-400 gap-2 text-xs">
                                            <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
                                            <span>Cargando alumnos del curso...</span>
                                        </div>
                                    ) : bulkCourseStudents.length === 0 ? (
                                        <div className="py-6 text-center text-xs text-slate-400">
                                            No se encontraron alumnos inscritos en este curso.
                                        </div>
                                    ) : (
                                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                            {bulkCourseStudents
                                                .filter(s => 
                                                    s.full_name.toLowerCase().includes(bulkStudentSearch.toLowerCase()) ||
                                                    (s.academy_code && s.academy_code.toLowerCase().includes(bulkStudentSearch.toLowerCase()))
                                                )
                                                .map(st => {
                                                    const isChecked = selectedStudentIds.includes(st.id);
                                                    return (
                                                        <div
                                                            key={st.id}
                                                            onClick={() => handleToggleStudentSelection(st.id)}
                                                            className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer select-none transition-all ${
                                                                isChecked 
                                                                    ? 'bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-blue-200 font-semibold' 
                                                                    : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => {}} // Handled by parent div click
                                                                    className="rounded text-brand-blue focus:ring-brand-blue cursor-pointer w-4 h-4"
                                                                />
                                                                <span className="truncate">{st.full_name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                                                                    {st.academy_code || st.personal_code || '-'}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-500">
                                                                    {st.balance} pts
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Preset Buttons for points & reason */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Plantillas Rápidas</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {BULK_PRESETS.map((p, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                setBulkPointsVal(p.points);
                                                setBulkDesc(p.desc);
                                            }}
                                            className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-brand-blue/15 hover:text-brand-blue dark:bg-slate-700/60 dark:hover:bg-brand-blue/30 dark:hover:text-white rounded-lg text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Points input */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Puntos a Asignar (a cada alumno seleccionado) *</label>
                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/40 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setBulkPointsVal(prev => prev > 5 ? prev - 5 : prev)}
                                        className="p-2 text-slate-500 hover:text-brand-blue active:scale-90 transition-all rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                                    >
                                        <MinusCircle className="w-5 h-5" />
                                    </button>
                                    <input
                                        type="number"
                                        value={bulkPointsVal}
                                        onChange={e => setBulkPointsVal(Number(e.target.value))}
                                        className="w-full text-center font-black text-2xl text-slate-800 dark:text-white bg-transparent outline-none border-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setBulkPointsVal(prev => prev + 5)}
                                        className="p-2 text-slate-500 hover:text-brand-blue active:scale-90 transition-all rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                                    >
                                        <PlusCircle className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Motivo de Asignación *</label>
                                <textarea
                                    required
                                    rows={2}
                                    placeholder="Ej: 1er Lugar en Dinámica de Debate, Trabajo en equipo..."
                                    value={bulkDesc}
                                    onChange={e => setBulkDesc(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-2xl bg-transparent text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsBulkModalOpen(false);
                                        setBulkSuccessNotice(null);
                                    }}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingBulk || selectedStudentIds.length === 0}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmittingBulk ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <span>Otorgar {bulkPointsVal} pts a {selectedStudentIds.length} Alumno(s)</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL: CREATE / EDIT REWARD */}
            {isRewardModalOpen && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-3 sm:p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsRewardModalOpen(false);
                    }}
                >
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 overflow-hidden relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button
                            onClick={() => setIsRewardModalOpen(false)}
                            className="absolute top-4 right-4 sm:top-5 sm:right-5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg p-1.5 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-brand-blue/15 rounded-2xl text-brand-blue">
                                <Gift className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-slate-800 dark:text-white">
                                    {editingReward ? 'Editar Recompensa' : 'Nueva Recompensa'}
                                </h3>
                                <p className="text-xs text-slate-400">Configure los parámetros del premio físico o digital</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveReward} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Título del Premio *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Diploma de Excelencia, Termo Ultec, Llavero Coleccionable..."
                                    value={rewardTitle}
                                    onChange={e => setRewardTitle(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Puntos Requeridos *</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={rewardPoints}
                                        onChange={e => setRewardPoints(Number(e.target.value))}
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Stock de Unidades</label>
                                    <input
                                        type="number"
                                        placeholder="Ilimitado ♾️"
                                        value={rewardStock}
                                        onChange={e => setRewardStock(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">URL de Imagen del Premio</label>
                                <input
                                    type="url"
                                    placeholder="https://images.unsplash.com/... (opcional)"
                                    value={rewardImage}
                                    onChange={e => setRewardImage(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Descripción del Premio</label>
                                <textarea
                                    rows={3}
                                    placeholder="Detalles sobre en qué consiste el premio o cómo se entrega..."
                                    value={rewardDesc}
                                    onChange={e => setRewardDesc(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-transparent text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsRewardModalOpen(false)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer min-h-[42px]"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingReward}
                                    className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-brand-blue/20 transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[42px]"
                                >
                                    {isSubmittingReward ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    <span>Guardar Premio</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL: VISTA PREVIA E IMPRESIÓN DEL CUADRO DE HONOR */}
            {isHonorRollModalOpen && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex flex-col justify-start items-center p-0 sm:p-4 overflow-y-auto"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setIsHonorRollModalOpen(false);
                        }
                    }}
                >
                    <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 dark:border-slate-800 flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden my-auto">
                        
                        {/* Modal Header Toolbar (Sticky & High Contrast) */}
                        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white shrink-0 shadow-md print:hidden">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                                    <Trophy className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm text-white flex items-center gap-2">
                                        <span>Cuadro de Honor</span>
                                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                            Oficial
                                        </span>
                                    </h3>
                                    <p className="text-[11px] text-slate-400 hidden sm:block">
                                        Vista previa de documento membretado para cartelera escolar
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 ml-auto">
                                {/* Selector de curso para el reporte */}
                                <select
                                    value={honorRollCourseId}
                                    onChange={e => setHonorRollCourseId(e.target.value)}
                                    className="px-3 py-2 border border-slate-700 rounded-xl bg-slate-800 text-xs text-white outline-none cursor-pointer hover:border-slate-600 transition-colors"
                                >
                                    <option value="">Todos los Cursos (General)</option>
                                    {courses.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>

                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="bg-brand-blue hover:bg-brand-blue/90 text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-brand-blue/30 cursor-pointer active:scale-95"
                                    title="Imprimir documento o guardar como PDF"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span className="hidden sm:inline">Imprimir / PDF</span>
                                    <span className="sm:hidden">Imprimir</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setIsHonorRollModalOpen(false)}
                                    className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ml-1"
                                    title="Cerrar vista previa y volver al panel (Esc)"
                                >
                                    <X className="w-4 h-4" />
                                    <span>Salir</span>
                                </button>
                            </div>
                        </div>

                        {/* Área de Visualización del Documento (Hoja física centrada) */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-800/80 flex flex-col items-center custom-scrollbar">
                            
                            {/* Documento Formal para Impresión */}
                            <div 
                                id="printable-cuadro-honor"
                                className="w-full max-w-[800px] bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-2xl border border-slate-300 font-sans print:shadow-none print:border-none print:p-0 print:m-0"
                            >
                                {/* Encabezado Institucional Membretado */}
                                <div className="text-center border-b-2 border-slate-900 pb-5 mb-6">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <span className="text-2xl">🎓</span>
                                        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-slate-950">
                                            ACADEMIA TECNOLÓGICA ULTEC
                                        </h1>
                                    </div>
                                    <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wider text-slate-700 mt-1">
                                        CUADRO DE HONOR Y EXCELENCIA ACADÉMICA
                                    </h2>
                                    <div className="flex items-center justify-center gap-3 mt-2 text-xs font-semibold text-slate-500">
                                        <span>Sede Central • Ciclo 2026</span>
                                        <span>•</span>
                                        <span className="font-bold text-slate-800">
                                            {honorRollCourseId 
                                                ? `Curso: ${courses.find(c => c.id === honorRollCourseId)?.name || 'Especialidad'}`
                                                : 'Clasificación General Institucional'}
                                        </span>
                                        <span>•</span>
                                        <span>{new Date().toLocaleDateString('es-GT', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                    </div>
                                </div>

                                {loadingHonorRoll ? (
                                    <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin text-brand-teal" />
                                        <span>Cargando estudiantes...</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* Podio Destacado en Impresión */}
                                        {honorRollStudents.length >= 3 && (
                                            <div className="grid grid-cols-3 gap-3 mb-6">
                                                {/* 2do Lugar */}
                                                <div className="border border-slate-300 rounded-xl p-3 text-center bg-slate-50">
                                                    <div className="text-xl mb-0.5">🥈</div>
                                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">2do Lugar</div>
                                                    <div className="font-bold text-xs text-slate-900 line-clamp-1 mt-0.5">{honorRollStudents[1].full_name}</div>
                                                    <div className="text-[10px] font-mono text-slate-500">{honorRollStudents[1].academy_code || honorRollStudents[1].personal_code || '-'}</div>
                                                    <div className="text-xs font-black text-slate-800 mt-1">{honorRollStudents[1].balance} pts</div>
                                                </div>
                                                {/* 1er Lugar */}
                                                <div className="border-2 border-amber-400 rounded-xl p-3 text-center bg-amber-50/70 relative shadow-sm">
                                                    <div className="text-2xl mb-0.5">🥇</div>
                                                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-700">1er Lugar de Honor</div>
                                                    <div className="font-black text-sm text-slate-950 line-clamp-1 mt-0.5">{honorRollStudents[0].full_name}</div>
                                                    <div className="text-[10px] font-mono font-bold text-amber-800">{honorRollStudents[0].academy_code || honorRollStudents[0].personal_code || '-'}</div>
                                                    <div className="text-sm font-black text-amber-700 mt-1">{honorRollStudents[0].balance} pts</div>
                                                </div>
                                                {/* 3er Lugar */}
                                                <div className="border border-slate-300 rounded-xl p-3 text-center bg-slate-50">
                                                    <div className="text-xl mb-0.5">🥉</div>
                                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">3er Lugar</div>
                                                    <div className="font-bold text-xs text-slate-900 line-clamp-1 mt-0.5">{honorRollStudents[2].full_name}</div>
                                                    <div className="text-[10px] font-mono text-slate-500">{honorRollStudents[2].academy_code || honorRollStudents[2].personal_code || '-'}</div>
                                                    <div className="text-xs font-black text-slate-800 mt-1">{honorRollStudents[2].balance} pts</div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Tabla Oficial de Calificaciones */}
                                        <table className="w-full border-collapse text-left text-xs mb-8">
                                            <thead>
                                                <tr className="border-b-2 border-slate-800 bg-slate-100 text-slate-800">
                                                    <th className="py-2 px-3 font-black uppercase tracking-wider text-center w-12">Lugar</th>
                                                    <th className="py-2 px-3 font-black uppercase tracking-wider">Estudiante</th>
                                                    <th className="py-2 px-3 font-black uppercase tracking-wider">Código Academia</th>
                                                    <th className="py-2 px-3 font-black uppercase tracking-wider">Liga / Nivel</th>
                                                    <th className="py-2 px-3 font-black uppercase tracking-wider text-right">Puntos Acumulados</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {honorRollStudents.map((st, i) => (
                                                    <tr key={st.id} className={i < 3 ? 'font-bold bg-amber-50/40' : ''}>
                                                        <td className="py-2 px-3 text-center font-bold">
                                                            {i === 0 ? '1🥇' : i === 1 ? '2🥈' : i === 2 ? '3🥉' : `#${i + 1}`}
                                                        </td>
                                                        <td className="py-2 px-3 font-semibold text-slate-900">{st.full_name}</td>
                                                        <td className="py-2 px-3 font-mono font-bold text-slate-700">{st.academy_code || st.personal_code || '-'}</td>
                                                        <td className="py-2 px-3 text-slate-600">{getStudentLeague(st.balance).name}</td>
                                                        <td className="py-2 px-3 text-right font-black text-slate-900">{st.balance} pts</td>
                                                    </tr>
                                                ))}
                                                {honorRollStudents.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="py-8 text-center text-slate-400">
                                                            No hay estudiantes registrados o con puntos para este curso.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>

                                        {/* Firmas y Sellos Institucionales */}
                                        <div className="mt-14 pt-4 border-t border-slate-200 grid grid-cols-2 gap-16 text-center text-[11px]">
                                            <div>
                                                <div className="h-14 border-b border-dashed border-slate-400 mb-2"></div>
                                                <p className="font-bold text-slate-900 uppercase">Lic. Dirección Académica ULTEC</p>
                                                <p className="text-slate-500">Firma y Sello Oficial</p>
                                            </div>
                                            <div>
                                                <div className="h-14 border-b border-dashed border-slate-400 mb-2"></div>
                                                <p className="font-bold text-slate-900 uppercase">Coordinación de Méritos y Disciplina</p>
                                                <p className="text-slate-500">Firma y Sello Oficial</p>
                                            </div>
                                        </div>

                                        <div className="mt-8 text-center text-[9px] text-slate-400 uppercase tracking-wider">
                                            Documento oficial generado por Plataforma ULTEC Cloud • Validez para cartelera y expediente académico
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Botones inferiores dentro del scroll (para cuando la lista es larga) */}
                            <div className="w-full max-w-[800px] mt-6 pb-6 flex items-center justify-between gap-4 print:hidden">
                                <button
                                    type="button"
                                    onClick={() => setIsHonorRollModalOpen(false)}
                                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-2 cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                    <span>Cerrar Vista Previa</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="px-6 py-2.5 bg-brand-blue hover:bg-brand-blue/90 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-brand-blue/30 flex items-center gap-2 cursor-pointer active:scale-95"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>Imprimir / Exportar a PDF</span>
                                </button>
                            </div>

                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ESTILOS DE IMPRESIÓN AISLADA (OCULTA TODO EL RESTO DE LA PÁGINA) */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }
                    #printable-cuadro-honor, #printable-cuadro-honor * {
                        visibility: visible !important;
                    }
                    #printable-cuadro-honor {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100vw !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 12mm 16mm !important;
                        background: white !important;
                        color: #0f172a !important;
                        z-index: 99999999 !important;
                        box-shadow: none !important;
                        border: none !important;
                    }
                    @page {
                        size: letter portrait;
                        margin: 8mm;
                    }
                }
            `}</style>

            {/* Modal de Confirmación para Eliminar Premio */}
            <ConfirmModal
                isOpen={!!deleteRewardConfirm}
                title="¿Eliminar Recompensa?"
                message={deleteRewardConfirm ? `¿Estás seguro que deseas eliminar permanentemente el premio "${deleteRewardConfirm.title}"? Esta acción no se puede deshacer.` : ''}
                confirmText="Eliminar Premio"
                cancelText="Cancelar"
                variant="danger"
                isLoading={isDeletingReward}
                onConfirm={confirmDeleteReward}
                onCancel={() => setDeleteRewardConfirm(null)}
            />

            {/* Modal de Confirmación para Entregar Premio */}
            <ConfirmModal
                isOpen={!!deliverClaimConfirm}
                title="¿Confirmar Entrega Física?"
                message={deliverClaimConfirm ? `¿Confirmas que has entregado físicamente el premio "${deliverClaimConfirm.rewardTitle}" a ${deliverClaimConfirm.studentName}?` : ''}
                confirmText="Sí, Confirmar Entrega"
                cancelText="Cancelar"
                variant="success"
                isLoading={isDeliveringClaim}
                onConfirm={confirmDeliverClaim}
                onCancel={() => setDeliverClaimConfirm(null)}
            />
        </div>
    );
};

export default MeritsAdmin;
