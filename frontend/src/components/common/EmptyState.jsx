import { FiInbox, FiAlertTriangle } from 'react-icons/fi';

export function EmptyState({ title = 'Nothing here yet', hint, action, icon }) {
  return (
    <div className="text-center py-5 px-3">
      <div className="mb-2" style={{ fontSize: 34, color: '#9ab0bb' }}>{icon || <FiInbox />}</div>
      <div className="fw-bold">{title}</div>
      {hint && <div className="text-muted small mt-1">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="text-center py-5 px-3" role="alert">
      <div className="mb-2" style={{ fontSize: 34, color: '#d93636' }}><FiAlertTriangle /></div>
      <div className="fw-bold">We couldn’t load this</div>
      <div className="text-muted small mt-1">{message}</div>
      {onRetry && <button className="btn btn-outline-primary btn-sm mt-3" onClick={onRetry}>Try again</button>}
    </div>
  );
}
