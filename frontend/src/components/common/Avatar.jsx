import { initials } from '../../utils/format';

export default function Avatar({ name, src, size = 40 }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (src) return <img src={src} alt={name || 'Profile'} className="avatar" style={style} />;
  return <span className="avatar" style={style} aria-hidden="true">{initials(name) || '?'}</span>;
}
