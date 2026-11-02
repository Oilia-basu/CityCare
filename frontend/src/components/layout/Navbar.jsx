import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { HOME } from '../../utils/format';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const links = [['/', 'Home'], ['/about', 'About'], ['/doctors', 'Doctors'], ['/departments', 'Departments'], ['/contact', 'Contact']];
  const close = () => setOpen(false);

  return (
    <header className="site-nav">
      <nav className="container d-flex align-items-center justify-content-between py-2 position-relative" aria-label="Main">
        <Link to="/" className="brand" onClick={close}><span className="brand-mark"><FiPlus /></span>CityCare</Link>
        <button className="btn btn-light d-lg-none" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle menu">☰</button>
        <div className={`site-menu ${open ? 'open' : ''}`}>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} className="nav-link px-lg-2" onClick={close}>{label}</NavLink>
          ))}
          <div className="d-flex gap-2 mt-2 mt-lg-0 ms-lg-2">
            {user ? (
              <>
                <Link to={HOME[user.role]} className="btn btn-primary btn-sm" onClick={close}>My dashboard</Link>
                <button className="btn btn-outline-primary btn-sm" onClick={async () => { await logout(); close(); nav('/'); }}>Log out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-outline-primary btn-sm" onClick={close}>Log in</Link>
                <Link to="/register" className="btn btn-primary btn-sm" onClick={close}>Register</Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
