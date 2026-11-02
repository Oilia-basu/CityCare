import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const apply = (d) => { setUser(d?.user || null); setProfile(d?.profile || null); };

  const refresh = useCallback(async () => {
    try { apply((await api.get('/auth/me')).data.data); } catch { apply(null); }
  }, []);

  // Fetch the logged-in user on application start
  useEffect(() => { refresh().finally(() => setLoading(false)); }, [refresh]);

  // Expired session anywhere in the app -> clear state and tell the user
  useEffect(() => {
    const onExpired = () => { setUser((u) => { if (u) toast.info('Your session expired. Please log in again.'); return null; }); setProfile(null); };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = async (email, password, portal) => {
    const d = (await api.post('/auth/login', { email, password, portal })).data.data;
    apply(d);
    return d.user;
  };
  const register = async (form) => {
    const d = (await api.post('/auth/register', form)).data.data;
    apply(d);
    return d.user;
  };
  const logout = async () => {
    try { await api.post('/auth/logout'); } finally { apply(null); }
  };

  const value = useMemo(() => ({ user, profile, loading, login, register, logout, refresh, setUser }), [user, profile, loading, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
