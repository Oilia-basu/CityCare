import { useState } from 'react';
import { toast } from 'react-toastify';
import api, { errMsg } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import StatCard from '../../components/common/StatCard';
import { ConfirmModal } from '../../components/common/Modal';
import { FiCheckCircle, FiClock, FiRotateCcw } from 'react-icons/fi';
import { fmtDate, fmtDateTime, money, to12h } from '../../utils/format';

/** Patient: own payment history. Receptionist/Admin: all transactions (admin can refund). */
export default function PaymentsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [refund, setRefund] = useState(null);
  const [busy, setBusy] = useState(false);
  const url = user.role === 'admin' ? '/admin/payments' : '/payments/history';
  const { data, loading, error, reload } = useFetch(url, { page, limit: 10, status: status || undefined, method: method || undefined });

  const doRefund = async () => {
    setBusy(true);
    try { await api.post('/payments/refund', { paymentId: refund._id, reason: 'Refund issued by admin' }); toast.success('Refund processed'); setRefund(null); reload(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const sum = data?.summary;
  const columns = [
    { key: 'a', label: 'Appointment', render: (p) => <><div className="fw-semibold">{p.appointment?.appointmentCode}</div><div className="small text-muted">{fmtDate(p.appointment?.appointmentDate)} {to12h(p.appointment?.startTime)}</div></> },
    ...(user.role !== 'patient' ? [{ key: 'pt', label: 'Patient', render: (p) => p.patient?.user?.name }] : []),
    { key: 'amt', label: 'Amount', render: (p) => <strong>{money(p.amount)}</strong> },
    { key: 'm', label: 'Method', render: (p) => (p.paymentMethod === 'Cash' ? 'At hospital' : 'Online') },
    { key: 's', label: 'Status', render: (p) => <><StatusBadge status={p.paymentStatus} />{p.refundStatus === 'Failed' && <div className="small text-danger">Refund failed</div>}</> },
    { key: 'tx', label: 'Transaction', render: (p) => <span className="small text-muted">{p.transactionId || '—'}<br />{p.paidAt ? fmtDateTime(p.paidAt) : ''}</span> },
    ...(user.role === 'admin' ? [{ key: 'ac', label: '', render: (p) => p.paymentStatus === 'Paid' && <button className="btn btn-sm btn-outline-danger" onClick={() => setRefund(p)}>Refund</button> }] : []),
  ];
  return (
    <>
      <PageHeader title={user.role === 'patient' ? 'Payment history' : 'Payments'} subtitle="Every consultation fee, with its current status." />
      {user.role === 'admin' && sum && (
        <div className="row g-3 mb-3">
          <div className="col-md-4"><StatCard tone="green" icon={<FiCheckCircle />} label={`Collected (${sum.Paid?.count || 0})`} value={money(sum.Paid?.total)} /></div>
          <div className="col-md-4"><StatCard tone="amber" icon={<FiClock />} label={`Awaiting payment (${sum.Pending?.count || 0})`} value={money(sum.Pending?.total)} /></div>
          <div className="col-md-4"><StatCard tone="slate" icon={<FiRotateCcw />} label={`Refunded (${sum.Refunded?.count || 0})`} value={money(sum.Refunded?.total)} /></div>
        </div>)}
      <div className="panel">
        <div className="p-3 d-flex gap-2 flex-wrap">
          <select className="form-select" style={{ maxWidth: 180 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status"><option value="">All statuses</option>{['Pending', 'Paid', 'Failed', 'Refunded'].map((s) => <option key={s}>{s}</option>)}</select>
          <select className="form-select" style={{ maxWidth: 180 }} value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} aria-label="Method"><option value="">All methods</option><option value="Online">Online</option><option value="Cash">At hospital</option></select>
        </div>
        <DataTable columns={columns} rows={data?.items} loading={loading} error={error} onRetry={reload} />
        <Pagination meta={data?.meta} onPage={setPage} />
      </div>
      {refund && <ConfirmModal title="Refund this payment?" danger confirmText={`Refund ${money(refund.amount)}`} busy={busy} onClose={() => setRefund(null)} onConfirm={doRefund}
        message={`${money(refund.amount)} will be returned to ${refund.patient?.user?.name}${refund.paymentMethod === 'Online' ? ' through Razorpay' : ' (cash refund recorded)'}. This cannot be undone.`} />}
    </>
  );
}
