import { useEffect, useState } from 'react';
import { api, getToken } from '../api.js';
import { Spinner, Modal, Empty, Chip } from '../components.jsx';

export default function Settings() {
  const [tab, setTab] = useState('general');
  return (
    <>
      <div className="topbar"><h1>Settings</h1></div>
      <div className="tabs">
        {[['general', 'General'], ['auth', 'Authentication'], ['payments', 'Payments'], ['comms', 'Communications'], ['languages', 'Languages'], ['pages', 'Pages'], ['faqs', 'FAQs'], ['apikeys', 'API keys'], ['database', 'Database'], ['audit', 'Audit log']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'general' && <General />}
      {tab === 'auth' && <AuthSettings />}
      {tab === 'payments' && <PaymentSettings />}
      {tab === 'comms' && <CommsSettings />}
      {tab === 'languages' && <Languages />}
      {tab === 'pages' && <Pages />}
      {tab === 'faqs' && <Faqs />}
      {tab === 'apikeys' && <ApiKeys />}
      {tab === 'database' && <DatabaseBackup />}
      {tab === 'audit' && <Audit />}
    </>
  );
}

function General() {
  const [settings, setSettings] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/admin/settings').then((d) => setSettings(d.settings)); }, []);
  if (!settings) return <Spinner />;

  const save = async () => {
    await api('/admin/settings', { method: 'PUT', body: settings });
    setMsg('Settings saved ✓');
    setTimeout(() => setMsg(''), 2500);
  };
  const set = (k) => (e) => setSettings({ ...settings, [k]: e.target.value });

  return (
    <div className="card pad" style={{ maxWidth: 560 }}>
      <div className="field"><label>App name</label><input value={settings.appName || ''} onChange={set('appName')} /></div>
      <div className="field"><label>Currency symbol</label><input value={settings.currency || ''} onChange={set('currency')} /></div>
      <div className="field"><label>Support email</label><input value={settings.supportEmail || ''} onChange={set('supportEmail')} /></div>
      <div className="field"><label>Support phone</label><input value={settings.supportPhone || ''} onChange={set('supportPhone')} /></div>
      <div className="field"><label>Default commission %</label><input type="number" value={settings.defaultCommission || 10} onChange={set('defaultCommission')} /></div>
      <hr className="divider" />
      <h3 style={{ margin: '0 0 4px' }}>Automation</h3>
      <p className="muted">Background jobs run every 5 minutes.</p>
      <div className="form-row">
        <div className="field"><label>Auto-cancel unaccepted orders after (min, 0=off)</label><input type="number" min="0" value={settings.autoCancelMinutes || 0} onChange={set('autoCancelMinutes')} /></div>
        <div className="field"><label>Auto-complete delivered after (days, 0=off)</label><input type="number" min="0" value={settings.autoCompleteDays ?? 3} onChange={set('autoCompleteDays')} /></div>
      </div>
      <div className="field"><label>Return window (days)</label><input type="number" min="0" value={settings.returnWindowDays ?? 7} onChange={set('returnWindowDays')} /></div>
      <hr className="divider" />
      <h3 style={{ margin: '0 0 4px' }}>Referral program</h3>
      <p className="muted">The referrer's wallet is credited when a referred customer's order is delivered. Bonus of 0 disables the program.</p>
      <div className="form-row">
        <div className="field">
          <label>Method</label>
          <select value={settings.referralMethod || 'flat'} onChange={set('referralMethod')}>
            <option value="flat">Flat amount</option>
            <option value="percentage">Percentage of order</option>
          </select>
        </div>
        <div className="field">
          <label>{settings.referralMethod === 'percentage' ? 'Bonus (%)' : 'Bonus amount (₹)'}</label>
          <input type="number" min="0" value={settings.referralAmount || 0} onChange={set('referralAmount')} />
        </div>
      </div>
      <div className="form-row">
        <div className="field"><label>Min. order total (₹)</label><input type="number" min="0" value={settings.referralMinOrder || 0} onChange={set('referralMinOrder')} /></div>
        {settings.referralMethod === 'percentage' && (
          <div className="field"><label>Max bonus per order (₹, 0=uncapped)</label><input type="number" min="0" value={settings.referralMaxAmount || 0} onChange={set('referralMaxAmount')} /></div>
        )}
        <div className="field"><label>Pay out on first N orders</label><input type="number" min="1" value={settings.referralBonusTimes || 1} onChange={set('referralBonusTimes')} /></div>
      </div>
      <hr className="divider" />
      <h3 style={{ margin: '0 0 4px' }}>Web & branding</h3>
      <p className="muted">Served to the storefront via the public home endpoint (v1 web settings).</p>
      <div className="form-row">
        <div className="field"><label>Logo URL</label><input value={settings.webLogo || ''} onChange={set('webLogo')} /></div>
        <div className="field"><label>Favicon URL</label><input value={settings.webFavicon || ''} onChange={set('webFavicon')} /></div>
      </div>
      <div className="field"><label>Landing hero image URL</label><input value={settings.heroImage || ''} onChange={set('heroImage')} /></div>
      <div className="field"><label>Meta description</label><input value={settings.metaDescription || ''} onChange={set('metaDescription')} /></div>
      <hr className="divider" />
      <h3 style={{ margin: '0 0 4px' }}>Cart limits & app version</h3>
      <p className="muted">Cart limits are enforced at checkout (0 = off). Min app version is advisory for the mobile apps.</p>
      <div className="form-row">
        <div className="field"><label>Max items per cart</label><input type="number" min="0" value={settings.maxCartItems || 0} onChange={set('maxCartItems')} /></div>
        <div className="field"><label>Min cart amount (₹)</label><input type="number" min="0" value={settings.minCartAmount || 0} onChange={set('minCartAmount')} /></div>
        <div className="field"><label>Min app version</label><input placeholder="1.0.0" value={settings.minAppVersion || ''} onChange={set('minAppVersion')} /></div>
      </div>
      {msg && <div className="success-text">{msg}</div>}
      <button className="btn" onClick={save}>Save settings</button>
    </div>
  );
}

function PaymentSettings() {
  const [settings, setSettings] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/admin/settings').then((d) => setSettings(d.settings)); }, []);
  if (!settings) return <Spinner />;

  const save = async () => {
    await api('/admin/settings', {
      method: 'PUT',
      body: {
        stripeEnabled: !!settings.stripeEnabled,
        stripePublishableKey: settings.stripePublishableKey || '',
        stripeSecretKey: settings.stripeSecretKey || '',
        stripeWebhookSecret: settings.stripeWebhookSecret || '',
        razorpayEnabled: !!settings.razorpayEnabled,
        razorpayKeyId: settings.razorpayKeyId || '',
        razorpayKeySecret: settings.razorpayKeySecret || '',
        razorpayWebhookSecret: settings.razorpayWebhookSecret || '',
        paypalEnabled: !!settings.paypalEnabled,
        paypalClientId: settings.paypalClientId || '',
        paypalClientSecret: settings.paypalClientSecret || '',
        paypalTestMode: settings.paypalTestMode !== false,
        paypalWebhookId: settings.paypalWebhookId || '',
        paytmEnabled: !!settings.paytmEnabled,
        paytmMid: settings.paytmMid || '',
        paytmMerchantKey: settings.paytmMerchantKey || '',
        paytmWebsite: settings.paytmWebsite || '',
        paytmTestMode: settings.paytmTestMode !== false,
        flutterwaveEnabled: !!settings.flutterwaveEnabled,
        flutterwaveSecretKey: settings.flutterwaveSecretKey || '',
        flutterwaveSecretHash: settings.flutterwaveSecretHash || '',
        midtransEnabled: !!settings.midtransEnabled,
        midtransServerKey: settings.midtransServerKey || '',
        midtransClientKey: settings.midtransClientKey || '',
        midtransTestMode: settings.midtransTestMode !== false,
        phonepeEnabled: !!settings.phonepeEnabled,
        phonepeMerchantId: settings.phonepeMerchantId || '',
        phonepeSaltKey: settings.phonepeSaltKey || '',
        phonepeSaltIndex: settings.phonepeSaltIndex || '1',
        phonepeTestMode: settings.phonepeTestMode !== false,
        currencyCode: settings.currencyCode || 'INR',
      },
    });
    setMsg('Payment settings saved ✓');
    setTimeout(() => setMsg(''), 2500);
  };
  const set = (k) => (e) =>
    setSettings({ ...settings, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      <div className="card pad">
        <div className="spread">
          <h3 style={{ margin: 0 }}>Stripe</h3>
          <label className="row" style={{ fontWeight: 600 }}>
            <input type="checkbox" checked={!!settings.stripeEnabled} onChange={set('stripeEnabled')} /> Enabled
          </label>
        </div>
        <p className="muted">Hosted Checkout (cards, Apple/Google Pay). Get keys at dashboard.stripe.com — use test keys (pk_test…/sk_test…) first.</p>
        <div className="field"><label>Publishable key</label><input value={settings.stripePublishableKey || ''} onChange={set('stripePublishableKey')} placeholder="pk_test_…" /></div>
        <div className="field"><label>Secret key</label><input type="password" value={settings.stripeSecretKey || ''} onChange={set('stripeSecretKey')} placeholder="sk_test_…" /></div>
        <div className="field"><label>Webhook signing secret</label><input type="password" value={settings.stripeWebhookSecret || ''} onChange={set('stripeWebhookSecret')} placeholder="whsec_…" /><small className="muted">Required for the webhook. Until it is set, <code>/api/payments/webhook/stripe</code> rejects everything — an unsigned webhook can&apos;t be told apart from a forged one. Checkout still works without it.</small></div>
        <p className="muted" style={{ fontSize: 12 }}>Webhook URL: <code>/api/payments/webhook/stripe</code> · event: checkout.session.completed</p>
      </div>
      <div>
        <div className="card pad" style={{ marginBottom: 16 }}>
          <div className="spread">
            <h3 style={{ margin: 0 }}>Razorpay</h3>
            <label className="row" style={{ fontWeight: 600 }}>
              <input type="checkbox" checked={!!settings.razorpayEnabled} onChange={set('razorpayEnabled')} /> Enabled
            </label>
          </div>
          <p className="muted">In-page checkout (UPI, cards, netbanking, wallets). Keys at dashboard.razorpay.com — use rzp_test… keys first.</p>
          <div className="field"><label>Key ID</label><input value={settings.razorpayKeyId || ''} onChange={set('razorpayKeyId')} placeholder="rzp_test_…" /></div>
          <div className="field"><label>Key secret</label><input type="password" value={settings.razorpayKeySecret || ''} onChange={set('razorpayKeySecret')} /></div>
          <div className="field"><label>Webhook secret</label><input type="password" value={settings.razorpayWebhookSecret || ''} onChange={set('razorpayWebhookSecret')} /><small className="muted">Required for the webhook. Until it is set, <code>/api/payments/webhook/razorpay</code> rejects everything. Checkout still works without it.</small></div>
          <p className="muted" style={{ fontSize: 12 }}>Webhook URL: <code>/api/payments/webhook/razorpay</code> · event: payment.captured</p>
        </div>
        <div className="card pad">
          <div className="field"><label>Currency code</label><input value={settings.currencyCode || 'INR'} onChange={set('currencyCode')} placeholder="INR" /></div>
        </div>
        {msg && <div className="success-text">{msg}</div>}
        <button className="btn" style={{ marginTop: 12 }} onClick={save}>Save payment settings</button>
      </div>

      <div className="card pad">
        <div className="spread">
          <h3 style={{ margin: 0 }}>PayPal</h3>
          <label className="row" style={{ fontWeight: 600 }}>
            <input type="checkbox" checked={!!settings.paypalEnabled} onChange={set('paypalEnabled')} /> Enabled
          </label>
        </div>
        <p className="muted">Redirect approval flow (Orders v2). Credentials at developer.paypal.com — sandbox first.</p>
        <div className="field"><label>Client ID</label><input value={settings.paypalClientId || ''} onChange={set('paypalClientId')} /></div>
        <div className="field"><label>Client secret</label><input type="password" value={settings.paypalClientSecret || ''} onChange={set('paypalClientSecret')} /></div>
        <div className="field"><label>Webhook ID</label><input value={settings.paypalWebhookId || ''} onChange={set('paypalWebhookId')} placeholder="from the PayPal dashboard" /><small className="muted">Required for the webhook (<code>/api/payments/webhook/paypal</code>). PayPal has no shared secret — it verifies against this subscription id.</small></div>
        <label className="row" style={{ fontWeight: 600 }}>
          <input type="checkbox" checked={settings.paypalTestMode !== false} onChange={set('paypalTestMode')} /> Sandbox mode
        </label>
      </div>

      <div className="card pad">
        <div className="spread">
          <h3 style={{ margin: 0 }}>Paytm</h3>
          <label className="row" style={{ fontWeight: 600 }}>
            <input type="checkbox" checked={!!settings.paytmEnabled} onChange={set('paytmEnabled')} /> Enabled
          </label>
        </div>
        <p className="muted">Hosted payment page (wallet, UPI, cards). MID + merchant key from dashboard.paytm.com.</p>
        <div className="field"><label>Merchant ID (MID)</label><input value={settings.paytmMid || ''} onChange={set('paytmMid')} /></div>
        <div className="field"><label>Merchant key</label><input type="password" value={settings.paytmMerchantKey || ''} onChange={set('paytmMerchantKey')} /></div>
        <div className="field"><label>Website name</label><input value={settings.paytmWebsite || ''} onChange={set('paytmWebsite')} placeholder="WEBSTAGING (test) / DEFAULT (live)" /></div>
        <label className="row" style={{ fontWeight: 600 }}>
          <input type="checkbox" checked={settings.paytmTestMode !== false} onChange={set('paytmTestMode')} /> Staging gateway
        </label>
      </div>

      <div className="card pad">
        <div className="spread">
          <h3 style={{ margin: 0 }}>Flutterwave</h3>
          <label className="row" style={{ fontWeight: 600 }}>
            <input type="checkbox" checked={!!settings.flutterwaveEnabled} onChange={set('flutterwaveEnabled')} /> Enabled
          </label>
        </div>
        <p className="muted">Hosted standard checkout. Secret key from dashboard.flutterwave.com (test keys start FLWSECK_TEST).</p>
        <div className="field"><label>Secret key</label><input type="password" value={settings.flutterwaveSecretKey || ''} onChange={set('flutterwaveSecretKey')} placeholder="FLWSECK_TEST-…" /></div>
        <div className="field"><label>Webhook secret hash</label><input type="password" value={settings.flutterwaveSecretHash || ''} onChange={set('flutterwaveSecretHash')} placeholder="the hash you set in the FLW dashboard" /></div>
      </div>

      <div className="card pad">
        <div className="spread">
          <h3 style={{ margin: 0 }}>Midtrans</h3>
          <label className="row" style={{ fontWeight: 600 }}>
            <input type="checkbox" checked={!!settings.midtransEnabled} onChange={set('midtransEnabled')} /> Enabled
          </label>
        </div>
        <p className="muted">Snap hosted checkout (Indonesia). Keys from dashboard.midtrans.com. Webhook: <code>/api/payments/webhook/midtrans</code></p>
        <div className="field"><label>Server key</label><input type="password" value={settings.midtransServerKey || ''} onChange={set('midtransServerKey')} placeholder="SB-Mid-server-…" /></div>
        <div className="field"><label>Client key</label><input value={settings.midtransClientKey || ''} onChange={set('midtransClientKey')} placeholder="SB-Mid-client-…" /></div>
        <label className="row"><input type="checkbox" checked={settings.midtransTestMode !== false} onChange={set('midtransTestMode')} /> Sandbox mode</label>
      </div>

      <div className="card pad">
        <div className="spread">
          <h3 style={{ margin: 0 }}>PhonePe</h3>
          <label className="row" style={{ fontWeight: 600 }}>
            <input type="checkbox" checked={!!settings.phonepeEnabled} onChange={set('phonepeEnabled')} /> Enabled
          </label>
        </div>
        <p className="muted">Hosted PAY_PAGE (India). Credentials from the PhonePe merchant dashboard. Webhook: <code>/api/payments/webhook/phonepe</code></p>
        <div className="field"><label>Merchant ID</label><input value={settings.phonepeMerchantId || ''} onChange={set('phonepeMerchantId')} placeholder="PGTESTPAYUAT" /></div>
        <div className="field"><label>Salt key</label><input type="password" value={settings.phonepeSaltKey || ''} onChange={set('phonepeSaltKey')} /></div>
        <div className="field"><label>Salt index</label><input value={settings.phonepeSaltIndex || '1'} onChange={set('phonepeSaltIndex')} placeholder="1" /></div>
        <label className="row"><input type="checkbox" checked={settings.phonepeTestMode !== false} onChange={set('phonepeTestMode')} /> Sandbox mode</label>
      </div>
    </div>
  );
}

// v1 parity: admin/Authentication_settings.php — how (and whether) a phone number is
// proven before an account is created.
function AuthSettings() {
  const [settings, setSettings] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/admin/settings').then((d) => setSettings(d.settings)); }, []);
  if (!settings) return <Spinner />;

  const method = settings.authenticationMethod || 'none';
  const save = async () => {
    await api('/admin/settings', {
      method: 'PUT',
      body: {
        authenticationMethod: method,
        otpExpirySeconds: Number(settings.otpExpirySeconds) || 60,
      },
    });
    setMsg('Authentication settings saved ✓');
    setTimeout(() => setMsg(''), 2500);
  };

  return (
    <div className="card pad" style={{ maxWidth: 640 }}>
      <h3 style={{ marginTop: 0 }}>Phone verification</h3>
      <p className="muted">
        Controls whether signup requires a verified phone number (v1 <code>authentication_settings</code>).
      </p>

      <div className="field">
        <label>Method</label>
        <select
          value={method}
          onChange={(e) => setSettings({ ...settings, authenticationMethod: e.target.value })}
        >
          <option value="none">None — no phone check at signup</option>
          <option value="sms">SMS OTP — we send and verify the code</option>
          <option value="firebase">Firebase — the app verifies the phone itself</option>
        </select>
      </div>

      {method === 'sms' && (
        <>
          <div className="field">
            <label>OTP validity (seconds)</label>
            <input
              type="number"
              min="30"
              value={settings.otpExpirySeconds || 60}
              onChange={(e) => setSettings({ ...settings, otpExpirySeconds: e.target.value })}
            />
          </div>
          <p className="muted">
            Codes go out over the SMS gateway configured under <strong>Communications</strong>. While that
            is set to "None (dev mode)" the code is returned in the API response instead of being sent,
            so signup still works for testing.
          </p>
        </>
      )}

      <button className="btn" onClick={save}>Save</button>
      {msg && <span className="ok" style={{ marginLeft: 12 }}>{msg}</span>}
    </div>
  );
}

function CommsSettings() {
  const [settings, setSettings] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/admin/settings').then((d) => setSettings(d.settings)); }, []);
  if (!settings) return <Spinner />;

  const save = async () => {
    await api('/admin/settings', {
      method: 'PUT',
      body: {
        smsProvider: settings.smsProvider || 'none',
        twilioSid: settings.twilioSid || '',
        twilioToken: settings.twilioToken || '',
        twilioFrom: settings.twilioFrom || '',
        fast2smsKey: settings.fast2smsKey || '',
        smtpHost: settings.smtpHost || '',
        smtpPort: settings.smtpPort || '',
        smtpUser: settings.smtpUser || '',
        smtpPass: settings.smtpPass || '',
        smtpFrom: settings.smtpFrom || '',
        fcmServiceAccount: settings.fcmServiceAccount || '',
      },
    });
    setMsg('Communication settings saved ✓');
    setTimeout(() => setMsg(''), 2500);
  };
  const set = (k) => (e) => setSettings({ ...settings, [k]: e.target.value });

  return (
    <div className="grid cols-2" style={{ alignItems: 'start' }}>
      <div className="card pad">
        <h3 style={{ marginTop: 0 }}>SMS gateway</h3>
        <p className="muted">Used for OTPs (password reset, verification). While set to "None (dev mode)", OTP codes are shown in the app for testing.</p>
        <div className="field"><label>Provider</label>
          <select value={settings.smsProvider || 'none'} onChange={set('smsProvider')}>
            <option value="none">None (dev mode — OTP shown in app)</option>
            <option value="twilio">Twilio</option>
            <option value="fast2sms">Fast2SMS</option>
          </select>
        </div>
        {settings.smsProvider === 'twilio' && (
          <>
            <div className="field"><label>Account SID</label><input value={settings.twilioSid || ''} onChange={set('twilioSid')} /></div>
            <div className="field"><label>Auth token</label><input type="password" value={settings.twilioToken || ''} onChange={set('twilioToken')} /></div>
            <div className="field"><label>From number</label><input value={settings.twilioFrom || ''} onChange={set('twilioFrom')} placeholder="+1…" /></div>
          </>
        )}
        {settings.smsProvider === 'fast2sms' && (
          <div className="field"><label>API key</label><input type="password" value={settings.fast2smsKey || ''} onChange={set('fast2smsKey')} /></div>
        )}
      </div>
      <div>
        <div className="card pad" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Email (SMTP)</h3>
          <p className="muted">Password resets and transactional emails. Leave empty for dev mode (logged only).</p>
          <div className="form-row">
            <div className="field"><label>Host</label><input value={settings.smtpHost || ''} onChange={set('smtpHost')} placeholder="smtp.gmail.com" /></div>
            <div className="field"><label>Port</label><input value={settings.smtpPort || ''} onChange={set('smtpPort')} placeholder="587" /></div>
          </div>
          <div className="field"><label>Username</label><input value={settings.smtpUser || ''} onChange={set('smtpUser')} /></div>
          <div className="field"><label>Password</label><input type="password" value={settings.smtpPass || ''} onChange={set('smtpPass')} /></div>
          <div className="field"><label>From</label><input value={settings.smtpFrom || ''} onChange={set('smtpFrom')} placeholder="DapiGO <no-reply@dapigo.com>" /></div>
        </div>
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Push notifications (FCM)</h3>
          <p className="muted">Paste the Firebase service-account JSON (Project settings → Service accounts → Generate key). Every in-app notification is then also pushed to registered devices.</p>
          <div className="field"><label>Service account JSON</label>
            <textarea rows={5} value={settings.fcmServiceAccount || ''} onChange={set('fcmServiceAccount')} placeholder='{"type":"service_account", …}' />
          </div>
        </div>
        {msg && <div className="success-text">{msg}</div>}
        <button className="btn" style={{ marginTop: 12 }} onClick={save}>Save communication settings</button>
      </div>
    </div>
  );
}

function Languages() {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', nativeName: '', rtl: false });
  const [editing, setEditing] = useState(null); // language being string-edited
  const [strings, setStrings] = useState({});
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => api('/admin/languages').then((d) => setItems(d.items));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    // new languages start from the English pack so nothing is missing
    const en = (items || []).find((l) => l.code === 'en');
    await api('/admin/languages', { method: 'POST', body: { ...form, code: form.code.trim().toLowerCase(), strings: en?.strings || {}, active: false } });
    setForm({ code: '', name: '', nativeName: '', rtl: false });
    load();
  };
  const update = async (id, body) => { await api(`/admin/languages/${id}`, { method: 'PUT', body }); load(); };
  const openEditor = (l) => { setEditing(l); setStrings({ ...(l.strings || {}) }); setFilter(''); setMsg(''); };
  const saveStrings = async () => {
    await api(`/admin/languages/${editing._id}`, { method: 'PUT', body: { strings } });
    setMsg('Strings saved ✓'); setTimeout(() => setMsg(''), 2000);
    load();
  };

  if (!items) return <Spinner />;
  const keys = Object.keys(strings).filter((k) => !filter || k.includes(filter.toLowerCase()) || (strings[k] || '').toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <div className="card pad" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Add language</h3>
        <p className="muted">New languages copy the English pack — translate strings in the editor. Customers see active languages in the storefront picker.</p>
        <div className="filters">
          <input style={{ width: 90 }} placeholder="Code (fr)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input placeholder="Name (French)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Native (Français)" value={form.nativeName} onChange={(e) => setForm({ ...form, nativeName: e.target.value })} />
          <label className="row" style={{ fontWeight: 600 }}>
            <input type="checkbox" checked={form.rtl} onChange={(e) => setForm({ ...form, rtl: e.target.checked })} /> RTL
          </label>
          <button className="btn sm" onClick={add} disabled={!form.code.trim() || !form.name.trim()}>+ Add</button>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Language</th><th>Code</th><th>Direction</th><th>Keys</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {items.map((l) => (
              <tr key={l._id}>
                <td><strong>{l.name}</strong>{l.nativeName ? <div className="muted">{l.nativeName}</div> : null}</td>
                <td>{l.code}</td>
                <td>{l.rtl ? 'RTL' : 'LTR'}</td>
                <td>{Object.keys(l.strings || {}).length}</td>
                <td><Chip s={l.active ? 'active' : 'suspended'} /></td>
                <td>
                  <div className="row">
                    <button className="btn gray sm" onClick={() => openEditor(l)}>Edit strings</button>
                    <button className="btn gray sm" onClick={() => update(l._id, { active: !l.active })}>{l.active ? 'Disable' : 'Enable'}</button>
                    {l.code !== 'en' && <button className="btn danger sm" onClick={async () => { if (confirm(`Delete ${l.name}?`)) { await api(`/admin/languages/${l._id}`, { method: 'DELETE' }); load(); } }}>Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal wide title={`Strings — ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="filters" style={{ marginBottom: 10 }}>
            <input placeholder="Filter keys or text…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: 1 }} />
            {msg && <span className="success-text" style={{ margin: 0 }}>{msg}</span>}
            <button className="btn sm" onClick={saveStrings}>Save</button>
          </div>
          <div style={{ maxHeight: '55vh', overflow: 'auto' }}>
            {keys.map((k) => (
              <div key={k} className="row" style={{ padding: '4px 0', gap: 10 }}>
                <code style={{ width: 220, flexShrink: 0, fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={k}>{k}</code>
                <input value={strings[k] || ''} onChange={(e) => setStrings({ ...strings, [k]: e.target.value })}
                  style={{ flex: 1, border: '1.5px solid var(--line)', borderRadius: 8, padding: '5px 9px', fontSize: 13.5 }} />
              </div>
            ))}
            {keys.length === 0 && <Empty text="No keys match." />}
          </div>
        </Modal>
      )}
    </>
  );
}

function Pages() {
  const [pages, setPages] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => api('/admin/pages').then((d) => setPages(d.pages));
  useEffect(() => { load(); }, []);
  if (!pages) return <Spinner />;

  const save = async () => {
    await api(`/admin/pages/${edit.slug}`, { method: 'PUT', body: { title: edit.title, content: edit.content } });
    setEdit(null); load();
  };

  return (
    <>
      <div className="grid cols-3">
        {pages.map((p) => (
          <div key={p._id} className="card pad">
            <strong>{p.title}</strong>
            <div className="muted">/{p.slug}</div>
            <button className="btn gray sm" style={{ marginTop: 10 }} onClick={() => setEdit({ ...p })}>Edit</button>
          </div>
        ))}
      </div>
      {edit && (
        <Modal wide title={`Edit: ${edit.slug}`} onClose={() => setEdit(null)}>
          <div className="field"><label>Title</label><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
          <div className="field"><label>Content</label><textarea rows={10} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} /></div>
          <button className="btn" onClick={save}>Save page</button>
        </Modal>
      )}
    </>
  );
}

function Faqs() {
  const [faqs, setFaqs] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '' });
  const load = () => api('/admin/faqs').then((d) => setFaqs(d.faqs));
  useEffect(() => { load(); }, []);
  if (!faqs) return <Spinner />;

  const save = async () => { await api('/admin/faqs', { method: 'POST', body: form }); setModal(false); setForm({ question: '', answer: '' }); load(); };
  const del = async (id) => { await api(`/admin/faqs/${id}`, { method: 'DELETE' }); load(); };

  return (
    <>
      <button className="btn" style={{ marginBottom: 14 }} onClick={() => setModal(true)}>+ New FAQ</button>
      {faqs.length === 0 ? <Empty text="No FAQs." /> : faqs.map((f) => (
        <div key={f._id} className="card pad spread" style={{ marginBottom: 10 }}>
          <div>
            <strong>{f.question}</strong>
            <div className="muted">{f.answer}</div>
          </div>
          <button className="btn danger sm" onClick={() => del(f._id)}>Delete</button>
        </div>
      ))}
      {modal && (
        <Modal title="New FAQ" onClose={() => setModal(false)}>
          <div className="field"><label>Question</label><input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
          <div className="field"><label>Answer</label><textarea rows={3} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></div>
          <button className="btn block" onClick={save} disabled={!form.question || !form.answer}>Save FAQ</button>
        </Modal>
      )}
    </>
  );
}

// v1 parity: Client_api_keys.php — named secrets + a copyable 30-min JWT preview.
function ApiKeys() {
  const [keys, setKeys] = useState(null);
  const [name, setName] = useState('');
  const [token, setToken] = useState(null); // { id, token }
  const [err, setErr] = useState('');

  const load = () => api('/admin/api-keys').then((d) => setKeys(d.keys));
  useEffect(() => { load(); }, []);
  if (!keys) return <Spinner />;

  const add = async () => {
    setErr('');
    try { await api('/admin/api-keys', { method: 'POST', body: { name } }); setName(''); load(); }
    catch (e) { setErr(e.message); }
  };
  const toggle = async (k) => {
    await api(`/admin/api-keys/${k._id}`, { method: 'PUT', body: { active: !k.active } });
    load();
  };
  const del = async (k) => {
    if (!confirm(`Delete API key "${k.name}"? Integrations using it will stop working.`)) return;
    await api(`/admin/api-keys/${k._id}`, { method: 'DELETE' });
    load();
  };
  const preview = async (k) => {
    setErr('');
    try {
      const d = await api(`/admin/api-keys/${k._id}/token`);
      setToken({ id: k._id, token: d.token });
    } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <div className="card pad" style={{ maxWidth: 560, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>New client API key</h3>
        <p className="muted">External clients sign JWTs with the generated secret. The secret is fixed for the key's lifetime.</p>
        <div className="row">
          <input placeholder="Client name" value={name} onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, border: '1.5px solid var(--line)', borderRadius: 9, padding: '8px 11px' }} />
          <button className="btn sm" onClick={add} disabled={!name.trim()}>Create key</button>
        </div>
        {err && <div className="error-text">{err}</div>}
      </div>
      {keys.length === 0 ? <Empty icon="🔑" text="No client API keys yet." /> : (
        <div className="card">
          <table className="table">
            <thead><tr><th>Client</th><th>Secret</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k._id}>
                  <td><strong>{k.name}</strong></td>
                  <td>
                    <code style={{ fontSize: 12 }}>{k.secret}</code>
                    {token?.id === k._id && (
                      <div className="muted" style={{ fontSize: 11, marginTop: 4, wordBreak: 'break-all' }}>
                        <strong>Test JWT (30 min):</strong> <code>{token.token}</code>
                      </div>
                    )}
                  </td>
                  <td><Chip s={k.active ? 'active' : 'closed'} /></td>
                  <td className="muted">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      <button className="btn gray sm" onClick={() => preview(k)}>Test token</button>
                      <button className="btn gray sm" onClick={() => toggle(k)}>{k.active ? 'Disable' : 'Enable'}</button>
                      <button className="btn danger sm" onClick={() => del(k)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// v1 parity: Database_bakup.php — pick collections, download a gzipped JSON archive.
function DatabaseBackup() {
  const [collections, setCollections] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { api('/admin/backup/collections').then((d) => setCollections(d.collections)); }, []);
  if (!collections) return <Spinner />;

  const toggle = (name) => {
    const next = new Set(picked);
    next.has(name) ? next.delete(name) : next.add(name);
    setPicked(next);
  };

  const download = async () => {
    setErr(''); setBusy(true);
    try {
      const q = picked.size ? `?collections=${[...picked].join(',')}` : '';
      const res = await fetch(`/api/admin/backup${q}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(`Backup failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (res.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1] || 'dapigo-backup.json.gz';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="card pad" style={{ maxWidth: 640 }}>
      <h3 style={{ marginTop: 0 }}>Database backup</h3>
      <p className="muted">
        Downloads the selected collections as a gzipped JSON archive (all collections when none are selected).
        Restore with any Mongo import tooling.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 4, margin: '10px 0' }}>
        {collections.map((c) => (
          <label key={c.name} className="row" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={picked.has(c.name)} onChange={() => toggle(c.name)} />
            {c.name} <span className="muted">({c.count})</span>
          </label>
        ))}
      </div>
      {err && <div className="error-text">{err}</div>}
      <button className="btn" onClick={download} disabled={busy}>
        {busy ? 'Preparing…' : picked.size ? `Download ${picked.size} collection(s)` : 'Download full backup'}
      </button>
    </div>
  );
}

function Audit() {
  const [logs, setLogs] = useState(null);
  useEffect(() => { api('/admin/audit').then((d) => setLogs(d.logs)); }, []);
  if (!logs) return <Spinner />;
  return logs.length === 0 ? <Empty text="No admin actions logged yet." /> : (
    <div className="card">
      <table className="table">
        <thead><tr><th>Admin</th><th>Action</th><th>Resource</th><th>When</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l._id}>
              <td>{l.actor?.name}</td>
              <td>{l.action}</td>
              <td>{l.resource} <span className="muted">{l.resourceId?.slice(-6)}</span></td>
              <td className="muted">{new Date(l.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
