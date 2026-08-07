import { useState } from 'react';
import { ScrollView } from 'react-native';
import { api } from '../api.js';
import { useAuth } from '../ctx.jsx';
import { C } from '../theme.js';
import { Bold, Btn, Card, ErrorText, Field, Input, SuccessText } from '../components.jsx';

export default function AccountScreen() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' });
  const [pw, setPw] = useState({ oldPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const save = async () => {
    try {
      const d = await api('/auth/profile', { method: 'PUT', body: form });
      setUser(d.user);
      setMsg('Profile updated ✓');
    } catch (e) { setMsg(e.message); }
  };

  const changePw = async () => {
    try {
      await api('/auth/change-password', { method: 'PUT', body: pw });
      setPwMsg('Password changed ✓');
      setPw({ oldPassword: '', newPassword: '' });
    } catch (e) { setPwMsg(e.message); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <Card style={{ padding: 16, gap: 4 }}>
        <Bold style={{ fontSize: 16, marginBottom: 8 }}>Profile details</Bold>
        <Field label="Name"><Input value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} /></Field>
        <Field label="Phone"><Input keyboardType="phone-pad" value={form.phone} onChangeText={(t) => setForm({ ...form, phone: t })} /></Field>
        <Field label="Email"><Input value={user.email} editable={false} style={{ opacity: 0.6 }} /></Field>
        <Field label="Referral code — share & earn"><Input value={user.referralCode || ''} editable={false} /></Field>
        {msg.includes('✓') ? <SuccessText>{msg}</SuccessText> : <ErrorText>{msg}</ErrorText>}
        <Btn title="Save changes" onPress={save} />
      </Card>

      <Card style={{ padding: 16, gap: 4 }}>
        <Bold style={{ fontSize: 16, marginBottom: 8 }}>Change password</Bold>
        <Field label="Current password"><Input secureTextEntry value={pw.oldPassword} onChangeText={(t) => setPw({ ...pw, oldPassword: t })} /></Field>
        <Field label="New password"><Input secureTextEntry value={pw.newPassword} onChangeText={(t) => setPw({ ...pw, newPassword: t })} /></Field>
        {pwMsg.includes('✓') ? <SuccessText>{pwMsg}</SuccessText> : <ErrorText>{pwMsg}</ErrorText>}
        <Btn title="Update password" onPress={changePw} />
      </Card>
    </ScrollView>
  );
}
