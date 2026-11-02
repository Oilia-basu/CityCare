export default function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`sbadge sb-${status}`}>{status}</span>;
}
