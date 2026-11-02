export function Spinner({ label = 'Loading…', center = true }) {
  return (
    <div className={center ? 'text-center py-5' : ''} role="status">
      <div className="spinner-border text-primary" style={{ width: 28, height: 28 }} />
      <div className="text-muted small mt-2">{label}</div>
    </div>
  );
}

export function SkeletonRows({ rows = 5, cols = 5 }) {
  return (
    <div className="p-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="d-flex gap-3 mb-3">
          {Array.from({ length: cols }).map((__, j) => <div key={j} className="skel flex-fill" />)}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ n = 4 }) {
  return (
    <div className="row g-3">
      {Array.from({ length: n }).map((_, i) => (
        <div className="col-6 col-lg-3" key={i}><div className="panel p-3"><div className="skel mb-3" style={{ height: 40, width: 40 }} /><div className="skel mb-2" style={{ width: '60%' }} /><div className="skel" style={{ width: '40%' }} /></div></div>
      ))}
    </div>
  );
}
