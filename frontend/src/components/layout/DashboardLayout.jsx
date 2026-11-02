import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { FiBell, FiCalendar, FiClipboard, FiCreditCard, FiGrid, FiHome, FiLogOut, FiMenu, FiPieChart, FiPlus, FiSettings, FiUser, FiUserPlus, FiUsers, FiLayers, FiActivity, FiList, FiPlusCircle } from 'react-icons/fi';
import { FaUserMd } from 'react-icons/fa';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';

const NAV = {
  patient: [
    ['/patient', 'Overview', <FiGrid />, true], ['/patient/book', 'Book appointment', <FiPlusCircle />], ['/patient/appointments', 'My appointments', <FiCalendar />],
    ['/patient/payments', 'Payments', <FiCreditCard />], ['/patient/notifications', 'Notifications', <FiBell />], ['/patient/profile', 'Profile & settings', <FiUser />],
  ],
  doctor: [
    ['/doctor', 'Overview', <FiGrid />, true], ['/doctor/appointments', 'Appointments', <FiCalendar />], ['/doctor/schedule', 'Schedule & availability', <FiClipboard />],
    ['/doctor/notifications', 'Notifications', <FiBell />], ['/doctor/profile', 'Profile', <FiUser />],
  ],
  receptionist: [
    ['/receptionist', 'Today', <FiGrid />, true], ['/receptionist/register', 'Register patient', <FiUserPlus />], ['/receptionist/patients', 'Find patients', <FiUsers />],
    ['/receptionist/book', 'Book appointment', <FiPlusCircle />], ['/receptionist/appointments', 'Appointments', <FiCalendar />], ['/receptionist/queue', 'Queue', <FiList />],
    ['/receptionist/payments', 'Payments', <FiCreditCard />], ['/receptionist/notifications', 'Notifications', <FiBell />], ['/receptionist/profile', 'Account', <FiUser />],
  ],
  admin: [
    ['/admin', 'Overview', <FiGrid />, true], ['/admin/doctors', 'Doctors', <FaUserMd />], ['/admin/patients', 'Patients', <FiUsers />], ['/admin/receptionists', 'Receptionists', <FiUserPlus />],
    ['/admin/departments', 'Departments', <FiLayers />], ['/admin/appointments', 'Appointments', <FiCalendar />], ['/admin/payments', 'Payments', <FiCreditCard />],
    ['/admin/analytics', 'Analytics & reports', <FiPieChart />], ['/admin/notifications', 'Notifications', <FiBell />], ['/admin/settings', 'Hospital settings', <FiSettings />], ['/admin/activity', 'Activity log', <FiActivity />], ['/admin/profile', 'My account', <FiUser />],
  ],
};
const TITLES = { patient: 'Patient portal', doctor: 'Doctor portal', receptionist: 'Front desk', admin: 'Administration' };

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const loc = useLocation();
  const nav = useNavigate();

  useEffect(() => setOpen(false), [loc.pathname]);

  // Unread notification badge (polls once a minute and whenever the route changes)
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/notifications', { params: { limit: 1, unread: true } }).then((r) => alive && setUnread(r.data.data.unreadCount)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [loc.pathname]);

  return (
    <div className="dash">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Sidebar">
        <Link to="/" className="sidebar-brand"><span className="brand-mark"><FiPlus /></span>CityCare</Link>
        <div className="px-3 pt-3 small text-muted fw-semibold">{TITLES[user.role]}</div>
        <nav>
          {NAV[user.role].map(([to, label, icon, end]) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>{icon}{label}</NavLink>
          ))}
        </nav>
        <div className="p-3 border-top">
          <Link to="/" className="side-link"><FiHome />Public website</Link>
          <button className="side-link w-100 border-0 bg-transparent" onClick={async () => { await logout(); nav('/'); }}><FiLogOut />Log out</button>
        </div>
      </aside>
      <div className={`backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className="dash-main">
        <header className="topbar">
          <button className="btn btn-light d-lg-none" onClick={() => setOpen(true)} aria-label="Open menu"><FiMenu /></button>
          <div className="d-none d-lg-block fw-semibold text-muted">Welcome back, {user.name.split(' ')[0]}</div>
          <div className="d-flex align-items-center gap-3 ms-auto">
            <Link to={`${'/' + user.role}/notifications`} className="bell btn btn-light" aria-label={`Notifications, ${unread} unread`}>
              <FiBell />{unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
            </Link>
            <Link to={`/${user.role}/profile`} className="d-flex align-items-center gap-2 text-reset">
              <Avatar name={user.name} src={user.profileImage} size={36} />
              <span className="d-none d-sm-block small fw-semibold lh-sm">{user.name}<br /><span className="text-muted fw-normal text-capitalize">{user.role}</span></span>
            </Link>
          </div>
        </header>
        <div className="dash-content"><Outlet context={{ refreshUnread: () => api.get('/notifications', { params: { limit: 1, unread: true } }).then((r) => setUnread(r.data.data.unreadCount)).catch(() => {}) }} /></div>
      </div>
    </div>
  );
}
