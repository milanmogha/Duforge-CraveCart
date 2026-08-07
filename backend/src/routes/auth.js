import { Router } from 'express';
import User from '../models/User.js';
import { Otp, Setting } from '../models/Misc.js';
import { protect, signToken } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';
import { slugify } from '../utils/helpers.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, changePasswordSchema } from '../utils/validators.js';
import { sendSMS, sendEmail, emailTemplate, generateOTP } from '../services/comms.js';

const router = Router();

// POST /api/auth/register  { name, email, phone, password, role?, storeName?, vehicleType? }
router.post(
  '/register',
  validate(registerSchema),
  asyncH(async (req, res) => {
    const { name, email, phone, password, role = 'customer', referralCode } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }
    if (!['customer', 'partner', 'rider'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ message: 'Email already registered' });

    // v1 gated register_user behind verify_user → verify_otp. Claim that proof here:
    // the phone must carry a consumed, unexpired signup OTP. Under 'firebase' the client
    // already proved the phone; under 'none' there is no gate at all.
    const { method } = await authMode();
    let phoneVerified = false;
    if (method === 'sms') {
      if (!phone) return res.status(400).json({ message: 'phone is required' });
      const proof = await Otp.findOne({
        phone,
        purpose: 'signup',
        consumedAt: { $ne: null },
        expiresAt: { $gt: new Date(Date.now() - 15 * 60 * 1000) }, // grace window to finish the form
      });
      if (!proof) {
        return res.status(400).json({ message: 'Verify your phone number before registering' });
      }
      await Otp.deleteOne({ _id: proof._id }); // single-use
      phoneVerified = true;
    } else if (method === 'firebase') {
      phoneVerified = !!phone;
    }

    const data = {
      name,
      email,
      phone,
      phoneVerified,
      password,
      role,
      referralCode: `${slugify(name).slice(0, 6).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`,
    };
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) data.referredBy = referrer._id;
    }
    if (role === 'partner') {
      data.partnerProfile = {
        storeName: req.body.storeName || `${name}'s Store`,
        slug: slugify(req.body.storeName || name) + '-' + Date.now().toString(36),
        city: req.body.city || '',
        address: req.body.address || '',
        kycStatus: 'pending',
      };
    }
    if (role === 'rider') {
      data.riderProfile = {
        vehicleType: req.body.vehicleType || 'bike',
        vehicleNumber: req.body.vehicleNumber || '',
        city: req.body.city || '',
        kycStatus: 'pending',
      };
    }
    const user = await User.create(data);
    res.status(201).json({ token: signToken(user), user: user.toSafe() });
  })
);

// ---------------------------------------------------------------------------
// Phone verification (v1: verify_user / verify_otp / resend_otp / get_login_identity)
//
// v1 kept an `otps` table keyed by mobile and gated registration on it, with the
// channel chosen by authentication_settings.authentication_method:
//   'sms'      — we mint + send the code and verify it ourselves
//   'firebase' — the client runs Firebase phone auth; the server just says "go ahead"
//   'none'     — no phone gate (v2 default, so demo/seed logins keep working)
// The mode lives in the `authenticationMethod` Setting (Admin → Settings → Authentication).
// ---------------------------------------------------------------------------

const OTP_DEFAULT_TTL = 60; // seconds — v1's checkOTPExpiration() window
const MAX_OTP_ATTEMPTS = 5;

async function authMode() {
  const s = await Setting.findOne({ key: 'authenticationMethod' }).lean();
  const ttl = await Setting.findOne({ key: 'otpExpirySeconds' }).lean();
  return {
    method: s?.value || 'none',
    ttl: Number(ttl?.value) > 0 ? Number(ttl.value) : OTP_DEFAULT_TTL,
  };
}

/** Mint a code for this phone, replacing any live one (v1 overwrote the row). */
async function issueOtp(phone, purpose, ttl) {
  const code = generateOTP();
  await Otp.deleteMany({ phone, purpose });
  await Otp.create({ phone, code, purpose, expiresAt: new Date(Date.now() + ttl * 1000) });
  const sms = await sendSMS(phone, `Your DapiGO verification code is ${code}. Valid for ${Math.round(ttl / 60) || 1} minute(s).`);
  // Demo fallback mirrors forgot-password: only leak the code when nothing could deliver it.
  return { code, delivered: sms.sent };
}

// GET /api/auth/config — what signup clients need to know before they render the form.
router.get(
  '/config',
  asyncH(async (req, res) => {
    const { method } = await authMode();
    res.json({ authenticationMethod: method, phoneVerificationRequired: method !== 'none' });
  })
);

// POST /api/auth/verify-user { phone, email?, isForgotPassword? } — v1 verify_user.
// Pre-registration guard + OTP dispatch. Does NOT create anything.
router.post(
  '/verify-user',
  asyncH(async (req, res) => {
    const { phone, email, isForgotPassword } = req.body;
    if (!phone) return res.status(400).json({ message: 'phone is required' });

    const byPhone = await User.findOne({ phone });
    if (isForgotPassword && !byPhone) {
      return res.status(404).json({ message: 'Mobile is not registered yet' });
    }
    if (!isForgotPassword) {
      if (byPhone) return res.status(400).json({ message: 'Mobile is already registered. Please log in.' });
      if (email && (await User.findOne({ email: email.toLowerCase() }))) {
        return res.status(400).json({ message: 'Email is already registered. Please log in.' });
      }
    }

    const { method, ttl } = await authMode();
    if (method === 'firebase') {
      // The client owns the OTP round-trip; nothing to mint server-side.
      return res.json({ method: 'firebase', message: 'Ready to send OTP request from firebase' });
    }
    if (method === 'none') {
      return res.json({ method: 'none', message: 'Phone verification is disabled' });
    }

    const purpose = isForgotPassword ? 'reset' : 'signup';
    const { code, delivered } = await issueOtp(phone, purpose, ttl);
    res.json({
      method: 'sms',
      message: delivered ? `OTP sent to ${phone}` : 'OTP generated',
      ...(delivered ? {} : { demoCode: code }),
    });
  })
);

// POST /api/auth/verify-otp { phone, otp, isForgotPassword? } — v1 verify_otp.
// Marks the phone provable; registration then claims the consumed code.
router.post(
  '/verify-otp',
  asyncH(async (req, res) => {
    const { phone, otp, isForgotPassword } = req.body;
    if (!phone || !otp) return res.status(400).json({ message: 'phone and otp are required' });

    const purpose = isForgotPassword ? 'reset' : 'signup';
    const record = await Otp.findOne({ phone, purpose }).sort({ createdAt: -1 });
    if (!record) return res.status(400).json({ message: 'No OTP requested for this number' });
    if (record.expiresAt < new Date()) return res.status(400).json({ message: 'OTP has expired. Request a new one.' });
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many incorrect attempts. Request a new OTP.' });
    }
    if (record.code !== String(otp)) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ message: 'Incorrect OTP' });
    }

    record.consumedAt = new Date();
    await record.save();

    // A phone that's already ours (password reset) can be marked verified right now.
    const user = await User.findOne({ phone });
    if (user && !user.phoneVerified) {
      user.phoneVerified = true;
      await user.save();
    }
    res.json({ message: 'Phone verified', verified: true });
  })
);

// POST /api/auth/resend-otp { phone, isForgotPassword? } — v1 resend_otp.
router.post(
  '/resend-otp',
  asyncH(async (req, res) => {
    const { phone, isForgotPassword } = req.body;
    if (!phone) return res.status(400).json({ message: 'phone is required' });
    const { method, ttl } = await authMode();
    if (method !== 'sms') return res.status(400).json({ message: 'OTP is not the active verification method' });

    const { code, delivered } = await issueOtp(phone, isForgotPassword ? 'reset' : 'signup', ttl);
    res.json({
      message: delivered ? `OTP resent to ${phone}` : 'OTP regenerated',
      ...(delivered ? {} : { demoCode: code }),
    });
  })
);

// GET /api/auth/login-identity?phone=… — v1 get_login_identity: does this phone have an account?
router.get(
  '/login-identity',
  asyncH(async (req, res) => {
    const phone = req.query.phone;
    if (!phone) return res.status(400).json({ message: 'phone is required' });
    const user = await User.findOne({ phone }).lean();
    res.json({ exists: !!user, ...(user ? { name: user.name, role: user.role } : {}) });
  })
);

// POST /api/auth/login  { email, password, role? }
router.post(
  '/login',
  validate(loginSchema),
  asyncH(async (req, res) => {
    const { email, password, panel } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password || ''))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ message: `Account is ${user.status}` });
    }
    // panel guard: admin panel only for admins, partner panel for partners, etc.
    if (panel && panel !== user.role) {
      return res.status(403).json({ message: `This login is for ${panel} accounts only` });
    }
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ token: signToken(user), user: user.toSafe() });
  })
);

// GET /api/auth/me
router.get('/me', protect, (req, res) => res.json({ user: req.user.toSafe() }));

// POST /api/auth/logout { fcmToken? } — v1 logout.
// JWTs are stateless so the token itself just gets dropped client-side; the part that
// actually matters server-side is retiring the device's push token, or the user keeps
// getting notifications on a phone they logged out of.
router.post(
  '/logout',
  protect,
  asyncH(async (req, res) => {
    const { fcmToken } = req.body;
    const update = fcmToken
      ? { $pull: { fcmTokens: fcmToken } }
      : { $set: { fcmTokens: [], fcmToken: '' } };
    await User.updateOne({ _id: req.user._id }, update);
    res.json({ message: 'Logged out' });
  })
);

// PUT /api/auth/profile
router.put(
  '/profile',
  protect,
  asyncH(async (req, res) => {
    const allowed = ['name', 'phone', 'avatar', 'language', 'fcmToken'];
    for (const k of allowed) if (req.body[k] !== undefined) req.user[k] = req.body[k];
    await req.user.save();
    res.json({ user: req.user.toSafe() });
  })
);

// PUT /api/auth/change-password { oldPassword, newPassword }
router.post(
  '/change-password',
  protect,
  validate(changePasswordSchema),
  asyncH(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(oldPassword || ''))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated' });
  })
);

// POST /api/auth/fcm-token { token } — register this device for push (v1: update_fcm)
router.post(
  '/fcm-token',
  protect,
  asyncH(async (req, res) => {
    const token = (req.body.token || '').trim();
    if (!token) return res.status(400).json({ message: 'token is required' });
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { fcmTokens: token }, $set: { fcmToken: token } }
    );
    res.json({ message: 'Device registered for notifications' });
  })
);

// POST /api/auth/forgot-password { email } — issues a 6-digit reset code (v1: reset_password + OTP).
// Sends via SMS/email when a gateway is configured; falls back to returning the
// code in the response (demo mode) only when no channel could deliver it.
router.post(
  '/forgot-password',
  asyncH(async (req, res) => {
    const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
    if (!user) return res.status(404).json({ message: 'No account with that email' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.resetCode = code;
    user.resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const channels = [];
    if (user.phone) {
      const sms = await sendSMS(user.phone, `Your DapiGO password reset code is ${code}. Valid for 10 minutes.`);
      if (sms.sent) channels.push('SMS');
    }
    const mail = await sendEmail(
      user.email,
      'Your DapiGO password reset code',
      emailTemplate('Password reset', `<p>Your reset code is:</p><p style="font-size:28px;font-weight:800;letter-spacing:4px">${code}</p><p>It is valid for 10 minutes. If you didn't request this, ignore this email.</p>`)
    );
    if (mail.sent) channels.push('email');

    if (channels.length) {
      return res.json({ message: `Reset code sent via ${channels.join(' & ')} (valid 10 min)` });
    }
    res.json({ message: 'Reset code generated (valid 10 min)', demoCode: code });
  })
);

// POST /api/auth/reset-password { email, code, newPassword }
router.post(
  '/reset-password',
  asyncH(async (req, res) => {
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email: (email || '').toLowerCase() }).select(
      '+resetCode +resetCodeExpires +password'
    );
    if (!user || !user.resetCode || user.resetCode !== String(code)) {
      return res.status(400).json({ message: 'Invalid reset code' });
    }
    if (user.resetCodeExpires < new Date()) {
      return res.status(400).json({ message: 'Reset code has expired' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    user.password = newPassword;
    user.resetCode = undefined;
    user.resetCodeExpires = undefined;
    await user.save();
    res.json({ message: 'Password reset — you can login now' });
  })
);

// GET /api/auth/validate-refer-code?code=X (v1: validate_refer_code)
router.get(
  '/validate-refer-code',
  asyncH(async (req, res) => {
    const code = (req.query.code || '').trim();
    if (!code) return res.status(400).json({ message: 'code is required' });
    const referrer = await User.findOne({ referralCode: code, status: 'active' }).select('name');
    res.json({ valid: !!referrer, referrerName: referrer?.name || null });
  })
);

// DELETE /api/auth/account  (soft delete)
router.delete(
  '/account',
  protect,
  asyncH(async (req, res) => {
    req.user.status = 'deleted';
    await req.user.save();
    res.json({ message: 'Account deleted' });
  })
);

// ---- Address book ----
router.get('/addresses', protect, (req, res) => res.json({ addresses: req.user.addresses }));

router.post(
  '/addresses',
  protect,
  asyncH(async (req, res) => {
    const { label, line1, line2, city, area, pincode, lat, lng, isDefault } = req.body;
    if (!line1 || !city) return res.status(400).json({ message: 'line1 and city are required' });
    if (isDefault) req.user.addresses.forEach((a) => (a.isDefault = false));
    req.user.addresses.push({ label, line1, line2, city, area, pincode, lat, lng, isDefault: !!isDefault || req.user.addresses.length === 0 });
    await req.user.save();
    res.status(201).json({ addresses: req.user.addresses });
  })
);

router.put(
  '/addresses/:id',
  protect,
  asyncH(async (req, res) => {
    const addr = req.user.addresses.id(req.params.id);
    if (!addr) return res.status(404).json({ message: 'Address not found' });
    if (req.body.isDefault) req.user.addresses.forEach((a) => (a.isDefault = false));
    Object.assign(addr, req.body);
    await req.user.save();
    res.json({ addresses: req.user.addresses });
  })
);

router.delete(
  '/addresses/:id',
  protect,
  asyncH(async (req, res) => {
    const addr = req.user.addresses.id(req.params.id);
    if (!addr) return res.status(404).json({ message: 'Address not found' });
    addr.deleteOne();
    await req.user.save();
    res.json({ addresses: req.user.addresses });
  })
);

// ---- Favorites ----
router.get(
  '/favorites',
  protect,
  asyncH(async (req, res) => {
    await req.user.populate('favorites');
    res.json({ favorites: req.user.favorites });
  })
);

router.post(
  '/favorites/:productId',
  protect,
  asyncH(async (req, res) => {
    const id = req.params.productId;
    const has = req.user.favorites.some((f) => String(f) === id);
    if (has) req.user.favorites = req.user.favorites.filter((f) => String(f) !== id);
    else req.user.favorites.push(id);
    await req.user.save();
    res.json({ favorited: !has, favorites: req.user.favorites });
  })
);

export default router;
