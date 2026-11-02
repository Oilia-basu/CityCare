import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from './components/layout/PublicLayout';
import DashboardLayout from './components/layout/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/public/Home';
import About from './pages/public/About';
import Doctors from './pages/public/Doctors';
import DoctorDetails from './pages/public/DoctorDetails';
import Departments from './pages/public/Departments';
import Contact from './pages/public/Contact';
import Login, { ForgotPassword, Register, ResetPassword } from './pages/public/Login';
import NotificationsPage from './pages/shared/NotificationsPage';
import PaymentsPage from './pages/shared/PaymentsPage';
import ProfilePage from './pages/shared/ProfilePage';
import { PatientAppointments, PatientBook, PatientDashboard } from './pages/patient/PatientPages';
import { DoctorAppointments, DoctorDashboard, DoctorSchedule } from './pages/doctor/DoctorPages';
import { PatientSearch, Queue, ReceptionAppointments, ReceptionBook, ReceptionDashboard, RegisterPatient } from './pages/receptionist/ReceptionistPages';
import { ActivityLog, AdminAppointments, AdminDashboard, AdminDepartments, AdminDoctors, AdminNotifications, AdminPatients, AdminReceptionists, AdminSettings, Analytics } from './pages/admin/AdminPages';

const guard = (role, element) => <ProtectedRoute roles={[role]}>{element}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="doctors" element={<Doctors />} />
        <Route path="doctors/:id" element={<DoctorDetails />} />
        <Route path="departments" element={<Departments />} />
        <Route path="contact" element={<Contact />} />
        <Route path="login" element={<Login portal="patient" />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="doctor/login" element={<Login portal="doctor" />} />
        <Route path="receptionist/login" element={<Login portal="receptionist" />} />
        <Route path="admin/login" element={<Login portal="admin" />} />
      </Route>

      <Route path="patient" element={guard('patient', <DashboardLayout />)}>
        <Route index element={<PatientDashboard />} />
        <Route path="book" element={<PatientBook />} />
        <Route path="appointments" element={<PatientAppointments />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="doctor" element={guard('doctor', <DashboardLayout />)}>
        <Route index element={<DoctorDashboard />} />
        <Route path="appointments" element={<DoctorAppointments />} />
        <Route path="schedule" element={<DoctorSchedule />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="receptionist" element={guard('receptionist', <DashboardLayout />)}>
        <Route index element={<ReceptionDashboard />} />
        <Route path="register" element={<RegisterPatient />} />
        <Route path="patients" element={<PatientSearch />} />
        <Route path="book" element={<ReceptionBook />} />
        <Route path="appointments" element={<ReceptionAppointments />} />
        <Route path="queue" element={<Queue />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="admin" element={guard('admin', <DashboardLayout />)}>
        <Route index element={<AdminDashboard />} />
        <Route path="doctors" element={<AdminDoctors />} />
        <Route path="patients" element={<AdminPatients />} />
        <Route path="receptionists" element={<AdminReceptionists />} />
        <Route path="departments" element={<AdminDepartments />} />
        <Route path="appointments" element={<AdminAppointments />} />
        <Route path="book" element={<ReceptionBook />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<div className="container py-5 text-center"><h1 className="h3">Page not found</h1><p className="text-muted">The page you are looking for does not exist.</p><a href="/" className="btn btn-primary">Go home</a></div>} />
    </Routes>
  );
}
