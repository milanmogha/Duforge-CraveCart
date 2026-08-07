export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h3>{title}</h3>
          <button className="btn gray sm" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Chip = ({ s }) => <span className={`chip ${s}`}>{String(s).replaceAll('_', ' ')}</span>;
export const Spinner = () => <div className="spinner">Loading…</div>;
export const Empty = ({ icon = '📭', text }) => (
  <div className="empty"><div className="big">{icon}</div><p>{text}</p></div>
);

export function Stat({ label, value, sub }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="muted">{sub}</div>}
    </div>
  );
}

export function BarChart({ data, labelKey = '_id', valueKey = 'total' }) {
  if (!data?.length) return <div className="muted">No data yet.</div>;
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div className="bars" style={{ marginBottom: 26, marginTop: 20 }}>
      {data.map((d, i) => (
        <div key={i} className="bar" style={{ height: `${(d[valueKey] / max) * 100}%` }}>
          <span>{Math.round(d[valueKey])}</span>
          <em>{String(d[labelKey]).slice(5)}</em>
        </div>
      ))}
    </div>
  );
}
