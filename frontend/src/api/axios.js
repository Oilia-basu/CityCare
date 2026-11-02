// Centralised Axios instance. Cookie-based auth (withCredentials) + global handling of expired sessions.
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

const SILENT = ['/auth/me', '/auth/login', '/auth/register'];

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !SILENT.some((p) => url.startsWith(p))) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    return Promise.reject(error);
  }
);

export const errMsg = (e, fallback = 'Something went wrong. Please try again.') =>
  e?.response?.data?.message || (e?.code === 'ERR_NETWORK' ? 'Cannot reach the server. Check your connection.' : e?.message) || fallback;

export default api;
