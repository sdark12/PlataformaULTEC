import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBranches, createBranch, updateBranch, deleteBranch } from './branchesService';
import { Plus, Loader2, Edit2, Trash2, Building2, X, Users, BookOpen, Check, ShieldAlert } from 'lucide-react';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { getCurrentUser } from '../auth/authService';
import { useBranch } from '../../context/BranchContext';

const BranchesList = () => {
    const queryClient = useQueryClient();
    const currentUser = getCurrentUser();
    const isSuperAdmin = currentUser?.role === 'superadmin';
    const { selectedBranchId, setSelectedBranchId } = useBranch();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteConfirmBranch, setDeleteConfirmBranch] = useState<any | null>(null);
    const [newBranch, setNewBranch] = useState({ name: '', address: '', phone: '', email: '' });
    const [selectedBranch, setSelectedBranch] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const { data: branches, isLoading, isError } = useQuery({
        queryKey: ['branches'],
        queryFn: getBranches,
    });

    const createMutation = useMutation({
        mutationFn: createBranch,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            setIsModalOpen(false);
            setNewBranch({ name: '', address: '', phone: '', email: '' });
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error creating branch:', err);
            setErrorMsg(err.response?.data?.message || 'Error al crear la sede. Verifique su conexión.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: any) => updateBranch(selectedBranch.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
            setIsModalOpen(false);
            setSelectedBranch(null);
            setNewBranch({ name: '', address: '', phone: '', email: '' });
            setErrorMsg('');
        },
        onError: (err: any) => {
            setErrorMsg(err.response?.data?.message || 'Error al actualizar la sede.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteBranch,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        },
        onError: (err: any) => {
            alert(err.response?.data?.message || 'Error al eliminar la sede. Es posible que tenga estudiantes inscritos.');
        }
    });

    const handleDelete = (branch: any) => {
        if (!isSuperAdmin) {
            alert('Solo el Superadministrador tiene privilegios para eliminar sedes institucionales.');
            return;
        }
        setDeleteConfirmBranch(branch);
    };

    const confirmDeleteBranch = () => {
        if (deleteConfirmBranch) {
            if (deleteConfirmBranch.students_count > 0) {
                alert(`No se puede eliminar la sede "${deleteConfirmBranch.name}" porque cuenta con ${deleteConfirmBranch.students_count} alumnos activos vinculados.`);
                setDeleteConfirmBranch(null);
                return;
            }
            deleteMutation.mutate(deleteConfirmBranch.id);
            setDeleteConfirmBranch(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!newBranch.name) {
            setErrorMsg('El nombre de la sede es obligatorio');
            return;
        }

        if (selectedBranch) {
            updateMutation.mutate(newBranch);
        } else {
            createMutation.mutate(newBranch);
        }
    };

    const handleEdit = (branch: any) => {
        if (!isSuperAdmin) {
            alert('Solo el Superadministrador puede modificar los datos de la sede.');
            return;
        }
        setSelectedBranch(branch);
        setNewBranch({
            name: branch.name,
            address: branch.address || '',
            phone: branch.phone || '',
            email: branch.email || ''
        });
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleNewBranch = () => {
        if (!isSuperAdmin) {
            alert('Solo el Superadministrador puede crear nuevas sedes institucionales.');
            return;
        }
        setSelectedBranch(null);
        setNewBranch({ name: '', address: '', phone: '', email: '' });
        setErrorMsg('');
        setIsModalOpen(true);
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-brand-teal" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando sedes y métricas regionales...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center space-x-3">
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Sedes Institucionales</h2>
                        {isSuperAdmin && (
                            <span className="px-2 py-0.5 rounded-full bg-brand-blue/15 text-brand-teal text-xs font-bold uppercase tracking-wider">
                                Multisede Activo
                            </span>
                        )}
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Gestión territorial de las franquicias, planteles y sucursales de la academia.
                    </p>
                </div>

                {isSuperAdmin ? (
                    <button
                        onClick={handleNewBranch}
                        className="flex items-center space-x-2 px-6 py-3 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(13,89,242,0.4)] active:scale-95 font-semibold border border-white/10"
                    >
                        <Plus className="h-5 w-5" />
                        <span>Nueva Sede</span>
                    </button>
                ) : (
                    <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                        <ShieldAlert className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>Gestión y alta de sedes reservada para Superadministración</span>
                    </div>
                )}
            </div>

            {isError && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center space-x-3">
                    <span className="font-medium">Hubo un problema al cargar las sedes. Por favor, reintente.</span>
                </div>
            )}

            {/* Grid of Branches */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {branches?.map((branch: any) => {
                    const isSelected = selectedBranchId === branch.id;
                    return (
                        <div
                            key={branch.id}
                            className={`group glass-card p-6 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                                isSelected
                                    ? 'border-brand-teal ring-2 ring-brand-teal/20 shadow-[0_0_20px_rgba(37,192,244,0.15)]'
                                    : 'border-slate-200 dark:border-white/10 hover:border-brand-blue/50 dark:hover:border-brand-blue/50'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-brand-blue/20 to-brand-purple/20 flex items-center justify-center text-brand-blue dark:text-brand-teal border border-brand-blue/10 group-hover:bg-brand-blue group-hover:text-white transition-colors duration-300 shadow-inner">
                                        <Building2 className="h-6 w-6" />
                                    </div>

                                    {isSelected && (
                                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30">
                                            <Check className="h-3 w-3" />
                                            <span>Sede en Pantalla</span>
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-brand-blue dark:group-hover:text-brand-teal transition-colors">
                                    {branch.name}
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm line-clamp-2 leading-relaxed">
                                    {branch.address || 'Sin dirección registrada.'}
                                </p>

                                {/* Branch KPIs */}
                                <div className="flex flex-wrap items-center gap-2 mt-4">
                                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-brand-blue dark:text-brand-teal text-xs font-semibold">
                                        <Users className="h-3.5 w-3.5" />
                                        <span>{branch.students_count ?? 0} alumnos</span>
                                    </span>
                                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-semibold">
                                        <BookOpen className="h-3.5 w-3.5" />
                                        <span>{branch.courses_count ?? 0} cursos</span>
                                    </span>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50 mt-5 space-y-3">
                                {branch.email && (
                                    <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                        📧 {branch.email}
                                    </div>
                                )}
                                {branch.phone && (
                                    <div className="text-xs text-slate-600 dark:text-slate-400">
                                        📱 {branch.phone}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-2">
                                    {isSuperAdmin ? (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedBranchId(isSelected ? 'all' : branch.id)}
                                            className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                                                isSelected
                                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/30'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-brand-blue/10 hover:text-brand-teal'
                                            }`}
                                        >
                                            {isSelected ? '✓ Ámbito Activo' : 'Ver datos de esta sede'}
                                        </button>
                                    ) : (
                                        <span className="text-[11px] text-slate-400 font-medium">Sede regional</span>
                                    )}

                                    {isSuperAdmin && (
                                        <div className="flex items-center space-x-1 ml-auto">
                                            <button
                                                onClick={() => handleEdit(branch)}
                                                className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
                                                title="Editar datos de sede"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(branch)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Eliminar sede"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {branches?.length === 0 && !isLoading && (
                    <div className="col-span-full bg-white/50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl py-20 text-center flex flex-col items-center justify-center space-y-4 backdrop-blur-sm">
                        <div className="h-16 w-16 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                            <Building2 className="h-8 w-8" />
                        </div>
                        <div className="max-w-xs">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No hay sedes registradas</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Comienza agregando tu primera sede territorial.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Crear / Editar Sede */}
            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-bold">{selectedBranch ? 'Editar Sede' : 'Crear Nueva Sede'}</h3>
                                <p className="text-blue-100 text-sm mt-1">{selectedBranch ? 'Modifique los detalles de la sede.' : 'Complete los detalles para agregar una sede.'}</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-white/80 hover:text-white bg-black/10 hover:bg-black/20 p-2 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {errorMsg && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 rounded-xl flex items-center space-x-2">
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre de la Sede *</label>
                                <input
                                    type="text"
                                    required
                                    value={newBranch.name}
                                    onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="Ej. Sede Norte, Sede Heredia"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Dirección Física</label>
                                <textarea
                                    value={newBranch.address}
                                    onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="Dirección exacta del plantel..."
                                    rows={2}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Teléfono</label>
                                    <input
                                        type="tel"
                                        value={newBranch.phone}
                                        onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        placeholder="Ej. +506 2222-3333"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Correo Electrónico</label>
                                    <input
                                        type="email"
                                        value={newBranch.email}
                                        onChange={(e) => setNewBranch({ ...newBranch, email: e.target.value })}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        placeholder="sede@ultec.edu"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                                >
                                    {createMutation.isPending || updateMutation.isPending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <span>{selectedBranch ? 'Actualizar' : 'Guardar Sede'}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal de Confirmación para Eliminar Sede */}
            <ConfirmModal
                isOpen={!!deleteConfirmBranch}
                title="¿Eliminar Sede Institucional?"
                description={
                    <div className="space-y-3">
                        <p>¿Estás seguro de eliminar la sede <strong className="text-rose-400">{deleteConfirmBranch?.name}</strong>?</p>
                        {deleteConfirmBranch?.students_count > 0 ? (
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
                                ⚠️ <strong>Bloqueo de seguridad:</strong> Esta sede cuenta con <strong>{deleteConfirmBranch.students_count}</strong> alumnos activos vinculados. Para proteger la integridad de los expedientes, la eliminación está bloqueada. Debe transferir o dar de baja a los alumnos antes de eliminarla.
                            </div>
                        ) : (
                            <p className="text-[11px] text-slate-400">Esta acción es permanente y no se puede deshacer.</p>
                        )}
                    </div>
                }
                confirmText={deleteConfirmBranch?.students_count > 0 ? 'Entendido (Bloqueado)' : 'Sí, Eliminar'}
                cancelText="Cancelar"
                variant="danger"
                isLoading={deleteMutation.isPending}
                onConfirm={confirmDeleteBranch}
                onClose={() => setDeleteConfirmBranch(null)}
            />
        </div>
    );
};

export default BranchesList;
