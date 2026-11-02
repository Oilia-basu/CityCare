import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

export default function Modal({ title, onClose, children, footer, size, busy }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose, busy]);

  return (
    <div className="modal-backdrop-custom" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={`modal-card ${size === 'lg' ? 'lg' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mh">
          <h3>{title}</h3>
          <button className="btn btn-sm btn-light" onClick={onClose} disabled={busy} aria-label="Close"><FiX /></button>
        </div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, message, confirmText = 'Confirm', danger, onConfirm, onClose, busy, children }) {
  return (
    <Modal title={title} onClose={onClose} busy={busy} footer={
      <>
        <button className="btn btn-light" onClick={onClose} disabled={busy}>Keep as is</button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmText}
        </button>
      </>
    }>
      <p className="mb-0">{message}</p>
      {children}
    </Modal>
  );
}
