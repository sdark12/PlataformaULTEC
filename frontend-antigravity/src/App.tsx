import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';

import Login from './features/auth/Login';
import DashboardLayout from './components/layout/DashboardLayout';
import CoursesList from './features/academic/CoursesList';
import StudentsList from './features/academic/StudentsList';
import EnrollmentsList from './features/academic/EnrollmentsList';
import PaymentsList from './features/finance/PaymentsList';
import InvoicesList from './features/finance/InvoicesList';
import Attendance from './features/academic/Attendance';
import Reports from './features/finance/Reports';
import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from './features/finance/reportService';
import { Users, BookOpen, DollarSign, AlertCircle, Loader2 } from 'lucide-react';

const DashboardHome = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: getDashboardStats,
  });

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Loader2 className="animate-spin h-12 w-12 text-blue-500/50" />
      <p className="text-slate-400 font-medium animate-pulse">Cargando estadísticas...</p>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Panel Principal</h1>
        <p className="text-slate-500 mt-1">Resumen general del estado de la academia.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Estudiantes Activos"
          value={stats?.active_students || 0}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Cursos Ofertados"
          value={stats?.active_courses || 0}
          icon={BookOpen}
          color="indigo"
        />
        <StatCard
          title="Recaudación Mensual"
          value={`Q${(stats?.monthly_income || 0).toLocaleString('es-GT', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Pendientes de Pago"
          value={stats?.pending_payments || 0}
          icon={AlertCircle}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 h-full flex items-center justify-center transition-transform group-hover:scale-110 duration-700 opacity-5 pointer-events-none">
            <BookOpen className="h-64 w-64 text-blue-600" />
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Bienvenido a Ultra Tecnología</h2>
            <p className="text-slate-600 max-w-lg leading-relaxed mb-8">
              Tu plataforma integral para la gestión académica y financiera. Aquí puedes supervisar el progreso de tus estudiantes, controlar los flujos de caja y optimizar la administración de tus cursos.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 cursor-pointer">
                Ver Reportes Detallados
              </div>
              <div className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer">
                Documentación
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-blue-500/20 blur-[60px] rounded-full" />
          <div className="relative z-10">
            <h3 className="text-xl font-bold text-white mb-2">Soporte Directo</h3>
            <p className="text-slate-400 text-sm">¿Necesitas ayuda con la plataforma? Estamos para servirte.</p>
          </div>
          <div className="mt-8 relative z-10">
            <button className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl border border-white/10 backdrop-blur-sm transition-all active:scale-95">
              Contactar Soporte
            </button>
          </div>
          <p className="text-[10px] text-slate-500 text-center mt-6">Versión 1.2.0 Enterprise Edition</p>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }: any) => {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600"
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center space-x-5 transition-all hover:shadow-xl hover:shadow-slate-200/50 group">
      <div className={`p-4 ${colors[color]} rounded-2xl group-hover:scale-110 transition-transform duration-300 font-bold`}>
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        <p className="text-3xl font-black text-slate-900 mt-1 tracking-tight">{value}</p>
      </div>
    </div>
  );
};

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" replace />}>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/courses" element={<CoursesList />} />
            <Route path="/students" element={<StudentsList />} />
            <Route path="/enrollments" element={<EnrollmentsList />} />
            <Route path="/payments" element={<PaymentsList />} />
            <Route path="/invoices" element={<InvoicesList />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/reports" element={<Reports />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
