import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, updateUser, createUser, resetUserPassword } from './userService';
import { getStudents } from '../academic/academicService';
import { Loader2, Users, Search, Edit2, Shield, Mail, CheckCircle, XCircle, Plus, Link as LinkIcon, KeyRound } from 'lucide-react';

const UsersList = () => {
    const queryClient = useQueryClient();
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        full_name: '',
        role: 'student',
        email: '',
        phone: '',
        active: true
    });
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        full_name: '',
        role: 'student',
        email: '',
        password: '',
        phone: '',
        student_id: ''
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [resetForm, setResetForm] = useState({
        userId: '',
        newPassword: '',
        confirmPassword: ''
    });

    const { data: users, isLoading, isError } = useQuery({
        queryKey: ['users'],
        queryFn: getUsers,
    });

    const { data: students } = useQuery({
        queryKey: ['students-list'],
        queryFn: getStudents,
    });

    const createMutation = useMutation({
        mutationFn: createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            queryClient.invalidateQueries({ queryKey: ['students-list'] });
            setIsCreateModalOpen(false);
            setCreateForm({ full_name: '', role: 'student', email: '', password: '', phone: '', student_id: '' });
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error creating user:', err);
            setErrorMsg(err.response?.data?.message || 'Error al crear usuario.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateUser(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsEditModalOpen(false);
            setEditForm({ full_name: '', role: 'student', email: '', phone: '', active: true });
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error updating user:', err);
            setErrorMsg(err.response?.data?.message || 'Error al actualizar usuario.');
        }
    });

    const resetPasswordMutation = useMutation({
        mutationFn: resetUserPassword,
        onSuccess: () => {
            setSuccessMsg('Contraseña actualizada correctamente.');
            setTimeout(() => {
                setIsResetModalOpen(false);
                setSuccessMsg('');
            }, 2000);
            setResetForm({ userId: '', newPassword: '', confirmPassword: '' });
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error resetting password:', err);
            setErrorMsg(err.response?.data?.message || 'Error al restablecer contraseña.');
        }
    });

    const openEditModal = (user: any) => {
        setSelectedUser(user);
        setEditForm({
            full_name: user.full_name || '',
            role: user.role || 'student',
            email: user.email || '',
            phone: user.phone || '',
            active: user.active !== false
        });
        setIsEditModalOpen(true);
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!editForm.full_name) {
            setErrorMsg('El nombre es obligatorio.');
            return;
        }
        updateMutation.mutate({ id: selectedUser.id, data: editForm });
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!createForm.full_name || !createForm.email || !createForm.password) {
            setErrorMsg('Nombre, correo y contraseña son obligatorios.');
            return;
        }

        // Clean student_id if role is not student
        const payload = { ...createForm };
        if (payload.role !== 'student') {
            payload.student_id = '';
        }

        createMutation.mutate(payload);
    };

    const handleResetPassword = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (!resetForm.newPassword || !resetForm.confirmPassword) {
            setErrorMsg('Por favor complete todos los campos.');
            return;
        }

        if (resetForm.newPassword !== resetForm.confirmPassword) {
            setErrorMsg('Las contraseñas no coinciden.');
            return;
        }

        if (resetForm.newPassword.length < 6) {
            setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        resetPasswordMutation.mutate({
            userId: resetForm.userId,
            newPassword: resetForm.newPassword
        });
    };

    // Filter by name, email or role
    const filteredUsers = users?.filter((u: any) => {
        const query = searchTerm.toLowerCase();
        return (
            (u.full_name && u.full_name.toLowerCase().includes(query)) ||
            (u.email && u.email.toLowerCase().includes(query)) ||
            (u.role && u.role.toLowerCase().includes(query))
        );
    });

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-blue-500/50" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando usuarios...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gestión de Usuarios</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Administra los accesos y roles de la plataforma.</p>
                </div>
                <button
                    onClick={() => {
                        setErrorMsg('');
                        setCreateForm({ full_name: '', role: 'student', email: '', password: '', phone: '', student_id: '' });
                        setIsCreateModalOpen(true);
                    }}
                    className="flex items-center space-x-2 px-6 py-3 bg-brand-blue text-white rounded-xl hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(13,89,242,0.4)] active:scale-95 font-semibold border border-white/10"
                >
                    <Plus className="h-5 w-5" />
                    <span>Nuevo Usuario</span>
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 dark:text-slate-500 group-focus-within:text-brand-blue transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, correo o rol..."
                        className="w-full pl-12 pr-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl focus:ring-4 focus:ring-brand-blue/20 focus:border-brand-blue outline-none transition-all shadow-sm backdrop-blur-sm placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-3">
                    <span className="font-medium">Hubo un problema al cargar los usuarios.</span>
                </div>
            )}

            <div className="glass-card rounded-3xl overflow-hidden">
                <div className="min-w-full inline-block align-middle">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700/50">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/80">
                            <tr>
                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Usuario</th>
                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Contacto</th>
                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Estado</th>
                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {filteredUsers?.map((user: any) => (
                                <tr key={user.id} className="hover:bg-white/50 dark:hover:bg-slate-800/50 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center space-x-4">
                                            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-brand-blue/20 to-brand-purple/20 text-brand-blue dark:text-brand-teal border border-brand-blue/10 flex items-center justify-center font-bold uppercase shadow-sm shrink-0">
                                                {user.full_name?.charAt(0) || 'U'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900 dark:text-slate-100">{user.full_name || 'Sin Nombre'}</p>
                                                <div className="flex items-center mt-1 space-x-2">
                                                    <Shield className="h-3 w-3 text-slate-400" />
                                                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">{user.role || 'student'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="space-y-1">
                                            <div className="flex items-center text-slate-600 dark:text-slate-300 text-sm">
                                                <Mail className="h-4 w-4 mr-2 text-slate-400 dark:text-slate-500" />
                                                <span className="truncate max-w-[200px]">{user.email || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        {user.active !== false ? (
                                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400">
                                                <CheckCircle className="h-3.5 w-3.5" />
                                                <span>Activo</span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                <XCircle className="h-3.5 w-3.5" />
                                                <span>Inactivo</span>
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                onClick={() => {
                                                    setErrorMsg('');
                                                    setSuccessMsg('');
                                                    setResetForm({ userId: user.id, newPassword: '', confirmPassword: '' });
                                                    setSelectedUser(user);
                                                    setIsResetModalOpen(true);
                                                }}
                                                className="inline-flex items-center p-2 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 transition-all opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                                                title="Cambiar Contraseña"
                                            >
                                                <KeyRound className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => openEditModal(user)}
                                                className="inline-flex items-center p-2 bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-brand-blue hover:text-white dark:hover:bg-brand-blue transition-all opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                                                title="Editar Usuario"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredUsers?.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="h-16 w-16 bg-white/50 dark:bg-slate-800/50 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                                                <Users className="h-8 w-8" />
                                            </div>
                                            <div>
                                                <p className="text-slate-900 dark:text-white font-bold">No se encontraron usuarios</p>
                                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Intenta con otro término de búsqueda.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsCreateModalOpen(false)} />

                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
                            <h3 className="text-2xl font-bold">Nuevo Usuario</h3>
                            <p className="text-green-100 text-sm mt-1">Crea un nuevo acceso a la plataforma.</p>
                        </div>

                        <form onSubmit={handleCreate} className="p-8 space-y-6">
                            {errorMsg && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
                                    {errorMsg}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Nombre Completo *</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all placeholder:text-slate-400"
                                        value={createForm.full_name}
                                        onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                                        placeholder="Ej: Ana Gómez"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Correo Electrónico *</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all placeholder:text-slate-400"
                                        value={createForm.email}
                                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                        placeholder="correo@ejemplo.com"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Contraseña *</label>
                                        <input
                                            type="password"
                                            required
                                            minLength={6}
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all placeholder:text-slate-400"
                                            value={createForm.password}
                                            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                            placeholder="******"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Rol *</label>
                                        <select
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                                            value={createForm.role}
                                            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                                        >
                                            <option value="student">Estudiante / Alumno</option>
                                            <option value="instructor">Instructor / Profesor</option>
                                            <option value="secretary">Secretario(a)</option>
                                            <option value="admin">Administrador</option>
                                        </select>
                                    </div>
                                </div>

                                {createForm.role === 'student' && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center">
                                            <LinkIcon className="h-4 w-4 mr-2" />
                                            Enlazar a Estudiante (Opcional)
                                        </label>
                                        <select
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all"
                                            value={createForm.student_id}
                                            onChange={(e) => {
                                                const studentId = e.target.value;
                                                const selectedStudent = students?.find((s: any) => s.id === studentId);
                                                setCreateForm({
                                                    ...createForm,
                                                    student_id: studentId,
                                                    // Auto-completar el nombre si se selecciona un estudiante
                                                    full_name: selectedStudent ? selectedStudent.full_name : createForm.full_name
                                                });
                                            }}
                                        >
                                            <option value="">-- No enlazar por ahora --</option>
                                            {students
                                                ?.filter((s: any) => !s.user_id) // Only students without a linked user_id
                                                ?.map((st: any) => (
                                                    <option key={st.id} value={st.id}>{st.full_name}</option>
                                                ))
                                            }
                                        </select>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 px-1">
                                            Garantiza que el alumno pueda iniciar sesión y ver su perfil académico personal.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex space-x-4 pt-6 mt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending}
                                    className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 shadow-lg shadow-green-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                                >
                                    {createMutation.isPending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <span>Crear Usuario</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsEditModalOpen(false)} />

                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                            <h3 className="text-2xl font-bold">Editar Usuario</h3>
                            <p className="text-blue-100 text-sm mt-1">Modifica los detalles y permisos del usuario.</p>
                        </div>

                        <form onSubmit={handleUpdate} className="p-8 space-y-6">
                            {errorMsg && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
                                    {errorMsg}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        value={editForm.full_name}
                                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Correo Electrónico (Solo lectura)</label>
                                    <input
                                        type="email"
                                        disabled
                                        className="w-full mt-2 px-4 py-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 rounded-xl outline-none cursor-not-allowed"
                                        value={editForm.email}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Rol</label>
                                        <select
                                            className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                            value={editForm.role}
                                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                        >
                                            <option value="student">Estudiante</option>
                                            <option value="instructor">Instructor</option>
                                            <option value="admin">Administrador</option>
                                            <option value="superadmin">Superadmin</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Estado</label>
                                        <div className="mt-2 flex items-center h-[50px] px-2">
                                            <label className="flex items-center space-x-3 cursor-pointer group">
                                                <div className="relative flex items-center justify-center">
                                                    <input
                                                        type="checkbox"
                                                        className="peer sr-only"
                                                        checked={editForm.active}
                                                        onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                                                    />
                                                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-blue/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-blue shadow-inner border border-transparent dark:border-slate-600"></div>
                                                </div>
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 select-none">
                                                    {editForm.active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex space-x-4 pt-6 mt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={updateMutation.isPending}
                                    className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                                >
                                    {updateMutation.isPending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <span>Guardar</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Reset Password Modal */}
            {isResetModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => !resetPasswordMutation.isPending && setIsResetModalOpen(false)} />

                    <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <KeyRound className="w-5 h-5" />
                                Cambiar Contraseña
                            </h3>
                            <p className="text-orange-100 text-sm mt-1">Para {selectedUser?.full_name}</p>
                        </div>

                        <form onSubmit={handleResetPassword} className="p-6 space-y-5">
                            {errorMsg && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
                                    {errorMsg}
                                </div>
                            )}

                            {successMsg && (
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" /> {successMsg}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Nueva Contraseña</label>
                                    <input
                                        type="password"
                                        required
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all placeholder:text-slate-400"
                                        value={resetForm.newPassword}
                                        onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                                        placeholder="******"
                                        minLength={6}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Confirmar Contraseña</label>
                                    <input
                                        type="password"
                                        required
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all placeholder:text-slate-400"
                                        value={resetForm.confirmPassword}
                                        onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })}
                                        placeholder="******"
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            <div className="flex space-x-3 pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsResetModalOpen(false)}
                                    disabled={resetPasswordMutation.isPending || !!successMsg}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetPasswordMutation.isPending || !!successMsg}
                                    className="flex-1 px-4 py-2.5 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
                                >
                                    {resetPasswordMutation.isPending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <span>Actualizar</span>
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

export default UsersList;
