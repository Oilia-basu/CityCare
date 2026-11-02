import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiCalendar, FiCheckCircle, FiClock, FiInbox, FiXCircle } from 'react-icons/fi';
import api, { errMsg } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import Avatar from '../../components/common/Avatar';
import { SkeletonCards, Spinner } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import AppointmentsManager from '../../components/appointments/AppointmentsManager';
import ScheduleEditor from '../../components/ScheduleEditor';
import { TextPromptModal } from '../../components/appointments/AppointmentModals';
import { fmtDate, to12h } from '../../utils/format';

export function DoctorDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch('/doctors/dashboard');
  const [rej, setRej] = useState(null);
  const [busy, setBusy] = useState(null);
  const accept = async (a) => { setBusy(a._id); try { await api.put(`/appointments/${a._id}/status`, { status: 'Confirmed' }); toast.success('Appointment accepted'); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); } };

  return (
    <>
      <PageHeader title={`Good day, ${user.name.replace(/^Dr\.?\s*/i, 'Dr. ')}`} subtitle="Your day at a glance." />
      {loading && !data ? <SkeletonCards n={5} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          {!data.profile.isVerified && <div className="alert alert-warning">Your profile is awaiting verification by an administrator. Patients cannot book you until it is verified.</div>}
          <div className="row g-3 mb-4">
            {[['blue', <FiCalendar />, 'Total', data.stats.total], ['amber', <FiInbox />, 'Pending', data.stats.pending], ['teal', <FiClock />, 'Upcoming', data.stats.upcoming], ['green', <FiCheckCircle />, 'Completed', data.stats.completed], ['red', <FiXCircle />, 'Cancelled', data.stats.cancelled]].map(([t, i, l, v]) => (
              <div className="col-6 col-lg" key={l}><StatCard tone={t} icon={i} label={l} value={v} /></div>))}
          </div>
          <div className="row g-3">
            <div className="col-lg-6"><div className="panel h-100"><div className="panel-head"><h2>Appointment requests</h2><span className="small text-muted">{data.requests.length} waiting</span></div>
              {!data.requests.length ? <EmptyState title="No requests waiting" hint="Paid or pay-at-hospital requests needing your approval appear here." /> : data.requests.map((a) => (
                <div key={a._id} className="p-3 border-bottom"><div className="d-flex justify-content-between"><div><div className="fw-semibold">{a.patient.user.name}</div><div className="small text-muted">{fmtDate(a.appointmentDate)}, {to12h(a.startTime)} • {a.reason || 'No reason given'}</div></div><StatusBadge status={a.paymentStatus} /></div>
                  <div className="mt-2 d-flex gap-2"><button className="btn btn-sm btn-primary" disabled={busy === a._id} onClick={() => accept(a)}>Accept</button><button className="btn btn-sm btn-outline-danger" onClick={() => setRej(a)}>Reject</button></div></div>))}
            </div></div>
            <div className="col-lg-6"><div className="panel h-100"><div className="panel-head"><h2>Today’s appointments</h2><Link to="/doctor/appointments" className="small">Manage</Link></div>
              {!data.today.length ? <EmptyState title="Nothing scheduled today" /> : data.today.map((a) => (
                <div key={a._id} className="d-flex align-items-center gap-3 p-3 border-bottom"><div className="fw-bold" style={{ width: 74 }}>{to12h(a.startTime)}</div><Avatar name={a.patient.user.name} size={36} /><div className="flex-grow-1"><div className="fw-semibold">{a.patient.user.name}</div><div className="small text-muted">{a.reason}{a.queueNumber ? ` • queue #${a.queueNumber}` : ''}</div></div><StatusBadge status={a.appointmentStatus} /></div>))}
            </div></div>
            <div className="col-12"><div className="panel"><div className="panel-head"><h2>Coming up</h2></div>
              {!data.upcoming.length ? <EmptyState title="No upcoming appointments" /> : data.upcoming.map((a) => (
                <div key={a._id} className="d-flex justify-content-between p-3 border-bottom"><div><span className="fw-semibold">{a.patient.user.name}</span> <span className="text-muted small">• {fmtDate(a.appointmentDate)}, {to12h(a.startTime)}</span></div><StatusBadge status={a.appointmentStatus} /></div>))}
            </div></div>
          </div>
        </>)}
      {rej && <TextPromptModal title="Reject this request?" label="Reason for the patient" required danger confirmText="Reject request" onClose={(c) => { setRej(null); c && reload(); }}
        onSubmit={(reason) => api.put(`/appointments/${rej._id}/status`, { status: 'Rejected', reason }).then(() => toast.success('Request rejected'))} />}
    </>
  );
}

export const DoctorAppointments = () => <><PageHeader title="Appointments" subtitle="Accept requests, run consultations and add notes." /><AppointmentsManager initialTab="upcoming" /></>;

export function DoctorSchedule() {
  const { data, loading, error, reload } = useFetch('/doctors/profile');
  const [saving, setSaving] = useState(false);
  const save = async (payload) => { setSaving(true); try { await api.put('/doctors/availability', payload); toast.success('Schedule saved'); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); } };
  return (
    <>
      <PageHeader title="Schedule & availability" subtitle="Patients only see slots generated from these hours." />
      {loading && !data ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : <ScheduleEditor schedule={data.schedule} blockedDates={data.profile.blockedDates} leaves={data.profile.leaves} isAvailable={data.profile.isAvailable} onSave={save} saving={saving} />}
    </>
  );
}
