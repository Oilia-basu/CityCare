import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errMsg } from '../api/axios';

/** GET helper with loading/error state and reload(). `params` changes trigger a refetch. Pass url=null to skip. */
export default function useFetch(url, params, { select = (d) => d.data } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState('');
  const key = JSON.stringify([url, params]);
  const seq = useRef(0);
  const [loadedKey, setLoadedKey] = useState(null);

  const run = useCallback(async () => {
    if (!url) { setLoading(false); return; }
    const id = ++seq.current;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(url, { params });
      if (id === seq.current) setData(select(res.data));
    } catch (e) {
      if (id === seq.current) setError(errMsg(e));
    } finally {
      if (id === seq.current) { setLoading(false); setLoadedKey(key); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { run(); }, [run]);
  // Also report "loading" for the very first render after the url/params change, before the effect has started the request.
  const pending = !!url && loadedKey !== key;
  return { data: pending && !data ? null : data, loading: loading || pending, error: pending ? '' : error, reload: run, setData };
}

export function useDebounce(value, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
