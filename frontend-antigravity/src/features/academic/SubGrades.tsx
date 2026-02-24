import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saveSubgradeCategories, deleteSubgradeCategory, getSubgrades, saveSubgrades } from './subgradeService';
import { Loader2, Save, Plus, Trash2, Edit2, Check } from 'lucide-react';

interface SubGradesProps {
    selectedCourse: string;
    selectedUnit: string;
}

const SubGrades = ({ selectedCourse, selectedUnit }: SubGradesProps) => {
    const queryClient = useQueryClient();

    // States for Categories Management
    const [categories, setCategories] = useState<any[]>([]);
    const [isEditingCategories, setIsEditingCategories] = useState(false);

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
        },
        onError: () => alert('Error al guardar categorías')
    });

    const mutationDeleteCategory = useMutation({
        mutationFn: deleteSubgradeCategory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrades'] });
        },
        onError: () => alert('Error al eliminar categoría')
    });

    const mutationSaveScores = useMutation({
        mutationFn: saveSubgrades,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subgrades'] });
            alert('Subcalificaciones guardadas exitosamente.');
        },
        onError: () => alert('Error al guardar subcalificaciones')
    });

    // Subgrades Handlers
    const handleScoreChange = (studentId: string, categoryId: string, scoreStr: string, maxScore: number) => {
        let val: string | number = scoreStr;
        if (scoreStr !== '') {
            const num = Number(scoreStr);
            if (num < 0) val = 0;
            if (num > maxScore) val = maxScore;
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
            Object.keys(student.scores).forEach(catId => {
                const scoreObj = student.scores[catId];
                if (scoreObj.score !== '') {
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
            mutationSaveScores.mutate({ subgrades: payload });
        } else {
            alert('No hay calificaciones modificadas para guardar.');
        }
    };

    // Category Handlers
    const handleAddCategory = () => {
        setCategories([...categories, { id: `temp-${Date.now()}`, name: '', max_score: 100, isNew: true }]);
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
            if (confirm(`¿Estás seguro de eliminar la categoría "${cat.name}"? Se perderán las notas asociadas.`)) {
                mutationDeleteCategory.mutate(cat.id);
            }
        }
    };

    const handleSaveCategories = () => {
        // Validation
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

    if (!selectedCourse) {
        return null;
    }

    if (isLoading || isFetching) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-100">
                <Loader2 className="animate-spin h-10 w-10 text-blue-500 mb-4" />
                <p className="text-slate-500 font-medium">Cargando subcalificaciones...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Category Configuration Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Categorías de Evaluación</h3>
                        <p className="text-sm text-slate-500">Configura los rubros a calificar en esta unidad (Ej: Cuaderno, Asistencia).</p>
                    </div>
                    {!isEditingCategories ? (
                        <button
                            onClick={() => setIsEditingCategories(true)}
                            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 text-sm bg-blue-50 px-3 py-1.5 rounded-lg"
                        >
                            <Edit2 className="w-4 h-4" /> Configurar Categorías
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveCategories}
                                disabled={mutationSaveCategories.isPending}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-1 text-sm px-4 py-2 rounded-lg"
                            >
                                {mutationSaveCategories.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                Guardar
                            </button>
                            <button
                                onClick={() => {
                                    setCategories(subgradesData?.categories || []);
                                    setIsEditingCategories(false);
                                }}
                                className="bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium text-sm px-4 py-2 rounded-lg"
                            >
                                Cancelar
                            </button>
                        </div>
                    )}
                </div>

                {isEditingCategories ? (
                    <div className="space-y-3 mt-4">
                        {categories.map((cat, index) => (
                            <div key={cat.id || index} className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={cat.name}
                                    onChange={(e) => handleCategoryChange(index, 'name', e.target.value)}
                                    placeholder="Nombre de Categoria (Ej: Cuaderno)"
                                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-500">Max pts:</span>
                                    <input
                                        type="number"
                                        value={cat.max_score}
                                        onChange={(e) => handleCategoryChange(index, 'max_score', e.target.value)}
                                        className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-center"
                                        min="1"
                                    />
                                </div>
                                <button onClick={() => handleRemoveCategory(index)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={handleAddCategory}
                            className="mt-3 text-slate-600 hover:text-slate-800 font-medium flex items-center gap-1 text-sm border border-dashed border-slate-300 rounded-lg px-4 py-2 w-full justify-center bg-slate-50 hover:bg-slate-100"
                        >
                            <Plus className="w-4 h-4" /> Agregar Nueva Categoría
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2 mt-4">
                        {categories.length > 0 ? categories.map((cat) => (
                            <div key={cat.id} className="bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 flex items-center gap-2">
                                {cat.name} <span className="bg-white text-slate-500 px-1.5 py-0.5 rounded text-xs">{cat.max_score} pts</span>
                            </div>
                        )) : (
                            <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 w-full">
                                No hay categorías configuradas aún. Clic en "Configurar Categorías" para empezar.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Subgrades Table Area */}
            {!isEditingCategories && categories.length > 0 && studentsData.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden relative">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 border-b border-slate-200 uppercase text-xs font-bold text-slate-500 tracking-wider">
                                <tr>
                                    <th className="px-6 py-5 sticky left-0 bg-slate-50/50 z-10 w-64 min-w-[16rem]">Estudiante</th>
                                    {categories.map(cat => (
                                        <th key={cat.id} className="px-6 py-5 text-center min-w-[8rem]">
                                            {cat.name} <div className="text-[10px] lowercase pt-1 text-slate-400 font-normal">Max: {cat.max_score}</div>
                                        </th>
                                    ))}
                                    <th className="px-6 py-5 text-center text-blue-600 bg-blue-50/30">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {studentsData.map((student) => {
                                    let totalScore = 0;
                                    categories.forEach(cat => {
                                        totalScore += Number(student.scores[cat.id]?.score) || 0;
                                    });

                                    return (
                                        <tr key={student.student_id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4 font-medium text-slate-800 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 border-r border-slate-100/50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
                                                        {student.student_name.charAt(0)}{student.student_name.split(' ')[1]?.[0] || ''}
                                                    </div>
                                                    <span className="truncate">{student.student_name}</span>
                                                </div>
                                            </td>
                                            {categories.map(cat => (
                                                <td key={cat.id} className="px-6 py-4 text-center">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={cat.max_score}
                                                        className="w-16 px-2 py-1.5 border border-slate-200 rounded-md focus:ring-2 focus:ring-blue-500 outline-none text-center font-semibold text-sm bg-slate-50 focus:bg-white"
                                                        placeholder="--"
                                                        value={student.scores[cat.id]?.score}
                                                        onChange={(e) => handleScoreChange(student.student_id, cat.id, e.target.value, cat.max_score)}
                                                    />
                                                </td>
                                            ))}
                                            <td className="px-6 py-4 text-center font-bold text-lg text-blue-700 bg-blue-50/30">
                                                {totalScore}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="bg-slate-50/80 p-5 border-t border-slate-200 flex justify-end items-center sticky bottom-0 z-20 backdrop-blur-md">
                        <button
                            onClick={handleSaveScores}
                            disabled={mutationSaveScores.isPending}
                            className="flex items-center space-x-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-sm hover:bg-blue-700 hover:shadow disabled:opacity-50 transition-all active:scale-95"
                        >
                            {mutationSaveScores.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            <span>Guardar Subcalificaciones</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubGrades;
