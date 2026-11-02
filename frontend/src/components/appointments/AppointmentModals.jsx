import { useState } from 'react';
import { toast } from 'react-toastify';
import { FaStar } from 'react-icons/fa';
import api, { errMsg } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import { Spinner } from '../common/Loader';
import { ErrorState } from '../common/EmptyState';
import SlotPicker from '../booking/SlotPicker';
import { fmtDate, fmtDateTime, money, to12h, todayStr } from '../../utils/format';

export function DetailsModal({ appt, onClose }) {
  const rows = [
    ['Appointment ID', appt.appointmentCode], ['Patient', `${appt.patient?.user?.name} • ${appt.patient?.user?.phone || ''}`], ['Doctor', appt.doctor?.user?.name],
    ['Department', appt.department?.name], ['Date', fmtDate(appt.appointmentDate)], ['Time', `${to12h(appt.startTime)} – ${to12h(appt.endTime)}`],
    ['Reason', appt.reason || '—'], ['Symptoms', appt.symptoms || '—'], ['Fee', money(appt.consultationFee)], ['Payment', `${appt.paymentMethod === 'Cash' ? 'Pay at hospital' : 'Online'} • ${appt.paymentStatus}`],
    ['Status', <StatusBadge key="s" status={appt.appointmentStatus} />],
    ...(appt.queueNumber ? [['Queue number', `#${appt.queueNumber}`]] : []),
    ...(appt.checkedInAt ? [['Checked in', fmtDateTime(appt.checkedInAt)]] : []),
    ...(appt.consultationNotes ? [['Consultation notes', appt.consultationNotes]] : []),
    ...(appt.cancellationReason ? [['Cancellation reason', appt.cancellationReason]] : []),
    ['Booked on', fmtDateTime(appt.createdAt)],
  ];
  return (
    <Modal title="Appointment details" onClose={onClose} footer={<button className="btn btn-light" onClick={onClose}>Close</button>}>
      <dl className="kv mb-0">{rows.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </Modal>
  );
}

export function ReceiptModal({ appointmentId, onClose }) {
  const { data, loading, error, reload } = useFetch(`/appointments/${appointmentId}/receipt`);
  return (
    <Modal title="Appointment receipt" onClose={onClose} footer={<><button className="btn btn-light" onClick={onClose}>Close</button><button className="btn btn-primary" disabled={!data} onClick={() => window.print()}>Print / save as PDF</button></>}>
      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="print-area receipt">
          <div className="text-center mb-3">
            <div className="h5 mb-0">{data.hospital.name}</div>
            <div className="text-muted small">{[data.hospital.address, data.hospital.phone].filter(Boolean).join(' • ')}</div>
            <div className="fw-bold mt-2">APPOINTMENT RECEIPT</div>
          </div>
          <dl className="kv">
            {[
              ['Receipt for', data.appointment.appointmentCode], ['Patient', data.appointment.patient.user.name], ['Doctor', `${data.appointment.doctor.user.name} (${data.appointment.doctor.specialization})`],
              ['Department', data.appointment.department.name], ['Date & time', `${fmtDate(data.appointment.appointmentDate)}, ${to12h(data.appointment.startTime)}`],
              ['Consultation fee', money(data.appointment.consultationFee)], ['Payment method', data.payment?.paymentMethod === 'Cash' ? 'Pay at hospital' : 'Online (Razorpay)'],
              ['Payment status', data.payment?.paymentStatus || data.appointment.paymentStatus], ...(data.payment?.transactionId ? [['Transaction ID', data.payment.transactionId]] : []),
              ...(data.payment?.paidAt ? [['Paid on', fmtDateTime(data.payment.paidAt)]] : []), ['Appointment status', data.appointment.appointmentStatus],
            ].map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <div className="text-muted small text-center mt-3">Issued {fmtDateTime(data.issuedAt)}. Please arrive 10 minutes early with a photo ID.</div>
        </div>
      )}
    </Modal>
  );
}

export function PatientInfoModal({ patientId, onClose }) {
  const { data, loading, error, reload } = useFetch(`/doctors/patients/${patientId}`);
  const p = data?.patient;
  return (
    <Modal title="Patient information" size="lg" onClose={onClose} footer={<button className="btn btn-light" onClick={onClose}>Close</button>}>
      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <dl className="kv">
            {[['Name', p.user.name], ['Contact', `${p.user.phone || '—'} • ${p.user.email}`], ['Date of birth', p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString('en-IN') : '—'], ['Gender', p.gender || '—'], ['Blood group', p.bloodGroup || '—'],
              ['Allergies', p.allergies?.length ? p.allergies.join(', ') : 'None recorded'], ['Medical history', p.medicalHistory || 'None recorded'],
              ['Emergency contact', p.emergencyContact?.name ? `${p.emergencyContact.name} (${p.emergencyContact.relation || 'contact'}) ${p.emergencyContact.phone || ''}` : '—'],
            ].map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <h4 className="h6 mt-3">Visits with you</h4>
          <div className="table-responsive"><table className="table table-sm"><tbody>
            {data.history.map((h) => <tr key={h._id}><td>{fmtDate(h.appointmentDate)}</td><td>{to12h(h.startTime)}</td><td><StatusBadge status={h.appointmentStatus} /></td><td className="small text-muted">{h.consultationNotes || h.reason || ''}</td></tr>)}
          </tbody></table></div>
        </>
      )}
    </Modal>
  );
}

/** Generic "give a reason / add notes" prompt that performs a request when confirmed. */
export function TextPromptModal({ title, label, placeholder, required, confirmText, danger, note, onSubmit, onClose, rows = 3 }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (required && !text.trim()) return toast.error(`${label} is required`);
    setBusy(true);
    try { await onSubmit(text.trim()); onClose(true); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title={title} busy={busy} onClose={() => onClose(false)} footer={
      <><button className="btn btn-light" onClick={() => onClose(false)} disabled={busy}>Cancel</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={submit} disabled={busy}>{busy ? 'Working…' : confirmText}</button></>
    }>
      {note && <div className="alert alert-info py-2 small">{note}</div>}
      <label className="form-label" htmlFor="prompt-text">{label}{required ? '' : ' (optional)'}</label>
      <textarea id="prompt-text" className="form-control" rows={rows} maxLength={500} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
    </Modal>
  );
}

export function RescheduleModal({ appt, onClose }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await api.put(`/appointments/${appt._id}/reschedule`, { date, startTime: time }); toast.success('Appointment rescheduled'); onClose(true); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title="Reschedule appointment" busy={busy} onClose={() => onClose(false)} footer={
      <><button className="btn btn-light" onClick={() => onClose(false)} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={busy || !date || !time}>{busy ? 'Saving…' : 'Confirm new time'}</button></>
    }>
      <p className="small text-muted">Currently <strong>{fmtDate(appt.appointmentDate)}, {to12h(appt.startTime)}</strong> with {appt.doctor.user.name}. Your old slot is released only when the new one is secured.</p>
      <label className="form-label" htmlFor="rs-date">New date</label>
      <input id="rs-date" type="date" className="form-control mb-3" min={todayStr()} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} />
      <SlotPicker doctorId={appt.doctor._id} date={date} value={time} onChange={setTime} />
    </Modal>
  );
}

export function ReviewModal({ appt, onClose }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { await api.post('/reviews', { appointmentId: appt._id, rating, comment }); toast.success('Thanks for your feedback!'); onClose(true); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title={`Rate ${appt.doctor.user.name}`} busy={busy} onClose={() => onClose(false)} footer={
      <><button className="btn btn-light" onClick={() => onClose(false)} disabled={busy}>Cancel</button><button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Submit review'}</button></>
    }>
      <div className="mb-3" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className="btn btn-link p-1" onClick={() => setRating(n)}>
            <FaStar size={30} color={n <= rating ? '#e39a0b' : '#cfdbe2'} />
          </button>
        ))}
      </div>
      <label className="form-label" htmlFor="rv-comment">Tell others about your visit (optional)</label>
      <textarea id="rv-comment" className="form-control" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
    </Modal>
  );
}
