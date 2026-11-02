import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiHeart, FiSearch, FiCalendar, FiCreditCard, FiCheckCircle } from 'react-icons/fi';
import useFetch from '../../hooks/useFetch';
import DoctorCard from '../../components/DoctorCard';
import { Spinner } from '../../components/common/Loader';

export default function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const { data: deps } = useFetch('/departments');
  const { data: docs, loading } = useFetch('/doctors', { sort: 'rating', limit: 4 });
  const { data: info } = useFetch('/public/hospital');
  const h = info?.hospital;

  const go = (e) => { e.preventDefault(); const p = new URLSearchParams(); if (q.trim()) p.set('search', q.trim()); if (dept) p.set('department', dept); nav(`/doctors?${p}`); };

  return (
    <>
      <section className="hero">
        <div className="container py-5">
          <div className="row align-items-center g-5 py-lg-4">
            <div className="col-lg-6">
              <h1>See the right doctor, at a time that suits you.</h1>
              <p className="lead text-muted my-4">Browse verified specialists, pick a free slot and pay securely — no calls, no queues at the counter.</p>
              <div className="d-flex gap-2 flex-wrap">
                <Link to="/doctors" className="btn btn-primary btn-lg">Find a doctor</Link>
                <Link to="/register" className="btn btn-outline-primary btn-lg">Create account</Link>
              </div>
              {h?.emergencyNumber && <p className="mt-4 mb-0 text-muted">Emergency? Call <strong className="text-dark">{h.emergencyNumber}</strong> any time.</p>}
            </div>
            <div className="col-lg-6">
              <form className="finder" onSubmit={go}>
                <h2 className="h5 mb-3">Search for a specialist</h2>
                <label className="form-label" htmlFor="h-q">Doctor name or specialization</label>
                <div className="position-relative mb-3"><FiSearch className="position-absolute" style={{ left: 12, top: 13, color: '#7d95a1' }} /><input id="h-q" className="form-control ps-5" placeholder="e.g. Cardiologist" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                <label className="form-label" htmlFor="h-d">Department</label>
                <select id="h-d" className="form-select mb-3" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">Any department</option>{deps?.items.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select>
                <button className="btn btn-teal w-100 btn-lg">Show available doctors</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="mb-1">Departments</h2><p className="text-muted mb-4">Care across every major specialty.</p>
          {!deps ? <Spinner /> : !deps.items.length ? <p className="text-muted">Departments will appear here once they are added.</p> : (
            <div className="row g-3">{deps.items.map((d) => (
              <div className="col-6 col-md-4 col-lg-3" key={d._id}><Link to={`/doctors?department=${d._id}`} className="dept-tile"><div className="ico"><FiHeart /></div><div className="fw-bold">{d.name}</div><div className="small text-muted">{d.doctorCount} doctor{d.doctorCount === 1 ? '' : 's'}</div></Link></div>
            ))}</div>)}
        </div>
      </section>

      <section className="section bg-mist">
        <div className="container">
          <div className="d-flex justify-content-between align-items-end mb-4"><div><h2 className="mb-1">Top-rated doctors</h2><p className="text-muted mb-0">Rated by patients after their consultations.</p></div><Link to="/doctors">View all</Link></div>
          {loading ? <Spinner /> : !docs?.items.length ? <p className="text-muted">No doctors are listed yet.</p> : (
            <div className="row g-3">{docs.items.map((d) => <div className="col-md-6 col-lg-3" key={d._id}><DoctorCard doctor={d} /></div>)}</div>)}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="mb-4">How booking works</h2>
          <div className="row g-4">
            {[[<FiSearch />, 'Choose a doctor', 'Compare experience, fees and ratings.'], [<FiCalendar />, 'Pick a free slot', 'Only genuinely open times are shown.'], [<FiCreditCard />, 'Pay online or at the hospital', 'Online payments are verified securely.'], [<FiCheckCircle />, 'Get confirmation', 'Notifications and email reminders keep you on track.']].map(([i, t, d], n) => (
              <div className="col-md-6 col-lg-3" key={t}><div className="d-flex gap-3"><div className="stat-icon tone-blue">{i}</div><div><div className="fw-bold">{n + 1}. {t}</div><div className="small text-muted">{d}</div></div></div></div>))}
          </div>
        </div>
      </section>
    </>
  );
}
