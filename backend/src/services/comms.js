// Communication channels (v1 parity: Sms_gateway_settings.php, Email_settings.php,
// FCM push). Everything is driven by Settings keys and degrades to "dev mode"
// (console log, OTP returned in API responses) until credentials are configured —
// wire now, add keys later.
//
// Settings keys:
//   SMS   — smsProvider ('none'|'twilio'|'fast2sms'), twilioSid, twilioToken,
//           twilioFrom, fast2smsKey
//   Email — smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom
//   Push  — fcmServiceAccount (paste the service-account JSON)
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { Setting } from '../models/Misc.js';

async function settings(keys) {
  const rows = await Setting.find({ key: { $in: keys } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ---------- SMS ----------

/**
 * Send an SMS. Returns { sent: boolean, dev: boolean }.
 * dev=true means no gateway is configured — callers may fall back to exposing
 * demo OTPs like before.
 */
export async function sendSMS(phone, message) {
  const s = await settings(['smsProvider', 'twilioSid', 'twilioToken', 'twilioFrom', 'fast2smsKey']);
  const provider = s.smsProvider || 'none';
  try {
    if (provider === 'twilio' && s.twilioSid && s.twilioToken) {
      const auth = Buffer.from(`${s.twilioSid}:${s.twilioToken}`).toString('base64');
      const body = new URLSearchParams({ To: phone.startsWith('+') ? phone : `+91${phone}`, From: s.twilioFrom || '', Body: message });
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${s.twilioSid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!r.ok) throw new Error(`Twilio ${r.status}: ${await r.text()}`);
      return { sent: true, dev: false };
    }
    if (provider === 'fast2sms' && s.fast2smsKey) {
      const r = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { authorization: s.fast2smsKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: 'q', message, numbers: phone.replace(/^\+?91/, '') }),
      });
      if (!r.ok) throw new Error(`Fast2SMS ${r.status}`);
      return { sent: true, dev: false };
    }
  } catch (e) {
    console.error(`[sms] send failed (${provider}):`, e.message);
    return { sent: false, dev: false };
  }
  console.log(`[sms:dev] to ${phone}: ${message}`);
  return { sent: false, dev: true };
}

// ---------- Email ----------

/** Send an email. Returns { sent, dev }. dev=true → SMTP not configured (logged only). */
export async function sendEmail(to, subject, html) {
  const s = await settings(['smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'smtpFrom']);
  if (!s.smtpHost || !s.smtpUser) {
    console.log(`[email:dev] to ${to}: ${subject}`);
    return { sent: false, dev: true };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: s.smtpHost,
      port: Number(s.smtpPort) || 587,
      secure: Number(s.smtpPort) === 465,
      auth: { user: s.smtpUser, pass: s.smtpPass },
    });
    await transporter.sendMail({
      from: s.smtpFrom || `DapiGO <${s.smtpUser}>`,
      to, subject, html,
    });
    return { sent: true, dev: false };
  } catch (e) {
    console.error('[email] send failed:', e.message);
    return { sent: false, dev: false };
  }
}

/** Tiny branded wrapper for transactional mails. */
export const emailTemplate = (title, bodyHtml) => `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
    <div style="background:#00b3a6;color:#fff;padding:16px 22px;font-size:19px;font-weight:700">DapiGO</div>
    <div style="padding:22px">
      <h2 style="margin:0 0 10px;color:#292929">${title}</h2>
      ${bodyHtml}
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">Food, groceries and essentials — delivered fast.</p>
    </div>
  </div>`;

// ---------- FCM push (HTTP v1, no firebase-admin dependency) ----------

let fcmTokenCache = { token: null, exp: 0, projectId: null };

async function fcmAccessToken() {
  const s = await settings(['fcmServiceAccount']);
  if (!s.fcmServiceAccount) return null;
  let sa;
  try { sa = typeof s.fcmServiceAccount === 'string' ? JSON.parse(s.fcmServiceAccount) : s.fcmServiceAccount; }
  catch { console.error('[push] fcmServiceAccount is not valid JSON'); return null; }
  if (!sa.client_email || !sa.private_key || !sa.project_id) return null;

  if (fcmTokenCache.token && Date.now() < fcmTokenCache.exp - 60000) {
    return { token: fcmTokenCache.token, projectId: fcmTokenCache.projectId };
  }
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: 'RS256' }
  );
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!r.ok) { console.error('[push] token exchange failed:', await r.text()); return null; }
  const data = await r.json();
  fcmTokenCache = { token: data.access_token, exp: Date.now() + data.expires_in * 1000, projectId: sa.project_id };
  return { token: data.access_token, projectId: sa.project_id };
}

/**
 * Push a notification to a user's registered device tokens.
 * Silently no-ops when FCM isn't configured. Removes tokens FCM reports dead.
 */
export async function sendPush(user, title, body, data = {}) {
  const tokens = user?.fcmTokens || [];
  if (!tokens.length) return { sent: 0, dev: false };
  const auth = await fcmAccessToken();
  if (!auth) {
    console.log(`[push:dev] to ${user.email || user._id}: ${title}`);
    return { sent: 0, dev: true };
  }
  let sent = 0;
  const dead = [];
  for (const token of tokens) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
        },
      }),
    });
    if (r.ok) sent += 1;
    else if ([400, 404].includes(r.status)) dead.push(token);
  }
  if (dead.length && user.constructor?.updateOne) {
    await user.constructor.updateOne({ _id: user._id }, { $pull: { fcmTokens: { $in: dead } } }).catch(() => {});
  }
  return { sent, dev: false };
}

// ---------- OTP helper ----------

export function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}
