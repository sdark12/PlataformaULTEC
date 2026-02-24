import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStudents, createStudent, updateStudent, deleteStudent } from '../../features/academic/academicService';
import { Loader2, Users, Search, Filter, Calendar, UserPlus, X, Phone, MapPin, Heart, Shield, GraduationCap, Pencil, Trash2 } from 'lucide-react';

const StudentsList = () => {
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newStudent, setNewStudent] = useState({
        full_name: '',
        birth_date: '',
        gender: '',
        identification_document: '',
        nationality: 'Guatemalteco',
        address: '',
        phone: '',
        guardian_name: '',
        guardian_phone: '',
        guardian_email: '',
        guardian_relationship: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        medical_notes: '',
        previous_school: ''
    });
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterGender, setFilterGender] = useState<'' | 'M' | 'F'>('');
    const [filterMedicalNotes, setFilterMedicalNotes] = useState(false);
    const [filterInstitution, setFilterInstitution] = useState('');

    const { data: students, isLoading, isError } = useQuery({
        queryKey: ['students'],
        queryFn: getStudents,
    });

    // Extract unique institutions dynamically
    const uniqueInstitutions = Array.from(new Set(students?.map((s: any) => s.previous_school).filter(Boolean))).sort();

    const createMutation = useMutation({
        mutationFn: createStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            setIsModalOpen(false);
            resetForm();
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error creating student:', err);
            setErrorMsg(err.response?.data?.message || 'Error al registrar al estudiante.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => updateStudent(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            setIsModalOpen(false);
            setIsEditing(false);
            resetForm();
            setErrorMsg('');
        },
        onError: (err: any) => {
            console.error('Error updating student:', err);
            setErrorMsg(err.response?.data?.message || 'Error al actualizar al estudiante.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: deleteStudent,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students'] });
            queryClient.invalidateQueries({ queryKey: ['grades'] });
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
        },
        onError: (err: any) => {
            console.error('Error deleting student:', err);
            alert(err.response?.data?.message || 'Error al eliminar al estudiante.');
        }
    });

    const handleDelete = (id: string) => {
        if (window.confirm('¿Está seguro de eliminar este estudiante? Esta acción no se puede deshacer.')) {
            deleteMutation.mutate(id);
        }
    };

    const resetForm = () => {
        setNewStudent({
            full_name: '',
            birth_date: '',
            gender: '',
            identification_document: '',
            nationality: 'Guatemalteco',
            address: '',
            phone: '',
            guardian_name: '',
            guardian_phone: '',
            guardian_email: '',
            guardian_relationship: '',
            emergency_contact_name: '',
            emergency_contact_phone: '',
            medical_notes: '',
            previous_school: ''
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        if (!newStudent.full_name) {
            setErrorMsg('El nombre completo es obligatorio');
            return;
        }

        if (isEditing && selectedStudent) {
            updateMutation.mutate({ id: selectedStudent.id, data: newStudent });
        } else {
            createMutation.mutate(newStudent);
        }
    };

    const filteredStudents = students?.filter((s: any) => {
        const matchesSearch =
            s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.identification_document && s.identification_document.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (s.phone && s.phone.includes(searchTerm));

        const matchesGender = filterGender ? s.gender === filterGender : true;

        const matchesMedicalNotes = filterMedicalNotes ? (s.medical_notes && s.medical_notes.trim().length > 0) : true;

        const matchesInstitution = filterInstitution ? s.previous_school === filterInstitution : true;

        return matchesSearch && matchesGender && matchesMedicalNotes && matchesInstitution;
    });

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <Loader2 className="animate-spin h-12 w-12 text-blue-500/50" />
            <p className="text-slate-400 font-medium animate-pulse">Cargando registros...</p>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Registro de Estudiantes</h2>
                    <p className="text-slate-500 mt-1">Base de datos centralizada de alumnos inscritos.</p>
                </div>
                <button
                    onClick={() => {
                        setErrorMsg('');
                        setIsEditing(false);
                        resetForm();
                        setIsModalOpen(true);
                    }}
                    className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 active:scale-95 font-semibold"
                >
                    <UserPlus className="h-5 w-5" />
                    <span>Registrar Estudiante</span>
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, documento o teléfono..."
                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`flex items-center justify-center space-x-2 px-6 py-3 border rounded-2xl transition-colors shadow-sm font-medium w-full md:w-auto ${isFilterOpen || filterGender || filterMedicalNotes || filterInstitution ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Filter className="h-5 w-5" />
                        <span>Filtros {(filterGender || filterMedicalNotes || filterInstitution) ? '(Activos)' : ''}</span>
                    </button>

                    {isFilterOpen && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-5 z-20 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-bold text-slate-800 mb-4 border-b pb-2">Filtros Avanzados</h4>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Escuela de Procedencia</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-4"
                                        value={filterInstitution}
                                        onChange={(e) => setFilterInstitution(e.target.value)}
                                    >
                                        <option value="">Todas las instituciones</option>
                                        {uniqueInstitutions.map((inst: any) => (
                                            <option key={inst} value={inst}>{inst}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Género</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                        value={filterGender}
                                        onChange={(e) => setFilterGender(e.target.value as '' | 'M' | 'F')}
                                    >
                                        <option value="">Todos los géneros</option>
                                        <option value="M">Masculino</option>
                                        <option value="F">Femenino</option>
                                    </select>
                                </div>

                                <div className="pt-2">
                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <div className="relative flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                className="peer sr-only"
                                                checked={filterMedicalNotes}
                                                onChange={(e) => setFilterMedicalNotes(e.target.checked)}
                                            />
                                            <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors select-none">Mostrar solo con Notas Médicas</span>
                                    </label>
                                </div>
                            </div>

                            {(filterGender || filterMedicalNotes || filterInstitution) && (
                                <button
                                    onClick={() => { setFilterGender(''); setFilterMedicalNotes(false); setFilterInstitution(''); setIsFilterOpen(false); }}
                                    className="mt-5 w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-2"
                                >
                                    Limpiar Filtros
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-3">
                    <span className="font-medium">Hubo un problema al cargar los datos. Reintente en unos momentos.</span>
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="min-w-full inline-block align-middle">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Estudiante</th>
                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest">Fecha de Nacimiento</th>
                                <th className="px-8 py-5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {filteredStudents?.map((student: any) => (
                                <tr key={student.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center space-x-4">
                                            <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                                {student.full_name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{student.full_name}</p>
                                                <p className="text-xs text-slate-500">ID: #{student.id.toString().padStart(4, '0')}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center text-slate-600">
                                            <Calendar className="h-4 w-4 mr-2 text-slate-400" />
                                            <span className="font-medium">
                                                {student.birth_date ? new Date(student.birth_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No registrada'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedStudent(student);
                                                    setIsViewModalOpen(true);
                                                }}
                                                className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all text-sm font-bold opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0">
                                                Ver Perfil
                                            </button>
                                            <button
                                                onClick={() => handleDelete(student.id)}
                                                className="inline-flex items-center p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0"
                                                title="Eliminar Estudiante"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredStudents?.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center space-y-4">
                                            <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                                                <Users className="h-8 w-8" />
                                            </div>
                                            <div>
                                                <p className="text-slate-900 font-bold">No se encontraron estudiantes</p>
                                                <p className="text-slate-500 text-sm mt-1">Intenta con otro término de búsqueda o registra uno nuevo.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />

                    <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                            <h3 className="text-2xl font-bold">{isEditing ? 'Editar Estudiante' : 'Registrar Estudiante'}</h3>
                            <p className="text-blue-100 text-sm mt-1">{isEditing ? 'Modifique los datos del estudiante.' : 'Complete los datos básicos para formalizar el registro.'}</p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                            {errorMsg && (
                                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium animate-shake">
                                    {errorMsg}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Información Personal */}
                                <div className="md:col-span-2">
                                    <h4 className="text-lg font-bold text-slate-800 mb-3 border-b pb-2">Información Personal</h4>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Nombre Completo *</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Ej: Juan Pérez"
                                        value={newStudent.full_name}
                                        onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Fecha de Nacimiento</label>
                                    <input
                                        type="date"
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-700"
                                        value={newStudent.birth_date}
                                        onChange={(e) => setNewStudent({ ...newStudent, birth_date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Género</label>
                                    <select
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-700"
                                        value={newStudent.gender}
                                        onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}
                                    >
                                        <option value="">Seleccione...</option>
                                        <option value="M">Masculino</option>
                                        <option value="F">Femenino</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">DPI / CUI / Documento</label>
                                    <input
                                        type="text"
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Documento de Identificación"
                                        value={newStudent.identification_document}
                                        onChange={(e) => setNewStudent({ ...newStudent, identification_document: e.target.value })}
                                    />
                                </div>

                                {/* Contacto */}
                                <div className="md:col-span-2">
                                    <h4 className="text-lg font-bold text-slate-800 mb-3 border-b pb-2 mt-4">Contacto</h4>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Dirección</label>
                                    <input
                                        type="text"
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Dirección domiciliar completa"
                                        value={newStudent.address}
                                        onChange={(e) => setNewStudent({ ...newStudent, address: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Teléfono</label>
                                    <input
                                        type="text"
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Ej: 5555-5555"
                                        value={newStudent.phone}
                                        onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Escuela de Procedencia</label>
                                    <input
                                        type="text"
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Institución anterior"
                                        value={newStudent.previous_school}
                                        onChange={(e) => setNewStudent({ ...newStudent, previous_school: e.target.value })}
                                    />
                                </div>

                                {/* Encargado */}
                                <div className="md:col-span-2">
                                    <h4 className="text-lg font-bold text-slate-800 mb-3 border-b pb-2 mt-4">Padre o Encargado</h4>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Nombre del Encargado</label>
                                    <input
                                        type="text"
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Nombre completo"
                                        value={newStudent.guardian_name}
                                        onChange={(e) => setNewStudent({ ...newStudent, guardian_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Parentesco</label>
                                    <select
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-700"
                                        value={newStudent.guardian_relationship}
                                        onChange={(e) => setNewStudent({ ...newStudent, guardian_relationship: e.target.value })}
                                    >
                                        <option value="">Seleccione...</option>
                                        <option value="Padre">Padre</option>
                                        <option value="Madre">Madre</option>
                                        <option value="Tutor">Tutor Legal</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Teléfono Encargado</label>
                                    <input
                                        type="text"
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Teléfono de contacto"
                                        value={newStudent.guardian_phone}
                                        onChange={(e) => setNewStudent({ ...newStudent, guardian_phone: e.target.value })}
                                    />
                                </div>

                                {/* Emergencia */}
                                <div className="md:col-span-2">
                                    <h4 className="text-lg font-bold text-slate-800 mb-3 border-b pb-2 mt-4">Emergencia y Salud</h4>
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Contacto Emergencia</label>
                                    <input
                                        type="text"
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Nombre contacto emergencia"
                                        value={newStudent.emergency_contact_name}
                                        onChange={(e) => setNewStudent({ ...newStudent, emergency_contact_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Tel. Emergencia</label>
                                    <input
                                        type="text"
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Teléfono emergencia"
                                        value={newStudent.emergency_contact_phone}
                                        onChange={(e) => setNewStudent({ ...newStudent, emergency_contact_phone: e.target.value })}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-sm font-semibold text-slate-700 ml-1">Notas Médicas / Alergias</label>
                                    <textarea
                                        className="w-full mt-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Especifique alergias, condiciones médicas o cuidados especiales..."
                                        rows={2}
                                        value={newStudent.medical_notes}
                                        onChange={(e) => setNewStudent({ ...newStudent, medical_notes: e.target.value })}
                                    />
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
                                    {createMutation.isPending ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <span>{isEditing ? 'Guardar Cambios' : 'Confirmar Registro'}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {/* View Profile Modal */}
            {isViewModalOpen && selectedStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsViewModalOpen(false)} />
                    <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">

                        {/* Header */}
                        <div className="bg-slate-900 p-8 text-white flex justify-between items-start shrink-0">
                            <div className="flex items-center space-x-6">
                                <div className="h-20 w-20 rounded-full bg-blue-600 text-white flex items-center justify-center text-3xl font-bold border-4 border-slate-800">
                                    {selectedStudent.full_name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-3xl font-bold">{selectedStudent.full_name}</h3>
                                    <div className="flex items-center space-x-3 text-slate-400 mt-2 text-sm">
                                        <span className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700">ID: #{selectedStudent.id.toString().padStart(4, '0')}</span>
                                        <span>•</span>
                                        <span>{selectedStudent.nationality || 'Nacionalidad no registrada'}</span>
                                        {selectedStudent.gender && (
                                            <>
                                                <span>•</span>
                                                <span>{selectedStudent.gender === 'M' ? 'Masculino' : 'Femenino'}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={() => {
                                        setIsEditing(true);
                                        setNewStudent(selectedStudent);
                                        setIsViewModalOpen(false);
                                        setIsModalOpen(true);
                                    }}
                                    className="text-white hover:text-blue-200 transition-colors bg-blue-700/50 p-2 rounded-full hover:bg-blue-700"
                                    title="Editar Estudiante"
                                >
                                    <Pencil className="h-5 w-5" />
                                </button>
                                <button onClick={() => setIsViewModalOpen(false)} className="text-slate-500 hover:text-white transition-colors bg-slate-800 p-2 rounded-full hover:bg-slate-700">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-8 overflow-y-auto custom-scrollbar space-y-8">

                            {/* Personal & Contact */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="flex items-center space-x-2 text-blue-600 font-bold border-b border-slate-100 pb-2">
                                        <UserPlus className="h-5 w-5" />
                                        <span>Datos Personales</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Fecha de Nacimiento</p>
                                            <p className="text-slate-700 font-medium">
                                                {selectedStudent.birth_date
                                                    ? new Date(selectedStudent.birth_date).toLocaleDateString('es-ES', { dateStyle: 'long' })
                                                    : 'No registrada'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Documento Identificación</p>
                                            <p className="text-slate-700 font-medium">{selectedStudent.identification_document || '---'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center space-x-2 text-blue-600 font-bold border-b border-slate-100 pb-2">
                                        <MapPin className="h-5 w-5" />
                                        <span>Ubicación y Contacto</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Dirección</p>
                                            <p className="text-slate-700 font-medium">{selectedStudent.address || '---'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Teléfono Personal</p>
                                            <div className="flex items-center space-x-2 text-slate-700">
                                                <Phone className="h-4 w-4 text-slate-400" />
                                                <span className="font-medium">{selectedStudent.phone || '---'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Guardian & Emergency */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                                    <div className="flex items-center space-x-2 text-indigo-600 font-bold">
                                        <Shield className="h-5 w-5" />
                                        <span>Encargado / Tutor</span>
                                    </div>
                                    {selectedStudent.guardian_name ? (
                                        <div className="space-y-3">
                                            <p className="text-lg font-bold text-slate-800">{selectedStudent.guardian_name}</p>
                                            <div className="flex items-center space-x-2 text-sm text-slate-600">
                                                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold uppercase">{selectedStudent.guardian_relationship || 'Tutor'}</span>
                                            </div>
                                            <div className="flex items-center space-x-2 text-slate-600">
                                                <Phone className="h-4 w-4 text-slate-400" />
                                                <span>{selectedStudent.guardian_phone || 'Sin teléfono'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-slate-400 italic">No hay información de encargado registrada.</p>
                                    )}
                                </div>

                                <div className="bg-red-50 p-6 rounded-2xl border border-red-100 space-y-4">
                                    <div className="flex items-center space-x-2 text-red-600 font-bold">
                                        <Heart className="h-5 w-5" />
                                        <span>Salud y Emergencia</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs text-red-400 uppercase font-bold tracking-wider">Contacto de Emergencia</p>
                                            <p className="font-bold text-slate-800">{selectedStudent.emergency_contact_name || '---'}</p>
                                            <p className="text-sm text-slate-600">{selectedStudent.emergency_contact_phone}</p>
                                        </div>
                                        {selectedStudent.medical_notes && (
                                            <div className="pt-2 border-t border-red-100">
                                                <p className="text-xs text-red-400 uppercase font-bold tracking-wider mb-1">Notas Médicas</p>
                                                <p className="text-sm text-slate-700 bg-white p-3 rounded-lg border border-red-100 italic">
                                                    "{selectedStudent.medical_notes}"
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Academic */}
                            {selectedStudent.previous_school && (
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="flex items-center space-x-2 text-green-600 font-bold">
                                        <GraduationCap className="h-5 w-5" />
                                        <span>Historial Académico</span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Escuela de Procedencia</p>
                                        <p className="text-slate-700 font-medium">{selectedStudent.previous_school}</p>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentsList;

