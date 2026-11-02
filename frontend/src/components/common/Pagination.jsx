export default function Pagination({ meta, onPage }) {
  if (!meta || meta.pages <= 1) return null;
  const { page, pages, total } = meta;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
  return (
    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 p-3 border-top">
      <span className="text-muted small">{total} result{total === 1 ? '' : 's'} • page {page} of {pages}</span>
      <nav aria-label="Pagination">
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item ${page === 1 ? 'disabled' : ''}`}><button className="page-link" onClick={() => onPage(page - 1)}>Previous</button></li>
          {nums.map((n) => <li key={n} className={`page-item ${n === page ? 'active' : ''}`}><button className="page-link" onClick={() => onPage(n)}>{n}</button></li>)}
          <li className={`page-item ${page === pages ? 'disabled' : ''}`}><button className="page-link" onClick={() => onPage(page + 1)}>Next</button></li>
        </ul>
      </nav>
    </div>
  );
}
