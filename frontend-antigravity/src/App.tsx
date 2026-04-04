import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './services/queryClient';

import Login from './features/auth/Login';
import DashboardLayout from './components/layout/DashboardLayout';
import CoursesList from './features/academic/CoursesList';
import StudentsList from './features/academic/StudentsList';
import EnrollmentsList from './features/academic/EnrollmentsList';
import ResetPassword from './features/auth/ResetPassword';
import PaymentsList from './features/finance/PaymentsList';
import InvoicesList from './features/finance/InvoicesList';
import Attendance from './features/academic/Attendance';
import Reports from './features/finance/Reports';
import StudentReports from './features/academic/StudentReports';
import Grades from './features/academic/Grades';
import UsersList from './features/users/UsersList';
import AuditLogs from './features/users/AuditLogs';
import CourseGradebook from './features/academic/CourseGradebook';
import AssignmentsModule from './features/academic/Assignments/AssignmentsModule';
import StudentAssignments from './features/academic/Assignments/StudentAssignments';
import BranchesList from './features/branches/BranchesList';
import StudentAttendance from './features/academic/StudentAttendance';
import CourseResources from './features/academic/CourseResources';
import Announcements from './features/academic/Announcements';
import StudentSchedule from './features/academic/StudentSchedule';
import DocumentCenter from './features/academic/DocumentCenter';
import ParentDashboard from './pages/ParentDashboard';
import DashboardHome from './pages/DashboardHome';
import DisciplineModule from './features/academic/DisciplineModule';
import SettingsPage from './features/settings/SettingsPage';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Core Auth & Layout Protection */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<DashboardHome />} />

              {/* Admin & Superadmin Only */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'superadmin']} />}>
                <Route path="/users" element={<UsersList />} />
                <Route path="/branches" element={<BranchesList />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Admin, Superadmin, Secretary */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'secretary']} />}>
                <Route path="/courses" element={<CoursesList />} />
                <Route path="/students" element={<StudentsList />} />
                <Route path="/enrollments" element={<EnrollmentsList />} />
                <Route path="/payments" element={<PaymentsList />} />
                <Route path="/invoices" element={<InvoicesList />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/student-reports" element={<StudentReports />} />
              </Route>

              {/* Attendance & Grades (Admin, Superadmin, Secretary, Instructor) */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'secretary', 'instructor']} />}>
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/grades" element={<Grades />} />
              </Route>

              {/* Instructor/Admin Specific */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'instructor']} />}>
                <Route path="/course-gradebook" element={<CourseGradebook />} />
                <Route path="/assignments" element={<AssignmentsModule />} />
                <Route path="/discipline" element={<DisciplineModule />} />
              </Route>

              {/* Shared between Instructors, Students, Admins */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'instructor', 'student', 'secretary', 'parent']} />}>
                <Route path="/resources" element={<CourseResources />} />
                <Route path="/announcements" element={<Announcements />} />
              </Route>

              {/* Shared Documents Center (Students, Admins, Secs) */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'secretary', 'student']} />}>
                <Route path="/documents" element={<DocumentCenter />} />
              </Route>

              {/* Student Only */}
              <Route element={<ProtectedRoute allowedRoles={['student']} />}>
                <Route path="/student-assignments" element={<StudentAssignments />} />
                <Route path="/my-attendance" element={<StudentAttendance />} />
                <Route path="/my-schedule" element={<StudentSchedule />} />
              </Route>

              {/* Parent Only */}
              <Route element={<ProtectedRoute allowedRoles={['parent']} />}>
                <Route path="/parent-dashboard" element={<ParentDashboard />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
