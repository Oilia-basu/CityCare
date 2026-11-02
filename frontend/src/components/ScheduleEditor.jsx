import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiTrash2 } from 'react-icons/fi';
import { DAYS, fmtDate, todayStr } from '../utils/format';

const blank = (d) => ({ dayOfWeek: d, enabled: d >= 1 && d <= 5, startTime: '09:00', endTime: '13:00', slotDuration: 30, breakStart: '', breakEnd: '', maxPatientsPerDay: 50 });

/** Weekly hours, breaks, blocked dates, leave and "accepting appointments". onSave receives the API payload. */
export default function ScheduleEditor({ schedule = [], blockedDates = [], leaves = [], isAvailable = true, onSave, saving }) {
  const [rows, setRows] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [leave, setLeave] = useState([]);
  const [avail, setAvail] = useState(true);
  const [nb, setNb] = useState({ date: '', reason: '' });
  const [nl, setNl] = useState({ from: '', to: '', reason: '' });

  useEffect(() => {
    setRows(Array.from({ length: 7 }, (_, d) => {
      const s = schedule.find((x) => x.dayOfWeek === d);
      return s ? { dayOfWeek: d, enabled: s.isActive, startTime: s.startTime, endTime: s.endTime, slotDuration: s.slotDuration, breakStart: s.breakStart || '', breakEnd: s.breakEnd || '', maxPatientsPerDay: s.maxPatientsPerDay } : { ...blank(d), enabled: false };
    }));
    setBlocked(blockedDates); setLeave(leaves); setAvail(isAvailable);
  }, [schedule, blockedDates, leaves, isAvailable]);

  const set = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = () => {
    const payload = rows.filter((r) => r.enabled).map((r) => ({ dayOfWeek: r.dayOfWeek, startTime: r.startTime, endTime: r.endTime, slotDuration: Number(r.slotDuration), breakStart: r.breakStart || undefined, breakEnd: r.breakEnd || undefined, maxPatientsPerDay: Number(r.maxPatientsPerDay) || 50, isActive: true }));
    onSave({ schedule: payload, blockedDates: blocked, leaves: leave, isAvailable: avail });
  };

  return (
    <div>
      <div className="panel mb-3">
        <div className="panel-head"><h2>Weekly working hours</h2>
          <div className="form-check form-switch m-0"><input className="form-check-input" type="checkbox" id="acc" checked={avail} onChange={(e) => setAvail(e.target.checked)} /><label className="form-check-label fw-semibold" htmlFor="acc">Accepting appointments</label></div></div>
        <div className="table-responsive"><table className="table">
          <thead><tr><th>Day</th><th>Working</th><th>Start</th><th>End</th><th>Slot (min)</th><th>Break from</th><th>Break to</th><th>Max / day</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.dayOfWeek} style={{ opacity: r.enabled ? 1 : 0.55 }}>
              <td className="fw-semibold">{DAYS[r.dayOfWeek]}</td>
              <td><input type="checkbox" className="form-check-input" checked={r.enabled} onChange={(e) => set(i, { enabled: e.target.checked })} aria-label={`Works on ${DAYS[r.dayOfWeek]}`} /></td>
              <td><input type="time" className="form-control form-control-sm" disabled={!r.enabled} value={r.startTime} onChange={(e) => set(i, { startTime: e.target.value })} /></td>
              <td><input type="time" className="form-control form-control-sm" disabled={!r.enabled} value={r.endTime} onChange={(e) => set(i, { endTime: e.target.value })} /></td>
              <td><input type="number" min="5" max="240" step="5" className="form-control form-control-sm" style={{ width: 80 }} disabled={!r.enabled} value={r.slotDuration} onChange={(e) => set(i, { slotDuration: e.target.value })} /></td>
              <td><input type="time" className="form-control form-control-sm" disabled={!r.enabled} value={r.breakStart} onChange={(e) => set(i, { breakStart: e.target.value })} /></td>
              <td><input type="time" className="form-control form-control-sm" disabled={!r.enabled} value={r.breakEnd} onChange={(e) => set(i, { breakEnd: e.target.value })} /></td>
              <td><input type="number" min="1" className="form-control form-control-sm" style={{ width: 80 }} disabled={!r.enabled} value={r.maxPatientsPerDay} onChange={(e) => set(i, { maxPatientsPerDay: e.target.value })} /></td>
            </tr>))}</tbody></table></div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-6"><div className="panel h-100">
          <div className="panel-head"><h2>Blocked dates</h2></div>
          <div className="panel-body">
            <div className="d-flex gap-2 flex-wrap mb-3">
              <input type="date" className="form-control" style={{ maxWidth: 170 }} min={todayStr()} value={nb.date} onChange={(e) => setNb({ ...nb, date: e.target.value })} aria-label="Date to block" />
              <input className="form-control" style={{ maxWidth: 200 }} placeholder="Reason (optional)" value={nb.reason} onChange={(e) => setNb({ ...nb, reason: e.target.value })} />
              <button className="btn btn-outline-primary" onClick={() => { if (!nb.date) return toast.error('Pick a date'); if (blocked.some((b) => b.date === nb.date)) return toast.error('Already blocked'); setBlocked([...blocked, nb].sort((a, b) => a.date.localeCompare(b.date))); setNb({ date: '', reason: '' }); }}>Block</button>
            </div>
            {!blocked.length && <div className="text-muted small">No blocked dates.</div>}
            {blocked.map((b) => <div key={b.date} className="d-flex justify-content-between align-items-center border-bottom py-2"><span><strong>{fmtDate(b.date)}</strong> <span className="text-muted small">{b.reason}</span></span><button className="btn btn-sm btn-light" aria-label="Remove" onClick={() => setBlocked(blocked.filter((x) => x.date !== b.date))}><FiTrash2 /></button></div>)}
          </div></div></div>
        <div className="col-lg-6"><div className="panel h-100">
          <div className="panel-head"><h2>Leave</h2></div>
          <div className="panel-body">
            <div className="d-flex gap-2 flex-wrap mb-3">
              <input type="date" className="form-control" style={{ maxWidth: 160 }} min={todayStr()} value={nl.from} onChange={(e) => setNl({ ...nl, from: e.target.value })} aria-label="Leave from" />
              <input type="date" className="form-control" style={{ maxWidth: 160 }} min={nl.from || todayStr()} value={nl.to} onChange={(e) => setNl({ ...nl, to: e.target.value })} aria-label="Leave to" />
              <input className="form-control" style={{ maxWidth: 160 }} placeholder="Reason" value={nl.reason} onChange={(e) => setNl({ ...nl, reason: e.target.value })} />
              <button className="btn btn-outline-primary" onClick={() => { if (!nl.from || !nl.to || nl.from > nl.to) return toast.error('Choose a valid date range'); setLeave([...leave, nl]); setNl({ from: '', to: '', reason: '' }); }}>Add</button>
            </div>
            {!leave.length && <div className="text-muted small">No leave planned.</div>}
            {leave.map((l, i) => <div key={i} className="d-flex justify-content-between align-items-center border-bottom py-2"><span><strong>{fmtDate(l.from)} → {fmtDate(l.to)}</strong> <span className="text-muted small">{l.reason}</span></span><button className="btn btn-sm btn-light" aria-label="Remove" onClick={() => setLeave(leave.filter((_, j) => j !== i))}><FiTrash2 /></button></div>)}
          </div></div></div>
      </div>
      <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save schedule'}</button>
      <span className="text-muted small ms-3">Existing appointments are never removed by schedule changes.</span>
    </div>
  );
}
