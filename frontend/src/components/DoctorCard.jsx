import { Link } from 'react-router-dom';
import { FiAward, FiBriefcase } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import Avatar from './common/Avatar';
import { DAYS_SHORT, money } from '../utils/format';

export default function DoctorCard({ doctor, bookTo }) {
  const name = doctor.user?.name;
  return (
    <div className="doc-card">
      <div className="doc-top">
        <Avatar name={name} src={doctor.user?.profileImage} size={64} />
        <div className="min-w-0">
          <Link to={`/doctors/${doctor._id}`} className="fw-bold fs-6 text-reset d-block">{name}</Link>
          <div className="text-muted small">{doctor.specialization}</div>
          <div className="small"><span className="rating"><FaStar style={{ marginTop: -3 }} /> {doctor.ratingCount ? doctor.averageRating.toFixed(1) : 'New'}</span>{doctor.ratingCount > 0 && <span className="text-muted"> ({doctor.ratingCount})</span>}</div>
        </div>
      </div>
      <div className="doc-body small">
        <div className="mb-1"><FiBriefcase className="me-1 text-muted" />{doctor.department?.name} • {doctor.experience} yr{doctor.experience === 1 ? '' : 's'} experience</div>
        <div className="mb-2"><FiAward className="me-1 text-muted" />{doctor.qualification}</div>
        <div className="text-muted">{doctor.availableDays?.length ? doctor.availableDays.map((d) => DAYS_SHORT[d]).join(' · ') : 'Schedule not set'}</div>
      </div>
      <div className="doc-foot">
        <div><div className="fw-bold">{money(doctor.consultationFee)}</div><div className="text-muted small">per consultation</div></div>
        <Link to={bookTo ? bookTo(doctor) : `/doctors/${doctor._id}`} className="btn btn-primary btn-sm">Book appointment</Link>
      </div>
    </div>
  );
}
