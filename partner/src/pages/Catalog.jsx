import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Spinner, Chip, Modal, Empty } from '../components.jsx';

/* Media picker modal — reusable from the product form. Uploads go through
   /api/upload (recorded in the media library) and existing files can be reused. */
export function MediaPicker({ onPick, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const load = () => api('/partner/media').then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const upload = async (file) => {
    if (!file) return;
    setErr('');
    const fd = new FormData();
    fd.append('image', file);
    try {
      const { url } = await api('/upload', { method: 'POST', formData: fd });
      load();
      if (onPick) onPick(url);
    } catch (e) { setErr(e.message); }
  };

  const del = async (id) => {
    if (!confirm('Remove this file from the library?')) return;
    await api(`/partner/media/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <Modal wide title="Media library" onClose={onClose}>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn sm" onClick={() => fileRef.current?.click()}>⬆ Upload image</button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => upload(e.target.files?.[0])} />
        <span className="muted">Click an image to use it.</span>
      </div>
      {err && <div className="error-text">{err}</div>}
      {!data ? <Spinner /> : data.items.length === 0 ? <Empty icon="🖼️" text="No uploads yet." /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
          {data.items.map((m) => (
            <div key={m._id} style={{ position: 'relative' }}>
              <img
                src={m.url} alt={m.filename}
                title={m.filename}
                style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 9, cursor: 'pointer', border: '1.5px solid var(--line)' }}
                onClick={() => onPick && onPick(m.url)}
              />
              <button
                className="btn danger sm"
                style={{ position: 'absolute', top: 4, right: 4, padding: '0 7px', lineHeight: '20px' }}
                onClick={() => del(m._id)}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

const TAX_EMPTY = { title: '', percentage: '', active: true };
const ATTR_EMPTY = { name: '', values: '', active: true };

export default function Catalog() {
  const [tab, setTab] = useState('taxes');
  const [taxes, setTaxes] = useState(null);
  const [attrs, setAttrs] = useState(null);
  const [tags, setTags] = useState(null);
  const [media, setMedia] = useState(false);
  const [modal, setModal] = useState(null); // { kind: 'tax'|'attr', edit, form }
  const [tagName, setTagName] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    api('/partner/taxes').then((d) => setTaxes(d.items));
    api('/partner/attributes').then((d) => setAttrs(d.items));
    api('/partner/tags').then((d) => setTags(d.items));
  };
  useEffect(() => { load(); }, []);

  const own = (item) => item.partner != null; // globals (admin) are read-only here

  const openTax = (t) => setModal({
    kind: 'tax', edit: t || null,
    form: t ? { title: t.title, percentage: t.percentage, active: t.active } : TAX_EMPTY,
  });
  const openAttr = (a) => setModal({
    kind: 'attr', edit: a || null,
    form: a ? { name: a.name, values: (a.values || []).join(', '), active: a.active } : ATTR_EMPTY,
  });

  const save = async () => {
    setErr('');
    const { kind, edit, form } = modal;
    const path = kind === 'tax' ? 'taxes' : 'attributes';
    const body = kind === 'tax'
      ? { title: form.title, percentage: Number(form.percentage), active: form.active }
      : { name: form.name, values: form.values.split(',').map((v) => v.trim()).filter(Boolean), active: form.active };
    try {
      if (edit) await api(`/partner/${path}/${edit._id}`, { method: 'PUT', body });
      else await api(`/partner/${path}`, { method: 'POST', body });
      setModal(null); load();
    } catch (e) { setErr(e.message); }
  };

  const del = async (path, id) => {
    if (!confirm('Delete this entry?')) return;
    await api(`/partner/${path}/${id}`, { method: 'DELETE' });
    load();
  };

  const addTag = async (e) => {
    e.preventDefault();
    if (!tagName.trim()) return;
    await api('/partner/tags', { method: 'POST', body: { name: tagName } });
    setTagName(''); load();
  };

  if (!taxes || !attrs || !tags) return <Spinner />;

  return (
    <>
      <div className="topbar">
        <h1>Catalog setup</h1>
        <div className="filters">
          {tab === 'taxes' && <button className="btn" onClick={() => openTax()}>+ New tax</button>}
          {tab === 'attributes' && <button className="btn" onClick={() => openAttr()}>+ New attribute</button>}
          {tab === 'media' && <button className="btn" onClick={() => setMedia(true)}>Open library</button>}
        </div>
      </div>

      <div className="tabs">
        {[['taxes', 'Taxes'], ['attributes', 'Attributes'], ['tags', 'Tags'], ['media', 'Media']].map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'taxes' && (
        taxes.length === 0 ? <Empty icon="🧾" text="No taxes yet — create one and pick it on your products." /> : (
          <div className="card">
            <table className="table">
              <thead><tr><th>Title</th><th>Rate</th><th>Scope</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {taxes.map((t) => (
                  <tr key={t._id}>
                    <td><strong>{t.title}</strong></td>
                    <td>{t.percentage}%</td>
                    <td>{own(t) ? 'My store' : <Chip s="active" />}{!own(t) && ' Global'}</td>
                    <td><Chip s={t.active ? 'active' : 'closed'} /></td>
                    <td>{own(t) && (
                      <div className="row">
                        <button className="btn gray sm" onClick={() => openTax(t)}>Edit</button>
                        <button className="btn danger sm" onClick={() => del('taxes', t._id)}>Delete</button>
                      </div>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'attributes' && (
        attrs.length === 0 ? <Empty icon="🎛️" text="No attributes yet — e.g. Size with values Small, Medium, Large." /> : (
          <div className="card">
            <table className="table">
              <thead><tr><th>Attribute</th><th>Values</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {attrs.map((a) => (
                  <tr key={a._id}>
                    <td><strong>{a.name}</strong>{!own(a) && <div className="muted">Global</div>}</td>
                    <td>{(a.values || []).join(' · ')}</td>
                    <td><Chip s={a.active ? 'active' : 'closed'} /></td>
                    <td>{own(a) && (
                      <div className="row">
                        <button className="btn gray sm" onClick={() => openAttr(a)}>Edit</button>
                        <button className="btn danger sm" onClick={() => del('attributes', a._id)}>Delete</button>
                      </div>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'tags' && (
        <div className="card pad">
          <form className="row" style={{ marginBottom: 14 }} onSubmit={addTag}>
            <input placeholder="New tag name…" value={tagName} onChange={(e) => setTagName(e.target.value)}
              style={{ border: '1.5px solid var(--line)', borderRadius: 9, padding: '8px 11px' }} />
            <button className="btn sm">Add tag</button>
          </form>
          {tags.length === 0 ? <Empty icon="🏷️" text="No tags yet." /> : (
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {tags.map((t) => (
                <span key={t._id} className="chip active" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {t.name}
                  {own(t) && <a style={{ cursor: 'pointer', fontWeight: 700 }} onClick={() => del('tags', t._id)}>✕</a>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'media' && (
        <div className="card pad">
          <p className="muted">Your uploaded images. Open the library to upload new files or manage existing ones — you can also browse it straight from the product form.</p>
          <button className="btn" onClick={() => setMedia(true)}>Open media library</button>
        </div>
      )}

      {media && <MediaPicker onClose={() => setMedia(false)} onPick={() => {}} />}

      {modal && (
        <Modal title={modal.edit ? 'Edit' : modal.kind === 'tax' ? 'New tax' : 'New attribute'} onClose={() => setModal(null)}>
          {modal.kind === 'tax' ? (
            <>
              <div className="field"><label>Title</label>
                <input value={modal.form.title} onChange={(e) => setModal({ ...modal, form: { ...modal.form, title: e.target.value } })} placeholder="e.g. GST 5%" />
              </div>
              <div className="field"><label>Percentage</label>
                <input type="number" min="0" step="0.01" value={modal.form.percentage} onChange={(e) => setModal({ ...modal, form: { ...modal.form, percentage: e.target.value } })} />
              </div>
            </>
          ) : (
            <>
              <div className="field"><label>Name</label>
                <input value={modal.form.name} onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })} placeholder="e.g. Size" />
              </div>
              <div className="field"><label>Values (comma-separated)</label>
                <input value={modal.form.values} onChange={(e) => setModal({ ...modal, form: { ...modal.form, values: e.target.value } })} placeholder="Small, Medium, Large" />
              </div>
            </>
          )}
          <div className="field"><label>Status</label>
            <select value={modal.form.active ? '1' : '0'} onChange={(e) => setModal({ ...modal, form: { ...modal.form, active: e.target.value === '1' } })}>
              <option value="1">Active</option><option value="0">Inactive</option>
            </select>
          </div>
          {err && <div className="error-text">{err}</div>}
          <button className="btn block" onClick={save}
            disabled={modal.kind === 'tax' ? !modal.form.title || modal.form.percentage === '' : !modal.form.name}>
            {modal.edit ? 'Save changes' : 'Create'}
          </button>
        </Modal>
      )}
    </>
  );
}
