import { Link } from 'react-router-dom';
import { FiCalendar, FiCheckCircle, FiClock, FiCreditCard } from 'react-icons/fi';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import { SkeletonCards } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import AppointmentsManager from '../../components/appointments/AppointmentsManager';
import BookingWizard from '../../components/booking/BookingWizard';
import Avatar from '../../components/common/Avatar';
import { fmtDate, money, to12h } from '../../utils/format';

export function PatientDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch('/patients/dashboard');
  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Here’s what’s coming up." actions={<Link to="/patient/book" className="btn btn-primary">Book appointment</Link>} />
      {loading && !data ? <SkeletonCards /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-lg-3"><StatCard tone="blue" icon={<FiCalendar />} label="Upcoming" value={data.stats.upcoming} /></div>
            <div className="col-6 col-lg-3"><StatCard tone="green" icon={<FiCheckCircle />} label="Completed" value={data.stats.completed} /></div>
            <div className="col-6 col-lg-3"><StatCard tone="red" icon={<FiClock />} label="Cancelled" value={data.stats.cancelled} /></div>
            <div className="col-6 col-lg-3"><StatCard tone="teal" icon={<FiCreditCard />} label="Total paid" value={money(data.stats.totalPaid)} /></div>
          </div>
          <div className="row g-3">
            <div className="col-lg-7"><div className="panel"><div className="panel-head"><h2>Upcoming appointments</h2><Link to="/patient/appointments" className="small">See all</Link></div>
              {!data.upcoming.length ? <EmptyState title="No upcoming appointments" action={<Link to="/patient/book" className="btn btn-primary btn-sm">Find a doctor</Link>} /> : data.upcoming.map((a) => (
                <div key={a._id} className="d-flex align-items-center gap-3 p-3 border-bottom"><Avatar name={a.doctor.user.name} src={a.doctor.user.profileImage} size={44} />
                  <div className="flex-grow-1"><div className="fw-semibold">{a.doctor.user.name}</div><div className="small text-muted">{a.doctor.specialization} • {fmtDate(a.appointmentDate)}, {to12h(a.startTime)}</div></div><StatusBadge status={a.appointmentStatus} /></div>))}
            </div></div>
            <div className="col-lg-5"><div className="panel"><div className="panel-head"><h2>Recent visits</h2></div>
              {!data.recent.length ? <EmptyState title="No visit history yet" /> : data.recent.map((a) => (
                <div key={a._id} className="d-flex justify-content-between p-3 border-bottom"><div><div className="fw-semibold">{a.doctor.user.name}</div><div className="small text-muted">{fmtDate(a.appointmentDate)}</div></div><StatusBadge status={a.appointmentStatus} /></div>))}
            </div></div>
          </div>
          {data.unreadNotifications > 0 && <div className="alert alert-info mt-3">You have {data.unreadNotifications} unread notification{data.unreadNotifications > 1 ? 's' : ''}. <Link to="/patient/notifications">Review them</Link></div>}
        </>)}
    </>
  );
}

export const PatientBook = () => <><PageHeader title="Book an appointment" subtitle="Choose a doctor, pick a time, and confirm." /><BookingWizard /></>;
export const PatientAppointments = () => <><PageHeader title="My appointments" subtitle="Upcoming visits and your full history." actions={<Link to="/patient/book" className="btn btn-primary">Book appointment</Link>} /><AppointmentsManager /></>;
