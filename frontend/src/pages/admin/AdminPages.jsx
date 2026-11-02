import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiCalendar, FiCheckCircle, FiClock, FiDollarSign, FiDownload, FiLayers, FiUserPlus, FiUsers, FiXCircle } from 'react-icons/fi';
import { FaUserMd } from 'react-icons/fa';
import api, { errMsg } from '../../api/axios';
import useFetch, { useDebounce } from '../../hooks/useFetch';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import Avatar from '../../components/common/Avatar';
import StatusBadge from '../../components/common/StatusBadge';
import Modal, { ConfirmModal } from '../../components/common/Modal';
import { SkeletonCards, Spinner } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import AppointmentsManager from '../../components/appointments/AppointmentsManager';
import ScheduleEditor from '../../components/ScheduleEditor';
import NotificationsPage from '../shared/NotificationsPage';
import { Card, DailyChart, Donut, MonthlyAppointments, RevenueChart } from './AdminCharts';
import { fmtDate, fmtDateTime, money, to12h } from '../../utils/format';

/* ------------------------------------------------------------- Dashboard */
export function AdminDashboard() {
  const { data, loading, error, reload } = useFetch('/admin/dashboard');
  if (loading && !data) return <><PageHeader title="Overview" /><SkeletonCards n={8} /></>;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const s = data.stats;
  const cards = [['blue', <FiUsers />, 'Patients', s.patients], ['teal', <FaUserMd />, 'Doctors', s.doctors], ['slate', <FiUserPlus />, 'Receptionists', s.receptionists], ['blue', <FiLayers />, 'Departments', s.departments],
    ['blue', <FiCalendar />, 'Appointments', s.appointments], ['amber', <FiClock />, 'Pending', s.pending], ['green', <FiCheckCircle />, 'Completed', s.completed], ['red', <FiXCircle />, 'Cancelled', s.cancelled]];
  return (
    <>
      <PageHeader title="Overview" subtitle="Live figures from the hospital database." />
      <div className="row g-3 mb-3">{cards.map(([t, i, l, v]) => <div className="col-6 col-lg-3" key={l}><StatCard tone={t} icon={i} label={l} value={v} /></div>)}
        <div className="col-12"><StatCard tone="green" icon={<FiDollarSign />} label="Total revenue collected" value={money(s.revenue)} /></div></div>
      <div className="row g-3 mb-3">
        <div className="col-lg-7"><Card title="Appointments by month"><MonthlyAppointments data={data.analytics.monthly} /></Card></div>
        <div className="col-lg-5"><Card title="Appointment status"><Donut data={data.analytics.statusDistribution} /></Card></div>
        <div className="col-lg-7"><Card title="Revenue by month"><RevenueChart data={data.analytics.monthly} /></Card></div>
        <div className="col-lg-5"><Card title="Last 14 days"><DailyChart data={data.analytics.daily} /></Card></div>
      </div>
      <div className="panel"><div className="panel-head"><h2>Recent appointments</h2></div>
        <DataTable rows={data.recent} columns={[
          { key: 'c', label: 'ID', render: (a) => a.appointmentCode }, { key: 'p', label: 'Patient', render: (a) => a.patient?.user?.name }, { key: 'd', label: 'Doctor', render: (a) => a.doctor?.user?.name },
          { key: 'w', label: 'When', render: (a) => `${fmtDate(a.appointmentDate)}, ${to12h(a.startTime)}` }, { key: 's', label: 'Status', render: (a) => <StatusBadge status={a.appointmentStatus} /> }, { key: 'pm', label: 'Payment', render: (a) => <StatusBadge status={a.paymentStatus} /> }]} /></div>
    </>);
}

/* ------------------------------------------------------------- Analytics & reports */
export function Analytics() {
  const [months, setMonths] = useState(6);
  const { data, loading, error, reload } = useFetch('/admin/analytics', { months });
  const [range, setRange] = useState({ from: '', to: '', status: '' });
  const exportCsv = async () => {
    try {
      const res = await api.get('/admin/reports/appointments', { params: { from: range.from || undefined, to: range.to || undefined, status: range.status || undefined }, responseType: 'blob' });
      const url = URL.createObjectURL(res.data); const a = document.createElement('a'); a.href = url; a.download = `appointments-${range.from || 'all'}-${range.to || 'now'}.csv`; a.click(); URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <>
      <PageHeader title="Analytics & reports" actions={<select className="form-select" value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Range"><option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></select>} />
      {loading && !data ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="row g-3 mb-3">
            <div className="col-lg-6"><Card title="Appointments by month"><MonthlyAppointments data={data.monthly} /></Card></div>
            <div className="col-lg-6"><Card title="Revenue by month"><RevenueChart data={data.monthly} /></Card></div>
            <div className="col-lg-6"><Card title="Appointments by department"><Donut data={data.byDepartment} /></Card></div>
            <div className="col-lg-6"><Card title="Appointment status"><Donut data={data.statusDistribution} /></Card></div>
          </div>
          <div className="panel mb-3"><div className="panel-head"><h2>Top doctors (completed consultations)</h2></div>
            <DataTable rows={data.topDoctors.map((d, i) => ({ ...d, _id: d.doctorId || i }))} columns={[{ key: 'n', label: 'Doctor', render: (d) => <><strong>{d.name}</strong><div className="small text-muted">{d.specialization}</div></> }, { key: 'c', label: 'Completed', render: (d) => d.completed }, { key: 'r', label: 'Fees billed', render: (d) => money(d.revenue) }]} /></div>
        </>)}
      <div className="panel"><div className="panel-head"><h2>Export appointments (CSV)</h2></div><div className="panel-body d-flex gap-2 flex-wrap align-items-end">
        <div><label className="form-label" htmlFor="ex-f">From</label><input id="ex-f" type="date" className="form-control" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div><label className="form-label" htmlFor="ex-t">To</label><input id="ex-t" type="date" className="form-control" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
        <div><label className="form-label" htmlFor="ex-s">Status</label><select id="ex-s" className="form-select" value={range.status} onChange={(e) => setRange({ ...range, status: e.target.value })}><option value="">Any</option>{['Pending', 'Confirmed', 'Checked-In', 'In-Progress', 'Completed', 'Cancelled', 'Rejected', 'No-Show'].map((s) => <option key={s}>{s}</option>)}</select></div>
        <button className="btn btn-primary" onClick={exportCsv}><FiDownload className="me-1" />Download CSV</button></div></div>
    </>);
}

/* ------------------------------------------------------------- Doctors */
const emptyDoc = { name: '', email: '', phone: '', department: '', specialization: '', qualification: '', experience: 0, licenseNumber: '', consultationFee: 500, biography: '', isVerified: true };

export function AdminDoctors() {
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const q = useDebounce(search);
  const { data, loading, error, reload } = useFetch('/admin/doctors', { search: q || undefined, page, limit: 10 });
  const { data: deps } = useFetch('/departments');
  const [edit, setEdit] = useState(null); const [sched, setSched] = useState(null); const [del, setDel] = useState(null); const [created, setCreated] = useState(null);

  const toggle = async (d, patch, msg) => { try { await api.put(`/admin/doctors/${d._id}`, patch); toast.success(msg); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const cols = [
    { key: 'n', label: 'Doctor', render: (d) => <div className="d-flex align-items-center gap-2"><Avatar name={d.user.name} src={d.user.profileImage} size={36} /><div><div className="fw-semibold">{d.user.name}</div><div className="small text-muted">{d.user.email}</div></div></div> },
    { key: 's', label: 'Specialization', render: (d) => <>{d.specialization}<div className="small text-muted">{d.department?.name}</div></> },
    { key: 'f', label: 'Fee', render: (d) => money(d.consultationFee) },
    { key: 'v', label: 'Verified', render: (d) => <div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={d.isVerified} onChange={(e) => toggle(d, { isVerified: e.target.checked }, e.target.checked ? 'Doctor verified' : 'Verification removed')} aria-label="Verified" /></div> },
    { key: 'a', label: 'Account', render: (d) => <div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={d.user.isActive} onChange={(e) => toggle(d, { isActive: e.target.checked }, e.target.checked ? 'Account activated' : 'Account deactivated')} aria-label="Active" /></div> },
    { key: 'x', label: '', render: (d) => <div className="d-flex gap-1"><button className="btn btn-sm btn-outline-primary" onClick={() => setEdit(d)}>Edit</button><button className="btn btn-sm btn-light" onClick={() => setSched(d)}>Schedule</button><button className="btn btn-sm btn-outline-danger" onClick={() => setDel(d)}>Delete</button></div> },
  ];
  return (
    <>
      <PageHeader title="Doctors" subtitle="Create doctor accounts, verify profiles and manage availability." actions={<button className="btn btn-primary" onClick={() => setEdit({})}>Add doctor</button>} />
      <div className="panel"><div className="p-3"><input className="form-control" style={{ maxWidth: 380 }} placeholder="Search name, email, specialization or license" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search doctors" /></div>
        <DataTable columns={cols} rows={data?.items} loading={loading} error={error} onRetry={reload} empty={<EmptyState title="No doctors yet" action={<button className="btn btn-primary btn-sm" onClick={() => setEdit({})}>Add the first doctor</button>} />} />
        <Pagination meta={data?.meta} onPage={setPage} /></div>
      {edit && <DoctorForm doctor={edit} departments={deps?.items || []} onClose={(r) => { setEdit(null); if (r) { reload(); if (r.temporaryPassword) setCreated(r); } }} />}
      {sched && <DoctorScheduleModal doctor={sched} onClose={() => setSched(null)} />}
      {del && <ConfirmModal title="Delete doctor?" danger confirmText="Delete doctor" message={`${del.user.name} will be removed. If they have past appointments the account is deactivated instead, so records are kept.`} onClose={() => setDel(null)}
        onConfirm={async () => { try { const r = await api.delete(`/admin/doctors/${del._id}`); toast.success(r.data.message); setDel(null); reload(); } catch (e) { toast.error(errMsg(e)); } }} />}
      {created && <Modal title="Doctor created" onClose={() => setCreated(null)} footer={<button className="btn btn-primary" onClick={() => setCreated(null)}>Done</button>}><p><strong>{created.doctor.user.name}</strong> can log in at <code>/doctor/login</code>.</p><div className="alert alert-warning mb-0">Temporary password: <code className="fs-6">{created.temporaryPassword}</code><br /><span className="small">Shown once and emailed to the doctor.</span></div></Modal>}
    </>);
}

function DoctorForm({ doctor, departments, onClose }) {
  const isNew = !doctor._id;
  const [f, setF] = useState(isNew ? emptyDoc : { name: doctor.user.name, email: doctor.user.email, phone: doctor.user.phone || '', department: doctor.department?._id || '', specialization: doctor.specialization, qualification: doctor.qualification, experience: doctor.experience, licenseNumber: doctor.licenseNumber, consultationFee: doctor.consultationFee, biography: doctor.biography || '', isVerified: doctor.isVerified });
  const [file, setFile] = useState(null); const [busy, setBusy] = useState(false);
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v)); if (file) fd.append('image', file);
      const r = isNew ? await api.post('/admin/doctors', fd) : await api.put(`/admin/doctors/${doctor._id}`, fd);
      toast.success(r.data.message); onClose(r.data.data);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <Modal title={isNew ? 'Add doctor' : `Edit ${doctor.user.name}`} size="lg" busy={busy} onClose={() => onClose()}>
      <form onSubmit={submit}><div className="row g-3">
        <div className="col-md-6"><label className="form-label" htmlFor="d-n">Full name</label><input id="d-n" className="form-control" required value={f.name} onChange={s('name')} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="d-e">Email</label><input id="d-e" type="email" className="form-control" required value={f.email} onChange={s('email')} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="d-p">Phone</label><input id="d-p" className="form-control" required value={f.phone} onChange={s('phone')} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="d-d">Department</label><select id="d-d" className="form-select" required value={f.department} onChange={s('department')}><option value="">Select…</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
        <div className="col-md-6"><label className="form-label" htmlFor="d-s">Specialization</label><input id="d-s" className="form-control" required value={f.specialization} onChange={s('specialization')} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="d-q">Qualification</label><input id="d-q" className="form-control" required value={f.qualification} onChange={s('qualification')} /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="d-x">Experience (years)</label><input id="d-x" type="number" min="0" className="form-control" value={f.experience} onChange={s('experience')} /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="d-l">License number</label><input id="d-l" className="form-control" required value={f.licenseNumber} onChange={s('licenseNumber')} /></div>
        <div className="col-md-4"><label className="form-label" htmlFor="d-f">Consultation fee (₹)</label><input id="d-f" type="number" min="0" className="form-control" required value={f.consultationFee} onChange={s('consultationFee')} /></div>
        <div className="col-12"><label className="form-label" htmlFor="d-b">Biography</label><textarea id="d-b" rows={3} className="form-control" value={f.biography} onChange={s('biography')} /></div>
        <div className="col-md-6"><label className="form-label" htmlFor="d-i">Profile photo</label><input id="d-i" type="file" accept="image/jpeg,image/png,image/webp" className="form-control" onChange={(e) => setFile(e.target.files[0])} /></div>
        <div className="col-md-6 d-flex align-items-end"><div className="form-check"><input id="d-v" type="checkbox" className="form-check-input" checked={f.isVerified} onChange={(e) => setF({ ...f, isVerified: e.target.checked })} /><label className="form-check-label" htmlFor="d-v">Profile verified (patients can book)</label></div></div>
      </div>
      {isNew && <div className="form-text mt-2">A temporary password is generated and emailed to the doctor. A Mon–Fri 9:00–13:00 schedule is created; adjust it from “Schedule”.</div>}
      <div className="d-flex justify-content-end gap-2 mt-4"><button type="button" className="btn btn-light" onClick={() => onClose()} disabled={busy}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create doctor' : 'Save changes'}</button></div></form>
    </Modal>);
}

function DoctorScheduleModal({ doctor, onClose }) {
  const { data, loading, reload } = useFetch(`/admin/doctors/${doctor._id}/schedule`);
  const [saving, setSaving] = useState(false);
  const save = async (p) => { setSaving(true); try { await api.put(`/admin/doctors/${doctor._id}/schedule`, p); toast.success('Schedule saved'); reload(); } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); } };
  return <Modal title={`Schedule – ${doctor.user.name}`} size="lg" onClose={onClose}>{loading && !data ? <Spinner /> : <ScheduleEditor schedule={data.schedule} blockedDates={data.doctor.blockedDates} leaves={data.doctor.leaves} isAvailable={data.doctor.isAvailable} onSave={save} saving={saving} />}</Modal>;
}

/* ------------------------------------------------------------- Patients */
export function AdminPatients() {
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const q = useDebounce(search);
  const { data, loading, error, reload } = useFetch('/admin/patients', { search: q || undefined, page, limit: 10 });
  const [view, setView] = useState(null); const [edit, setEdit] = useState(null);
  const toggle = async (p) => { try { await api.put(`/admin/patients/${p._id}`, { isActive: !p.user.isActive }); toast.success(p.user.isActive ? 'Account deactivated' : 'Account activated'); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const cols = [
    { key: 'n', label: 'Patient', render: (p) => <div className="d-flex align-items-center gap-2"><Avatar name={p.user.name} src={p.user.profileImage} size={34} /><div><div className="fw-semibold">{p.user.name}</div><div className="small text-muted">{p.patientCode}</div></div></div> },
    { key: 'c', label: 'Contact', render: (p) => <>{p.user.phone}<div className="small text-muted">{p.user.email}</div></> },
    { key: 'j', label: 'Joined', render: (p) => fmtDate(p.createdAt?.slice(0, 10)) },
    { key: 'a', label: 'Active', render: (p) => <div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={p.user.isActive} onChange={() => toggle(p)} aria-label="Active" /></div> },
    { key: 'x', label: '', render: (p) => <div className="d-flex gap-1"><button className="btn btn-sm btn-outline-primary" onClick={() => setView(p._id)}>View</button><button className="btn btn-sm btn-light" onClick={() => setEdit(p)}>Edit</button></div> },
  ];
  return (
    <><PageHeader title="Patients" />
      <div className="panel"><div className="p-3"><input className="form-control" style={{ maxWidth: 380 }} placeholder="Search by name, phone, email or patient ID" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search patients" /></div>
        <DataTable columns={cols} rows={data?.items} loading={loading} error={error} onRetry={reload} empty={<EmptyState title="No patients found" />} /><Pagination meta={data?.meta} onPage={setPage} /></div>
      {view && <PatientView id={view} onClose={() => setView(null)} />}
      {edit && <PatientEdit patient={edit} onClose={(c) => { setEdit(null); c && reload(); }} />}</>);
}
function PatientView({ id, onClose }) {
  const { data, loading, error } = useFetch(`/admin/patients/${id}`);
  const p = data?.patient;
  return <Modal title="Patient details" size="lg" onClose={onClose} footer={<button className="btn btn-light" onClick={onClose}>Close</button>}>{loading ? <Spinner /> : error ? <ErrorState message={error} /> : <>
    <dl className="kv">{[['Name', p.user.name], ['Patient ID', p.patientCode], ['Email', p.user.email], ['Phone', p.user.phone], ['Date of birth', p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString('en-IN') : '—'], ['Gender / blood', `${p.gender || '—'} / ${p.bloodGroup || '—'}`], ['Address', p.address || '—'], ['Allergies', p.allergies?.join(', ') || '—'], ['Medical history', p.medicalHistory || '—']].map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    <h4 className="h6 mt-3">Recent appointments</h4>
    <DataTable rows={data.history} columns={[{ key: 'c', label: 'ID', render: (a) => a.appointmentCode }, { key: 'd', label: 'Doctor', render: (a) => a.doctor.user.name }, { key: 'w', label: 'When', render: (a) => `${fmtDate(a.appointmentDate)} ${to12h(a.startTime)}` }, { key: 's', label: 'Status', render: (a) => <StatusBadge status={a.appointmentStatus} /> }]} empty={<div className="text-muted small">No appointments.</div>} /></>}</Modal>;
}
function PatientEdit({ patient, onClose }) {
  const [f, setF] = useState({ name: patient.user.name, phone: patient.user.phone || '', address: patient.address || '', bloodGroup: patient.bloodGroup || '', gender: patient.gender || '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await api.put(`/admin/patients/${patient._id}`, f); toast.success('Patient updated'); onClose(true); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); } };
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return <Modal title="Edit patient" busy={busy} onClose={() => onClose(false)}><form onSubmit={submit}><div className="row g-3">
    <div className="col-md-6"><label className="form-label" htmlFor="pe-n">Name</label><input id="pe-n" className="form-control" required value={f.name} onChange={s('name')} /></div>
    <div className="col-md-6"><label className="form-label" htmlFor="pe-p">Phone</label><input id="pe-p" className="form-control" value={f.phone} onChange={s('phone')} /></div>
    <div className="col-md-6"><label className="form-label" htmlFor="pe-g">Gender</label><select id="pe-g" className="form-select" value={f.gender} onChange={s('gender')}><option value="">Not stated</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
    <div className="col-md-6"><label className="form-label" htmlFor="pe-b">Blood group</label><select id="pe-b" className="form-select" value={f.bloodGroup} onChange={s('bloodGroup')}><option value="">Unknown</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}</select></div>
    <div className="col-12"><label className="form-label" htmlFor="pe-a">Address</label><input id="pe-a" className="form-control" value={f.address} onChange={s('address')} /></div></div>
    <div className="d-flex justify-content-end gap-2 mt-4"><button type="button" className="btn btn-light" onClick={() => onClose(false)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div></form></Modal>;
}

/* ------------------------------------------------------------- Receptionists */
export function AdminReceptionists() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch('/admin/receptionists', { page, limit: 10 });
  const { data: deps } = useFetch('/departments');
  const [edit, setEdit] = useState(null); const [created, setCreated] = useState(null);
  const toggle = async (r) => { try { await api.put(`/admin/receptionists/${r._id}`, { isActive: !r.user.isActive }); toast.success(r.user.isActive ? 'Deactivated' : 'Activated'); reload(); } catch (e) { toast.error(errMsg(e)); } };
  const cols = [
    { key: 'n', label: 'Receptionist', render: (r) => <><div className="fw-semibold">{r.user.name}</div><div className="small text-muted">{r.user.email}</div></> },
    { key: 'e', label: 'Employee ID', render: (r) => r.employeeId }, { key: 'd', label: 'Department', render: (r) => r.assignedDepartment?.name || '—' }, { key: 'j', label: 'Joined', render: (r) => new Date(r.joiningDate).toLocaleDateString('en-IN') },
    { key: 'a', label: 'Active', render: (r) => <div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={r.user.isActive} onChange={() => toggle(r)} aria-label="Active" /></div> },
    { key: 'x', label: '', render: (r) => <button className="btn btn-sm btn-outline-primary" onClick={() => setEdit(r)}>Edit</button> },
  ];
  return (
    <><PageHeader title="Receptionists" actions={<button className="btn btn-primary" onClick={() => setEdit({})}>Add receptionist</button>} />
      <div className="panel"><DataTable columns={cols} rows={data?.items} loading={loading} error={error} onRetry={reload} empty={<EmptyState title="No receptionists yet" />} /><Pagination meta={data?.meta} onPage={setPage} /></div>
      {edit && <ReceptionistForm rec={edit} departments={deps?.items || []} onClose={(r) => { setEdit(null); if (r) { reload(); if (r.temporaryPassword) setCreated(r); } }} />}
      {created && <Modal title="Receptionist created" onClose={() => setCreated(null)} footer={<button className="btn btn-primary" onClick={() => setCreated(null)}>Done</button>}><div className="alert alert-warning mb-0">Temporary password for <strong>{created.receptionist.user.name}</strong>: <code className="fs-6">{created.temporaryPassword}</code><br /><span className="small">Shown once and emailed to them.</span></div></Modal>}</>);
}
function ReceptionistForm({ rec, departments, onClose }) {
  const isNew = !rec._id;
  const [f, setF] = useState(isNew ? { name: '', email: '', phone: '', employeeId: '', assignedDepartment: '' } : { name: rec.user.name, phone: rec.user.phone || '', employeeId: rec.employeeId, assignedDepartment: rec.assignedDepartment?._id || '' });
  const [busy, setBusy] = useState(false);
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { const r = isNew ? await api.post('/admin/receptionists', f) : await api.put(`/admin/receptionists/${rec._id}`, f); toast.success(r.data.message); onClose(r.data.data); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); } };
  return <Modal title={isNew ? 'Add receptionist' : 'Edit receptionist'} busy={busy} onClose={() => onClose()}><form onSubmit={submit}><div className="row g-3">
    <div className="col-md-6"><label className="form-label" htmlFor="rc-n">Name</label><input id="rc-n" className="form-control" required value={f.name} onChange={s('name')} /></div>
    <div className="col-md-6"><label className="form-label" htmlFor="rc-p">Phone</label><input id="rc-p" className="form-control" required value={f.phone} onChange={s('phone')} /></div>
    {isNew && <div className="col-12"><label className="form-label" htmlFor="rc-e">Email</label><input id="rc-e" type="email" className="form-control" required value={f.email} onChange={s('email')} /></div>}
    <div className="col-md-6"><label className="form-label" htmlFor="rc-i">Employee ID</label><input id="rc-i" className="form-control" required value={f.employeeId} onChange={s('employeeId')} /></div>
    <div className="col-md-6"><label className="form-label" htmlFor="rc-d">Assigned department</label><select id="rc-d" className="form-select" value={f.assignedDepartment} onChange={s('assignedDepartment')}><option value="">None</option>{departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div></div>
    <div className="d-flex justify-content-end gap-2 mt-4"><button type="button" className="btn btn-light" onClick={() => onClose()}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div></form></Modal>;
}

/* ------------------------------------------------------------- Departments */
export function AdminDepartments() {
  const { data, loading, error, reload } = useFetch('/admin/departments', { all: true });
  const [edit, setEdit] = useState(null); const [del, setDel] = useState(null);
  const cols = [
    { key: 'n', label: 'Department', render: (d) => <div className="d-flex align-items-center gap-2">{d.image && <img src={d.image} alt="" width="40" height="40" className="rounded" style={{ objectFit: 'cover' }} />}<div><div className="fw-semibold">{d.name}</div><div className="small text-muted">{d.description}</div></div></div> },
    { key: 'c', label: 'Doctors', render: (d) => d.doctorCount }, { key: 's', label: 'Status', render: (d) => <StatusBadge status={d.isActive ? 'Confirmed' : 'Cancelled'} /> },
    { key: 'x', label: '', render: (d) => <div className="d-flex gap-1"><button className="btn btn-sm btn-outline-primary" onClick={() => setEdit(d)}>Edit</button><button className="btn btn-sm btn-outline-danger" onClick={() => setDel(d)}>Delete</button></div> },
  ];
  return (
    <><PageHeader title="Departments" actions={<button className="btn btn-primary" onClick={() => setEdit({})}>Add department</button>} />
      <div className="panel"><DataTable columns={cols} rows={data?.items} loading={loading} error={error} onRetry={reload} empty={<EmptyState title="No departments yet" />} /></div>
      {edit && <DeptForm dept={edit} onClose={(c) => { setEdit(null); c && reload(); }} />}
      {del && <ConfirmModal title="Delete department?" danger confirmText="Delete" message={`“${del.name}” will be deleted. Departments that still have doctors cannot be deleted.`} onClose={() => setDel(null)} onConfirm={async () => { try { await api.delete(`/admin/departments/${del._id}`); toast.success('Department deleted'); setDel(null); reload(); } catch (e) { toast.error(errMsg(e)); setDel(null); } }} />}</>);
}
function DeptForm({ dept, onClose }) {
  const isNew = !dept._id;
  const [f, setF] = useState({ name: dept.name || '', description: dept.description || '', isActive: dept.isActive ?? true });
  const [file, setFile] = useState(null); const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { const fd = new FormData(); Object.entries(f).forEach(([k, v]) => fd.append(k, v)); if (file) fd.append('image', file); const r = isNew ? await api.post('/admin/departments', fd) : await api.put(`/admin/departments/${dept._id}`, fd); toast.success(r.data.message); onClose(true); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); } };
  return <Modal title={isNew ? 'Add department' : 'Edit department'} busy={busy} onClose={() => onClose(false)}><form onSubmit={submit}>
    <label className="form-label" htmlFor="dp-n">Name</label><input id="dp-n" className="form-control mb-3" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
    <label className="form-label" htmlFor="dp-d">Description</label><textarea id="dp-d" rows={3} className="form-control mb-3" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
    <label className="form-label" htmlFor="dp-i">Image (optional)</label><input id="dp-i" type="file" accept="image/jpeg,image/png,image/webp" className="form-control mb-3" onChange={(e) => setFile(e.target.files[0])} />
    <div className="form-check"><input id="dp-a" type="checkbox" className="form-check-input" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /><label className="form-check-label" htmlFor="dp-a">Active (accepting appointments)</label></div>
    <div className="d-flex justify-content-end gap-2 mt-4"><button type="button" className="btn btn-light" onClick={() => onClose(false)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div></form></Modal>;
}

/* ------------------------------------------------------------- Appointments */
export const AdminAppointments = () => <><PageHeader title="All appointments" subtitle="Search, filter and monitor every appointment in the hospital." /><AppointmentsManager /></>;

/* ------------------------------------------------------------- Notifications (own + broadcast) */
export function AdminNotifications() {
  const [f, setF] = useState({ title: '', message: '', audience: 'all' }); const [busy, setBusy] = useState(false);
  const send = async (e) => { e.preventDefault(); setBusy(true); try { const r = await api.post('/admin/notifications/broadcast', f); toast.success(r.data.message); setF({ title: '', message: '', audience: 'all' }); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); } };
  return <NotificationsPage><form className="panel panel-body mb-3" onSubmit={send}><h2 className="h6">Send an announcement</h2><div className="row g-2">
    <div className="col-md-3"><select className="form-select" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} aria-label="Audience"><option value="all">Everyone</option><option value="patient">Patients</option><option value="doctor">Doctors</option><option value="receptionist">Receptionists</option></select></div>
    <div className="col-md-9"><input className="form-control" placeholder="Title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Title" /></div>
    <div className="col-12"><textarea className="form-control" rows={2} placeholder="Message" required value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} aria-label="Message" /></div></div>
    <button className="btn btn-primary mt-2" disabled={busy}>{busy ? 'Sending…' : 'Send announcement'}</button></form></NotificationsPage>;
}

/* ------------------------------------------------------------- Settings */
export function AdminSettings() {
  const { data, loading, error, reload } = useFetch('/admin/settings');
  const [f, setF] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setF(data.settings); }, [data]);
  if (loading && !f) return <Spinner />; if (error) return <ErrorState message={error} onRetry={reload} />; if (!f) return null;
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sw = (k, label, hint) => <div className="form-check form-switch mb-3"><input className="form-check-input" type="checkbox" id={k} checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /><label className="form-check-label fw-semibold" htmlFor={k}>{label}</label>{hint && <div className="small text-muted">{hint}</div>}</div>;
  const num = (k, label, hint) => <div className="col-md-4"><label className="form-label" htmlFor={k}>{label}</label><input id={k} type="number" min="0" className="form-control" value={f[k]} onChange={s(k)} />{hint && <div className="form-text">{hint}</div>}</div>;
  const save = async (e) => { e.preventDefault(); setBusy(true); try { await api.put('/admin/settings', f); toast.success('Settings saved'); reload(); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); } };
  return (
    <><PageHeader title="Hospital settings" subtitle="Public information and booking rules. Changes apply immediately." />
      <form onSubmit={save}>
        <div className="panel panel-body mb-3"><h2 className="h6">Hospital information</h2><div className="row g-3">
          <div className="col-md-6"><label className="form-label" htmlFor="hn">Hospital name</label><input id="hn" className="form-control" value={f.hospitalName} onChange={s('hospitalName')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="hp">Phone</label><input id="hp" className="form-control" value={f.phone} onChange={s('phone')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="he">Public email</label><input id="he" type="email" className="form-control" value={f.email} onChange={s('email')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="hem">Emergency number</label><input id="hem" className="form-control" value={f.emergencyNumber} onChange={s('emergencyNumber')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="ha">Address</label><input id="ha" className="form-control" value={f.address} onChange={s('address')} /></div>
          <div className="col-md-6"><label className="form-label" htmlFor="hw">Working hours</label><input id="hw" className="form-control" value={f.workingHours} onChange={s('workingHours')} /></div>
          <div className="col-12"><label className="form-label" htmlFor="hab">About the hospital</label><textarea id="hab" rows={3} className="form-control" value={f.about} onChange={s('about')} /></div></div></div>
        <div className="panel panel-body mb-3"><h2 className="h6">Booking rules</h2><div className="row g-3 mb-3">
          {num('cancellationDeadlineHours', 'Cancel up to (hours before)')}{num('rescheduleDeadlineHours', 'Reschedule up to (hours before)')}{num('maxReschedules', 'Max reschedules per appointment')}
          {num('maxAdvanceBookingDays', 'Book up to (days ahead)')}{num('minLeadMinutes', 'Minimum lead time (minutes)')}{num('reservationMinutes', 'Unpaid slot hold (minutes)', 'Online bookings release the slot after this time')}
          {num('reminderHoursBefore', 'Send reminder (hours before)')}</div>
          {sw('autoConfirmAppointments', 'Confirm appointments automatically', 'Off = doctors must accept every request.')}
          {sw('onlinePaymentEnabled', 'Allow online payment (Razorpay)')}{sw('cashPaymentEnabled', 'Allow pay at hospital')}
          {sw('allowDoctorsToSetFee', 'Let doctors edit their own consultation fee')}{sw('emailNotificationsEnabled', 'Send email notifications')}</div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
      </form></>);
}

/* ------------------------------------------------------------- Activity log */
export function ActivityLog() {
  const [page, setPage] = useState(1); const [action, setAction] = useState(''); const a = useDebounce(action);
  const { data, loading, error, reload } = useFetch('/admin/logs', { page, limit: 25, action: a || undefined });
  return (
    <><PageHeader title="Activity log" subtitle="An audit trail of important actions." />
      <div className="panel"><div className="p-3"><input className="form-control" style={{ maxWidth: 320 }} placeholder="Filter by action, e.g. CANCELLED" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Filter log" /></div>
        <DataTable rows={data?.items} loading={loading} error={error} onRetry={reload} columns={[{ key: 't', label: 'Time', render: (l) => fmtDateTime(l.createdAt) }, { key: 'u', label: 'User', render: (l) => l.user ? `${l.user.name} (${l.user.role})` : 'System' }, { key: 'a', label: 'Action', render: (l) => <code>{l.action}</code> }, { key: 'd', label: 'Details', render: (l) => <span className="small text-muted">{l.description}</span> }]} />
        <Pagination meta={data?.meta} onPage={setPage} /></div></>);
}
