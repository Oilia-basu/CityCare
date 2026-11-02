import { SkeletonRows } from './Loader';
import { EmptyState, ErrorState } from './EmptyState';

/** columns: [{ key, label, render?(row), className? }] */
export default function DataTable({ columns, rows, loading, error, onRetry, empty, rowKey = '_id' }) {
  if (loading && !rows?.length) return <SkeletonRows cols={Math.min(columns.length, 6)} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!rows?.length) return empty || <EmptyState />;
  return (
    <div className="table-responsive" style={{ opacity: loading ? 0.6 : 1 }}>
      <table className="table">
        <thead><tr>{columns.map((c) => <th key={c.key} className={c.className}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[rowKey]}>
              {columns.map((c) => <td key={c.key} className={c.className}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
