import { useEffect, useState } from 'react';
import { api, money, dt } from '../api.js';
import { Spinner, Chip, Modal, Empty } from '../components.jsx';

export default function Users() {
  const [role, setRole] = useState('partner');
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const [reason, setReason] = useState('');
  const [adminModal, setAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });
  const [adminErr, setAdminErr] = useState('');

  const load = () => {
    const q = new URLSearchParams({ role, page });
    if (search) q.set('search', search);
    api(`/admin/users?${q}`).then(setData);
  };
  useEffect(load, [role, page]);

  const update = async (id, body) => {
    await api(`/admin/users/${id}`, { method: 'PUT', body });
    setOpen(null); setReason('');
    load();
  };

  const kycOf = (u) => u.partnerProfile?.kycStatus || u.riderProfile?.kycStatus;

  return (
    <>
      <div className="topbar">
        <h1>Users & KYC</h1>
        <div className="filters">
          <input placeholder="Search name/email…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
          {role === 'admin' && <button className="btn" onClick={() => { setAdminForm({ name: '', email: '', password: '' }); setAdminErr(''); setAdminModal(true); }}>+ New admin</button>}
        </div>
      </div>
      {adminModal && (
        <Modal title="New system admin" onClose={() => setAdminModal(false)}>
          <p className="muted">Creates a full-access admin account (v1: System users).</p>
          <div className="field"><label>Name</label><input value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} /></div>
          <div className="field"><label>Email</label><input type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} /></div>
          <div className="field"><label>Password</label><input type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} /></div>
          {adminErr && <div className="error-text">{adminErr}</div>}
          <button className="btn block" disabled={!adminForm.name || !adminForm.email || adminForm.password.length < 6}
            onClick={async () => {
              try {
                await api('/admin/system-users', { method: 'POST', body: adminForm });
                setAdminModal(false); load();
              } catch (e) { setAdminErr(e.message); }
            }}
          >Create admin</button>
        </Modal>
      )}
      <div className="tabs">
        {['partner', 'rider', 'customer', 'admin'].map((r) => (
          <button key={r} className={role === r ? 'on' : ''} onClick={() => { setRole(r); setPage(1); }}>
            {r.charAt(0).toUpperCase() + r.slice(1)}s
          </button>
        ))}
      </div>
      {!data ? <Spinner /> : data.users.length === 0 ? <Empty text="No users." /> : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th><th>Email / phone</th>
                {role === 'partner' && <th>Store</th>}
                {role === 'rider' && <th>Vehicle</th>}
                {(role === 'partner' || role === 'rider') && <th>KYC</th>}
                <th>Wallet</th><th>Status</th><th>Joined</th><th></th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u._id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}<div className="muted">{u.phone}</div></td>
                  {role === 'partner' && <td>{u.partnerProfile?.storeName}<div className="muted">{u.partnerProfile?.city} · {u.partnerProfile?.commissionPercent}% comm.</div></td>}
                  {role === 'rider' && (
                    <td>
                      {u.riderProfile?.vehicleType} {u.riderProfile?.vehicleNumber}
                      <div className="muted">
                        COD held {money(u.riderProfile?.codHeld || 0)}
                        {(u.riderProfile?.codHeld || 0) > 0 && (
                          <button
                            className="btn sm"
                            style={{ marginLeft: 8, padding: '1px 8px', fontSize: 12 }}
                            onClick={async () => {
                              const amount = prompt(`Collect how much? (holds ${money(u.riderProfile.codHeld)})`, u.riderProfile.codHeld);
                              if (!amount) return;
                              try {
                                await api(`/admin/riders/${u._id}/collect-cash`, { method: 'POST', body: { amount: Number(amount) } });
                                load();
                              } catch (e) { alert(e.message); }
                            }}
                          >Collect</button>
                        )}
                      </div>
                    </td>
                  )}
                  {(role === 'partner' || role === 'rider') && <td><Chip s={kycOf(u) || 'pending'} /></td>}
                  <td>{money(u.walletBalance)}</td>
                  <td><Chip s={u.status} /></td>
                  <td className="muted">{dt(u.createdAt)}</td>
                  <td><button className="btn gray sm" onClick={() => setOpen(u)}>Manage</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal title={`Manage ${open.name}`} onClose={() => setOpen(null)}>
          <div className="muted">{open.email} · {open.role}</div>
          {(open.role === 'partner' || open.role === 'rider') && kycOf(open) !== 'approved' && (
            <>
              <hr className="divider" />
              <h4 style={{ margin: '0 0 8px' }}>KYC review</h4>
              <div className="field">
                <label>Rejection reason (only if rejecting)</label>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. document unclear" />
              </div>
              <div className="row">
                <button className="btn green" onClick={() => update(open._id, { kycStatus: 'approved' })}>✓ Approve</button>
                <button className="btn danger" onClick={() => update(open._id, { kycStatus: 'rejected', kycRejectReason: reason })}>✗ Reject</button>
              </div>
            </>
          )}
          {open.role === 'partner' && (
            <>
              <hr className="divider" />
              <div className="field">
                <label>Commission percent</label>
                <input type="number" defaultValue={open.partnerProfile?.commissionPercent} id="comm-input" />
              </div>
              <button className="btn sm" onClick={() => update(open._id, { commissionPercent: document.getElementById('comm-input').value })}>Save commission</button>
            </>
          )}
          <hr className="divider" />
          <h4 style={{ margin: '0 0 8px' }}>Account status</h4>
          <div className="row">
            {open.status !== 'active' && <button className="btn green sm" onClick={() => update(open._id, { status: 'active' })}>Activate</button>}
            {open.status !== 'suspended' && <button className="btn danger sm" onClick={() => update(open._id, { status: 'suspended' })}>Suspend</button>}
          </div>
        </Modal>
      )}
    </>
  );
}
