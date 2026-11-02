import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';

export default function About() {
  const { data } = useFetch('/public/hospital');
  const h = data?.hospital;
  return (
    <div className="container py-5" style={{ maxWidth: 820 }}>
      <h1 className="h2 mb-3">About {h?.name || 'our hospital'}</h1>
      <p className="lead">{h?.about || 'We bring patients, doctors and front-desk teams onto one platform so that booking a visit is quick and care starts on time.'}</p>
      <div className="row g-3 my-3">
        {[['Verified doctors', 'Every doctor is checked by our administrators before patients can book.'], ['Reliable booking', 'Slots are reserved instantly, so two patients can never hold the same time.'], ['Secure payments', 'Online payments are verified on our servers; you can also pay at the hospital.']].map(([t, d]) => (
          <div className="col-md-4" key={t}><div className="panel panel-body h-100"><div className="fw-bold mb-1">{t}</div><div className="small text-muted">{d}</div></div></div>))}
      </div>
      {h?.workingHours && <p><strong>Hours:</strong> {h.workingHours}</p>}
      <Link to="/doctors" className="btn btn-primary">Find a doctor</Link>
    </div>
  );
}
