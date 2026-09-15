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
    Sparkles, 
    ShoppingBag, 
    History, 
    Check, 
    Loader2, 
    Coins, 
    Flame,
    Gift,
    AlertCircle
} from 'lucide-react';

const MyMerits: React.FC = () => {
    const [balanceData, setBalanceData] = useState<StudentBalanceResponse | null>(null);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    const handleClaimReward = async (rewardId: string, rewardTitle: string) => {
        if (!window.confirm(`¿Estás seguro que deseas canjear tus puntos por "${rewardTitle}"?`)) {
            return;
        }

        setClaimingId(rewardId);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
            const res = await claimReward(rewardId);
            setSuccessMessage(res.message);
            await loadData(); // Reload points balance
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (error: any) {
            console.error("Error claiming reward:", error);
            setErrorMessage(error.response?.data?.message || "Ocurrió un error al reclamar el premio.");
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

    // Gamification levels logic
    const getLevelInfo = (pts: number) => {
        if (pts < 100) return { name: 'Bronce 🥉', prev: 0, next: 100, color: 'from-amber-700 to-amber-500', text: 'text-amber-500', border: 'border-amber-600/30' };
        if (pts < 250) return { name: 'Plata 🥈', prev: 100, next: 250, color: 'from-slate-400 to-slate-200', text: 'text-slate-300', border: 'border-slate-400/30' };
        if (pts < 500) return { name: 'Oro 🥇', prev: 250, next: 500, color: 'from-yellow-500 to-amber-400', text: 'text-yellow-400', border: 'border-yellow-500/30' };
        return { name: 'Platino 👑', prev: 500, next: 1000, color: 'from-indigo-400 via-purple-400 to-pink-400', text: 'text-purple-400', border: 'border-purple-500/30' };
    };

    const level = getLevelInfo(points);
    const progressPercent = Math.min(100, Math.max(0, ((points - level.prev) / (level.next - level.prev)) * 100));

    return (
        <div className="p-6 max-w-6xl mx-auto pb-24 space-y-8 font-sans">
            
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                    <Sparkles className="w-7 h-7 text-brand-teal animate-pulse" />
                    Mi Portal de Gamificación
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    ¡Tu esfuerzo tiene recompensas! Gana puntos por tus excelentes calificaciones y asistencia y canjéalos por increíbles premios.
                </p>
            </div>

            {/* Notifications */}
            {successMessage && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold animate-in fade-in duration-300 flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}
            {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-semibold animate-in fade-in duration-300 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Balance & Progress Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Points Card */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl p-6 shadow-xl border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-teal/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Mis Puntos Disponibles</p>
                            <h2 className="text-5xl font-black mt-2 tracking-tight flex items-baseline gap-2 bg-gradient-to-r from-brand-teal via-white to-brand-blue bg-clip-text text-transparent">
                                {points}
                                <span className="text-xs text-brand-teal uppercase font-extrabold tracking-wider">PTS</span>
                            </h2>
                        </div>
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                            <Coins className="w-6 h-6 text-brand-teal" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-slate-400 text-xs bg-white/5 py-2 px-3 rounded-xl border border-white/5 w-fit">
                        <Flame className="w-4 h-4 text-orange-400" />
                        <span>¡Sigue sumando éxitos en clase!</span>
                    </div>
                </div>

                {/* Level Progress Card */}
                <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between min-h-[220px] relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold">Nivel Actual</p>
                            <h3 className={`text-2xl font-black mt-1 ${level.text}`}>
                                Rango {level.name}
                            </h3>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full border text-xs font-black ${level.border} ${level.text} bg-slate-50 dark:bg-slate-900/30`}>
                            {progressPercent.toFixed(0)}% Completado
                        </div>
                    </div>

                    {/* Glowing Progress Bar */}
                    <div className="space-y-2.5 my-auto">
                        <div className="w-full h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-white/5">
                            <div 
                                className={`h-full rounded-full bg-gradient-to-r ${level.color} transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(37,192,244,0.3)]`} 
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs font-bold text-slate-400 dark:text-slate-500 px-1">
                            <span>{level.prev} pts</span>
                            <span className="flex items-center gap-1">
                                Siguiente Rango en: <strong className="text-slate-700 dark:text-white">{level.next} pts</strong>
                            </span>
                        </div>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/50 pt-3 mt-4 flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span>¡Cada nivel superior desbloquea premios más grandes en la tienda!</span>
                    </div>
                </div>

            </div>

            {/* Content Tabs / Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Rewards Store (Grid) - Takes 2 cols */}
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2.5">
                        <ShoppingBag className="w-5 h-5 text-brand-teal" />
                        Tienda de Recompensas
                    </h2>

                    {rewards.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-8 rounded-3xl text-center text-slate-400">
                            <Gift className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                            <p className="font-bold text-sm">No hay premios disponibles actualmente.</p>
                            <p className="text-xs text-slate-500 mt-1">El administrador publicará nuevas recompensas muy pronto.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {rewards.map((reward) => {
                                const canClaim = points >= reward.points_required;
                                const isOutOfStock = reward.stock !== null && reward.stock <= 0;
                                const isClaiming = claimingId === reward.id;

                                return (
                                    <div 
                                        key={reward.id} 
                                        className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700/70 p-5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between relative overflow-hidden group hover:-translate-y-0.5"
                                    >
                                        {/* Image wrapper */}
                                        <div className="h-40 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-900/60 rounded-2xl flex items-center justify-center mb-4 relative overflow-hidden border border-slate-200/40 dark:border-slate-700/20">
                                            {reward.image_url ? (
                                                <img 
                                                    src={reward.image_url} 
                                                    alt={reward.title}
                                                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" 
                                                />
                                            ) : (
                                                <Gift className="w-12 h-12 text-brand-teal/40 group-hover:scale-110 transition-transform duration-500" />
                                            )}
                                            
                                            {/* Cost overlay tag */}
                                            <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md text-brand-teal font-black text-xs px-3 py-1.5 rounded-full flex items-center gap-1 border border-white/10 shadow-lg">
                                                <Coins className="w-3.5 h-3.5" />
                                                <span>{reward.points_required} pts</span>
                                            </div>
                                        </div>

                                        {/* Content info */}
                                        <div className="space-y-1.5 flex-1">
                                            <h3 className="font-extrabold text-slate-800 dark:text-white group-hover:text-brand-teal transition-colors line-clamp-1">{reward.title}</h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed min-h-[32px]">{reward.description || 'Sin descripción'}</p>
                                        </div>

                                        {/* Footer action and stock */}
                                        <div className="mt-5 border-t border-slate-100 dark:border-slate-700/50 pt-4 flex items-center justify-between gap-4">
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                                {reward.stock === null ? 'Ilimitado ♾️' : `Stock: ${reward.stock} uds`}
                                            </span>

                                            <button
                                                onClick={() => handleClaimReward(reward.id, reward.title)}
                                                disabled={!canClaim || isOutOfStock || isClaiming}
                                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                                                    isOutOfStock 
                                                        ? 'bg-rose-100 dark:bg-rose-950/20 text-rose-500 dark:text-rose-400 border border-rose-200/50 cursor-not-allowed'
                                                        : !canClaim 
                                                        ? 'bg-slate-100 dark:bg-slate-750 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-transparent'
                                                        : 'bg-brand-teal hover:bg-brand-teal/90 text-slate-950 hover:shadow-lg hover:shadow-brand-teal/20 active:scale-95 cursor-pointer'
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
                <div className="space-y-6">
                    <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2.5">
                        <History className="w-5 h-5 text-brand-teal" />
                        Historial de Puntos
                    </h2>

                    <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 space-y-4 max-h-[580px] overflow-y-auto custom-scrollbar">
                        {(!balanceData?.transactions || balanceData.transactions.length === 0) ? (
                            <p className="text-center text-slate-400 text-xs py-8">Aún no tienes movimientos registrados.</p>
                        ) : (
                            balanceData.transactions.map((tx) => {
                                const isPositive = tx.points > 0;
                                return (
                                    <div 
                                        key={tx.id} 
                                        className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl flex items-center justify-between gap-3 border border-slate-100 dark:border-slate-700/30"
                                    >
                                        <div className="min-w-0">
                                            <p className="font-bold text-xs text-slate-700 dark:text-slate-300 truncate leading-snug">{tx.description}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded-full ${
                                                    tx.transaction_type === 'attendance'
                                                        ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-500'
                                                        : tx.transaction_type === 'grade'
                                                        ? 'bg-purple-50 dark:bg-purple-950/20 text-purple-500'
                                                        : tx.transaction_type === 'claim'
                                                        ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-500'
                                                        : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500'
                                                }`}>
                                                    {tx.transaction_type === 'attendance' ? 'Asistencia' :
                                                     tx.transaction_type === 'grade' ? 'Nota' :
                                                     tx.transaction_type === 'claim' ? 'Canje' : 'Manual'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                    {new Date(tx.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>

                                        <span className={`font-black text-sm shrink-0 flex items-center gap-0.5 ${
                                            isPositive ? 'text-emerald-500' : 'text-orange-500'
                                        }`}>
                                            {isPositive ? '+' : ''}{tx.points}
                                            <span className="text-[9px] uppercase font-black text-slate-400 dark:text-slate-500">pts</span>
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>

        </div>
    );
};

export default MyMerits;
