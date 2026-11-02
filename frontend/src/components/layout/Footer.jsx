import { Link } from 'react-router-dom';
import useFetch from '../../hooks/useFetch';

export default function Footer() {
  const { data } = useFetch('/public/hospital');
  const h = data?.hospital;
  return (
    <footer className="footer">
      <div className="container">
        <div className="row g-4">
          <div className="col-md-5">
            <div className="h5 text-white">{h?.name || 'CityCare Hospital'}</div>
            <p className="small mb-1">{h?.about || 'Book appointments with verified doctors, pay securely and manage your visits in one place.'}</p>
            {h?.emergencyNumber && <p className="small mb-0">Emergency: <strong className="text-white">{h.emergencyNumber}</strong></p>}
          </div>
          <div className="col-6 col-md-3">
            <div className="fw-bold text-white mb-2">Explore</div>
            <ul className="list-unstyled small mb-0">
              <li><Link to="/doctors">Find a doctor</Link></li>
              <li><Link to="/departments">Departments</Link></li>
              <li><Link to="/about">About us</Link></li>
              <li><Link to="/contact">Contact</Link></li>
            </ul>
          </div>
          <div className="col-6 col-md-4">
            <div className="fw-bold text-white mb-2">Staff portals</div>
            <ul className="list-unstyled small mb-0">
              <li><Link to="/doctor/login">Doctor login</Link></li>
              <li><Link to="/receptionist/login">Receptionist login</Link></li>
              <li><Link to="/admin/login">Admin login</Link></li>
            </ul>
          </div>
        </div>
        <hr className="border-secondary mt-4" />
        <div className="small">© {new Date().getFullYear()} {h?.name || 'CityCare Hospital'}. {h?.workingHours}</div>
      </div>
    </footer>
  );
}
