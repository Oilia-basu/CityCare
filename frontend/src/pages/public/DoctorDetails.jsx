import { Link, useParams } from 'react-router-dom';
import { FaStar } from 'react-icons/fa';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/common/Avatar';
import { Spinner } from '../../components/common/Loader';
import { ErrorState } from '../../components/common/EmptyState';
import { DAYS, money, to12h, fmtDate } from '../../utils/format';

export default function DoctorDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(`/doctors/${id}`);
  if (loading) return <Spinner />;
  if (error) return <div className="container py-5"><ErrorState message={error} onRetry={reload} /></div>;
  const { doctor: d, schedule, reviews } = data;
  const bookLink = user?.role === 'patient' ? `/patient/book?doctor=${d._id}` : user ? `/${user.role}/book?doctor=${d._id}` : '/login';
  return (
    <div className="container py-5">
      <div className="row g-4">
        <div className="col-lg-8">
          <div className="panel panel-body d-flex gap-4 flex-wrap mb-3">
            <Avatar name={d.user.name} src={d.user.profileImage} size={110} />
            <div className="flex-grow-1">
              <h1 className="h3 mb-1">{d.user.name}</h1>
              <div className="text-muted">{d.specialization} • {d.department?.name}</div>
              <div className="my-2 rating"><FaStar style={{ marginTop: -3 }} /> {d.ratingCount ? `${d.averageRating.toFixed(1)} (${d.ratingCount} review${d.ratingCount > 1 ? 's' : ''})` : 'No reviews yet'}</div>
              <div className="small"><strong>{d.qualification}</strong> • {d.experience} years of experience</div>
            </div>
          </div>
          <div className="panel panel-body mb-3"><h2 className="h5">About</h2><p className="mb-0" style={{ whiteSpace: 'pre-line' }}>{d.biography || 'This doctor has not added a biography yet.'}</p></div>
          <div className="panel panel-body"><h2 className="h5">Patient reviews</h2>
            {!reviews.length ? <p className="text-muted mb-0">Reviews appear here after completed consultations.</p> : reviews.map((r) => (
              <div key={r._id} className="border-bottom py-2"><span className="rating">{'★'.repeat(r.rating)}<span style={{ color: '#cfdbe2' }}>{'★'.repeat(5 - r.rating)}</span></span> <strong className="ms-2">{r.patientName}</strong> <span className="text-muted small">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>{r.comment && <div className="small">{r.comment}</div>}</div>))}
          </div>
        </div>
        <div className="col-lg-4">
          <div className="panel panel-body">
            <div className="text-muted small">Consultation fee</div><div className="h3">{money(d.consultationFee)}</div>
            <Link to={bookLink} state={{ from: `/patient/book?doctor=${d._id}` }} className="btn btn-primary w-100 mb-2">Book appointment</Link>
            {!d.isAvailable && <div className="alert alert-warning py-2 small">Currently not accepting new appointments.</div>}
            <h2 className="h6 mt-3">Weekly schedule</h2>
            {!schedule.length ? <p className="small text-muted">Schedule not published yet.</p> : schedule.map((s) => <div key={s._id} className="d-flex justify-content-between small py-1 border-bottom"><span>{DAYS[s.dayOfWeek]}</span><span className="text-muted">{to12h(s.startTime)} – {to12h(s.endTime)}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
