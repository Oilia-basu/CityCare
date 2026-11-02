import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiCalendar, FiCheckCircle, FiClock, FiCreditCard, FiUserCheck, FiXCircle } from 'react-icons/fi';
import api, { errMsg } from '../../api/axios';
import useFetch, { useDebounce } from '../../hooks/useFetch';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import Avatar from '../../components/common/Avatar';
import StatusBadge from '../../components/common/StatusBadge';
import { SkeletonCards } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import AppointmentsManager from '../../components/appointments/AppointmentsManager';
import BookingWizard from '../../components/booking/BookingWizard';
import { fmtDate, to12h } from '../../utils/format';

export function ReceptionDashboard() {
  const [date, setDate] = useState('');
  const { data, loading, error, reload } = useFetch('/receptionist/dashboard', { date: date || undefined });
  const s = data?.stats;
  return (
    <>
      <PageHeader title="Front desk" subtitle={data ? `Schedule for ${fmtDate(data.date)}` : ' '} actions={<input type="date" className="form-control" value={date || data?.date || ''} onChange={(e) => setDate(e.target.value)} aria-label="Date" />} />
      {loading && !data ? <SkeletonCards n={6} /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="row g-3 mb-4">
          {[['blue', <FiCalendar />, 'Appointments', s.total], ['amber', <FiClock />, 'Awaiting doctor', s.pending], ['teal', <FiUserCheck />, 'In clinic', s.checkedIn], ['green', <FiCheckCircle />, 'Completed', s.completed], ['red', <FiXCircle />, 'Cancelled', s.cancelled], ['slate', <FiCreditCard />, 'Unpaid', s.unpaid]].map(([t, i, l, v]) => (
            <div className="col-6 col-lg-2" key={l}><StatCard tone={t} icon={i} label={l} value={v} /></div>))}
        </div>)}
      <AppointmentsManager key={date} showTabs={false} showDate={false} fixedFilters={{ date: date || data?.date, sort: 'date_asc' }} onChanged={reload} pageSize={20} emptyAction={<Link to="/receptionist/book" className="btn btn-primary btn-sm">Book an appointment</Link>} />
    </>
  );
}

export function RegisterPatient() {
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', dateOfBirth: '', gender: '', bloodGroup: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post('/receptionist/patients', f); setDone(r.data.data); toast.success('Patient registered'); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  if (done) return (
    <><PageHeader title="Patient registered" />
      <div className="panel panel-body" style={{ maxWidth: 560 }}>
        <p><strong>{done.user.name}</strong> • {done.patient.patientCode}</p>
        <div className="alert alert-warning">Temporary password: <code className="fs-6">{done.temporaryPassword}</code><br /><span className="small">Shown only once. It was also emailed to the patient; they should change it after logging in.</span></div>
        <div className="d-flex gap-2"><button className="btn btn-primary" onClick={() => nav(`/receptionist/book?patient=${done.patient._id}`)}>Book an appointment</button><button className="btn btn-light" onClick={() => { setDone(null); setF({ name: '', email: '', phone: '', dateOfBirth: '', gender: '', bloodGroup: '', address: '' }); }}>Register another</button></div>
      </div></>);
  return (
    <><PageHeader title="Register a patient" subtitle="For walk-in patients without an online account." />
      <form className="panel panel-body" style={{ maxWidth: 720 }} onSubmit={submit}>
        <div className="row g-3">
          <div className="col-md-6"><label className="form-label" htmlFor="rg-n">Full name</label><input id="rg-n" className="form-control" required value={f.name} onChange={s('name')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="rg-p">Phone</label><input id="rg-p" className="form-control" required value={f.phone} onChange={s('phone')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="rg-e">Email</label><input id="rg-e" type="email" className="form-control" required value={f.email} onChange={s('email')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="rg-d">Date of birth</label><input id="rg-d" type="date" className="form-control" value={f.dateOfBirth} onChange={s('dateOfBirth')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="rg-g">Gender</label><select id="rg-g" className="form-select" value={f.gender} onChange={s('gender')}><option value="">Not stated</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
          <div className="col-md-6"><label className="form-label" htmlFor="rg-b">Blood group</label><select id="rg-b" className="form-select" value={f.bloodGroup} onChange={s('bloodGroup')}><option value="">Unknown</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}</select></div>
          <div className="col-12"><label className="form-label" htmlFor="rg-a">Address</label><input id="rg-a" className="form-control" value={f.address} onChange={s('address')} /></div>
        </div>
        <button className="btn btn-primary mt-4" disabled={busy}>{busy ? 'Registering…' : 'Register patient'}</button>
      </form></>);
}

export function PatientSearch() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search);
  const { data, loading, error, reload } = useFetch('/receptionist/patients', { search: q || undefined, page, limit: 10 });
  const nav = useNavigate();
  const cols = [
    { key: 'n', label: 'Patient', render: (p) => <div className="d-flex align-items-center gap-2"><Avatar name={p.user.name} src={p.user.profileImage} size={34} /><div><div className="fw-semibold">{p.user.name}</div><div className="small text-muted">{p.patientCode}</div></div></div> },
    { key: 'c', label: 'Contact', render: (p) => <>{p.user.phone}<div className="small text-muted">{p.user.email}</div></> },
    { key: 'g', label: 'Details', render: (p) => [p.gender, p.bloodGroup].filter(Boolean).join(' • ') || '—' },
    { key: 's', label: 'Account', render: (p) => <StatusBadge status={p.user.isActive ? 'Confirmed' : 'Cancelled'} /> },
    { key: 'a', label: '', render: (p) => <button className="btn btn-sm btn-primary" disabled={!p.user.isActive} onClick={() => nav(`/receptionist/book?patient=${p._id}`)}>Book appointment</button> },
  ];
  return (
    <><PageHeader title="Find a patient" actions={<Link to="/receptionist/register" className="btn btn-outline-primary">Register new patient</Link>} />
      <div className="panel"><div className="p-3"><input className="form-control" style={{ maxWidth: 420 }} placeholder="Search by name, phone, email or patient ID" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search patients" /></div>
        <DataTable columns={cols} rows={data?.items} loading={loading} error={error} onRetry={reload} empty={<EmptyState title="No patients found" hint="Check the spelling, or register them." />} />
        <Pagination meta={data?.meta} onPage={setPage} /></div></>);
}

export const ReceptionBook = () => <><PageHeader title="Book on behalf of a patient" /><BookingWizard /></>;
export const ReceptionAppointments = () => <><PageHeader title="Appointments" subtitle="Reschedule, cancel, check in and record payments." /><AppointmentsManager initialTab="upcoming" /></>;

export function Queue() {
  const { data, loading, error, reload } = useFetch('/receptionist/queue');
  useEffect(() => { const t = setInterval(() => document.visibilityState === 'visible' && reload(), 30000); return () => clearInterval(t); }, [reload]);
  const groups = {};
  (data?.items || []).forEach((a) => { (groups[a.doctor._id] ||= { doctor: a.doctor, list: [] }).list.push(a); });
  return (
    <><PageHeader title="Patient queue" subtitle={`Checked-in patients waiting today${data ? ` (${fmtDate(data.date)})` : ''}. Refreshes every 30 seconds.`} actions={<button className="btn btn-outline-primary" onClick={reload}>Refresh now</button>} />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <SkeletonCards n={3} /> : !data.items.length ? <div className="panel"><EmptyState title="Nobody is waiting" hint="Patients appear here after you check them in." /></div> : (
        <div className="row g-3">{Object.values(groups).map(({ doctor, list }) => (
          <div className="col-lg-6" key={doctor._id}><div className="panel"><div className="panel-head"><h2>{doctor.user.name}</h2><span className="small text-muted">{list.length} waiting</span></div>
            {list.map((a) => <div key={a._id} className="d-flex align-items-center gap-3 p-3 border-bottom"><div className="queue-no">{a.queueNumber}</div><div className="flex-grow-1"><div className="fw-semibold">{a.patient.user.name}</div><div className="small text-muted">Booked {to12h(a.startTime)}</div></div><StatusBadge status={a.appointmentStatus} /></div>)}
          </div></div>))}</div>)}
    </>);
}
