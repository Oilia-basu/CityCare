import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '../../utils/format';

const COLORS = ['#0e6ba8', '#0fa3a3', '#e39a0b', '#4a3fb0', '#d93636', '#1c7a3b', '#7d95a1', '#a9680b'];
const monthLabel = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });

export function Card({ title, children, height = 260 }) {
  return <div className="panel h-100"><div className="panel-head"><h2>{title}</h2></div><div className="panel-body" style={{ height }}>{children}</div></div>;
}
const none = <div className="text-muted small text-center pt-5">Not enough data yet</div>;

export function MonthlyAppointments({ data }) {
  const d = data.map((x) => ({ ...x, label: monthLabel(x.month) }));
  if (!d.some((x) => x.appointments)) return none;
  return <ResponsiveContainer><BarChart data={d}><CartesianGrid strokeDasharray="3 3" stroke="#e5eef2" /><XAxis dataKey="label" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Legend /><Bar dataKey="completed" name="Completed" stackId="a" fill="#1c7a3b" /><Bar dataKey="cancelled" name="Cancelled" stackId="a" fill="#d93636" /><Bar dataKey="appointments" name="All booked" fill="#0e6ba8" /></BarChart></ResponsiveContainer>;
}
export function RevenueChart({ data }) {
  const d = data.map((x) => ({ ...x, label: monthLabel(x.month) }));
  if (!d.some((x) => x.revenue)) return none;
  return <ResponsiveContainer><LineChart data={d}><CartesianGrid strokeDasharray="3 3" stroke="#e5eef2" /><XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} tickFormatter={(v) => `₹${v >= 1000 ? `${v / 1000}k` : v}`} /><Tooltip formatter={(v) => money(v)} /><Line type="monotone" dataKey="revenue" name="Revenue" stroke="#0fa3a3" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>;
}
export function DailyChart({ data }) {
  if (!data.some((x) => x.appointments)) return none;
  return <ResponsiveContainer><BarChart data={data.map((x) => ({ ...x, label: x.date.slice(5) }))}><CartesianGrid strokeDasharray="3 3" stroke="#e5eef2" /><XAxis dataKey="label" fontSize={11} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Bar dataKey="appointments" name="Appointments" fill="#0e6ba8" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>;
}
export function Donut({ data }) {
  if (!data.length) return none;
  return <ResponsiveContainer><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>;
}
