import React, { useEffect, useState } from 'react';
import { 
    getLeaderboard, 
    awardPoints, 
    getRewards, 
    createReward, 
    updateReward, 
    deleteReward, 
    getStudentBalance,
    type LeaderboardEntry, 
    type Reward,
    type MeritTransaction
} from './meritsService';
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
    Save
} from 'lucide-react';

const MeritsAdmin: React.FC = () => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'students' | 'rewards'>('students');

    // Filter students
    const [searchQuery, setSearchQuery] = useState('');

    // Detailed student view
    const [selectedStudent, setSelectedStudent] = useState<LeaderboardEntry | null>(null);
    const [studentHistory, setStudentHistory] = useState<MeritTransaction[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Modals
    const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
    const [awardPointsVal, setAwardPointsVal] = useState(10);
    const [awardDesc, setAwardDesc] = useState('');
    const [isSubmittingAward, setIsSubmittingAward] = useState(false);

    const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
    const [editingReward, setEditingReward] = useState<Reward | null>(null);
    const [rewardTitle, setRewardTitle] = useState('');
    const [rewardDesc, setRewardDesc] = useState('');
    const [rewardPoints, setRewardPoints] = useState(50);
    const [rewardStock, setRewardStock] = useState<string>('');
    const [rewardImage, setRewardImage] = useState('');
    const [isSubmittingReward, setIsSubmittingReward] = useState(false);

    // Feedback
    const [notice, setNotice] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showNotice = (msg: string, type: 'success' | 'error' = 'success') => {
        setNotice({ msg, type });
        setTimeout(() => setNotice(null), 3000);
    };

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const lead = await getLeaderboard();
            setLeaderboard(lead);
            const rew = await getRewards();
            setRewards(rew);
        } catch (error) {
            console.error("Error loading administrative merits data:", error);
            showNotice("Error al cargar datos de méritos", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

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

            showNotice(`¡Operación realizada! Puntos asignados exitosamente a ${selectedStudent.full_name}.`);
            setIsAwardModalOpen(false);
            setAwardDesc('');
            
            // Reload history and leaderboard
            await handleSelectStudent(selectedStudent);
            const updatedLead = await getLeaderboard();
            setLeaderboard(updatedLead);
        } catch (error) {
            console.error("Error manually awarding points:", error);
            showNotice("Error al asignar puntos manualmente", "error");
        } finally {
            setIsSubmittingAward(false);
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

    const handleDeleteReward = async (rewardId: string, title: string) => {
        if (!window.confirm(`¿Estás seguro que deseas eliminar permanentemente el premio "${title}"?`)) {
            return;
        }

        try {
            await deleteReward(rewardId);
            showNotice("Recompensa eliminada.");
            const updatedRewards = await getRewards();
            setRewards(updatedRewards);
        } catch (error) {
            console.error("Error deleting reward:", error);
            showNotice("Error al eliminar recompensa", "error");
        }
    };

    // Filtered leaderboard
    const filteredLeaderboard = leaderboard.filter(student => 
        student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (student.personal_code && student.personal_code.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px]">
                <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto pb-24 space-y-8 font-sans">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <Trophy className="w-7 h-7 text-brand-teal" />
                        Control de Méritos y Gamificación
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Monitoree los puntos de los estudiantes, asigne méritos manuales y administre la tienda de recompensas de la sede.
                    </p>
                </div>

                {activeTab === 'rewards' && (
                    <button
                        onClick={handleOpenCreateReward}
                        className="bg-brand-blue hover:bg-brand-blue/90 text-white px-5 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm shadow-brand-blue/20 cursor-pointer"
                    >
                        <Plus className="w-5 h-5" />
                        Nuevo Premio
                    </button>
                )}
            </div>

            {/* Notice banner */}
            {notice && (
                <div className={`p-4 rounded-xl font-semibold animate-in slide-in-from-top-2 flex items-center justify-between ${
                    notice.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                    <span>{notice.msg}</span>
                </div>
            )}

            {/* Tab navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-700/60 gap-4">
                <button
                    onClick={() => { setActiveTab('students'); setSelectedStudent(null); }}
                    className={`py-3 px-4 font-bold text-sm tracking-wide border-b-2 transition-colors cursor-pointer ${
                        activeTab === 'students' 
                            ? 'border-brand-teal text-brand-teal' 
                            : 'border-transparent text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    Estudiantes y Puntos
                </button>
                <button
                    onClick={() => setActiveTab('rewards')}
                    className={`py-3 px-4 font-bold text-sm tracking-wide border-b-2 transition-colors cursor-pointer ${
                        activeTab === 'rewards' 
                            ? 'border-brand-teal text-brand-teal' 
                            : 'border-transparent text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                >
                    Gestión de Premios
                </button>
            </div>

            {/* TAB CONTENT: STUDENTS */}
            {activeTab === 'students' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Leaderboard List */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Search field */}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar estudiante por nombre o código..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-blue/20 outline-none"
                            />
                        </div>

                        {/* Leaderboard cards */}
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-sm">
                            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/10 flex justify-between text-xs font-black text-slate-400 uppercase tracking-widest">
                                <span>Ranking / Estudiante</span>
                                <span>Saldo Puntos</span>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-[500px] overflow-y-auto custom-scrollbar">
                                {filteredLeaderboard.length === 0 ? (
                                    <p className="text-center py-8 text-slate-400 text-sm">No se encontraron estudiantes.</p>
                                ) : (
                                    filteredLeaderboard.map((student, idx) => {
                                        const isSelected = selectedStudent?.id === student.id;
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
                                                <div className="flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                                                        idx === 0 
                                                            ? 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600' 
                                                            : idx === 1 
                                                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' 
                                                            : idx === 2 
                                                            ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-600' 
                                                            : 'text-slate-400'
                                                    }`}>
                                                        {idx + 1}
                                                    </span>
                                                    <div>
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white leading-snug">{student.full_name}</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{student.personal_code || 'Sin código'}</p>
                                                    </div>
                                                </div>

                                                <span className="font-extrabold text-sm text-slate-700 dark:text-white flex items-center gap-1">
                                                    <Coins className="w-4 h-4 text-brand-teal" />
                                                    {student.balance} <span className="text-[10px] text-slate-400">pts</span>
                                                </span>
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
                                <div className="absolute top-0 right-0 p-6 opacity-5">
                                    <History className="w-24 h-24" />
                                </div>

                                <div className="relative z-10 space-y-1">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Estudiante Seleccionado</p>
                                    <h3 className="font-black text-lg text-slate-800 dark:text-white">{selectedStudent.full_name}</h3>
                                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50 mt-2">
                                        <span className="text-xs text-slate-400">Saldo Actual:</span>
                                        <span className="font-extrabold text-sm text-brand-teal flex items-center gap-1">
                                            <Coins className="w-4 h-4" />
                                            {selectedStudent.balance} pts
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <button
                                    onClick={() => setIsAwardModalOpen(true)}
                                    className="w-full bg-brand-teal/20 text-brand-teal hover:bg-brand-teal/30 border border-brand-teal/20 px-4 py-2.5 rounded-xl font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <Award className="w-4 h-4" />
                                    ASIGNAR MÉRITOS
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
                                                            <span className="text-[9px] text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</span>
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

            {/* MODAL: MANUAL AWARD ADJUSTMENT */}
            {isAwardModalOpen && selectedStudent && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-6 overflow-hidden relative animate-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setIsAwardModalOpen(false)}
                            className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg p-1 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-brand-teal/15 rounded-2xl text-brand-teal">
                                <Award className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-lg text-slate-800 dark:text-white">Otorgar Méritos/Puntos</h3>
                                <p className="text-xs text-slate-400">Asignar o deducir puntos a {selectedStudent.full_name}</p>
                            </div>
                        </div>

                        <form onSubmit={handleAwardPointsSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cantidad de Puntos</label>
                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/40 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                    <button
                                        type="button"
                                        onClick={() => setAwardPointsVal(prev => prev > 1 ? prev - 5 : prev)}
                                        className="p-2 text-slate-500 hover:text-brand-blue active:scale-90 transition-all rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                                    >
                                        <MinusCircle className="w-5 h-5" />
                                    </button>
                                    <input
                                        type="number"
                                        value={awardPointsVal}
                                        onChange={e => setAwardPointsVal(Number(e.target.value))}
                                        className="w-full text-center font-black text-xl text-slate-800 dark:text-white bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setAwardPointsVal(prev => prev + 5)}
                                        className="p-2 text-slate-500 hover:text-brand-blue active:scale-90 transition-all rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 shrink-0 cursor-pointer"
                                    >
                                        <PlusCircle className="w-5 h-5" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1.5 text-center">Tip: Puedes usar valores negativos para aplicar deméritos o multas.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Descripción / Motivo</label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Ej: Excelente participación en el concurso de ciencias, proyecto sobresaliente, etc..."
                                    value={awardDesc}
                                    onChange={e => setAwardDesc(e.target.value)}
                                    className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-2xl bg-transparent text-sm text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAwardModalOpen(false)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingAward}
                                    className="flex-1 bg-brand-teal hover:bg-brand-teal/90 text-slate-950 font-black py-2.5 rounded-xl text-xs shadow-lg shadow-brand-teal/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {isSubmittingAward ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Guardar Puntos</span>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: CREATE / EDIT REWARD */}
            {isRewardModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-6 overflow-hidden relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <button
                            onClick={() => setIsRewardModalOpen(false)}
                            className="absolute top-5 right-5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg p-1 transition-colors cursor-pointer"
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

                            <div className="grid grid-cols-2 gap-4">
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
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700/60 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingReward}
                                    className="flex-1 bg-brand-blue hover:bg-brand-blue/90 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-brand-blue/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {isSubmittingReward ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    <span>Guardar Premio</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MeritsAdmin;
