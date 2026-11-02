import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiCheckCircle, FiSearch } from 'react-icons/fi';
import api, { errMsg } from '../../api/axios';
import useFetch, { useDebounce } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { payForAppointment } from '../../utils/razorpay';
import Avatar from '../common/Avatar';
import Pagination from '../common/Pagination';
import StatusBadge from '../common/StatusBadge';
import { Spinner } from '../common/Loader';
import { EmptyState } from '../common/EmptyState';
import SlotPicker from './SlotPicker';
import { fmtDate, money, to12h, todayStr } from '../../utils/format';

const STEPS = ['Choose doctor', 'Date & time', 'Details & payment'];

/** Used by patients (books for themselves) and receptionists/admins (pick a patient first). */
export default function BookingWizard() {
  const { user } = useAuth();
  const staff = user.role !== 'patient';
  const base = `/${user.role}`;
  const [params] = useSearchParams();
  const nav = useNavigate();

  const [step, setStep] = useState(0);
  const [doctor, setDoctor] = useState(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState({ reason: '', symptoms: '', paymentMethod: '' });
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(null);

  const { data: hospitalData } = useFetch('/public/hospital');
  const hospital = hospitalData?.hospital;
  const methods = useMemo(() => [...(hospital?.onlinePaymentEnabled ? ['Online'] : []), ...(hospital?.cashPaymentEnabled ? ['Cash'] : [])], [hospital]);
  useEffect(() => { if (methods.length && !methods.includes(form.paymentMethod)) setForm((f) => ({ ...f, paymentMethod: methods[0] })); }, [methods]); // eslint-disable-line

  // Preselect doctor / patient from the URL (?doctor=ID&patient=ID)
  useEffect(() => {
    const d = params.get('doctor');
    if (d) api.get(`/doctors/${d}`).then((r) => { setDoctor(r.data.data.doctor); setStep(1); }).catch(() => toast.error('That doctor is not available for booking.'));
    const p = params.get('patient');
    if (p && staff) api.get('/receptionist/patients', { params: { search: p } }).then((r) => { const f = r.data.data.items.find((x) => x._id === p); if (f) setPatient(f); }).catch(() => {});
  }, []); // eslint-disable-line

  const book = async () => {
    setSubmitting(true);
    try {
      const url = user.role === 'patient' ? '/appointments' : '/receptionist/appointments';
      const { data } = await api.post(url, { doctorId: doctor._id, date, startTime: time, reason: form.reason, symptoms: form.symptoms, paymentMethod: form.paymentMethod, patientId: patient?._id });
      let appt = data.data.appointment;
      setBooked(appt);
      if (appt.paymentMethod === 'Online' && appt.paymentStatus === 'Pending') appt = await payNow(appt) || appt;
    } catch (e) { toast.error(errMsg(e)); if (e.response?.status === 409) setTime(''); } finally { setSubmitting(false); }
  };
  const payNow = async (appt) => {
    try {
      const paid = await payForAppointment(appt._id, hospital?.name);
      setBooked(paid);
      toast.success('Payment successful – your appointment is confirmed');
      return paid;
    } catch (e) {
      if (e.message === 'dismissed') toast.info('Payment not completed yet. Your slot is held for a few minutes.');
      else toast.error(errMsg(e, e.message));
      return null;
    }
  };

  if (booked) return <Confirmation appt={booked} hospital={hospital} base={base} onPay={async () => { setSubmitting(true); await payNow(booked); setSubmitting(false); }} busy={submitting} onAnother={() => { setBooked(null); setStep(0); setDoctor(null); setDate(''); setTime(''); setPatient(null); nav(`${base}/book`, { replace: true }); }} />;

  const canNext = [!!doctor, !!date && !!time, (!staff || !!patient) && !!form.paymentMethod][step];

  return (
    <div>
      <div className="steps" aria-label="Booking progress">
        {STEPS.map((s, i) => <div key={s} className={`step-pill ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}><span className="n">{i < step ? '✓' : i + 1}</span>{s}</div>)}
      </div>

      {step === 0 && <DoctorStep selected={doctor} onSelect={(d) => { setDoctor(d); setTime(''); }} />}

      {step === 1 && doctor && (
        <div className="row g-3">
          <div className="col-lg-4"><DoctorSummary doctor={doctor} onChange={() => setStep(0)} /></div>
          <div className="col-lg-8">
            <div className="panel panel-body">
              <label className="form-label" htmlFor="b-date">Appointment date</label>
              <input id="b-date" type="date" className="form-control mb-3" style={{ maxWidth: 230 }} min={todayStr()} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} />
              <SlotPicker doctorId={doctor._id} date={date} value={time} onChange={setTime} />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="row g-3">
          <div className="col-lg-7">
            {staff && <PatientPicker value={patient} onChange={setPatient} base={base} />}
            <div className="panel panel-body mb-3">
              <h2 className="h6">Visit details</h2>
              <label className="form-label" htmlFor="b-reason">Reason for visit</label>
              <input id="b-reason" className="form-control mb-3" maxLength={500} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Regular check-up, chest pain, skin rash" />
              <label className="form-label" htmlFor="b-sym">Symptoms (optional)</label>
              <textarea id="b-sym" className="form-control" rows={3} maxLength={1000} value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} />
            </div>
            <div className="panel panel-body">
              <h2 className="h6">How would you like to pay?</h2>
              {!hospital ? <Spinner center={false} /> : methods.map((m) => (
                <label key={m} className={`pick mb-2 ${form.paymentMethod === m ? 'selected' : ''}`}>
                  <input type="radio" name="pm" className="form-check-input mt-1" checked={form.paymentMethod === m} onChange={() => setForm({ ...form, paymentMethod: m })} />
                  <span><strong>{m === 'Online' ? 'Pay online now' : 'Pay at the hospital'}</strong><br /><span className="small text-muted">{m === 'Online' ? `Secure payment by card, UPI or net banking. Your slot is held for ${hospital.reservationMinutes} minutes while you pay.` : 'Pay at the front desk when you arrive.'}</span></span>
                </label>
              ))}
            </div>
          </div>
          <div className="col-lg-5">
            <Summary doctor={doctor} date={date} time={time} patient={patient} />
          </div>
        </div>
      )}

      <div className="d-flex justify-content-between mt-4">
        <button className="btn btn-light" disabled={step === 0 || submitting} onClick={() => setStep(step - 1)}>Back</button>
        {step < 2 ? <button className="btn btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</button>
          : <button className="btn btn-primary" disabled={!canNext || submitting} onClick={book}>{submitting ? 'Booking…' : form.paymentMethod === 'Online' ? `Confirm & pay ${money(doctor.consultationFee)}` : 'Confirm booking'}</button>}
      </div>
    </div>
  );
}

function DoctorStep({ selected, onSelect }) {
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search);
  const { data: deps } = useFetch('/departments');
  const { data, loading } = useFetch('/doctors', { search: q || undefined, department: dept || undefined, page, limit: 6 });
  return (
    <div>
      <div className="d-flex gap-2 flex-wrap mb-3">
        <div className="position-relative flex-grow-1" style={{ maxWidth: 360 }}>
          <FiSearch className="position-absolute" style={{ left: 12, top: 13, color: '#7d95a1' }} />
          <input className="form-control ps-5" placeholder="Search by doctor name or specialization" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search doctors" />
        </div>
        <select className="form-select" style={{ maxWidth: 230 }} value={dept} onChange={(e) => { setDept(e.target.value); setPage(1); }} aria-label="Department">
          <option value="">All departments</option>
          {deps?.items.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
      </div>
      {loading && !data ? <Spinner /> : !data?.items.length ? <div className="panel"><EmptyState title="No doctors match" hint="Try another name or department." /></div> : (
        <div className="row g-3">
          {data.items.map((d) => (
            <div className="col-md-6" key={d._id}>
              <label className={`pick ${selected?._id === d._id ? 'selected' : ''}`}>
                <input type="radio" name="doctor" className="form-check-input mt-2" checked={selected?._id === d._id} onChange={() => onSelect(d)} />
                <Avatar name={d.user.name} src={d.user.profileImage} size={52} />
                <span className="flex-grow-1"><strong>{d.user.name}</strong><br /><span className="small text-muted">{d.specialization} • {d.department?.name}<br />{d.experience} yrs • {d.qualification}</span></span>
                <span className="fw-bold">{money(d.consultationFee)}</span>
              </label>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2"><Pagination meta={data?.meta} onPage={setPage} /></div>
    </div>
  );
}

function DoctorSummary({ doctor, onChange }) {
  return (
    <div className="panel panel-body">
      <div className="d-flex gap-3 align-items-center mb-3"><Avatar name={doctor.user.name} src={doctor.user.profileImage} size={56} /><div><div className="fw-bold">{doctor.user.name}</div><div className="small text-muted">{doctor.specialization}</div></div></div>
      <div className="small text-muted mb-1">{doctor.department?.name} • {doctor.qualification}</div>
      <div className="fw-bold mb-2">{money(doctor.consultationFee)} <span className="text-muted fw-normal small">consultation fee</span></div>
      <button className="btn btn-sm btn-light" onClick={onChange}>Change doctor</button>
    </div>
  );
}

function Summary({ doctor, date, time, patient }) {
  return (
    <div className="panel panel-body">
      <h2 className="h6">Appointment summary</h2>
      <dl className="kv mb-0" style={{ gridTemplateColumns: '110px 1fr' }}>
        {[['Doctor', doctor.user.name], ['Department', doctor.department?.name], ['Date', fmtDate(date)], ['Time', to12h(time)], ...(patient ? [['Patient', patient.user.name]] : []), ['Fee', money(doctor.consultationFee)]]
          .map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <div className="small text-muted mt-3">The fee is set by the hospital and confirmed on the server when you book.</div>
    </div>
  );
}

function PatientPicker({ value, onChange, base }) {
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const { data, loading } = useFetch('/receptionist/patients', { search: q || undefined, limit: 5 });
  return (
    <div className="panel panel-body mb-3">
      <div className="d-flex justify-content-between align-items-center"><h2 className="h6 mb-2">Patient</h2><Link to={`${base}/register`} className="small">Register a new patient</Link></div>
      {value ? (
        <div className="d-flex align-items-center justify-content-between"><div><strong>{value.user.name}</strong><div className="small text-muted">{value.patientCode} • {value.user.phone}</div></div><button className="btn btn-sm btn-light" onClick={() => onChange(null)}>Change</button></div>
      ) : (
        <>
          <input className="form-control mb-2" placeholder="Search by name, phone, email or patient ID" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search patients" />
          {loading ? <div className="skel" /> : data?.items.map((p) => (
            <button key={p._id} className="pick w-100 text-start mb-1" onClick={() => onChange(p)}><Avatar name={p.user.name} size={32} /><span><strong>{p.user.name}</strong><br /><span className="small text-muted">{p.patientCode} • {p.user.phone}</span></span></button>
          ))}
          {!loading && !data?.items.length && <div className="small text-muted">No patient found. Register them first.</div>}
        </>
      )}
    </div>
  );
}

function Confirmation({ appt, hospital, base, onPay, busy, onAnother }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const awaiting = appt.paymentMethod === 'Online' && appt.paymentStatus === 'Pending' && appt.appointmentStatus === 'Pending';
  const left = appt.reservationExpiresAt ? Math.max(0, Math.floor((new Date(appt.reservationExpiresAt) - now) / 1000)) : 0;
  return (
    <div className="panel panel-body mx-auto" style={{ maxWidth: 680 }}>
      <div className="text-center mb-3">
        <FiCheckCircle size={44} color={awaiting ? '#a9680b' : '#1c7a3b'} />
        <h1 className="h4 mt-2 mb-1">{awaiting ? 'Slot reserved – complete payment' : appt.appointmentStatus === 'Confirmed' ? 'Appointment confirmed' : 'Appointment requested'}</h1>
        <p className="text-muted mb-0">{awaiting ? (left > 0 ? `Pay within ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} to keep this slot.` : 'The reservation has expired. Please book again.') : appt.appointmentStatus === 'Pending' ? 'The doctor will review your request. You will be notified.' : 'A confirmation has been sent to your notifications and email.'}</p>
      </div>
      <dl className="kv">
        {[['Appointment ID', appt.appointmentCode], ['Patient', appt.patient.user.name], ['Doctor', appt.doctor.user.name], ['Department', appt.department.name], ['Date', fmtDate(appt.appointmentDate)], ['Time', `${to12h(appt.startTime)} – ${to12h(appt.endTime)}`], ['Consultation fee', money(appt.consultationFee)],
          ['Payment status', <StatusBadge key="p" status={appt.paymentStatus} />], ['Appointment status', <StatusBadge key="s" status={appt.appointmentStatus} />]]
          .map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <div className="d-flex gap-2 flex-wrap justify-content-center mt-3">
        {awaiting && left > 0 && <button className="btn btn-primary" onClick={onPay} disabled={busy}>{busy ? 'Opening…' : `Pay ${money(appt.consultationFee)} now`}</button>}
        <Link to={`${base}/appointments`} className="btn btn-outline-primary">View appointments</Link>
        <button className="btn btn-light" onClick={onAnother}>Book another</button>
      </div>
      {hospital?.cancellationDeadlineHours != null && <p className="small text-muted text-center mt-3 mb-0">You can cancel free up to {hospital.cancellationDeadlineHours} hours before the appointment.</p>}
    </div>
  );
}
