import { useEffect } from 'react';
import useFetch from '../../hooks/useFetch';
import { to12h } from '../../utils/format';
import { ErrorState } from '../common/EmptyState';

/** Loads real slots from the backend for (doctor, date). value = selected startTime ("HH:mm"). */
export default function SlotPicker({ doctorId, date, value, onChange }) {
  const { data, loading, error, reload } = useFetch(doctorId && date ? '/appointments/available-slots' : null, { doctorId, date });

  // If the chosen slot disappears (someone else took it), clear the selection.
  useEffect(() => {
    if (value && data?.slots && !data.slots.find((s) => s.startTime === value && s.available)) onChange('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!date) return <p className="text-muted small mb-0">Choose a date to see available times.</p>;
  if ((loading && !data) || (!data && !error)) return <div className="slot-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skel" style={{ height: 38 }} />)}</div>;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data.bookable) return <div className="alert alert-warning mb-0 py-2">{data.reason}</div>;

  const free = data.slots.filter((s) => s.available).length;
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="small text-muted">{free} of {data.slots.length} slots free • {data.slotDuration} min each</span>
        <button type="button" className="btn btn-sm btn-link p-0" onClick={reload}>Refresh</button>
      </div>
      {free === 0 && <div className="alert alert-warning py-2">{data.reason}</div>}
      <div className="slot-grid" role="listbox" aria-label="Available time slots">
        {data.slots.map((s) => (
          <button key={s.startTime} type="button" role="option" aria-selected={value === s.startTime} className={`slot ${value === s.startTime ? 'selected' : ''}`} disabled={!s.available} onClick={() => onChange(s.startTime, s)}>
            {to12h(s.startTime)}
          </button>
        ))}
      </div>
    </div>
  );
}
