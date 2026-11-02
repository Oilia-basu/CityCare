import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import api, { errMsg } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import Avatar from '../../components/common/Avatar';
import { Spinner } from '../../components/common/Loader';

const ENDPOINT = { patient: '/patients/profile', doctor: '/doctors/profile' };

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const role = user.role;
  const { data, loading, reload } = useFetch(ENDPOINT[role] || null);
  const [f, setF] = useState({ name: user.name, phone: user.phone || '' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const p = data?.profile;

  useEffect(() => {
    if (!p) return;
    if (role === 'patient') setF((x) => ({ ...x, dateOfBirth: p.dateOfBirth?.slice(0, 10) || '', gender: p.gender || '', bloodGroup: p.bloodGroup || '', address: p.address || '', medicalHistory: p.medicalHistory || '', allergies: (p.allergies || []).join(', '), ecName: p.emergencyContact?.name || '', ecPhone: p.emergencyContact?.phone || '', ecRelation: p.emergencyContact?.relation || '' }));
    if (role === 'doctor') setF((x) => ({ ...x, biography: p.biography || '', qualification: p.qualification || '', experience: p.experience ?? 0, consultationFee: p.consultationFee ?? 0 }));
  }, [p, role]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const pickFile = (e) => {
    const x = e.target.files[0];
    if (!x) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(x.type)) return toast.error('Choose a JPG, PNG or WEBP image');
    if (x.size > 2 * 1024 * 1024) return toast.error('Image must be 2 MB or smaller');
    setFile(x); setPreview(URL.createObjectURL(x));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!ENDPOINT[role]) await api.put('/auth/profile', { name: f.name, phone: f.phone });
      else {
        const fd = new FormData();
        fd.append('name', f.name); fd.append('phone', f.phone);
        if (file) fd.append('image', file);
        if (role === 'patient') {
          ['dateOfBirth', 'gender', 'bloodGroup', 'address', 'medicalHistory', 'allergies'].forEach((k) => fd.append(k, f[k] ?? ''));
          fd.append('emergencyContact', JSON.stringify({ name: f.ecName, phone: f.ecPhone, relation: f.ecRelation }));
        } else {
          ['biography', 'qualification', 'experience'].forEach((k) => fd.append(k, f[k] ?? ''));
          if (data.canEditFee) fd.append('consultationFee', f.consultationFee);
        }
        await api.put(ENDPOINT[role], fd);
      }
      toast.success('Profile saved'); setFile(null); await refresh(); reload();
    } catch (err) { toast.error(errMsg(err)); } finally { setSaving(false); }
  };

  if (ENDPOINT[role] && loading && !data) return <Spinner />;
  return (
    <>
      <PageHeader title={role === 'admin' || role === 'receptionist' ? 'My account' : 'Profile & settings'} subtitle="Keep your details up to date." />
      <div className="row g-3">
        <div className="col-lg-8">
          <form className="panel panel-body" onSubmit={save}>
            {ENDPOINT[role] && (
              <div className="d-flex align-items-center gap-3 mb-4">
                <Avatar name={user.name} src={preview || user.profileImage} size={72} />
                <div><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickFile} />
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => fileRef.current.click()}>Change photo</button>
                  <div className="small text-muted mt-1">JPG, PNG or WEBP up to 2 MB.</div></div>
              </div>)}
            <div className="row g-3">
              <div className="col-md-6"><label className="form-label" htmlFor="pf-name">Full name</label><input id="pf-name" className="form-control" required value={f.name} onChange={set('name')} /></div>
              <div className="col-md-6"><label className="form-label" htmlFor="pf-phone">Phone</label><input id="pf-phone" className="form-control" value={f.phone} onChange={set('phone')} /></div>
              <div className="col-12"><label className="form-label">Email</label><input className="form-control" value={user.email} disabled /></div>
              {role === 'patient' && <>
                <div className="col-md-4"><label className="form-label" htmlFor="pf-dob">Date of birth</label><input id="pf-dob" type="date" className="form-control" value={f.dateOfBirth || ''} onChange={set('dateOfBirth')} /></div>
                <div className="col-md-4"><label className="form-label" htmlFor="pf-g">Gender</label><select id="pf-g" className="form-select" value={f.gender || ''} onChange={set('gender')}><option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
                <div className="col-md-4"><label className="form-label" htmlFor="pf-b">Blood group</label><select id="pf-b" className="form-select" value={f.bloodGroup || ''} onChange={set('bloodGroup')}><option value="">Unknown</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}</select></div>
                <div className="col-12"><label className="form-label" htmlFor="pf-a">Address</label><input id="pf-a" className="form-control" value={f.address || ''} onChange={set('address')} /></div>
                <div className="col-md-6"><label className="form-label" htmlFor="pf-al">Allergies (comma separated)</label><input id="pf-al" className="form-control" value={f.allergies || ''} onChange={set('allergies')} /></div>
                <div className="col-md-6"><label className="form-label" htmlFor="pf-mh">Medical history</label><input id="pf-mh" className="form-control" value={f.medicalHistory || ''} onChange={set('medicalHistory')} /></div>
                <div className="col-md-4"><label className="form-label" htmlFor="pf-ecn">Emergency contact</label><input id="pf-ecn" className="form-control" value={f.ecName || ''} onChange={set('ecName')} /></div>
                <div className="col-md-4"><label className="form-label" htmlFor="pf-ecp">Their phone</label><input id="pf-ecp" className="form-control" value={f.ecPhone || ''} onChange={set('ecPhone')} /></div>
                <div className="col-md-4"><label className="form-label" htmlFor="pf-ecr">Relation</label><input id="pf-ecr" className="form-control" value={f.ecRelation || ''} onChange={set('ecRelation')} /></div>
                <div className="col-12 small text-muted">Medical details are visible only to you, administrators, and doctors you have booked with.</div>
              </>}
              {role === 'doctor' && <>
                <div className="col-md-6"><label className="form-label">Specialization</label><input className="form-control" value={p?.specialization || ''} disabled /></div>
                <div className="col-md-6"><label className="form-label">Department</label><input className="form-control" value={p?.department?.name || ''} disabled /></div>
                <div className="col-md-6"><label className="form-label" htmlFor="pf-q">Qualification</label><input id="pf-q" className="form-control" value={f.qualification || ''} onChange={set('qualification')} /></div>
                <div className="col-md-3"><label className="form-label" htmlFor="pf-e">Experience (yrs)</label><input id="pf-e" type="number" min="0" className="form-control" value={f.experience ?? 0} onChange={set('experience')} /></div>
                <div className="col-md-3"><label className="form-label" htmlFor="pf-f">Fee (₹)</label><input id="pf-f" type="number" min="0" className="form-control" disabled={!data?.canEditFee} value={f.consultationFee ?? 0} onChange={set('consultationFee')} title={data?.canEditFee ? '' : 'Set by the hospital administrator'} /></div>
                <div className="col-12"><label className="form-label" htmlFor="pf-bio">Biography</label><textarea id="pf-bio" rows={4} maxLength={2000} className="form-control" value={f.biography || ''} onChange={set('biography')} /></div>
                <div className="col-12"><span className={`sbadge ${p?.isVerified ? 'sb-Paid' : 'sb-Pending'}`}>{p?.isVerified ? 'Profile verified' : 'Awaiting admin verification'}</span></div>
              </>}
            </div>
            <button className="btn btn-primary mt-4" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
          </form>
        </div>
        <div className="col-lg-4"><ChangePassword /></div>
      </div>
    </>
  );
}

function ChangePassword() {
  const [f, setF] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.put('/auth/change-password', f); toast.success('Password changed'); setF({ currentPassword: '', newPassword: '' }); } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };
  return (
    <form className="panel panel-body" onSubmit={submit}>
      <h2 className="h6">Change password</h2>
      <label className="form-label" htmlFor="cp-c">Current password</label>
      <input id="cp-c" type="password" className="form-control mb-3" autoComplete="current-password" required value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} />
      <label className="form-label" htmlFor="cp-n">New password</label>
      <input id="cp-n" type="password" className="form-control" autoComplete="new-password" required minLength={8} value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />
      <div className="form-text mb-3">At least 8 characters with a letter and a number.</div>
      <button className="btn btn-outline-primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
    </form>
  );
}
