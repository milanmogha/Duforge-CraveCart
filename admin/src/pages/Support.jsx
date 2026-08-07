import { useEffect, useState } from 'react';
import { api, dt } from '../api.js';
import { Spinner, Chip, Empty } from '../components.jsx';

export default function Support() {
  const [tab, setTab] = useState('tickets');
  return (
    <>
      <div className="topbar"><h1>Support</h1></div>
      <div className="tabs">
        <button className={tab === 'tickets' ? 'on' : ''} onClick={() => setTab('tickets')}>Tickets</button>
        <button className={tab === 'reviews' ? 'on' : ''} onClick={() => setTab('reviews')}>Review moderation</button>
      </div>
      {tab === 'tickets' ? <Tickets /> : <Reviews />}
    </>
  );
}

function Tickets() {
  const [tickets, setTickets] = useState(null);
  const [open, setOpen] = useState(null);
  const [reply, setReply] = useState('');

  const load = () => api('/support/tickets?all=true').then((d) => setTickets(d.tickets));
  useEffect(() => { load(); }, []);

  const view = async (id) => { const d = await api(`/support/tickets/${id}`); setOpen(d.ticket); };
  const send = async () => {
    const d = await api(`/support/tickets/${open._id}/reply`, { method: 'POST', body: { message: reply } });
    setOpen(d.ticket); setReply(''); load();
  };
  const setStatus = async (status) => {
    await api(`/support/tickets/${open._id}/status`, { method: 'PUT', body: { status } });
    view(open._id); load();
  };

  if (!tickets) return <Spinner />;

  if (open) {
    return (
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', alignItems: 'start' }}>
        <div className="card pad">
          <button className="btn gray sm" onClick={() => setOpen(null)}>← All tickets</button>
          <h3 style={{ margin: '12px 0 2px' }}>{open.subject}</h3>
          <div className="muted">{open.user?.name} ({open.user?.email}) · {open.type} · {open.priority} priority</div>
          <hr className="divider" />
          {open.messages.map((m) => (
            <div key={m._id} style={{ marginBottom: 12, textAlign: m.senderRole === 'admin' ? 'right' : 'left' }}>
              <div className="card" style={{ display: 'inline-block', padding: '10px 14px', background: m.senderRole === 'admin' ? 'var(--brand-light)' : '#fff', maxWidth: '82%', textAlign: 'left' }}>
                <div className="muted" style={{ fontSize: 12 }}>{m.senderRole === 'admin' ? 'You (support)' : m.sender?.name || 'User'} · {dt(m.createdAt)}</div>
                {m.message}
              </div>
            </div>
          ))}
          {open.status !== 'closed' && (
            <div className="row" style={{ marginTop: 10 }}>
              <input className="card" style={{ padding: '9px 12px', flex: 1, border: '1.5px solid var(--line)' }} placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} />
              <button className="btn sm" onClick={send} disabled={!reply}>Reply</button>
            </div>
          )}
        </div>
        <div className="card pad">
          <h4 style={{ marginTop: 0 }}>Status: <Chip s={open.status} /></h4>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {['in_progress', 'resolved', 'closed'].map((s) => (
              <button key={s} className="btn gray sm" onClick={() => setStatus(s)}>{s.replaceAll('_', ' ')}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return tickets.length === 0 ? <Empty text="No tickets." /> : (
    <div className="card">
      <table className="table">
        <thead><tr><th>Subject</th><th>User</th><th>Type</th><th>Priority</th><th>Status</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t._id}>
              <td><strong>{t.subject}</strong></td>
              <td>{t.user?.name}<div className="muted">{t.user?.role}</div></td>
              <td>{t.type}</td>
              <td>{t.priority}</td>
              <td><Chip s={t.status} /></td>
              <td className="muted">{dt(t.updatedAt)}</td>
              <td><button className="btn gray sm" onClick={() => view(t._id)}>Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Reviews() {
  const [reviews, setReviews] = useState(null);
  const load = () => api('/admin/reviews').then((d) => setReviews(d.reviews));
  useEffect(() => { load(); }, []);
  const toggle = async (r) => { await api(`/admin/reviews/${r._id}`, { method: 'PUT', body: { hidden: !r.hidden } }); load(); };

  if (!reviews) return <Spinner />;
  return reviews.length === 0 ? <Empty text="No reviews yet." /> : (
    <div className="card">
      <table className="table">
        <thead><tr><th>By</th><th>Target</th><th>Rating</th><th>Comment</th><th>Visibility</th><th></th></tr></thead>
        <tbody>
          {reviews.map((r) => (
            <tr key={r._id}>
              <td>{r.user?.name}</td>
              <td>{r.target}: {r.product?.title || r.partner?.partnerProfile?.storeName || '—'}</td>
              <td>{'★'.repeat(r.rating)}</td>
              <td>{r.comment || <span className="muted">—</span>}</td>
              <td><Chip s={r.hidden ? 'suspended' : 'active'} /></td>
              <td><button className="btn gray sm" onClick={() => toggle(r)}>{r.hidden ? 'Show' : 'Hide'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
