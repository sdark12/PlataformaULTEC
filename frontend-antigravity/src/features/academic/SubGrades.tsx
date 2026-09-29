import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    saveSubgradeCategories, 
    deleteSubgradeCategory, 
    getSubgrades, 
    saveSubgrades,
    copySubgradeCategories,
    getSubgradeCategories
} from './subgradeService';
import { 
    Loader2, Save, Plus, Trash2, Edit2, Check, Search, 
    CheckCircle2, Layers, AlertCircle, FileSpreadsheet,
    Copy, X
} from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import * as XLSX from 'xlsx';
import { saveWorkbook } from '../../utils/fileDownloader';


interface SubGradesProps {
    selectedCourse: string;
    selectedUnit: string;
    evaluationUnits?: string[];
}

const SubGrades = ({ selectedCourse, selectedUnit, evaluationUnits }: SubGradesProps) => {
    const queryClient = useQueryClient();

    // States for Categories Management
    const [categories, setCategories] = useState<any[]>([]);
    const [isEditingCategories, setIsEditingCategories] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<{ id: string; name: string } | null>(null);

    // States for Subgrades
    const [studentsData, setStudentsData] = useState<any[]>([]);

    // Fetch Categories and Subgrades
    const { data: subgradesData, isLoading, isFetching } = useQuery({
        queryKey: ['subgrades', selectedCourse, selectedUnit],
        queryFn: () => getSubgrades(selectedCourse, selectedUnit),
        enabled: !!selectedCourse && !!selectedUnit,
    });

    useEffect(() => {
        if (subgradesData) {
            setCategories(subgradesData.categories || []);
            setStudentsData(subgradesData.students || []);
        }
    }, [subgradesData]);

    const mutationSaveCategories = useMutation({
        mutationFn: saveSubgradeCategories,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrades'] });
            setIsEditingCategories(false);
            setToastMessage('Categorías de evaluación actualizadas correctamente');
            setTimeout(() => setToastMessage(null), 3000);
        },
        onError: () => alert('Error al guardar categorías')
    });

    const mutationDeleteCategory = useMutation({
        mutationFn: deleteSubgradeCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrades'] });
            setToastMessage('Categoría eliminada');
            setTimeout(() => setToastMessage(null), 3000);
        },
        onError: () => alert('Error al eliminar categoría')
    });

    const mutationSaveScores = useMutation({
        mutationFn: saveSubgrades,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrades'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['course_gradebook'] });
            setToastMessage('¡Subcalificaciones guardadas y nota bimestral sincronizada!');
            setTimeout(() => setToastMessage(null), 3500);
        },
        onError: () => alert('Error al guardar subcalificaciones')
    });

    // States for Copy Categories Modal
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [sourceUnitToCopy, setSourceUnitToCopy] = useState<string>('');
    const [isLoadingSourceCats, setIsLoadingSourceCats] = useState(false);
    const [sourceCategoriesPreview, setSourceCategoriesPreview] = useState<any[]>([]);

    const validUnits = useMemo(() => {
        const base = evaluationUnits && evaluationUnits.length > 0 
            ? evaluationUnits 
            : ['Bimestre 1', 'Bimestre 2', 'Bimestre 3', 'Bimestre 4'];
        return base.filter(u => !u.toLowerCase().includes('recupera'));
    }, [evaluationUnits]);

    const currentIndex = validUnits.indexOf(selectedUnit);
    const previousUnit = currentIndex > 0 ? validUnits[currentIndex - 1] : null;
    const canCopy = validUnits.length > 1;

    const handleOpenCopyModal = (defaultUnit?: string | null) => {
        const initialSource = defaultUnit || previousUnit || validUnits.find(u => u !== selectedUnit) || '';
        setSourceUnitToCopy(initialSource);
        setIsCopyModalOpen(true);
    };

    useEffect(() => {
        let isMounted = true;
        if (isCopyModalOpen && sourceUnitToCopy && selectedCourse) {
            setIsLoadingSourceCats(true);
            getSubgradeCategories(selectedCourse, sourceUnitToCopy)
                .then((cats) => {
                    if (isMounted) {
                        setSourceCategoriesPreview(cats || []);
                    }
                })
                .catch((err) => {
                    console.error('Error fetching source categories:', err);
                    if (isMounted) {
                        setSourceCategoriesPreview([]);
                    }
                })
                .finally(() => {
                    if (isMounted) {
                        setIsLoadingSourceCats(false);
                    }
                });
        }
        return () => {
            isMounted = false;
        };
    }, [isCopyModalOpen, sourceUnitToCopy, selectedCourse]);

    const mutationCopyCategories = useMutation({
        mutationFn: copySubgradeCategories,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['subgrades'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['course_gradebook'] });
            setIsCopyModalOpen(false);
            setToastMessage(data?.message || `¡Categorías copiadas exitosamente desde ${sourceUnitToCopy}!`);
            setTimeout(() => setToastMessage(null), 3500);
        },
        onError: (err: any) => {
            const msg = err.response?.data?.message || 'Error al copiar las categorías';
            alert(msg);
        }
    });

    const handleConfirmCopy = () => {
        if (!sourceUnitToCopy || sourceCategoriesPreview.length === 0) return;
        mutationCopyCategories.mutate({
            course_id: selectedCourse,
            source_unit_name: sourceUnitToCopy,
            target_unit_name: selectedUnit,
            replace_existing: true
        });
    };

    // Subgrades Handlers
    const handleScoreChange = (studentId: string, categoryId: string, scoreStr: string, maxScore: number) => {
        let val: string | number = scoreStr;
        if (scoreStr !== '') {
            const num = Number(scoreStr);
            if (num < 0) val = 0;
            else if (num > maxScore) val = maxScore;
            else val = num;
        }

        setStudentsData(prev => prev.map(student => {
            if (student.student_id === studentId) {
                return {
                    ...student,
                    scores: {
                        ...student.scores,
                        [categoryId]: {
                            ...student.scores[categoryId],
                            score: val
                        }
                    }
                };
            }
            return student;
        }));
    };

    const handleSaveScores = () => {
        const payload: any[] = [];
        studentsData.forEach(student => {
            Object.keys(student.scores || {}).forEach(catId => {
                const scoreObj = student.scores[catId];
                if (scoreObj && scoreObj.score !== '' && scoreObj.score !== undefined) {
                    payload.push({
                        student_id: student.student_id,
                        category_id: catId,
                        score: scoreObj.score,
                        remarks: scoreObj.remarks
                    });
                }
            });
        });

        if (payload.length > 0) {
            mutationSaveScores.mutate({ 
                course_id: selectedCourse,
                unit_name: selectedUnit,
                subgrades: payload 
            });
        } else {
            alert('No hay calificaciones modificadas para guardar.');
        }
    };

    const requestSaveScores = () => {
        const hasScores = studentsData.some(student => 
            Object.values(student.scores || {}).some((s: any) => s && s.score !== '' && s.score !== undefined)
        );
        if (!hasScores) {
            return alert('No hay calificaciones ingresadas para guardar.');
        }
        setShowConfirmModal(true);
    };

    const confirmAndSave = () => {
        setShowConfirmModal(false);
        handleSaveScores();
    };

    const exportToExcel = async () => {
        if (!studentsData || studentsData.length === 0 || !categories || categories.length === 0) return;

        const dataToExport = studentsData.map(student => {
            const row: any = {
                'Estudiante': student.student_name
            };
            
            let totalScore = 0;
            categories.forEach(cat => {
                const rawScore = student.scores[cat.id]?.score;
                const score = Number(rawScore) || 0;
                row[`${cat.name} (Max: ${cat.max_score})`] = rawScore !== '' && rawScore !== undefined ? score : 'Pendiente';
                totalScore += score;
            });
            
            row['Total'] = totalScore;
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Subcalificaciones");
        await saveWorkbook(workbook, `Subcalificaciones_${selectedUnit}.xlsx`);
    };

    // Category Handlers
    const handleAddCategory = () => {
        setCategories([...categories, { id: `temp-${Date.now()}`, name: '', max_score: 10, isNew: true }]);
        setIsEditingCategories(true);
    };

    const handleCategoryChange = (index: number, field: string, value: any) => {
        const newCat = [...categories];
        newCat[index][field] = value;
        setCategories(newCat);
    };

    const handleRemoveCategory = (index: number) => {
        const cat = categories[index];
        if (cat.isNew) {
            setCategories(categories.filter((_, i) => i !== index));
        } else {
            setDeleteCategoryConfirm({ id: cat.id, name: cat.name });
        }
    };

    const handleSaveCategories = () => {
        for (const cat of categories) {
            if (!cat.name.trim() || !cat.max_score) {
                return alert('Por favor completa el nombre y punteo máximo de todas las categorías.');
            }
        }

        const payload = categories.map(c => ({
            ...(c.isNew ? {} : { id: c.id }),
            name: c.name,
            max_score: Number(c.max_score)
        }));

        mutationSaveCategories.mutate({
            course_id: selectedCourse,
            unit_name: selectedUnit,
            categories: payload
        });
    };

    const totalMaxPoints = categories.reduce((sum, cat) => sum + (Number(cat.max_score) || 0), 0);

    const filteredStudents = studentsData.filter(student =>
        student.student_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!selectedCourse) {
        return null;
    }

    if (isLoading || isFetching) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-900/60 rounded-3xl border border-slate-800 text-slate-400">
                <Loader2 className="animate-spin h-8 w-8 text-blue-500 mb-3" />
                <p className="text-sm font-medium">Cargando subcalificaciones...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-300">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[110] px-4 py-3 bg-emerald-600 text-white text-sm font-bold rounded-2xl shadow-2xl shadow-emerald-950/60 border border-emerald-400/30 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Category Configuration Area */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl backdrop-blur-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-400" />
                            <h3 className="text-base sm:text-lg font-bold text-slate-100">Categorías de Evaluación</h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Rubros a calificar en esta unidad (Ej: Tareas, Cuaderno, Examen).
                        </p>
                    </div>

                    {!isEditingCategories ? (
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {canCopy && (
                                <button
                                    type="button"
                                    onClick={() => handleOpenCopyModal()}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0 shadow-sm cursor-pointer"
                                    title={previousUnit ? `Copiar estructura y rubros desde ${previousUnit}` : 'Copiar categorías de otro bimestre'}
                                >
                                    <Copy className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{previousUnit ? `Copiar de ${previousUnit}` : 'Copiar Categorías'}</span>
                                </button>
                            )}

                            <button
                                onClick={() => setIsEditingCategories(true)}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0 shadow-sm"
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Configurar Categorías</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={handleSaveCategories}
                                disabled={mutationSaveCategories.isPending}
                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-blue-600/30"
                            >
                                {mutationSaveCategories.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                <span>Guardar</span>
                            </button>
                            <button
                                onClick={() => {
                                    setCategories(subgradesData?.categories || []);
                                    setIsEditingCategories(false);
                                }}
                                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                        </div>
                    )}
                </div>

                {/* Resumen de Total de Puntos */}
                <div className="flex items-center gap-2 py-2 px-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs mb-3">
                    <span className="text-slate-400">Suma total de rubros:</span>
                    <span className={`font-black font-mono ${totalMaxPoints === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {totalMaxPoints} pts
                    </span>
                    {totalMaxPoints === 100 ? (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            (Exacto 100)
                        </span>
                    ) : (
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            (Recomendado: 100)
                        </span>
                    )}
                </div>

                {isEditingCategories ? (
                    <div className="space-y-3 mt-3">
                        {categories.map((cat, index) => (
                            <div key={cat.id || index} className="flex items-center gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800">
                                <input
                                    type="text"
                                    value={cat.name}
                                    onChange={(e) => handleCategoryChange(index, 'name', e.target.value)}
                                    placeholder="Nombre del rubro (ej: Cuaderno, Examen)"
                                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 rounded-xl text-xs font-medium focus:border-blue-500 outline-none transition-all"
                                />
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-xs text-slate-400 font-medium">Max:</span>
                                    <input
                                        type="number"
                                        value={cat.max_score}
                                        onChange={(e) => handleCategoryChange(index, 'max_score', e.target.value)}
                                        className="w-16 px-2 py-2 bg-slate-900 border border-slate-700 text-slate-100 rounded-xl text-xs font-bold text-center focus:border-blue-500 outline-none"
                                        min="1"
                                    />
                                    <span className="text-xs text-slate-400">pts</span>
                                </div>
                                <button 
                                    onClick={() => handleRemoveCategory(index)} 
                                    className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0"
                                    title="Eliminar rubro"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}

                        <div className="flex flex-col sm:flex-row items-center gap-2 mt-2">
                            <button
                                type="button"
                                onClick={handleAddCategory}
                                className="flex-1 text-blue-400 hover:text-blue-300 font-bold flex items-center justify-center gap-1.5 text-xs border border-dashed border-blue-500/40 hover:border-blue-500 rounded-xl px-4 py-2.5 w-full bg-blue-500/5 hover:bg-blue-500/10 transition-all active:scale-95 cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Agregar Nueva Categoría</span>
                            </button>
                            {canCopy && (
                                <button
                                    type="button"
                                    onClick={() => handleOpenCopyModal()}
                                    className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center justify-center gap-1.5 text-xs border border-dashed border-emerald-500/40 hover:border-emerald-500 rounded-xl px-4 py-2.5 w-full sm:w-auto bg-emerald-500/5 hover:bg-emerald-500/10 transition-all active:scale-95 shrink-0 cursor-pointer"
                                    title={previousUnit ? `Copiar categorías de ${previousUnit}` : 'Copiar categorías'}
                                >
                                    <Copy className="w-4 h-4 text-emerald-400" />
                                    <span>{previousUnit ? `Copiar de ${previousUnit}` : 'Copiar de otro bimestre'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {categories.length > 0 ? categories.map((cat) => (
                            <div 
                                key={cat.id} 
                                className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 flex items-center gap-2 shadow-sm"
                            >
                                <span>{cat.name}</span>
                                <span className="bg-slate-900 text-blue-400 font-mono font-bold px-1.5 py-0.5 rounded-md text-[11px] border border-slate-700">
                                    {cat.max_score} pts
                                </span>
                            </div>
                        )) : (
                            <div className="text-xs text-amber-400 bg-amber-500/10 px-3.5 py-3 rounded-xl border border-amber-500/20 w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                                    <span>No hay categorías configuradas aún en este bimestre.</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {canCopy && (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenCopyModal()}
                                            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                                        >
                                            <Copy className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>{previousUnit ? `Copiar de ${previousUnit}` : 'Copiar categorías'}</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingCategories(true)}
                                        className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                    >
                                        <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                                        <span>Configurar</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Subgrades Table Area */}
            {!isEditingCategories && categories.length > 0 && studentsData.length > 0 && (
                <>
                    {/* Búsqueda rápida de alumno y Guardado Rápido */}
                    <div className="flex items-center justify-between gap-2.5">
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Buscar alumno..."
                                className="w-full pl-9 pr-3 py-2 bg-slate-900/90 border border-slate-800 text-slate-200 text-xs rounded-xl outline-none focus:border-blue-500 transition-all placeholder:text-slate-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={requestSaveScores}
                            disabled={mutationSaveScores.isPending}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/30 transition-all shrink-0"
                            title="Guardar notas de subcalificaciones"
                        >
                            <Save className="w-3.5 h-3.5" />
                            <span>Guardar</span>
                        </button>
                    </div>

                    {/* VISTA MÓVIL: Tarjetas de Estudiante con Rubros en Grid */}
                    <div className="block md:hidden space-y-3">
                        {filteredStudents.map((student) => {
                            let totalScore = 0;
                            categories.forEach(cat => {
                                totalScore += Number(student.scores[cat.id]?.score) || 0;
                            });

                            const isPassed = totalScore >= 60;

                            return (
                                <div 
                                    key={student.student_id} 
                                    className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-md space-y-3 backdrop-blur-sm"
                                >
                                    {/* Encabezado del Estudiante */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center space-x-3 min-w-0">
                                            <div className="w-9 h-9 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                                {student.student_name.charAt(0)}{student.student_name.split(' ')[1]?.[0] || ''}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-slate-100 text-sm truncate leading-tight">
                                                    {student.student_name}
                                                </p>
                                                <p className="text-[11px] text-slate-400 mt-0.5">
                                                    Acumulado: <strong className={isPassed ? 'text-emerald-400' : 'text-rose-400'}>{totalScore}</strong> / {totalMaxPoints} pts
                                                </p>
                                            </div>
                                        </div>

                                        <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border shrink-0 ${
                                            isPassed 
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                        }`}>
                                            Total: {totalScore}
                                        </div>
                                    </div>

                                    {/* Grilla 2-Columnas de Rubros para este Alumno */}
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                                        {categories.map((cat) => {
                                            const currentScore = student.scores[cat.id]?.score;
                                            const numScore = currentScore === '' || currentScore === undefined ? '' : Number(currentScore);
                                            const isFullScore = numScore !== '' && numScore === Number(cat.max_score);

                                            return (
                                                <div 
                                                    key={cat.id} 
                                                    className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between gap-1.5"
                                                >
                                                    <div className="flex items-start justify-between gap-1 min-w-0">
                                                        <span className="font-bold text-slate-200 text-xs truncate" title={cat.name}>
                                                            {cat.name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                                            /{cat.max_score}
                                                        </span>
                                                    </div>

                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={cat.max_score}
                                                        className={`w-full py-1.5 px-2 rounded-lg text-center font-bold text-sm border outline-none transition-all ${
                                                            numScore === '' ? 'border-slate-700 bg-slate-900 text-slate-400' :
                                                            isFullScore ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' :
                                                            'border-blue-500/40 bg-slate-900 text-slate-100'
                                                        }`}
                                                        placeholder="--"
                                                        value={currentScore ?? ''}
                                                        onChange={(e) => handleScoreChange(student.student_id, cat.id, e.target.value, cat.max_score)}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        {filteredStudents.length === 0 && (
                            <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                                No se encontraron estudiantes con ese nombre.
                            </div>
                        )}
                    </div>

                    {/* VISTA ESCRITORIO: Tabla Multicolumna Dark */}
                    <div className="hidden md:block bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-950/80 border-b border-slate-800 uppercase text-xs font-bold text-slate-400 tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4 sticky left-0 bg-slate-950 z-10 w-64 min-w-[16rem]">Estudiante</th>
                                        {categories.map(cat => (
                                            <th key={cat.id} className="px-6 py-4 text-center min-w-[7rem]">
                                                {cat.name} 
                                                <div className="text-[10px] lowercase pt-0.5 text-slate-500 font-normal">Max: {cat.max_score}</div>
                                            </th>
                                        ))}
                                        <th className="px-6 py-4 text-center text-blue-400 bg-blue-950/30">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/80">
                                    {filteredStudents.map((student) => {
                                        let totalScore = 0;
                                        categories.forEach(cat => {
                                            totalScore += Number(student.scores[cat.id]?.score) || 0;
                                        });

                                        return (
                                            <tr key={student.student_id} className="hover:bg-slate-800/40 transition-colors group">
                                                <td className="px-6 py-4 font-medium text-slate-100 sticky left-0 bg-slate-900 group-hover:bg-slate-800/80 z-10 border-r border-slate-800">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                                            {student.student_name.charAt(0)}{student.student_name.split(' ')[1]?.[0] || ''}
                                                        </div>
                                                        <span className="font-bold truncate">{student.student_name}</span>
                                                    </div>
                                                </td>
                                                {categories.map(cat => (
                                                    <td key={cat.id} className="px-6 py-4 text-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={cat.max_score}
                                                            className="w-16 px-2 py-1.5 border border-slate-700 rounded-xl focus:border-blue-500 outline-none text-center font-bold text-sm bg-slate-950 text-slate-100"
                                                            placeholder="--"
                                                            value={student.scores[cat.id]?.score ?? ''}
                                                            onChange={(e) => handleScoreChange(student.student_id, cat.id, e.target.value, cat.max_score)}
                                                        />
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 text-center font-bold text-base text-blue-400 bg-blue-950/30">
                                                    {totalScore}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Barra Estática Inferior de Guardado y Exportación (Fija al final del contenido, no flota sobre las tarjetas al deslizar) */}
                    <div className="mt-8 p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                        <button
                            onClick={exportToExcel}
                            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-bold rounded-xl border border-emerald-500/30 transition-all active:scale-95 text-xs sm:text-sm"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>Exportar Excel</span>
                        </button>
                        <button
                            onClick={requestSaveScores}
                            disabled={mutationSaveScores.isPending}
                            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 active:scale-95 disabled:opacity-50 transition-all text-xs sm:text-sm shrink-0"
                        >
                            {mutationSaveScores.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>{mutationSaveScores.isPending ? 'Guardando...' : 'Guardar Subcalificaciones'}</span>
                        </button>
                    </div>
                </>
            )}

            {/* Modal de Confirmación para Guardar Subcalificaciones */}
            <ConfirmModal
                isOpen={showConfirmModal}
                title="¿Guardar Subcalificaciones?"
                message={`¿Confirmas que deseas registrar las subcalificaciones de ${filteredStudents.length} estudiantes para la unidad "${selectedUnit}"? Los puntajes se actualizarán de forma permanente.`}
                confirmText="Sí, Guardar"
                cancelText="Cancelar"
                variant="primary"
                isLoading={mutationSaveScores.isPending}
                onConfirm={confirmAndSave}
                onCancel={() => setShowConfirmModal(false)}
            />

            {/* Modal de Confirmación para Eliminar Categoría */}
            <ConfirmModal
                isOpen={!!deleteCategoryConfirm}
                title="¿Eliminar Categoría?"
                message={deleteCategoryConfirm ? `¿Estás seguro de eliminar la categoría "${deleteCategoryConfirm.name}"? Se perderán todas las notas asociadas.` : ''}
                confirmText="Eliminar Categoría"
                cancelText="Cancelar"
                variant="danger"
                isLoading={mutationDeleteCategory.isPending}
                onConfirm={() => {
                    if (deleteCategoryConfirm) {
                        mutationDeleteCategory.mutate(deleteCategoryConfirm.id);
                        setDeleteCategoryConfirm(null);
                    }
                }}
                onCancel={() => setDeleteCategoryConfirm(null)}
            />

            {/* Modal de Copiar Categorías desde otro Bimestre */}
            {isCopyModalOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-slate-100 relative animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-2xl">
                                    <Copy className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-slate-100">Copiar Categorías</h4>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Destino: <span className="text-blue-400 font-bold">{selectedUnit}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCopyModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Selector de Unidad Origen */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-slate-300">
                                Copiar estructura desde:
                            </label>
                            <div className="relative">
                                <select
                                    value={sourceUnitToCopy}
                                    onChange={(e) => setSourceUnitToCopy(e.target.value)}
                                    className="w-full px-3.5 py-2.5 bg-slate-800/90 border border-slate-700 text-slate-100 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition-all cursor-pointer"
                                >
                                    {validUnits
                                        .filter(u => u !== selectedUnit)
                                        .map(u => (
                                            <option key={u} value={u} className="bg-slate-900 text-slate-100">
                                                {u} {u === previousUnit ? '(Bimestre Anterior)' : ''}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        {/* Vista Previa de Categorías */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                                <span>Rubros a importar:</span>
                                {sourceCategoriesPreview.length > 0 && (
                                    <span className="text-slate-400 text-[11px]">
                                        {sourceCategoriesPreview.length} categoría(s)
                                    </span>
                                )}
                            </div>

                            {isLoadingSourceCats ? (
                                <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                                    <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                                    <span>Consultando categorías de {sourceUnitToCopy}...</span>
                                </div>
                            ) : sourceCategoriesPreview.length === 0 ? (
                                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                                    <div>
                                        <p className="font-bold">Sin categorías en "{sourceUnitToCopy}"</p>
                                        <p className="text-amber-400/80 mt-0.5">Elige otro bimestre que ya tenga rubros creados.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        {sourceCategoriesPreview.map((c: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center text-xs py-1.5 px-2.5 bg-slate-900/90 rounded-lg border border-slate-800/80">
                                                <span className="text-slate-200 font-medium truncate pr-2">{c.name}</span>
                                                <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 shrink-0">
                                                    {c.max_score} pts
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs font-medium">
                                        <span className="text-slate-400">Total ponderación:</span>
                                        <span className="font-mono font-bold text-slate-100">
                                            {sourceCategoriesPreview.reduce((acc, curr) => acc + (Number(curr.max_score) || 0), 0)} pts
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Aviso si la unidad actual ya tiene categorías */}
                        {categories.length > 0 && (
                            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                                <span>
                                    <strong>Atención:</strong> {selectedUnit} ya tiene {categories.length} categoría(s). Al confirmar, se reemplazarán por las de {sourceUnitToCopy}.
                                </span>
                            </div>
                        )}

                        {/* Botones de acción */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsCopyModalOpen(false)}
                                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={isLoadingSourceCats || sourceCategoriesPreview.length === 0 || mutationCopyCategories.isPending}
                                onClick={handleConfirmCopy}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-600/30 cursor-pointer"
                            >
                                {mutationCopyCategories.isPending ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                )}
                                <span>Copiar Categorías</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default SubGrades;
