import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiBell, FiTrash2, FiCheck } from 'react-icons/fi';
import api, { errMsg } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import { SkeletonRows } from '../../components/common/Loader';
import { fmtDateTime } from '../../utils/format';

export default function NotificationsPage({ children }) {
  const ctx = useOutletContext();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, loading, error, reload } = useFetch('/notifications', { page, limit: 15, unread: unreadOnly || undefined });
  const after = () => { reload(); ctx?.refreshUnread?.(); };
  const act = async (fn) => { try { await fn(); after(); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <>
      <PageHeader title="Notifications" subtitle={data ? `${data.unreadCount} unread` : ' '} actions={
        <>
          <button className={`btn ${unreadOnly ? 'btn-primary' : 'btn-light'}`} onClick={() => { setUnreadOnly(!unreadOnly); setPage(1); }}>Unread only</button>
          <button className="btn btn-outline-primary" disabled={!data?.unreadCount} onClick={() => act(() => api.put('/notifications/read-all').then(() => toast.success('All marked as read')))}><FiCheck className="me-1" />Mark all as read</button>
        </>} />
      {children}
      <div className="panel">
        {loading && !data ? <SkeletonRows rows={5} cols={2} /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.items.length ? <EmptyState icon={<FiBell />} title="You’re all caught up" hint="New booking, payment and reminder updates will appear here." /> : data.items.map((n) => (
          <div key={n._id} className="d-flex gap-3 p-3 border-bottom align-items-start" style={{ background: n.isRead ? '#fff' : '#f2f8fc' }}>
            <div className={`stat-icon tone-${n.type === 'cancellation' || n.type === 'payment_failure' ? 'red' : n.type === 'payment_success' || n.type === 'completion' ? 'green' : 'blue'}`} style={{ width: 38, height: 38 }}><FiBell /></div>
            <div className="flex-grow-1">
              <div className="fw-semibold">{n.title}{!n.isRead && <span className="badge bg-primary ms-2">New</span>}</div>
              <div className="small">{n.message}</div>
              <div className="text-muted small">{fmtDateTime(n.createdAt)}</div>
            </div>
            {!n.isRead && <button className="btn btn-sm btn-light" onClick={() => act(() => api.put(`/notifications/${n._id}/read`))}>Mark read</button>}
            <button className="btn btn-sm btn-light" aria-label="Delete notification" onClick={() => act(() => api.delete(`/notifications/${n._id}`))}><FiTrash2 /></button>
          </div>
        ))}
        <Pagination meta={data?.meta} onPage={setPage} />
      </div>
    </>
  );
}
