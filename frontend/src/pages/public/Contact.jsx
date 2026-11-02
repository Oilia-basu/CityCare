import { useState } from 'react';
import { toast } from 'react-toastify';
import { FiMail, FiMapPin, FiPhone, FiClock } from 'react-icons/fi';
import api, { errMsg } from '../../api/axios';
import useFetch from '../../hooks/useFetch';

export default function Contact() {
  const { data } = useFetch('/public/hospital');
  const h = data?.hospital;
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.post('/public/contact', f); toast.success(r.data.message); setF({ name: '', email: '', phone: '', message: '' }); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  const info = [[<FiMapPin />, h?.address], [<FiPhone />, h?.phone], [<FiMail />, h?.email], [<FiClock />, h?.workingHours]].filter(([, v]) => v);
  return (
    <div className="container py-5">
      <h1 className="h2 mb-4">Contact us</h1>
      <div className="row g-4">
        <div className="col-lg-5">{info.length ? info.map(([i, v], n) => <div key={n} className="d-flex gap-3 mb-3"><div className="stat-icon tone-teal">{i}</div><div className="align-self-center">{v}</div></div>) : <p className="text-muted">Contact details will be shown here once the hospital adds them in settings.</p>}
          {h?.emergencyNumber && <div className="alert alert-danger">Emergency: <strong>{h.emergencyNumber}</strong></div>}</div>
        <div className="col-lg-7"><form className="panel panel-body" onSubmit={submit}>
          <div className="row g-3">
            <div className="col-md-6"><label className="form-label" htmlFor="c-n">Your name</label><input id="c-n" className="form-control" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div className="col-md-6"><label className="form-label" htmlFor="c-e">Email</label><input id="c-e" type="email" className="form-control" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div className="col-12"><label className="form-label" htmlFor="c-p">Phone (optional)</label><input id="c-p" className="form-control" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div className="col-12"><label className="form-label" htmlFor="c-m">How can we help?</label><textarea id="c-m" rows={5} maxLength={2000} required className="form-control" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
          </div>
          <button className="btn btn-primary mt-3" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
        </form></div>
      </div>
    </div>
  );
}
