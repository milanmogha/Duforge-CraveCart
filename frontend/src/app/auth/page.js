"use client"

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function AuthPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  
  const [mode, setMode] = useState('login'); // login | register | forgot
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', referralCode: '' });
  const [reset, setReset] = useState({ code: '', newPassword: '', sent: false, demoCode: '' });

  // Phone-OTP signup (v1 verify_user → verify_otp → register_user). Whether the step
  // runs at all is an admin setting, so ask the server rather than assuming.
  const [otpRequired, setOtpRequired] = useState(false);
  const [otp, setOtp] = useState({ step: false, code: '', demoCode: '' });

  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/auth/config')
      .then((d) => setOtpRequired(d.authenticationMethod === 'sms'))
      .catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const sendOtp = async (resend = false) => {
    const d = await api(resend ? '/auth/resend-otp' : '/auth/verify-user', {
      method: 'POST',
      body: { phone: form.phone, email: form.email },
    });
    setOtp((o) => ({ ...o, step: true, demoCode: d.demoCode || '' }));
    setMsg(d.demoCode ? `${d.message} (demo code: ${d.demoCode})` : d.message);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setMsg(''); setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        router.push('/');
      } else if (mode === 'register') {
        if (otpRequired && !otp.step) {
          // Step 1: prove the phone before creating anything.
          await sendOtp();
        } else if (otpRequired && otp.step) {
          // Step 2: consume the code, then create the account.
          await api('/auth/verify-otp', { method: 'POST', body: { phone: form.phone, otp: otp.code } });
          await register({ ...form, role: 'customer' });
          router.push('/');
        } else {
          await register({ ...form, role: 'customer' });
          router.push('/');
        }
      } else if (mode === 'forgot') {
        if (!reset.sent) {
          const d = await api('/auth/forgot-password', { method: 'POST', body: { email: form.email } });
          setReset({ ...reset, sent: true, demoCode: d.demoCode });
          setMsg(`Code sent! (demo code: ${d.demoCode})`);
        } else {
          await api('/auth/reset-password', {
            method: 'POST',
            body: { email: form.email, code: reset.code, newPassword: reset.newPassword },
          });
          setMsg('Password reset ✓ — login with your new password.');
          setMode('login');
          setReset({ code: '', newPassword: '', sent: false, demoCode: '' });
        }
      }
    } catch (ex) { 
      setErr(ex.message); 
    }
    setBusy(false);
  };

  const switchMode = (m) => {
    setMode(m);
    setErr('');
    setMsg('');
    setReset({ code: '', newPassword: '', sent: false, demoCode: '' });
    setOtp({ step: false, code: '', demoCode: '' });
  };

  return (
    <div className="flex min-h-[calc(100vh-16rem)] items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="border-border/50 shadow-xl bg-card/60 backdrop-blur-xl">
          <CardHeader className="space-y-2 text-center pb-4">
            <div className="mx-auto bg-primary text-primary-foreground p-1.5 rounded-xl w-12 h-12 flex items-center justify-center mb-2">
              <span className="font-black text-2xl tracking-tighter">DG</span>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create an account' : 'Reset password'}
            </CardTitle>
            <CardDescription className="text-sm">
              {mode === 'login' && 'Login to order from your favorite stores.'}
              {mode === 'register' && 'Join DapiGO in seconds.'}
              {mode === 'forgot' && (reset.sent ? 'Enter the 6-digit code and your new password.' : "We'll send a reset code to your email.")}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <AnimatePresence mode="popLayout">
                {mode === 'register' && (
                  <motion.div
                    key="name"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5"
                  >
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Full name</label>
                    <Input required value={form.name} onChange={set('name')} />
                  </motion.div>
                )}
                
                <motion.div layout key="email" className="space-y-1.5">
                  <label className="text-sm font-medium leading-none">Email</label>
                  <Input type="email" required value={form.email} onChange={set('email')} disabled={mode === 'forgot' && reset.sent} />
                </motion.div>

                {mode === 'register' && (
                  <motion.div
                    key="phone"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5"
                  >
                    <label className="text-sm font-medium leading-none">Phone</label>
                    <Input
                      value={form.phone}
                      onChange={set('phone')}
                      required={otpRequired}
                      disabled={otp.step}
                    />
                  </motion.div>
                )}

                {mode === 'register' && otp.step && (
                  <motion.div
                    key="otp"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium leading-none">Verification code</label>
                      <button
                        type="button"
                        onClick={() => sendOtp(true).catch((ex) => setErr(ex.message))}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Resend
                      </button>
                    </div>
                    <Input
                      required
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={otp.code}
                      onChange={(e) => setOtp({ ...otp, code: e.target.value })}
                      className="tracking-[0.4em] text-center font-semibold"
                    />
                  </motion.div>
                )}

                {(mode === 'login' || mode === 'register') && (
                  <motion.div layout key="password" className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium leading-none">Password</label>
                      {mode === 'login' && (
                        <button type="button" onClick={() => switchMode('forgot')} className="text-xs text-primary hover:underline font-medium">
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input type="password" required minLength={6} value={form.password} onChange={set('password')} />
                  </motion.div>
                )}

                {mode === 'register' && (
                  <motion.div
                    key="referral"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5"
                  >
                    <label className="text-sm font-medium leading-none">Referral code (optional)</label>
                    <Input value={form.referralCode} onChange={set('referralCode')} />
                  </motion.div>
                )}
                
                {mode === 'forgot' && reset.sent && (
                  <motion.div
                    key="reset-fields"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium leading-none">Reset code</label>
                      <Input required value={reset.code} onChange={(e) => setReset({ ...reset, code: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium leading-none">New password</label>
                      <Input type="password" required minLength={6} value={reset.newPassword} onChange={(e) => setReset({ ...reset, newPassword: e.target.value })} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {err && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 text-sm text-destructive-foreground bg-destructive/90 rounded-md">
                  {err}
                </motion.div>
              )}
              {msg && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 text-sm text-green-800 bg-green-100 dark:bg-green-900/50 dark:text-green-300 rounded-md">
                  {msg}
                </motion.div>
              )}

              <Button type="submit" className="w-full font-semibold" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Please wait
                  </>
                ) : mode === 'login' ? 'Login'
                  : mode === 'register' ? (otpRequired && !otp.step ? 'Send verification code' : 'Create account')
                  : reset.sent ? 'Reset password' : 'Send reset code'}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="flex flex-col border-t pt-4">
            <p className="text-center text-sm text-muted-foreground">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button 
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                className="font-semibold text-primary hover:underline transition-all"
              >
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </p>
            {mode === 'login' && (
              <p className="text-center text-xs text-muted-foreground mt-4 opacity-70">
                Demo: customer@dapigo.com / customer123
              </p>
            )}
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
