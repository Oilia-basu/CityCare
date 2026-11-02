import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useFetch, { useDebounce } from '../../hooks/useFetch';
import DoctorCard from '../../components/DoctorCard';
import Pagination from '../../components/common/Pagination';
import { Spinner } from '../../components/common/Loader';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';

export default function Doctors() {
  const [sp, setSp] = useSearchParams();
  const [search, setSearch] = useState(sp.get('search') || '');
  const q = useDebounce(search);
  const dept = sp.get('department') || '';
  const spec = sp.get('specialization') || '';
  const sort = sp.get('sort') || '';
  const [page, setPage] = useState(1);
  const setParam = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); setPage(1); };
  const { data: deps } = useFetch('/departments');
  const { data, loading, error, reload } = useFetch('/doctors', { search: q || undefined, department: dept || undefined, specialization: spec || undefined, sort: sort || undefined, page, limit: 12 });

  return (
    <div className="container py-5">
      <h1 className="h2 mb-1">Our doctors</h1><p className="text-muted mb-4">Every doctor listed here has been verified by the hospital.</p>
      <div className="row g-2 mb-4">
        <div className="col-lg-4"><input className="form-control" placeholder="Search by name or specialization" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search doctors" /></div>
        <div className="col-6 col-lg-3"><select className="form-select" value={dept} onChange={(e) => setParam('department', e.target.value)} aria-label="Department"><option value="">All departments</option>{deps?.items.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
        <div className="col-6 col-lg-3"><select className="form-select" value={spec} onChange={(e) => setParam('specialization', e.target.value)} aria-label="Specialization"><option value="">All specializations</option>{data?.specializations.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="col-12 col-lg-2"><select className="form-select" value={sort} onChange={(e) => setParam('sort', e.target.value)} aria-label="Sort"><option value="">Newest</option><option value="rating">Top rated</option><option value="experience">Most experienced</option><option value="fee_asc">Fee: low to high</option><option value="fee_desc">Fee: high to low</option></select></div>
      </div>
      {loading && !data ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : !data.items.length ? <EmptyState title="No doctors found" hint="Try removing a filter or searching by another name." /> : (
        <>
          <div className="row g-3">{data.items.map((d) => <div className="col-md-6 col-lg-4" key={d._id}><DoctorCard doctor={d} bookTo={(x) => `/patient/book?doctor=${x._id}`} /></div>)}</div>
          <div className="mt-3"><Pagination meta={data.meta} onPage={setPage} /></div>
        </>)}
    </div>
  );
}
