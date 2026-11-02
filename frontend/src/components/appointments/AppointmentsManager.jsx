import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api, { errMsg } from '../../api/axios';
import useFetch, { useDebounce } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { payForAppointment } from '../../utils/razorpay';
import StatusBadge from '../common/StatusBadge';
import Pagination from '../common/Pagination';
import DataTable from '../common/DataTable';
import { EmptyState } from '../common/EmptyState';
import Avatar from '../common/Avatar';
import { ConfirmModal } from '../common/Modal';
import { DetailsModal, PatientInfoModal, ReceiptModal, RescheduleModal, ReviewModal, TextPromptModal } from './AppointmentModals';
import { fmtDate, money, to12h, todayStr } from '../../utils/format';

const TABS = [
  ['all', 'All', {}], ['upcoming', 'Upcoming', { when: 'upcoming' }], ['pending', 'Pending', { status: 'Pending' }],
  ['completed', 'Completed', { status: 'Completed' }], ['cancelled', 'Cancelled', { status: 'Cancelled,Rejected,No-Show' }],
];

/**
 * One appointments table for every role. What each row offers depends on the role AND the appointment's state;
 * the backend enforces the same rules, so a button here can never bypass them.
 */
export default function AppointmentsManager({ initialTab = 'all', fixedFilters = {}, showTabs = true, showDate = true, onChanged, emptyAction, pageSize = 10, hideFilters }) {
  const { user } = useAuth();
  const role = user.role;
  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [modal, setModal] = useState(null);
  const q = useDebounce(search);

  const tabParams = TABS.find((t) => t[0] === tab)[2];
  const params = { ...tabParams, ...(date ? { date } : {}), ...(q ? { search: q } : {}), ...fixedFilters, page, limit: pageSize, sort: tab === 'upcoming' ? 'date_asc' : fixedFilters.sort || 'date_desc' };
  const { data, loading, error, reload } = useFetch('/appointments', params);
  const rows = data?.items || [];

  const done = () => { reload(); onChanged?.(); };
  const run = async (appt, fn, okMsg) => {
    setBusyId(appt._id);
    try { await fn(); if (okMsg) toast.success(okMsg); done(); } catch (e) { toast.error(errMsg(e)); done(); } finally { setBusyId(null); }
  };
  const setStatus = (a, status, extra = {}, msg) => run(a, () => api.put(`/appointments/${a._id}/status`, { status, ...extra }), msg || `Marked ${status}`);
  const pay = (a) => run(a, async () => { try { await payForAppointment(a._id); toast.success('Payment successful – appointment confirmed'); } catch (e) { if (e.message !== 'dismissed') throw e; toast.info('Payment window closed. Your slot stays reserved until it expires.'); } });
  const closeModal = (changed) => { setModal(null); if (changed) done(); };

  const today = todayStr();
  const isOnlineUnpaid = (a) => a.paymentMethod === 'Online' && a.paymentStatus === 'Pending' && a.appointmentStatus === 'Pending';
  const expired = (a) => a.reservationExpiresAt && new Date(a.reservationExpiresAt) < new Date();

  const actions = (a) => {
    const s = a.appointmentStatus;
    const B = ({ children, onClick, cls = 'btn-outline-primary', title }) => <button className={`btn btn-sm ${cls}`} title={title} disabled={busyId === a._id} onClick={onClick}>{children}</button>;
    const out = [<B key="d" cls="btn-light" onClick={() => setModal({ type: 'details', a })}>Details</B>];
    const open = ['Pending', 'Confirmed'].includes(s);

    if (role === 'patient') {
      if (isOnlineUnpaid(a) && !expired(a)) out.unshift(<B key="pay" cls="btn-primary" onClick={() => pay(a)}>Pay {money(a.consultationFee)}</B>);
      if (open && !(isOnlineUnpaid(a))) out.push(<B key="rs" onClick={() => setModal({ type: 'reschedule', a })}>Reschedule</B>);
      if (open) out.push(<B key="c" cls="btn-outline-danger" onClick={() => setModal({ type: 'cancel', a })}>Cancel</B>);
      if (s === 'Completed' && !a.isReviewed) out.push(<B key="rv" cls="btn-teal" onClick={() => setModal({ type: 'review', a })}>Rate doctor</B>);
    }
    if (role === 'doctor') {
      if (s === 'Pending' && !isOnlineUnpaid(a)) { out.unshift(<B key="ok" cls="btn-primary" onClick={() => setStatus(a, 'Confirmed', {}, 'Appointment accepted')}>Accept</B>); out.push(<B key="rj" cls="btn-outline-danger" onClick={() => setModal({ type: 'reject', a })}>Reject</B>); }
      if (['Confirmed', 'Checked-In'].includes(s)) out.unshift(<B key="st" onClick={() => setStatus(a, 'In-Progress', {}, 'Consultation started')}>Start</B>);
      if (['Confirmed', 'Checked-In', 'In-Progress'].includes(s)) out.unshift(<B key="cp" cls="btn-primary" onClick={() => setModal({ type: 'complete', a })}>Complete</B>);
      if (['Confirmed', 'Checked-In'].includes(s)) out.push(<B key="ns" cls="btn-outline-secondary" onClick={() => setStatus(a, 'No-Show')}>No-show</B>);
      out.push(<B key="pt" cls="btn-light" onClick={() => setModal({ type: 'patient', a })}>Patient</B>);
      if (['Confirmed', 'Pending', 'Checked-In'].includes(s)) out.push(<B key="c" cls="btn-outline-danger" onClick={() => setModal({ type: 'cancel', a })}>Cancel</B>);
    }
    if (role === 'receptionist' || role === 'admin') {
      if (role === 'receptionist' && s === 'Confirmed' && a.appointmentDate === today) out.unshift(<B key="ci" cls="btn-primary" onClick={() => run(a, () => api.put(`/receptionist/appointments/${a._id}/check-in`), 'Patient checked in')}>Check in</B>);
      if (a.paymentMethod === 'Cash' && a.paymentStatus === 'Pending' && !['Cancelled', 'Rejected'].includes(s)) out.push(<B key="mp" cls="btn-teal" onClick={() => run(a, () => api.put(`/payments/${a._id}/mark-paid`), 'Payment recorded')}>Mark paid</B>);
      if (open && role === 'receptionist' && !isOnlineUnpaid(a)) out.push(<B key="rs" onClick={() => setModal({ type: 'reschedule', a })}>Reschedule</B>);
      if (role === 'admin' && s === 'Pending' && !isOnlineUnpaid(a)) out.push(<B key="ok" onClick={() => setStatus(a, 'Confirmed')}>Confirm</B>);
      if (['Pending', 'Confirmed', 'Checked-In'].includes(s)) out.push(<B key="c" cls="btn-outline-danger" onClick={() => setModal({ type: 'cancel', a })}>Cancel</B>);
      if (role === 'receptionist' && ['Confirmed', 'Checked-In'].includes(s)) out.push(<B key="ns" cls="btn-outline-secondary" onClick={() => setStatus(a, 'No-Show')}>No-show</B>);
    }
    if (a.paymentStatus === 'Paid' || a.paymentMethod === 'Cash') out.push(<B key="rc" cls="btn-light" onClick={() => setModal({ type: 'receipt', a })}>Receipt</B>);
    return <div className="d-flex gap-1 flex-wrap">{out}</div>;
  };

  const person = (a) => {
    const u = role === 'patient' ? a.doctor?.user : a.patient?.user;
    const sub = role === 'patient' ? a.doctor?.specialization : a.patient?.user?.phone;
    return (
      <div className="d-flex align-items-center gap-2">
        <Avatar name={u?.name} src={u?.profileImage} size={34} />
        <div><div className="fw-semibold">{u?.name}</div><div className="text-muted small">{sub}{role !== 'patient' && role !== 'doctor' ? ` • ${a.doctor?.user?.name}` : ''}</div></div>
      </div>
    );
  };

  const columns = [
    { key: 'p', label: role === 'patient' ? 'Doctor' : 'Patient', render: person },
    { key: 'when', label: 'Date & time', render: (a) => <><div className="fw-semibold">{fmtDate(a.appointmentDate)}</div><div className="text-muted small">{to12h(a.startTime)} – {to12h(a.endTime)}{a.queueNumber ? ` • queue #${a.queueNumber}` : ''}</div></> },
    ...(role !== 'doctor' ? [{ key: 'dept', label: 'Department', render: (a) => a.department?.name }] : []),
    { key: 'pay', label: 'Payment', render: (a) => <><div>{money(a.consultationFee)}</div><div className="small"><StatusBadge status={a.paymentStatus} /> <span className="text-muted">{a.paymentMethod === 'Cash' ? 'at hospital' : 'online'}</span></div></> },
    { key: 'st', label: 'Status', render: (a) => <><StatusBadge status={a.appointmentStatus} />{isOnlineUnpaid(a) && <div className="small text-muted mt-1">{expired(a) ? 'Reservation expired' : 'Awaiting payment'}</div>}</> },
    { key: 'act', label: 'Actions', render: actions },
  ];

  const m = modal;
  return (
    <div className="panel">
      {showTabs && (
        <div className="px-3 pt-3 d-flex gap-1 flex-wrap">
          {TABS.map(([k, label]) => <button key={k} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-light'}`} onClick={() => { setTab(k); setPage(1); }}>{label}</button>)}
        </div>
      )}
      {!hideFilters && (
        <div className="p-3 d-flex gap-2 flex-wrap">
          {role !== 'patient' && <input className="form-control" style={{ maxWidth: 300 }} placeholder="Search patient, doctor or appointment ID" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search appointments" />}
          {showDate && !fixedFilters.date && <input type="date" className="form-control" style={{ maxWidth: 190 }} value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} aria-label="Filter by date" />}
          {(date || search) && <button className="btn btn-light" onClick={() => { setDate(''); setSearch(''); setPage(1); }}>Clear filters</button>}
        </div>
      )}
      <DataTable columns={columns} rows={rows} loading={loading} error={error} onRetry={reload}
        empty={<EmptyState title="No appointments found" hint={tab === 'all' && !date && !search ? 'Appointments will show up here once they are booked.' : 'Try a different tab or clear the filters.'} action={emptyAction || (role === 'patient' && <Link to="/patient/book" className="btn btn-primary btn-sm">Book an appointment</Link>)} />} />
      <Pagination meta={data?.meta} onPage={setPage} />

      {m?.type === 'details' && <DetailsModal appt={m.a} onClose={() => setModal(null)} />}
      {m?.type === 'receipt' && <ReceiptModal appointmentId={m.a._id} onClose={() => setModal(null)} />}
      {m?.type === 'patient' && <PatientInfoModal patientId={m.a.patient._id} onClose={() => setModal(null)} />}
      {m?.type === 'reschedule' && <RescheduleModal appt={m.a} onClose={closeModal} />}
      {m?.type === 'review' && <ReviewModal appt={m.a} onClose={closeModal} />}
      {m?.type === 'cancel' && (
        <TextPromptModal title="Cancel this appointment?" label="Reason" required={role === 'doctor'} confirmText="Cancel appointment" danger
          note={m.a.paymentStatus === 'Paid' ? 'This appointment is paid. The full amount will be refunded to the original payment method.' : undefined}
          placeholder="Let everyone know why" onClose={closeModal}
          onSubmit={(reason) => api.put(`/appointments/${m.a._id}/cancel`, { reason }).then(() => toast.success('Appointment cancelled'))} />
      )}
      {m?.type === 'reject' && (
        <TextPromptModal title="Reject this request?" label="Reason for the patient" required confirmText="Reject request" danger placeholder="e.g. I am on leave that day"
          onClose={closeModal} onSubmit={(reason) => api.put(`/appointments/${m.a._id}/status`, { status: 'Rejected', reason }).then(() => toast.success('Request rejected'))} />
      )}
      {m?.type === 'complete' && (
        <TextPromptModal title="Complete consultation" label="Consultation notes" confirmText="Mark completed" rows={5} placeholder="Diagnosis, advice, follow-up…"
          onClose={closeModal} onSubmit={(notes) => api.put(`/appointments/${m.a._id}/status`, { status: 'Completed', notes }).then(() => toast.success('Consultation completed'))} />
      )}
    </div>
  );
}
