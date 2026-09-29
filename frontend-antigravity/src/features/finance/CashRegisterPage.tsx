import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Wallet, Coins, Receipt, ArrowDownLeft, ArrowUpRight, 
    CheckCircle2, AlertTriangle, Printer, History, Plus, 
    Trash2, Clock, Lock, Unlock, CheckCheck, Loader2, X, FileText
} from 'lucide-react';
import { 
    cashRegisterService, 
    type CashShift 
} from './cashRegisterService';
import { getCurrentUser } from '../auth/authService';
import { useBranch } from '../../context/BranchContext';

export const CashRegisterPage: React.FC = () => {
    const queryClient = useQueryClient();
    const currentUser = getCurrentUser();
    const { selectedBranchId } = useBranch();
    const role = currentUser?.role || 'secretary';
    const isStaff = ['admin', 'superadmin', 'secretary'].includes(role);
    const canAudit = ['admin', 'superadmin'].includes(role);

    // Active UI Tab: 'current' (Turno Activo) | 'history' (Historial)
    const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

    // Modals state
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [selectedShiftForVoucher, setSelectedShiftForVoucher] = useState<string | null>(null);

    // Query: Current Shift
    const { 
        data: currentData, 
        isLoading: isLoadingCurrent
    } = useQuery({
        queryKey: ['cashRegisterCurrent', selectedBranchId],
        queryFn: () => cashRegisterService.getCurrentShift(),
        enabled: isStaff,
        refetchInterval: 15000 // Refresco automático cada 15 segundos
    });

    // Query: Shifts History
    const { 
        data: historyData, 
        isLoading: isLoadingHistory 
    } = useQuery({
        queryKey: ['cashRegisterHistory', selectedBranchId],
        queryFn: () => cashRegisterService.getShiftsHistory(40),
        enabled: isStaff && activeTab === 'history'
    });

    // Mutation: Open Shift
    const [openingBalance, setOpeningBalance] = useState<string>('0.00');
    const [openingNotes, setOpeningNotes] = useState<string>('');
    const openShiftMutation = useMutation({
        mutationFn: (data: { opening_balance: number; opening_notes?: string; branch_id?: string }) => 
            cashRegisterService.openShift(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashRegisterCurrent'] });
            queryClient.invalidateQueries({ queryKey: ['cashRegisterHistory'] });
            setOpeningBalance('0.00');
            setOpeningNotes('');
        },
        onError: (err: any) => {
            alert(err?.response?.data?.message || 'Error al abrir el turno de caja.');
        }
    });

    // Mutation: Delete Expense
    const deleteExpenseMutation = useMutation({
        mutationFn: (id: string) => cashRegisterService.deleteExpense(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashRegisterCurrent'] });
        },
        onError: (err: any) => {
            alert(err?.response?.data?.message || 'Error al eliminar el gasto.');
        }
    });

    // Mutation: Audit Shift
    const auditShiftMutation = useMutation({
        mutationFn: ({ id, notes }: { id: string; notes?: string }) => 
            cashRegisterService.auditShift(id, notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cashRegisterHistory'] });
            alert('El turno ha sido auditado y visado correctamente.');
        },
        onError: (err: any) => {
            alert(err?.response?.data?.message || 'Error al auditar el turno.');
        }
    });

    const formatMoney = (amount: number | string | undefined | null) => {
        const val = Number(amount) || 0;
        return `Q${val.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (isoString?: string | null) => {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleDateString('es-GT', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const isShiftActive = currentData?.active && currentData.shift;
    const shift = currentData?.shift;

    // Sub-tab for current shift transactions
    const [subTab, setSubTab] = useState<'payments' | 'expenses'>('payments');

    return (
        <div className="space-y-6">
            {/* Header & Main Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                            <Coins className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                                Caja Chica y Arqueo Diario
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Control de gaveta en efectivo, registro de egresos menores y corte de turno por sede
                            </p>
                        </div>
                    </div>
                </div>

                {/* Status Badge & Tab Buttons */}
                <div className="flex items-center gap-3">
                    {/* Live State Badge */}
                    {isLoadingCurrent ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-semibold">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verificando caja...
                        </div>
                    ) : isShiftActive ? (
                        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold shadow-sm">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                            <span>TURNO ACTIVO EN GAVETA</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
                            <Lock className="h-3.5 w-3.5" />
                            <span>CAJA CERRADA</span>
                        </div>
                    )}

                    {/* Navigation Tabs */}
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setActiveTab('current')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'current'
                                    ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-brand-teal shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Coins className="h-3.5 w-3.5" />
                            <span>Turno Actual</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                activeTab === 'history'
                                    ? 'bg-white dark:bg-slate-900 text-brand-blue dark:text-brand-teal shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <History className="h-3.5 w-3.5" />
                            <span>Historial y Arqueos</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Warning when SuperAdmin has 'all' branches selected */}
            {currentData?.requires_branch_selection && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-700 dark:text-amber-300 text-sm">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold">Selección de Sede Requerida para Caja Chica</p>
                        <p className="text-xs opacity-90 mt-0.5">
                            La caja chica y el arqueo diario operan a nivel de sede territorial. Utiliza el selector de sede en la barra superior para elegir el plantel que deseas aperturar, operar o arquear.
                        </p>
                    </div>
                </div>
            )}

            {/* TAB 1: TURNO ACTUAL */}
            {activeTab === 'current' && (
                <>
                    {isLoadingCurrent ? (
                        <div className="p-12 text-center text-slate-500">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-brand-blue" />
                            <p className="text-sm">Consultando estado de la caja chica...</p>
                        </div>
                    ) : !isShiftActive ? (
                        /* ESTADO 1: CAJA CERRADA -> FORMULARIO DE APERTURA */
                        <div className="max-w-2xl mx-auto my-6 p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl text-center">
                            <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-brand-blue/10 to-indigo-500/10 border border-brand-blue/20 text-brand-blue dark:text-brand-teal mb-4">
                                <Unlock className="h-8 w-8" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Apertura de Turno de Caja
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                                Inicie el turno de caja indicando el fondo inicial disponible en gaveta para dar cambio.
                            </p>

                            <form 
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    openShiftMutation.mutate({
                                        opening_balance: Number(openingBalance) || 0,
                                        opening_notes: openingNotes,
                                        branch_id: selectedBranchId !== 'all' ? selectedBranchId : undefined
                                    });
                                }}
                                className="mt-6 text-left space-y-4"
                            >
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                                        Fondo Inicial de Gaveta / Cambio (Q)
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold">
                                            Q
                                        </div>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={openingBalance}
                                            onChange={(e) => setOpeningBalance(e.target.value)}
                                            required
                                            className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-brand-blue outline-none transition"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Efectivo físico presente en la gaveta antes de iniciar cobros del día.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                                        Notas u Observaciones de Apertura (Opcional)
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={openingNotes}
                                        onChange={(e) => setOpeningNotes(e.target.value)}
                                        placeholder="Ej: Turno matutino, billetes de baja denominación recibidos de administración..."
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-blue outline-none transition"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={openShiftMutation.isPending}
                                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                                >
                                    {openShiftMutation.isPending ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            <span>Abriendo Turno...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Unlock className="h-5 w-5" />
                                            <span>Abrir Turno de Caja Ahora</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    ) : (
                        /* ESTADO 2: CAJA ABIERTA -> PANEL OPERATIVO EN VIVO */
                        <div className="space-y-6">
                            {/* Shift Info Banner & Action Buttons */}
                            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 shadow-xl text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-extrabold uppercase tracking-wider">
                                            Turno Activo
                                        </span>
                                        <span className="text-xs text-slate-300 font-medium">
                                            Sede: <strong className="text-white">{shift?.branch_name}</strong>
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold">
                                        Responsable de Caja: {shift?.opened_by_name}
                                    </h3>
                                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5 text-brand-teal" />
                                        <span>Apertura: {formatDate(shift?.opened_at)}</span>
                                        {shift?.opening_notes && (
                                            <span className="italic text-slate-300 ml-2">"{shift.opening_notes}"</span>
                                        )}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        onClick={() => setIsExpenseModalOpen(true)}
                                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span>Registrar Gasto Menor</span>
                                    </button>

                                    <button
                                        onClick={() => setIsCloseModalOpen(true)}
                                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-lg shadow-emerald-500/20"
                                    >
                                        <Lock className="h-4 w-4" />
                                        <span>Arqueo y Cerrar Caja</span>
                                    </button>
                                </div>
                            </div>

                            {/* 4 KPI Cards: Gaveta Reconciliation */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* 1. Fondo Inicial */}
                                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider">Fondo Inicial</span>
                                        <Wallet className="h-4 w-4 text-slate-400" />
                                    </div>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">
                                        {formatMoney(shift?.opening_balance)}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1">Saldo base al abrir turno</p>
                                </div>

                                {/* 2. Cobros en Efectivo (Gaveta) */}
                                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                            (+) Cobrado en Efectivo
                                        </span>
                                        <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                            <ArrowDownLeft className="h-4 w-4" />
                                        </div>
                                    </div>
                                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                        {formatMoney(shift?.cash_inflow)}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        {currentData?.payments.filter(p => p.method?.toLowerCase() === 'cash' || p.method?.toLowerCase() === 'efectivo').length} pago(s) en efectivo
                                    </p>
                                </div>

                                {/* 3. Gastos Menores (Egresos) */}
                                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
                                    <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                                            (-) Gastos de Caja Chica
                                        </span>
                                        <div className="p-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                            <ArrowUpRight className="h-4 w-4" />
                                        </div>
                                    </div>
                                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                                        {formatMoney(shift?.expenses_outflow)}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        {currentData?.expenses.length} egreso(s) registrados
                                    </p>
                                </div>

                                {/* 4. Saldo Teórico Esperado en Gaveta */}
                                <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-blue/10 via-indigo-500/10 to-transparent border border-brand-blue/30 shadow-md relative overflow-hidden">
                                    <div className="flex items-center justify-between text-brand-blue dark:text-brand-teal mb-2">
                                        <span className="text-xs font-extrabold uppercase tracking-wider">
                                            (=) Total Esperado en Gaveta
                                        </span>
                                        <Coins className="h-4 w-4 text-brand-blue dark:text-brand-teal" />
                                    </div>
                                    <p className="text-2xl font-black text-brand-blue dark:text-brand-teal">
                                        {formatMoney(shift?.expected_cash)}
                                    </p>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                                        Efectivo que debe haber físicamente
                                    </p>
                                </div>
                            </div>

                            {/* Extra Transparency Bar: Otros Métodos (Transferencias / Tarjetas) */}
                            {Number(shift?.other_inflow) > 0 && (
                                <div className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                        <FileText className="h-4 w-4 text-brand-blue" />
                                        <span>
                                            Ingresos por Transferencia / Tarjeta / Depósito (No van a gaveta física):
                                        </span>
                                    </div>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                        {formatMoney(shift?.other_inflow)}
                                    </span>
                                </div>
                            )}

                            {/* Sub-Tabs: Cobros del Turno vs Egresos de Caja Chica */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-4 gap-6">
                                    <button
                                        onClick={() => setSubTab('payments')}
                                        className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition ${
                                            subTab === 'payments'
                                                ? 'border-brand-blue text-brand-blue dark:text-brand-teal'
                                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        <Coins className="h-4 w-4" />
                                        <span>Cobros Recibidos en Turno ({currentData?.payments.length || 0})</span>
                                    </button>
                                    <button
                                        onClick={() => setSubTab('expenses')}
                                        className={`pb-3 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition ${
                                            subTab === 'expenses'
                                                ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        <Receipt className="h-4 w-4" />
                                        <span>Egresos Menores ({currentData?.expenses.length || 0})</span>
                                    </button>
                                </div>

                                <div className="p-6">
                                    {subTab === 'payments' ? (
                                        /* Lista de Cobros del Turno */
                                        <div>
                                            {currentData?.payments.length === 0 ? (
                                                <div className="py-8 text-center text-slate-400 text-sm">
                                                    No se ha registrado ningún cobro aún durante este turno de caja.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-xs">
                                                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                                                            <tr>
                                                                <th className="py-2.5 px-3">Hora</th>
                                                                <th className="py-2.5 px-3">Estudiante</th>
                                                                <th className="py-2.5 px-3">Concepto</th>
                                                                <th className="py-2.5 px-3">Método</th>
                                                                <th className="py-2.5 px-3 text-right">Monto</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                            {currentData?.payments.map((p) => {
                                                                const isCash = p.method?.toLowerCase() === 'cash' || p.method?.toLowerCase() === 'efectivo';
                                                                return (
                                                                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                                                                        <td className="py-2.5 px-3 text-slate-500 font-mono">
                                                                            {new Date(p.payment_date).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                                                                        </td>
                                                                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                                                                            {p.students?.full_name || 'Estudiante'}
                                                                            {p.students?.academy_code && (
                                                                                <span className="block text-[10px] text-slate-400 font-normal">
                                                                                    {p.students.academy_code}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                                                            {p.description || p.payment_type || 'Colegiatura'}
                                                                            {p.reference_number && (
                                                                                <span className="block text-[10px] text-slate-400">
                                                                                    Ref: {p.reference_number}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-2.5 px-3">
                                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                                isCash
                                                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                                                    : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                                                            }`}>
                                                                                {isCash ? 'EFECTIVO' : p.method.toUpperCase()}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                                                                            {formatMoney(p.amount)}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Lista de Egresos de Caja Chica */
                                        <div>
                                            {currentData?.expenses.length === 0 ? (
                                                <div className="py-8 text-center text-slate-400 text-sm">
                                                    No se han registrado egresos menores en este turno de caja.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-xs">
                                                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                                                            <tr>
                                                                <th className="py-2.5 px-3">Hora</th>
                                                                <th className="py-2.5 px-3">Categoría</th>
                                                                <th className="py-2.5 px-3">Descripción</th>
                                                                <th className="py-2.5 px-3">Comprobante</th>
                                                                <th className="py-2.5 px-3 text-right">Monto</th>
                                                                <th className="py-2.5 px-3 text-center">Acción</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                            {currentData?.expenses.map((e) => (
                                                                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                                                                    <td className="py-2.5 px-3 text-slate-500 font-mono">
                                                                        {new Date(e.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                                                                    </td>
                                                                    <td className="py-2.5 px-3">
                                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                                            {e.category}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                                                                        {e.description}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-slate-500">
                                                                        {e.receipt_number ? `No. ${e.receipt_number}` : '—'}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400">
                                                                        -{formatMoney(e.amount)}
                                                                    </td>
                                                                    <td className="py-2.5 px-3 text-center">
                                                                        <button
                                                                            onClick={() => {
                                                                                if (confirm('¿Desea anular y eliminar este registro de gasto de la caja chica?')) {
                                                                                    deleteExpenseMutation.mutate(e.id);
                                                                                }
                                                                            }}
                                                                            disabled={deleteExpenseMutation.isPending}
                                                                            title="Eliminar gasto"
                                                                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* TAB 2: HISTORIAL DE TURNOS Y ARQUEOS */}
            {activeTab === 'history' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-base">
                                Historial de Turnos de Caja y Arqueos
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Registro inmutable de cierres, diferencias y comprobantes de corte
                            </p>
                        </div>
                    </div>

                    {isLoadingHistory ? (
                        <div className="p-12 text-center text-slate-500">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-brand-blue" />
                            <p className="text-xs">Cargando historial de turnos...</p>
                        </div>
                    ) : !historyData || historyData.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 text-sm">
                            No se encontraron registros de turnos de caja en esta sede.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="py-3 px-4">Apertura / Cierre</th>
                                        <th className="py-3 px-4">Sede / Responsable</th>
                                        <th className="py-3 px-4 text-right">Fondo Base</th>
                                        <th className="py-3 px-4 text-right">Cobrado (Efectivo)</th>
                                        <th className="py-3 px-4 text-right">Egresos</th>
                                        <th className="py-3 px-4 text-right">Esperado</th>
                                        <th className="py-3 px-4 text-right">Real Entregado</th>
                                        <th className="py-3 px-4 text-center">Diferencia</th>
                                        <th className="py-3 px-4 text-center">Estado</th>
                                        <th className="py-3 px-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {historyData.map((s) => {
                                        const diff = Number(s.difference) || 0;
                                        const isExact = diff === 0;
                                        const isOver = diff > 0;
                                        return (
                                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-slate-900 dark:text-white">
                                                        {formatDate(s.opened_at)}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        Cierre: {s.closed_at ? formatDate(s.closed_at) : 'En curso'}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-slate-900 dark:text-white">
                                                        {s.branch_name}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        Abierto por: {s.opened_by_name}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-right font-medium text-slate-600 dark:text-slate-300">
                                                    {formatMoney(s.opening_balance)}
                                                </td>
                                                <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                    {formatMoney(s.cash_inflow)}
                                                </td>
                                                <td className="py-3 px-4 text-right font-medium text-rose-600 dark:text-rose-400">
                                                    {formatMoney(s.expenses_outflow)}
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                                                    {formatMoney(s.expected_cash)}
                                                </td>
                                                <td className="py-3 px-4 text-right font-bold text-brand-blue dark:text-brand-teal">
                                                    {s.actual_cash !== null && s.actual_cash !== undefined ? formatMoney(s.actual_cash) : '—'}
                                                </td>
                                                <td className="py-3 px-4 text-center font-bold">
                                                    {s.status === 'OPEN' ? (
                                                        <span className="text-slate-400 font-normal">En curso</span>
                                                    ) : isExact ? (
                                                        <span className="text-emerald-600 dark:text-emerald-400">Exacto</span>
                                                    ) : isOver ? (
                                                        <span className="text-blue-600 dark:text-blue-400">+{formatMoney(diff)}</span>
                                                    ) : (
                                                        <span className="text-rose-600 dark:text-rose-400">-{formatMoney(Math.abs(diff))}</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                                        s.status === 'AUDITED'
                                                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                                            : s.status === 'CLOSED'
                                                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                    }`}>
                                                        {s.status === 'AUDITED' ? 'AUDITADO' : s.status === 'CLOSED' ? 'CERRADO' : 'ABIERTO'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => setSelectedShiftForVoucher(s.id)}
                                                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-blue/10 hover:text-brand-blue text-slate-600 dark:text-slate-300 transition cursor-pointer"
                                                            title="Ver Comprobante de Corte"
                                                        >
                                                            <Printer className="h-3.5 w-3.5" />
                                                        </button>

                                                        {canAudit && s.status === 'CLOSED' && (
                                                            <button
                                                                onClick={() => {
                                                                    const notes = prompt('Ingrese notas de auditoría o visto bueno:');
                                                                    if (notes !== null) {
                                                                        auditShiftMutation.mutate({ id: s.id, notes });
                                                                    }
                                                                }}
                                                                className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 transition cursor-pointer"
                                                                title="Visar y Auditar Turno"
                                                            >
                                                                <CheckCheck className="h-3.5 w-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL 1: REGISTRAR GASTO MENOR DE CAJA CHICA */}
            {isExpenseModalOpen && (
                <ExpenseModal
                    isOpen={isExpenseModalOpen}
                    onClose={() => setIsExpenseModalOpen(false)}
                    onSuccess={() => {
                        setIsExpenseModalOpen(false);
                        queryClient.invalidateQueries({ queryKey: ['cashRegisterCurrent'] });
                    }}
                />
            )}

            {/* MODAL 2: ARQUEO Y CIERRE DE TURNO */}
            {isCloseModalOpen && shift && (
                <CloseShiftModal
                    isOpen={isCloseModalOpen}
                    shift={shift}
                    onClose={() => setIsCloseModalOpen(false)}
                    onSuccess={(closedShiftId) => {
                        setIsCloseModalOpen(false);
                        queryClient.invalidateQueries({ queryKey: ['cashRegisterCurrent'] });
                        queryClient.invalidateQueries({ queryKey: ['cashRegisterHistory'] });
                        setSelectedShiftForVoucher(closedShiftId);
                    }}
                />
            )}

            {/* MODAL 3: COMPROBANTE DE CORTE / ARQUEO IMPRIMIBLE */}
            {selectedShiftForVoucher && (
                <ShiftVoucherModal
                    shiftId={selectedShiftForVoucher}
                    onClose={() => setSelectedShiftForVoucher(null)}
                />
            )}
        </div>
    );
};

// -------------------------------------------------------------
// MODAL DE REGISTRO DE GASTO MENOR
// -------------------------------------------------------------
interface ExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const ExpenseModal: React.FC<ExpenseModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [category, setCategory] = useState<string>('Papelería y Útiles');
    const [description, setDescription] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [receiptNumber, setReceiptNumber] = useState<string>('');

    const mutation = useMutation({
        mutationFn: () => cashRegisterService.recordExpense({
            category,
            description,
            amount: Number(amount) || 0,
            receipt_number: receiptNumber || undefined
        }),
        onSuccess: () => {
            onSuccess();
        },
        onError: (err: any) => {
            alert(err?.response?.data?.message || 'Error al registrar el gasto de caja chica.');
        }
    });

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-base">
                        <Receipt className="h-5 w-5" />
                        <span>Registrar Gasto de Caja Chica</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (Number(amount) <= 0) {
                            alert('Ingrese un monto válido mayor a 0.');
                            return;
                        }
                        mutation.mutate();
                    }}
                    className="p-6 space-y-4"
                >
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                            Categoría del Gasto
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-rose-500"
                        >
                            <option value="Papelería y Útiles">Papelería y Útiles de Oficina</option>
                            <option value="Limpieza y Aseo">Limpieza y Mantenimiento Menor</option>
                            <option value="Servicios Básicos">Servicios Básicos / Recargas</option>
                            <option value="Alimentación y Cafetería">Alimentación y Cafetería</option>
                            <option value="Transporte y Envíos">Transporte y Mensajería</option>
                            <option value="Otros Egresos">Otros Egresos Menores</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                            Monto del Gasto (Q) *
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center font-bold text-slate-400">Q</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0.05"
                                required
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-lg outline-none focus:ring-2 focus:ring-rose-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                            Descripción / Concepto *
                        </label>
                        <textarea
                            rows={2}
                            required
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Ej: Compra de marcadores para pizarra y papel higiénico..."
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-rose-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                            No. de Factura / Recibo Físico (Opcional)
                        </label>
                        <input
                            type="text"
                            value={receiptNumber}
                            onChange={(e) => setReceiptNumber(e.target.value)}
                            placeholder="Ej: FAC-9823 o Vale #12"
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-rose-500"
                        />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-500/25 flex items-center gap-2 transition disabled:opacity-50"
                        >
                            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            <span>Registrar Egreso</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

// -------------------------------------------------------------
// MODAL DE ARQUEO Y CIERRE DE TURNO
// -------------------------------------------------------------
interface CloseShiftModalProps {
    isOpen: boolean;
    shift: CashShift;
    onClose: () => void;
    onSuccess: (closedShiftId: string) => void;
}

const CloseShiftModal: React.FC<CloseShiftModalProps> = ({ isOpen, shift, onClose, onSuccess }) => {
    const [actualCash, setActualCash] = useState<string>(String(shift.expected_cash || '0.00'));
    const [closingNotes, setClosingNotes] = useState<string>('');

    const expectedCash = Number(shift.expected_cash) || 0;
    const countedCash = Number(actualCash) || 0;
    const difference = countedCash - expectedCash;
    const isExact = Math.abs(difference) < 0.01;
    const isOver = difference > 0.01;

    const mutation = useMutation({
        mutationFn: () => cashRegisterService.closeShift({
            shift_id: shift.id,
            actual_cash: countedCash,
            closing_notes: closingNotes
        }),
        onSuccess: (res) => {
            onSuccess(res.shift.id);
        },
        onError: (err: any) => {
            alert(err?.response?.data?.message || 'Error al procesar el cierre de caja.');
        }
    });

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-base">
                        <Lock className="h-5 w-5 text-brand-blue" />
                        <span>Arqueo y Cierre de Turno de Caja</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (confirm(`¿Confirma el cierre definitivo del turno con Q${countedCash.toFixed(2)} contados en gaveta?`)) {
                            mutation.mutate();
                        }
                    }}
                    className="p-6 space-y-4"
                >
                    {/* Conciliation Summary Card */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-500">
                            <span>Fondo Inicial de Apertura:</span>
                            <span className="font-semibold text-slate-900 dark:text-white">Q{shift.opening_balance.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                            <span>(+) Cobros en Efectivo (Gaveta):</span>
                            <span className="font-semibold">+Q{shift.cash_inflow.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-rose-600 dark:text-rose-400">
                            <span>(-) Egresos Menores de Caja:</span>
                            <span className="font-semibold">-Q{shift.expenses_outflow.toFixed(2)}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                            <span>Saldo Teórico Esperado en Gaveta:</span>
                            <span className="text-brand-blue dark:text-brand-teal">Q{expectedCash.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Counted Cash Input */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                            Efectivo Físico Contado en Gaveta (Q) *
                        </label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center font-bold text-slate-400">Q</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                autoFocus
                                value={actualCash}
                                onChange={(e) => setActualCash(e.target.value)}
                                className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold text-xl outline-none focus:ring-2 focus:ring-brand-blue"
                            />
                        </div>
                    </div>

                    {/* Live Difference / Cuadre Banner */}
                    <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                        isExact
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : isOver
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                    }`}>
                        <div className="flex items-center gap-2">
                            {isExact ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                            <span>
                                {isExact ? 'Cuadre Exacto de Gaveta' : isOver ? 'Sobrante de Caja' : 'Faltante de Caja'}
                            </span>
                        </div>
                        <span className="text-sm font-extrabold">
                            {isExact ? 'Q0.00' : isOver ? `+Q${difference.toFixed(2)}` : `-Q${Math.abs(difference).toFixed(2)}`}
                        </span>
                    </div>

                    {/* Closing Notes */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                            Observaciones de Cierre / Justificación de Diferencia
                        </label>
                        <textarea
                            rows={2}
                            value={closingNotes}
                            onChange={(e) => setClosingNotes(e.target.value)}
                            placeholder="Ej: Turno entregado a la administración. Efectivo entregado en sobre cerrado..."
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-brand-blue"
                        />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                        >
                            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                            <span>Confirmar Arqueo y Cerrar Turno</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

// -------------------------------------------------------------
// MODAL DE COMPROBANTE / CORTE DE CAJA IMPRIMIBLE
// -------------------------------------------------------------
interface ShiftVoucherModalProps {
    shiftId: string;
    onClose: () => void;
}

const ShiftVoucherModal: React.FC<ShiftVoucherModalProps> = ({ shiftId, onClose }) => {
    const { data, isLoading } = useQuery({
        queryKey: ['shiftDetails', shiftId],
        queryFn: () => cashRegisterService.getShiftDetails(shiftId)
    });

    const shift = data?.shift;
    const payments = data?.payments || [];
    const expenses = data?.expenses || [];

    const formatMoney = (val?: number | null) => `Q${(Number(val) || 0).toFixed(2)}`;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white print:static">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl print:border-none print:shadow-none print:max-h-none print:w-full">
                {/* Modal Controls (hidden on print) */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between print:hidden">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4 text-brand-blue" />
                        <span>Comprobante de Corte de Caja</span>
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => window.print()}
                            className="px-3 py-1.5 rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90 text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                        >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Imprimir</span>
                        </button>
                        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {isLoading || !shift ? (
                    <div className="p-12 text-center text-slate-400 text-xs">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-brand-blue" />
                        <span>Generando comprobante oficial...</span>
                    </div>
                ) : (
                    /* Printable Voucher Content */
                    <div className="p-8 text-slate-900 dark:text-slate-100 print:text-black print:p-4 text-xs font-sans space-y-6">
                        {/* Institutional Header */}
                        <div className="text-center border-b border-slate-200 dark:border-slate-800 pb-4">
                            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white print:text-black">
                                INSTITUTO TECNOLÓGICO ULTEC
                            </h2>
                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                                COMPROBANTE DE CORTE Y ARQUEO DIARIO DE CAJA
                            </p>
                            <p className="text-xs font-bold text-brand-blue dark:text-brand-teal mt-1">
                                Sede: {shift.branch_name}
                            </p>
                            {shift.branch_address && (
                                <p className="text-[10px] text-slate-400">{shift.branch_address}</p>
                            )}
                        </div>

                        {/* Shift Metadata Grid */}
                        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-[11px]">
                            <div>
                                <p className="text-slate-500">Cajero(a) Responsable:</p>
                                <p className="font-bold text-slate-900 dark:text-white">{shift.opened_by_name}</p>
                                <p className="text-slate-500 mt-2">Fecha y Hora Apertura:</p>
                                <p className="font-medium text-slate-800 dark:text-slate-200">
                                    {new Date(shift.opened_at).toLocaleString('es-GT')}
                                </p>
                            </div>
                            <div>
                                <p className="text-slate-500">Cerrado por:</p>
                                <p className="font-bold text-slate-900 dark:text-white">{shift.closed_by_name || 'En curso'}</p>
                                <p className="text-slate-500 mt-2">Fecha y Hora Cierre:</p>
                                <p className="font-medium text-slate-800 dark:text-slate-200">
                                    {shift.closed_at ? new Date(shift.closed_at).toLocaleString('es-GT') : '—'}
                                </p>
                            </div>
                        </div>

                        {/* Financial Reconciliation Table */}
                        <div>
                            <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-600 dark:text-slate-300 mb-2">
                                1. Conciliación y Arqueo de Gaveta Física
                            </h4>
                            <table className="w-full text-xs border border-slate-200 dark:border-slate-800">
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    <tr>
                                        <td className="p-2.5 font-medium text-slate-600 dark:text-slate-400">Fondo Inicial de Caja</td>
                                        <td className="p-2.5 text-right font-bold">{formatMoney(shift.opening_balance)}</td>
                                    </tr>
                                    <tr className="bg-emerald-500/5">
                                        <td className="p-2.5 font-medium text-emerald-700 dark:text-emerald-300">(+) Cobros Totales en Efectivo</td>
                                        <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">+{formatMoney(shift.cash_inflow)}</td>
                                    </tr>
                                    <tr className="bg-rose-500/5">
                                        <td className="p-2.5 font-medium text-rose-700 dark:text-rose-300">(-) Egresos Menores de Caja Chica</td>
                                        <td className="p-2.5 text-right font-bold text-rose-600 dark:text-rose-400">-{formatMoney(shift.expenses_outflow)}</td>
                                    </tr>
                                    <tr className="bg-slate-100 dark:bg-slate-800/80 font-bold text-sm">
                                        <td className="p-3">(=) Saldo Teórico Esperado en Gaveta</td>
                                        <td className="p-3 text-right text-brand-blue dark:text-brand-teal">{formatMoney(shift.expected_cash)}</td>
                                    </tr>
                                    <tr className="font-bold text-sm">
                                        <td className="p-3">Efectivo Físico Real Entregado</td>
                                        <td className="p-3 text-right">{formatMoney(shift.actual_cash)}</td>
                                    </tr>
                                    <tr className="bg-slate-50 dark:bg-slate-800/40 font-bold">
                                        <td className="p-2.5">Diferencia de Caja (Cuadre)</td>
                                        <td className="p-2.5 text-right">
                                            {shift.difference === 0 ? (
                                                <span className="text-emerald-600">Q0.00 (Exacto)</span>
                                            ) : (shift.difference || 0) > 0 ? (
                                                <span className="text-blue-600">+{formatMoney(shift.difference)} (Sobrante)</span>
                                            ) : (
                                                <span className="text-rose-600">-{formatMoney(Math.abs(shift.difference || 0))} (Faltante)</span>
                                            )}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Breakdown of Petty Cash Expenses */}
                        {expenses.length > 0 && (
                            <div>
                                <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-600 dark:text-slate-300 mb-2">
                                    2. Desglose de Gastos Menores Realizados
                                </h4>
                                <table className="w-full text-[11px] border border-slate-200 dark:border-slate-800">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        <tr>
                                            <th className="p-2 text-left">Categoría</th>
                                            <th className="p-2 text-left">Descripción</th>
                                            <th className="p-2 text-left">Comprobante</th>
                                            <th className="p-2 text-right">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {expenses.map((e) => (
                                            <tr key={e.id}>
                                                <td className="p-2">{e.category}</td>
                                                <td className="p-2 font-medium">{e.description}</td>
                                                <td className="p-2 text-slate-500">{e.receipt_number || '—'}</td>
                                                <td className="p-2 text-right font-bold text-rose-600">-{formatMoney(e.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Breakdown of Payments Received */}
                        {payments.length > 0 && (
                            <div>
                                <h4 className="font-bold uppercase tracking-wider text-[11px] text-slate-600 dark:text-slate-300 mb-2">
                                    3. Cobros Registrados en este Turno ({payments.length})
                                </h4>
                                <table className="w-full text-[11px] border border-slate-200 dark:border-slate-800">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        <tr>
                                            <th className="p-2 text-left">Estudiante</th>
                                            <th className="p-2 text-left">Concepto</th>
                                            <th className="p-2 text-left">Método</th>
                                            <th className="p-2 text-right">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {payments.map((p) => (
                                            <tr key={p.id}>
                                                <td className="p-2 font-medium">{p.students?.full_name || 'Estudiante'}</td>
                                                <td className="p-2 text-slate-600 dark:text-slate-400">{p.description || p.payment_type || 'Colegiatura'}</td>
                                                <td className="p-2 uppercase font-semibold">{p.method}</td>
                                                <td className="p-2 text-right font-bold">{formatMoney(p.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Notes */}
                        {shift.closing_notes && (
                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-[11px]">
                                <span className="font-bold text-slate-600 dark:text-slate-400">Observaciones: </span>
                                <span className="italic">{shift.closing_notes}</span>
                            </div>
                        )}

                        {/* Signatures */}
                        <div className="pt-10 grid grid-cols-2 gap-12 text-center text-xs">
                            <div className="border-t border-slate-400 dark:border-slate-600 pt-2">
                                <p className="font-bold">{shift.opened_by_name}</p>
                                <p className="text-[10px] text-slate-500">Firma Cajero(a) / Secretaría</p>
                            </div>
                            <div className="border-t border-slate-400 dark:border-slate-600 pt-2">
                                <p className="font-bold">{shift.closed_by_name || 'Dirección / Auditoría'}</p>
                                <p className="text-[10px] text-slate-500">Firma Revisado / Dirección de Sede</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default CashRegisterPage;
