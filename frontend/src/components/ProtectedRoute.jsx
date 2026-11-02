import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './common/Loader';
import { HOME, LOGIN } from '../utils/format';

/** Wraps role-specific dashboards. Wrong role -> redirected to their own dashboard. */
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session…" />;
  if (!user) return <Navigate to={LOGIN[roles[0]] || '/login'} state={{ from: location.pathname + location.search }} replace />;
  if (!roles.includes(user.role)) return <Navigate to={HOME[user.role]} replace />;
  return children;
}
