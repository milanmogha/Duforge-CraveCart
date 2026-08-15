import { describe, it, expect, beforeEach } from 'vitest';
import { api, makeUser, setSetting, login } from './helpers.js';
import { Otp } from '../src/models/Misc.js';

// v1 parity: verify_user → verify_otp → register_user (Api.php), gated by
// authentication_settings.authentication_method. See docs/PARITY_AUDIT_2026-07-12.md.

const signup = { name: 'New Cust', email: 'new@test.cravecart', phone: '9812345678', password: 'pass1234' };

describe('phone verification (authenticationMethod = none)', () => {
  it('registers without any phone check — the default, so demo logins keep working', async () => {
    const res = await api().post('/api/auth/register').send(signup);
    expect(res.status).toBe(201);
    expect(res.body.user.phoneVerified).toBe(false);
  });

  it('reports that no verification is required', async () => {
    const res = await api().get('/api/auth/config');
    expect(res.body).toMatchObject({ authenticationMethod: 'none', phoneVerificationRequired: false });
  });
});

describe('phone verification (authenticationMethod = sms)', () => {
  beforeEach(async () => {
    await setSetting('authenticationMethod', 'sms');
    await setSetting('otpExpirySeconds', 60);
  });

  const requestOtp = async (phone = signup.phone) => {
    const res = await api().post('/api/auth/verify-user').send({ phone, email: signup.email });
    expect(res.status).toBe(200);
    // No SMS gateway in tests, so the code comes back in the response (dev fallback).
    expect(res.body.demoCode).toMatch(/^\d{6}$/);
    return res.body.demoCode;
  };

  it('refuses registration when the phone has not been verified', async () => {
    const res = await api().post('/api/auth/register').send(signup);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/verify your phone/i);
  });

  it('completes verify-user → verify-otp → register and marks the phone verified', async () => {
    const code = await requestOtp();

    const verify = await api().post('/api/auth/verify-otp').send({ phone: signup.phone, otp: code });
    expect(verify.status).toBe(200);
    expect(verify.body.verified).toBe(true);

    const reg = await api().post('/api/auth/register').send(signup);
    expect(reg.status).toBe(201);
    expect(reg.body.user.phoneVerified).toBe(true);
  });

  it('rejects a wrong code', async () => {
    await requestOtp();
    const res = await api().post('/api/auth/verify-otp').send({ phone: signup.phone, otp: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/incorrect/i);
  });

  it('rejects an expired code (v1 checkOTPExpiration)', async () => {
    const code = await requestOtp();
    await Otp.updateOne({ phone: signup.phone }, { expiresAt: new Date(Date.now() - 1000) });

    const res = await api().post('/api/auth/verify-otp').send({ phone: signup.phone, otp: code });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('locks out after repeated wrong guesses, so the 6-digit code cannot be brute-forced', async () => {
    await requestOtp();
    for (let i = 0; i < 5; i++) {
      await api().post('/api/auth/verify-otp').send({ phone: signup.phone, otp: '111111' });
    }
    const res = await api().post('/api/auth/verify-otp').send({ phone: signup.phone, otp: '111111' });
    expect(res.status).toBe(429);
  });

  it('consumes the OTP on registration, so one verification cannot mint two accounts', async () => {
    const code = await requestOtp();
    await api().post('/api/auth/verify-otp').send({ phone: signup.phone, otp: code });
    await api().post('/api/auth/register').send(signup);

    const replay = await api()
      .post('/api/auth/register')
      .send({ ...signup, email: 'other@test.cravecart' });
    expect(replay.status).toBe(400);
    expect(replay.body.message).toMatch(/verify your phone/i);
  });

  it('refuses to send a signup OTP to a number that already has an account', async () => {
    await makeUser({ phone: '9800000001' });
    const res = await api().post('/api/auth/verify-user').send({ phone: '9800000001' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it('requires the number to exist for a forgot-password OTP', async () => {
    const res = await api()
      .post('/api/auth/verify-user')
      .send({ phone: '9700000009', isForgotPassword: true });
    expect(res.status).toBe(404);
  });

  it('keeps signup and reset codes separate, so one cannot be replayed as the other', async () => {
    const user = await makeUser({ phone: '9800000002' });
    const reset = await api()
      .post('/api/auth/verify-user')
      .send({ phone: user.phone, isForgotPassword: true });

    // A reset code must not satisfy a signup verification.
    const res = await api()
      .post('/api/auth/verify-otp')
      .send({ phone: user.phone, otp: reset.body.demoCode });
    expect(res.status).toBe(400);
  });
});

describe('login identity (v1 get_login_identity)', () => {
  it('reports whether a phone already has an account', async () => {
    const user = await makeUser({ phone: '9811111111' });

    const known = await api().get(`/api/auth/login-identity?phone=${user.phone}`);
    expect(known.body).toMatchObject({ exists: true, role: 'customer' });

    const unknown = await api().get('/api/auth/login-identity?phone=9700000000');
    expect(unknown.body.exists).toBe(false);
  });
});

describe('logout (v1 logout)', () => {
  it('retires the device push token — a stateless JWT is dropped client-side', async () => {
    const user = await makeUser({ fcmTokens: ['device-a', 'device-b'] });
    const token = await login(user.email, 'pass1234', 'customer');

    await api()
      .post('/api/auth/logout')
      .set({ Authorization: `Bearer ${token}` })
      .send({ fcmToken: 'device-a' })
      .expect(200);

    const { default: User } = await import('../src/models/User.js');
    const fresh = await User.findById(user._id);
    expect(fresh.fcmTokens).toEqual(['device-b']);
  });
});
