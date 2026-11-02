import { Link } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import useFetch from '../../hooks/useFetch';
import { Spinner } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';

export default function Departments() {
  const { data, loading, error, reload } = useFetch('/departments');
  return (
    <div className="container py-5">
      <h1 className="h2 mb-1">Departments</h1><p className="text-muted mb-4">Choose a department to see its doctors.</p>
      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.items.length ? <EmptyState title="No departments yet" /> : (
        <div className="row g-3">{data.items.map((d) => (
          <div className="col-md-6 col-lg-4" key={d._id}><Link to={`/doctors?department=${d._id}`} className="dept-tile">
            {d.image ? <img src={d.image} alt="" className="rounded mb-2" style={{ width: '100%', height: 130, objectFit: 'cover' }} /> : <div className="ico"><FiHeart /></div>}
            <div className="fw-bold">{d.name}</div><div className="small text-muted mb-2">{d.description}</div><div className="small fw-semibold">{d.doctorCount} doctor{d.doctorCount === 1 ? '' : 's'}</div>
          </Link></div>))}</div>)}
    </div>
  );
}
