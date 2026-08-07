import { useEffect, useState } from 'react';
import { api } from './api.js';

/**
 * Phone-OTP signup (v1 verify_user → verify_otp → register_user).
 *
 * Whether the step runs at all is an admin setting (`authenticationMethod`), so ask the
 * server instead of assuming: with it off, signup stays a single step exactly as before.
 *
 * Usage in an auth screen:
 *   const otp = useSignupOtp();
 *   // on submit:
 *   if (otp.required && !otp.sent) return otp.send(phone, email);   // step 1
 *   if (otp.required) await otp.verify(phone);                      // step 2, then register()
 */
export function useSignupOtp() {
  const [required, setRequired] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    api('/auth/config')
      .then((d) => setRequired(d.authenticationMethod === 'sms'))
      .catch(() => {}); // offline or old backend — fall back to plain signup
  }, []);

  const send = async (phone, email, resend = false) => {
    const d = await api(resend ? '/auth/resend-otp' : '/auth/verify-user', {
      method: 'POST',
      body: { phone, email },
    });
    setSent(true);
    // With no SMS gateway configured the backend returns the code so signup still works.
    setHint(d.demoCode ? `${d.message} (demo code: ${d.demoCode})` : d.message);
    return d;
  };

  const verify = async (phone) => {
    await api('/auth/verify-otp', { method: 'POST', body: { phone, otp: code } });
  };

  const reset = () => {
    setSent(false);
    setCode('');
    setHint('');
  };

  return { required, sent, code, setCode, hint, send, verify, reset };
}
