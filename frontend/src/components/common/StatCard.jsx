export default function StatCard({ icon, label, value, tone = 'blue' }) {
  return (
    <div className="panel stat">
      <div className={`stat-icon tone-${tone}`}>{icon}</div>
      <div>
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
