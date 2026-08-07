import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { api } from '../api.js';
import { useAuth } from '../ctx.jsx';
import { Bold, Btn, Card, ChipSelect, ErrorText, Field, Input, Row, SuccessText } from '../components.jsx';
import { C } from '../theme.js';

const VEHICLES = [['bike', 'Bike'], ['scooter', 'Scooter'], ['bicycle', 'Bicycle'], ['car', 'Car']];

export default function ProfileScreen() {
  const { user, setUser, logout } = useAuth();
  const r = user.riderProfile || {};
  const [form, setForm] = useState({
    vehicleType: r.vehicleType || 'bike', vehicleNumber: r.vehicleNumber || '',
    licenseNumber: r.licenseNumber || '', city: r.city || '',
    bankName: r.bankName || '', bankAccount: r.bankAccount || '', bankIfsc: r.bankIfsc || '',
  });
  const [basic, setBasic] = useState({ name: user.name, phone: user.phone || '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (t) => setForm({ ...form, [k]: t });

  const save = async () => {
    setMsg(''); setBusy(true);
    try {
      await api('/auth/profile', { method: 'PUT', body: basic });
      const d = await api('/rider/profile', { method: 'PUT', body: form });
      setUser(d.user);
      setMsg('Profile saved ✓');
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <Card style={{ padding: 16 }}>
          <Bold style={{ fontSize: 16, marginBottom: 10 }}>Personal & vehicle</Bold>
          <Field label="Name"><Input value={basic.name} onChangeText={(t) => setBasic({ ...basic, name: t })} /></Field>
          <Field label="Phone"><Input keyboardType="phone-pad" value={basic.phone} onChangeText={(t) => setBasic({ ...basic, phone: t })} /></Field>
          <Field label="Vehicle type">
            <ChipSelect options={VEHICLES} value={form.vehicleType} onChange={(v) => setForm({ ...form, vehicleType: v })} style={{ flexGrow: 0 }} />
          </Field>
          <Row>
            <View style={{ flex: 1 }}><Field label="Vehicle number"><Input autoCapitalize="characters" value={form.vehicleNumber} onChangeText={set('vehicleNumber')} /></Field></View>
            <View style={{ flex: 1 }}><Field label="License number"><Input autoCapitalize="characters" value={form.licenseNumber} onChangeText={set('licenseNumber')} /></Field></View>
          </Row>
          <Field label="City"><Input value={form.city} onChangeText={set('city')} /></Field>
        </Card>

        <Card style={{ padding: 16 }}>
          <Bold style={{ fontSize: 16, marginBottom: 10 }}>Bank details (for payouts)</Bold>
          <Field label="Bank name"><Input value={form.bankName} onChangeText={set('bankName')} /></Field>
          <Field label="Account number"><Input keyboardType="numeric" value={form.bankAccount} onChangeText={set('bankAccount')} /></Field>
          <Field label="IFSC"><Input autoCapitalize="characters" value={form.bankIfsc} onChangeText={set('bankIfsc')} /></Field>
          {msg.includes('✓') ? <SuccessText>{msg}</SuccessText> : <ErrorText>{msg}</ErrorText>}
        </Card>

        <Btn block disabled={busy} title={busy ? 'Saving…' : 'Save profile'} onPress={save} />
        <Btn kind="ghost" title="Logout" onPress={logout} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
