import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getFinancialReport } from './reportService';
import { Loader2 } from 'lucide-react';

const Reports = () => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const { data: report, isLoading } = useQuery({
        queryKey: ['financialReport', startDate, endDate],
        queryFn: () => getFinancialReport(startDate, endDate),
    });

    const totalIncome = report?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Reportes Financieros</h2>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mb-6 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Fecha Inicio</label>
                    <input
                        type="date"
                        className="mt-1 px-3 py-2 border rounded-lg"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Fecha Fin</label>
                    <input
                        type="date"
                        className="mt-1 px-3 py-2 border rounded-lg"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
                <div className="ml-auto bg-green-50 px-4 py-2 rounded-lg border border-green-100">
                    <p className="text-sm text-green-600 font-medium">Total Ingresos</p>
                    <p className="text-2xl font-bold text-green-700">Q{totalIncome.toFixed(2)}</p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8 text-blue-600" /></div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-medium text-slate-500">Fecha</th>
                                <th className="px-6 py-4 font-medium text-slate-500">Estudiante</th>
                                <th className="px-6 py-4 font-medium text-slate-500">Curso</th>
                                <th className="px-6 py-4 font-medium text-slate-500">Método</th>
                                <th className="px-6 py-4 font-medium text-slate-500">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {report?.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4 text-slate-600">
                                        {new Date(item.payment_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900">{item.student_name}</td>
                                    <td className="px-6 py-4 text-slate-600">{item.course_name}</td>
                                    <td className="px-6 py-4 text-slate-600">{item.method}</td>
                                    <td className="px-6 py-4 font-bold text-green-600">Q{item.amount}</td>
                                </tr>
                            ))}
                            {report?.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        No hay transacciones en este período.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Reports;
