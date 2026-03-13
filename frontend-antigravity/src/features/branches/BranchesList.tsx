import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBranches, createBranch, updateBranch, deleteBranch } from './branchesService';
import { Plus, Loader2, Edit2, Trash2, Building2 } from 'lucide-react';

const BranchesList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
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
        if (window.confirm(`¿Está seguro de eliminar "${branch.name}"? Esto puede fallar si la sede ya tiene registros asociados.`)) {
            deleteMutation.mutate(branch.id);
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
        setSelectedBranch(null);
        setNewBranch({ name: '', address: '', phone: '', email: '' });
        setErrorMsg('');
        setIsModalOpen(true);
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-blue-500/50" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando sedes...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Sedes</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Gestión de las franquicias o localidades de la academia.</p>
                </div>
                <button
                    onClick={handleNewBranch}
                    className="flex items-center space-x-2 px-6 py-3 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(13,89,242,0.4)] active:scale-95 font-semibold border border-white/10"
                >
                    <Plus className="h-5 w-5" />
                    <span>Nueva Sede</span>
                </button>
            </div>

            {isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-3">
                    <span className="font-medium">Hubo un problema al cargar las sedes. Por favor, reintente.</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {branches?.map((branch: any) => (
                    <div
                        key={branch.id}
                        className="group glass-card p-6 border border-slate-200 dark:border-white/10 hover:border-brand-blue/50 dark:hover:border-brand-blue/50 transition-all duration-300 relative overflow-hidden"
                    >
                        <div className="mb-4">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-brand-blue/20 to-brand-purple/20 flex items-center justify-center text-brand-blue dark:text-brand-teal border border-brand-blue/10 mb-4 group-hover:bg-brand-blue group-hover:text-white transition-colors duration-300 shadow-inner">
                                <Building2 className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-brand-blue dark:group-hover:text-brand-teal transition-colors">{branch.name}</h3>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm line-clamp-2 leading-relaxed">{branch.address || 'Sin dirección proporcionada.'}</p>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50 flex flex-col space-y-2">
                            { branch.email && <div className="text-sm text-slate-600 dark:text-slate-300">📧 {branch.email}</div> }
                            { branch.phone && <div className="text-sm text-slate-600 dark:text-slate-300">📱 {branch.phone}</div> }
                            <div className="flex justify-end space-x-1 mt-4">
                                <button
                                    onClick={() => handleEdit(branch)}
                                    className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 rounded-lg transition-colors"
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
                        </div>
                    </div>
                ))}

                {branches?.length === 0 && !isLoading && (
                    <div className="col-span-full bg-white/50 dark:bg-slate-800/50 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl py-20 text-center flex flex-col items-center justify-center space-y-4 backdrop-blur-sm">
                        <div className="h-16 w-16 bg-slate-100 dark:bg-slate-700/50 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                            <Building2 className="h-8 w-8" />
                        </div>
                        <div className="max-w-xs">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No hay sedes aún</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Comienza agregando tu primera sede.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />

                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                            <h3 className="text-2xl font-bold">{selectedBranch ? 'Editar Sede' : 'Crear Nueva Sede'}</h3>
                            <p className="text-blue-100 text-sm mt-1">{selectedBranch ? 'Modifique los detalles de la sede.' : 'Complete los detalles para agregar una sede.'}</p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            {errorMsg && (
                                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium animate-shake">
                                    {errorMsg}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Nombre de la Sede</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Ej: Sede Norte"
                                        value={newBranch.name}
                                        onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Dirección</label>
                                    <textarea
                                        rows={2}
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400 resize-none"
                                        placeholder="Dirección completa..."
                                        value={newBranch.address}
                                        onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 ml-1">Teléfono</label>
                                        <input
                                            type="text"
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="Ej: 5555-1234"
                                            value={newBranch.phone}
                                            onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-semibold text-slate-700 ml-1">Correo Electrónico</label>
                                        <input
                                            type="email"
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                            placeholder="correo@sede.com"
                                            value={newBranch.email}
                                            onChange={(e) => setNewBranch({ ...newBranch, email: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex space-x-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending}
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
                </div>
            )}
        </div>
    );
};

export default BranchesList;
