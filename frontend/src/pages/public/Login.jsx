import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api, { errMsg } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { HOME } from '../../utils/format';

const COPY = {
  patient: ['Patient login', 'Welcome back. Log in to manage your appointments.'],
  doctor: ['Doctor login', 'Access your schedule, requests and consultations.'],
  receptionist: ['Receptionist login', 'Front-desk access for registrations and check-ins.'],
  admin: ['Administrator login', 'Restricted area for hospital administrators.'],
};

export default function Login({ portal = 'patient' }) {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={HOME[user.role]} replace />;

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const u = await login(f.email, f.password, portal);
      toast.success(`Welcome, ${u.name.split(' ')[0]}`);
      const from = loc.state?.from;
      nav(from && from.startsWith(HOME[u.role]) ? from : HOME[u.role], { replace: true });
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <div className="auth-wrap"><form className="auth-card" onSubmit={submit}>
      <h1 className="h4">{COPY[portal][0]}</h1><p className="text-muted">{COPY[portal][1]}</p>
      <label className="form-label" htmlFor="l-e">Email</label>
      <input id="l-e" type="email" className="form-control mb-3" autoComplete="username" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <label className="form-label" htmlFor="l-p">Password</label>
      <input id="l-p" type="password" className="form-control mb-2" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <div className="text-end mb-3"><Link to="/forgot-password" className="small">Forgot password?</Link></div>
      <button className="btn btn-primary w-100" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      {portal === 'patient' && <p className="text-center small mt-3 mb-0">New here? <Link to="/register">Create an account</Link></p>}
      {portal !== 'patient' && <p className="text-center small mt-3 mb-0">Not staff? <Link to="/login">Patient login</Link></p>}
    </form></div>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={HOME[user.role]} replace />;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await register(f); toast.success('Account created'); nav('/patient', { replace: true }); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  const s = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="auth-wrap"><form className="auth-card" onSubmit={submit}>
      <h1 className="h4">Create your account</h1><p className="text-muted">Book and manage appointments online.</p>
      <label className="form-label" htmlFor="r-n">Full name</label><input id="r-n" className="form-control mb-3" required value={f.name} onChange={s('name')} autoComplete="name" />
      <label className="form-label" htmlFor="r-e">Email</label><input id="r-e" type="email" className="form-control mb-3" required value={f.email} onChange={s('email')} autoComplete="email" />
      <label className="form-label" htmlFor="r-p">Phone</label><input id="r-p" type="tel" className="form-control mb-3" required value={f.phone} onChange={s('phone')} autoComplete="tel" />
      <label className="form-label" htmlFor="r-w">Password</label><input id="r-w" type="password" className="form-control" required minLength={8} value={f.password} onChange={s('password')} autoComplete="new-password" />
      <div className="form-text mb-3">At least 8 characters, with a letter and a number.</div>
      <button className="btn btn-primary w-100" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      <p className="text-center small mt-3 mb-0">Already registered? <Link to="/login">Log in</Link></p>
    </form></div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await api.post('/auth/forgot-password', { email }); setSent(true); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); } };
  return (
    <div className="auth-wrap"><form className="auth-card" onSubmit={submit}>
      <h1 className="h4">Forgot your password?</h1>
      {sent ? <div className="alert alert-success mt-3">If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in 15 minutes.</div> : <>
        <p className="text-muted">Enter your email and we’ll send a reset link.</p>
        <label className="form-label" htmlFor="f-e">Email</label><input id="f-e" type="email" className="form-control mb-3" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="btn btn-primary w-100" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button></>}
      <p className="text-center small mt-3 mb-0"><Link to="/login">Back to login</Link></p>
    </form></div>
  );
}

export function ResetPassword() {
  const token = new URLSearchParams(useLocation().search).get('token');
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => { e.preventDefault(); setBusy(true); try { await api.post('/auth/reset-password', { token, password }); toast.success('Password updated. Please log in.'); nav('/login'); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); } };
  return (
    <div className="auth-wrap"><form className="auth-card" onSubmit={submit}>
      <h1 className="h4">Choose a new password</h1>
      {!token ? <div className="alert alert-warning mt-3">This link is missing its token. Request a new reset email.</div> : <>
        <label className="form-label mt-3" htmlFor="rp">New password</label><input id="rp" type="password" className="form-control" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <div className="form-text mb-3">At least 8 characters, with a letter and a number.</div>
        <button className="btn btn-primary w-100" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button></>}
      <p className="text-center small mt-3 mb-0"><Link to="/forgot-password">Request a new link</Link></p>
    </form></div>
  );
}
