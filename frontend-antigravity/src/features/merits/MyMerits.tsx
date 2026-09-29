import React, { useEffect, useState } from 'react';
import { 
    getStudentBalance, 
    getRewards, 
    claimReward, 
    type StudentBalanceResponse, 
    type Reward 
} from './meritsService';
import { 
    Trophy, 
    ShoppingBag, 
    History, 
    Check, 
    Loader2, 
    Coins, 
    Flame, 
    Gift, 
    AlertCircle 
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';

const MyMerits: React.FC = () => {
    const [balanceData, setBalanceData] = useState<StudentBalanceResponse | null>(null);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [claimConfirm, setClaimConfirm] = useState<{ id: string; title: string; points: number } | null>(null);
    const [activeTab, setActiveTab] = useState<'rewards' | 'history'>('rewards');

    // Load data
    const loadData = async () => {
        try {
            // Get user from localStorage
            const userStr = localStorage.getItem('user');
            const currentUser = userStr ? JSON.parse(userStr) : null;
            if (!currentUser) return;

            // Fetch balance & history
            const bal = await getStudentBalance(currentUser.id);
            setBalanceData(bal);

            // Fetch active rewards
            const rew = await getRewards();
            setRewards(rew);
        } catch (error) {
            console.error("Error loading student merits data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const requestClaimReward = (reward: Reward) => {
        setClaimConfirm({ id: reward.id, title: reward.title, points: reward.points_required });
    };

    const confirmClaimReward = async () => {
        if (!claimConfirm) return;
        const rewardId = claimConfirm.id;
        setClaimingId(rewardId);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const res = await claimReward(rewardId);
            setSuccessMessage(res.message);
            await loadData(); // Reload points balance
            setClaimConfirm(null);
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (error: any) {
            console.error("Error claiming reward:", error);
            setErrorMessage(error.response?.data?.message || "Ocurrió un error al reclamar el premio.");
            setClaimConfirm(null);
            setTimeout(() => setErrorMessage(null), 5000);
        } finally {
            setClaimingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px]">
                <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
            </div>
        );
    }

    const points = balanceData?.balance || 0;
    const userStr = localStorage.getItem('user');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    const studentName = currentUser?.full_name || 'Estudiante';
    const studentInitial = studentName.charAt(0).toUpperCase();

    // Stats calculations
    const transactions = balanceData?.transactions || [];
    const totalEarned = transactions
        .filter(t => t.points > 0)
        .reduce((sum, t) => sum + t.points, 0);
    const totalDemerits = transactions
        .filter(t => t.points < 0)
        .reduce((sum, t) => sum + Math.abs(t.points), 0);
    const claimedCount = transactions.filter(t => t.transaction_type === 'claim').length;

    // Gamification levels logic
    const getLevelInfo = (pts: number) => {
        if (pts < 100) return { levelNum: 1, name: 'Bronce 🥉', rankTitle: 'Cadete Inicial', prev: 0, next: 100, color: 'from-amber-600 to-amber-400', text: 'text-amber-500', border: 'border-amber-600/30' };
        if (pts < 250) return { levelNum: 2, name: 'Plata 🥈', rankTitle: 'Técnico Especialista', prev: 100, next: 250, color: 'from-slate-400 to-slate-200', text: 'text-slate-300', border: 'border-slate-400/30' };
        if (pts < 500) return { levelNum: 3, name: 'Oro 🥇', rankTitle: 'Desarrollador Avanzado', prev: 250, next: 500, color: 'from-yellow-500 to-amber-400', text: 'text-yellow-400', border: 'border-yellow-500/30' };
        return { levelNum: 4, name: 'Platino 👑', rankTitle: 'Innovador Élite', prev: 500, next: 1000, color: 'from-indigo-400 via-purple-400 to-pink-400', text: 'text-purple-400', border: 'border-purple-500/30' };
    };

    const level = getLevelInfo(points);
    const progressPercent = Math.min(100, Math.max(0, ((points - level.prev) / (level.next - level.prev)) * 100));

    return (
        <div className="max-w-6xl mx-auto pb-36 sm:pb-16 space-y-6 font-sans animate-in fade-in duration-500">
            {/* Top Hero Card from Stitch */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#151a2d] to-slate-950 rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl text-white">
                {/* Glowing backdrop shapes */}
                <div className="absolute -right-16 -top-16 w-64 h-64 bg-brand-blue/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute right-1/3 -bottom-20 w-56 h-56 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    {/* User profile ring & level */}
                    <div className="flex items-center gap-4 sm:gap-5">
                        <div className="relative shrink-0">
                            {/* Avatar with glowing border */}
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-brand-blue to-purple-500 p-0.5 shadow-lg shadow-brand-blue/30 flex items-center justify-center">
                                <div className="w-full h-full bg-slate-900 rounded-[14px] sm:rounded-[22px] flex items-center justify-center">
                                    <span className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                                        {studentInitial}
                                    </span>
                                </div>
                            </div>
                            <div className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-full bg-brand-blue text-[10px] font-black uppercase tracking-wider text-white shadow-md border border-white/20">
                                Lvl {level.levelNum}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xl sm:text-2xl font-black tracking-tight">{studentName}</h2>
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                    <Flame className="w-3 h-3 text-orange-400" />
                                    Racha Activa
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-400 mt-0.5 font-medium">
                                Nivel {level.levelNum}: <span className="text-brand-teal font-bold">{level.rankTitle}</span> ({level.name})
                            </p>
                        </div>
                    </div>

                    {/* Available Points Counter */}
                    <div className="flex items-center justify-between md:flex-col md:items-end bg-white/5 md:bg-transparent p-4 md:p-0 rounded-2xl border border-white/5 md:border-0">
                        <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">Puntos Disponibles</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-brand-teal via-white to-brand-blue bg-clip-text text-transparent">
                                {points}
                            </span>
                            <span className="text-xs font-black text-brand-teal uppercase tracking-wider">PTS</span>
                        </div>
                    </div>
                </div>

                {/* Level XP Bar */}
                <div className="relative z-10 mt-6 pt-5 border-t border-white/10 space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-400">Progreso al Siguiente Rango</span>
                        <span className="text-brand-teal">{progressPercent.toFixed(0)}% ({points} / {level.next} pts)</span>
                    </div>

                    <div className="w-full h-3.5 bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner">
                        <div
                            className={`h-full rounded-full bg-gradient-to-r ${level.color} transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(37,192,244,0.4)]`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* 4 Stats Cards Grid from Stitch */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-[#1c1f2a] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider">Méritos Ganados</span>
                        <Coins className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        +{totalEarned} <span className="text-xs font-bold text-slate-400">pts</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">Por notas y asistencia</span>
                </div>

                <div className="bg-white dark:bg-[#1c1f2a] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider">Deméritos</span>
                        <Check className="w-4 h-4 text-teal-500" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                        {totalDemerits === 0 ? '0' : `-${totalDemerits}`}
                    </div>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold mt-1">Conducta ejemplar</span>
                </div>

                <div className="bg-white dark:bg-[#1c1f2a] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider">Recompensas</span>
                        <Gift className="w-4 h-4 text-brand-blue" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-brand-blue">
                        {claimedCount}
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">Canjes realizados</span>
                </div>

                <div className="bg-white dark:bg-[#1c1f2a] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider">Ranking Salón</span>
                        <Trophy className="w-4 h-4 text-yellow-500" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-yellow-500">
                        Top 5
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">Nivel sobresaliente</span>
                </div>
            </div>

            {/* Notifications */}
            {successMessage && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold animate-in fade-in duration-300 flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-sm">{successMessage}</span>
                </div>
            )}
            {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-semibold animate-in fade-in duration-300 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    <span className="text-sm">{errorMessage}</span>
                </div>
            )}

            {/* Segmented View Switcher on mobile */}
            <div className="flex bg-slate-100 dark:bg-[#161922] p-1 rounded-2xl border border-slate-200/80 dark:border-white/5 lg:hidden">
                <button
                    onClick={() => setActiveTab('rewards')}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        activeTab === 'rewards'
                            ? 'bg-white dark:bg-[#252a3a] text-brand-blue shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Tienda de Premios ({rewards.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        activeTab === 'history'
                            ? 'bg-white dark:bg-[#252a3a] text-brand-blue shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    <History className="w-4 h-4" />
                    <span>Historial ({transactions.length})</span>
                </button>
            </div>

            {/* Content Tabs / Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Rewards Store (Grid) - Takes 2 cols */}
                <div className={`lg:col-span-2 space-y-4 ${activeTab === 'history' ? 'hidden lg:block' : ''}`}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5 text-brand-blue" />
                            Tienda de Recompensas
                        </h3>
                        <span className="text-xs text-slate-400 font-bold">{rewards.length} disponibles</span>
                    </div>

                    {rewards.length === 0 ? (
                        <div className="bg-white dark:bg-[#1c1f2a] border border-dashed border-slate-300 dark:border-white/10 p-12 rounded-3xl text-center text-slate-400">
                            <Gift className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                            <p className="font-bold text-sm">No hay premios disponibles actualmente.</p>
                            <p className="text-xs text-slate-500 mt-1">El equipo académico publicará nuevas recompensas muy pronto.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                            {rewards.map((reward) => {
                                const canClaim = points >= reward.points_required;
                                const isOutOfStock = reward.stock !== null && reward.stock <= 0;
                                const isClaiming = claimingId === reward.id;

                                return (
                                    <div
                                        key={reward.id}
                                        className="bg-white dark:bg-[#1c1f2a] rounded-3xl border border-slate-200/80 dark:border-white/10 p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group"
                                    >
                                        {/* Image wrapper */}
                                        <div className="h-40 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-[#161922] rounded-2xl flex items-center justify-center mb-4 relative overflow-hidden border border-slate-200/50 dark:border-white/5">
                                            {reward.image_url ? (
                                                <img
                                                    src={reward.image_url}
                                                    alt={reward.title}
                                                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <Gift className="w-12 h-12 text-brand-blue/40 group-hover:scale-110 transition-transform duration-500" />
                                            )}

                                            {/* Cost overlay tag */}
                                            <div className="absolute top-3 right-3 bg-slate-900/85 backdrop-blur-md text-brand-teal font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-1 border border-white/10 shadow-lg">
                                                <Coins className="w-3.5 h-3.5 text-yellow-400" />
                                                <span>{reward.points_required} pts</span>
                                            </div>
                                        </div>

                                        {/* Content info */}
                                        <div className="space-y-1.5 flex-1">
                                            <h4 className="font-bold text-slate-800 dark:text-white group-hover:text-brand-blue transition-colors line-clamp-1">{reward.title}</h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed min-h-[32px]">{reward.description || 'Sin descripción adicional provista.'}</p>
                                        </div>

                                        {/* Footer action and stock */}
                                        <div className="mt-5 border-t border-slate-100 dark:border-white/5 pt-4 flex items-center justify-between gap-4">
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                                {reward.stock === null ? 'Ilimitado ♾️' : `Stock: ${reward.stock} uds`}
                                            </span>

                                            <button
                                                onClick={() => requestClaimReward(reward)}
                                                disabled={!canClaim || isOutOfStock || isClaiming}
                                                className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                                                    isOutOfStock
                                                        ? 'bg-rose-100 dark:bg-rose-950/20 text-rose-500 dark:text-rose-400 border border-rose-200/50 cursor-not-allowed'
                                                        : !canClaim
                                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-transparent'
                                                        : 'bg-brand-blue hover:bg-blue-600 text-white shadow-md shadow-brand-blue/20 active:scale-95 cursor-pointer'
                                                }`}
                                            >
                                                {isClaiming ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : isOutOfStock ? (
                                                    <span>Agotado</span>
                                                ) : !canClaim ? (
                                                    <span>Faltan Puntos</span>
                                                ) : (
                                                    <>
                                                        <Gift className="w-3.5 h-3.5" />
                                                        <span>Canjear</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* History Ledger (Right Column) - Takes 1 col */}
                <div className={`space-y-4 ${activeTab === 'rewards' ? 'hidden lg:block' : ''}`}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <History className="w-5 h-5 text-brand-blue" />
                            Historial de Puntos
                        </h3>
                        <span className="text-xs text-slate-400 font-bold">{transactions.length} registros</span>
                    </div>

                    <div className="bg-white dark:bg-[#1c1f2a] rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/80 dark:border-white/10 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                        {transactions.length === 0 ? (
                            <p className="text-center text-slate-400 text-xs py-12">Aún no tienes movimientos registrados.</p>
                        ) : (
                            transactions.map((tx) => {
                                const isPositive = tx.points > 0;
                                return (
                                    <div
                                        key={tx.id}
                                        className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl flex items-center justify-between gap-3 border border-slate-100 dark:border-white/5"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate leading-snug">{tx.description}</p>
                                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                <span className={`text-[9px] uppercase font-black px-1.5 py-0.2 rounded-full ${
                                                    tx.transaction_type === 'attendance'
                                                        ? 'bg-blue-500/10 text-blue-500'
                                                        : tx.transaction_type === 'grade'
                                                        ? 'bg-purple-500/10 text-purple-500'
                                                        : tx.transaction_type === 'claim'
                                                        ? 'bg-amber-500/10 text-amber-500'
                                                        : tx.transaction_type === 'refund'
                                                        ? 'bg-indigo-500/10 text-indigo-500'
                                                        : 'bg-emerald-500/10 text-emerald-500'
                                                }`}>
                                                    {tx.transaction_type === 'attendance' ? 'Asistencia' :
                                                     tx.transaction_type === 'grade' ? 'Nota' :
                                                     tx.transaction_type === 'claim' ? 'Canje' :
                                                     tx.transaction_type === 'refund' ? 'Reembolso' : 'Mérito'}
                                                </span>
                                                {tx.transaction_type === 'claim' && (
                                                    <span className={`text-[9px] uppercase font-black px-1.5 py-0.2 rounded-full ${
                                                        tx.status === 'delivered'
                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                            : tx.status === 'cancelled'
                                                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                                    }`}>
                                                        {tx.status === 'delivered' ? '✅ Entregado' : tx.status === 'cancelled' ? '❌ Cancelado' : '⏳ Por entregar'}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                    {new Date(tx.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>

                                        <span className={`font-black text-sm shrink-0 flex items-center gap-0.5 ${
                                            isPositive ? 'text-emerald-500' : 'text-orange-500'
                                        }`}>
                                            {isPositive ? '+' : ''}{tx.points}
                                            <span className="text-[9px] uppercase font-black text-slate-400">pts</span>
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Modal de Confirmación para Canjear Premio */}
            <ConfirmModal
                isOpen={!!claimConfirm}
                title="¿Confirmar Canje de Puntos?"
                message={claimConfirm ? `¿Estás seguro que deseas canjear ${claimConfirm.points} puntos por "${claimConfirm.title}"?` : ''}
                confirmText="Sí, Canjear"
                cancelText="Cancelar"
                variant="primary"
                isLoading={!!claimingId}
                onConfirm={confirmClaimReward}
                onCancel={() => setClaimConfirm(null)}
            />
        </div>
    );
};

export default MyMerits;
