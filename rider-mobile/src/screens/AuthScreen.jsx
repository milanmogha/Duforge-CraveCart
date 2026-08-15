import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { api } from '../api.js';
import { useAuth } from '../ctx.jsx';
import { C, F } from '../theme.js';
import { Btn, Card, ChipSelect, ErrorText, Field, Input, Muted, SuccessText } from '../components.jsx';
import { useSignupOtp } from '../useSignupOtp.js';

const VEHICLES = [['bike', 'Bike'], ['scooter', 'Scooter'], ['bicycle', 'Bicycle'], ['car', 'Car']];

export default function AuthScreen() {
  const { login, register } = useAuth();
  const otp = useSignupOtp();
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', vehicleType: 'bike' });
  const [reset, setReset] = useState({ code: '', newPassword: '', sent: false });
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (t) => setForm({ ...form, [k]: t });

  const submit = async () => {
    setErr(''); setMsg(''); setBusy(true);
    try {
      if (mode === 'login') await login(form.email.trim(), form.password);
      else if (mode === 'register') {
        // Prove the phone first when the admin has the OTP gate switched on.
        if (otp.required && !otp.sent) {
          const d = await otp.send(form.phone, form.email.trim());
          setMsg(d.demoCode ? `${d.message} (demo code: ${d.demoCode})` : d.message);
        } else {
          if (otp.required) await otp.verify(form.phone);
          await register({ ...form, email: form.email.trim() });
        }
      }
      else if (mode === 'forgot') {
        if (!reset.sent) {
          const d = await api('/auth/forgot-password', { method: 'POST', body: { email: form.email.trim() } });
          setReset({ ...reset, sent: true });
          setMsg(d.demoCode ? `Code sent! (demo code: ${d.demoCode})` : 'Code sent — check your SMS/email.');
        } else {
          await api('/auth/reset-password', {
            method: 'POST',
            body: { email: form.email.trim(), code: reset.code, newPassword: reset.newPassword },
          });
          setMsg('Password reset ✓ — login with your new password.');
          setMode('login');
          setReset({ code: '', newPassword: '', sent: false });
        }
      }
    } catch (ex) { setErr(ex.message); }
    setBusy(false);
  };

  const switchMode = (m) => { setMode(m); setErr(''); setMsg(''); setReset({ code: '', newPassword: '', sent: false }); otp.reset(); };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 60 }} keyboardShouldPersistTaps="handled">
        <Card style={{ padding: 20, gap: 4, alignItems: 'stretch' }}>
          <Image source={require('../../assets/logo.png')} style={{ width: 56, height: 56, borderRadius: 12, alignSelf: 'center', marginBottom: 8 }} />
          <Text style={{ fontFamily: F.b, fontSize: 22, color: C.ink, textAlign: 'center' }}>
            {mode === 'login' ? 'Rider login' : mode === 'register' ? 'Ride with CraveCart' : 'Reset password'}
          </Text>
          <Muted style={{ textAlign: 'center', marginBottom: 14 }}>
            {mode === 'login' && 'Deliver orders and track your earnings.'}
            {mode === 'register' && 'Sign up as a delivery rider — start after admin approval.'}
            {mode === 'forgot' && (reset.sent ? 'Enter the 6-digit code and your new password.' : "We'll send a reset code to your email.")}
          </Muted>

          {mode === 'register' && (
            <Field label="Your name"><Input value={form.name} onChangeText={set('name')} /></Field>
          )}
          <Field label="Email">
            <Input autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={set('email')} editable={!(mode === 'forgot' && reset.sent)} />
          </Field>
          {mode === 'register' && (
            <>
              <Field label="Phone"><Input keyboardType="phone-pad" value={form.phone} onChangeText={set('phone')} editable={!otp.sent} /></Field>
              {otp.sent && (
                <Field label="Verification code">
                  <Input keyboardType="number-pad" maxLength={6} value={otp.code} onChangeText={otp.setCode} />
                  <Text
                    style={{ fontFamily: F.b, color: C.brand, fontSize: 12.5, marginTop: 6 }}
                    onPress={() => otp.send(form.phone, form.email.trim(), true).catch((ex) => setErr(ex.message))}
                  >
                    Resend code
                  </Text>
                </Field>
              )}
              <Field label="Vehicle">
                <ChipSelect options={VEHICLES} value={form.vehicleType} onChange={(v) => setForm({ ...form, vehicleType: v })} style={{ flexGrow: 0 }} />
              </Field>
            </>
          )}
          {(mode === 'login' || mode === 'register') && (
            <Field label="Password"><Input secureTextEntry value={form.password} onChangeText={set('password')} /></Field>
          )}
          {mode === 'forgot' && reset.sent && (
            <>
              <Field label="Reset code"><Input keyboardType="number-pad" value={reset.code} onChangeText={(t) => setReset({ ...reset, code: t })} /></Field>
              <Field label="New password"><Input secureTextEntry value={reset.newPassword} onChangeText={(t) => setReset({ ...reset, newPassword: t })} /></Field>
            </>
          )}

          <ErrorText>{err}</ErrorText>
          <SuccessText>{msg}</SuccessText>

          <Btn
            block
            disabled={busy}
            title={
              busy ? 'Please wait…'
                : mode === 'login' ? 'Login'
                : mode === 'register' ? (otp.required && !otp.sent ? 'Send verification code' : 'Create rider account')
                : reset.sent ? 'Reset password' : 'Send reset code'
            }
            onPress={submit}
            style={{ marginTop: 8 }}
          />

          {mode === 'login' && (
            <Text style={{ fontFamily: F.r, color: C.muted, textAlign: 'center', marginTop: 12, textDecorationLine: 'underline', fontSize: 13 }} onPress={() => switchMode('forgot')}>
              Forgot password?
            </Text>
          )}
          <Text style={{ fontFamily: F.r, color: C.muted, textAlign: 'center', marginTop: 12, fontSize: 13.5 }}>
            {mode === 'login' ? 'New rider? ' : 'Already have an account? '}
            <Text style={{ fontFamily: F.b, color: C.brand }} onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Sign up' : 'Login'}
            </Text>
          </Text>
          {mode === 'login' && (
            <Muted style={{ textAlign: 'center', fontSize: 12, marginTop: 8 }}>Demo: rider@cravecart.com / rider123</Muted>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
