import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { api } from '../api.js';
import { useAuth } from '../ctx.jsx';
import { Bold, Btn, Card, ErrorText, Field, Input, Muted, Row, SuccessText, SwitchRow } from '../components.jsx';
import { C } from '../theme.js';

export default function StoreScreen() {
  const { user, setUser } = useAuth();
  const p = user.partnerProfile || {};
  const [form, setForm] = useState({
    storeName: p.storeName || '', description: p.description || '',
    address: p.address || '', city: p.city || '',
    cuisineTags: (p.cuisineTags || []).join(', '), openTime: p.openTime || '09:00',
    closeTime: p.closeTime || '22:00', isOpen: p.isOpen ?? true,
    deliveryCharge: String(p.deliveryCharge ?? 30), freeDeliveryAbove: String(p.freeDeliveryAbove ?? 500),
    minOrder: String(p.minOrder ?? 0), bankName: p.bankName || '', bankAccount: p.bankAccount || '', bankIfsc: p.bankIfsc || '',
  });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (t) => setForm({ ...form, [k]: t });

  const save = async (patch) => {
    setMsg(''); setBusy(true);
    const body = patch || {
      ...form,
      cuisineTags: form.cuisineTags.split(',').map((t) => t.trim()).filter(Boolean),
      deliveryCharge: Number(form.deliveryCharge),
      freeDeliveryAbove: Number(form.freeDeliveryAbove),
      minOrder: Number(form.minOrder),
    };
    try {
      const d = await api('/partner/store', { method: 'PUT', body });
      setUser(d.user);
      if (!patch) setMsg('Store settings saved ✓');
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };

  // The open/closed switch saves immediately — it's the thing partners reach for.
  const toggleOpen = (isOpen) => {
    setForm((f) => ({ ...f, isOpen }));
    save({ isOpen });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <Card style={{ padding: 16 }}>
          <SwitchRow
            label={form.isOpen ? 'Store is OPEN' : 'Store is CLOSED'}
            sub={form.isOpen ? 'Customers can order right now.' : 'Hidden from new orders until you reopen.'}
            value={form.isOpen}
            onChange={toggleOpen}
          />
        </Card>

        <Card style={{ padding: 16 }}>
          <Bold style={{ fontSize: 16, marginBottom: 10 }}>Store profile</Bold>
          <Field label="Store name"><Input value={form.storeName} onChangeText={set('storeName')} /></Field>
          <Field label="Description"><Input multiline value={form.description} onChangeText={set('description')} /></Field>
          <Field label="Address"><Input value={form.address} onChangeText={set('address')} /></Field>
          <Field label="City"><Input value={form.city} onChangeText={set('city')} /></Field>
          <Field label="Tags (comma separated)"><Input placeholder="Indian, Biryani…" value={form.cuisineTags} onChangeText={set('cuisineTags')} /></Field>
          <Row>
            <View style={{ flex: 1 }}><Field label="Opens at"><Input placeholder="09:00" value={form.openTime} onChangeText={set('openTime')} /></Field></View>
            <View style={{ flex: 1 }}><Field label="Closes at"><Input placeholder="22:00" value={form.closeTime} onChangeText={set('closeTime')} /></Field></View>
          </Row>
        </Card>

        <Card style={{ padding: 16 }}>
          <Bold style={{ fontSize: 16, marginBottom: 10 }}>Delivery & pricing</Bold>
          <Row>
            <View style={{ flex: 1 }}><Field label="Delivery charge"><Input keyboardType="numeric" value={form.deliveryCharge} onChangeText={set('deliveryCharge')} /></Field></View>
            <View style={{ flex: 1 }}><Field label="Free above"><Input keyboardType="numeric" value={form.freeDeliveryAbove} onChangeText={set('freeDeliveryAbove')} /></Field></View>
            <View style={{ flex: 1 }}><Field label="Min order"><Input keyboardType="numeric" value={form.minOrder} onChangeText={set('minOrder')} /></Field></View>
          </Row>
          <Muted>Platform commission: {p.commissionPercent ?? 10}% (set by admin)</Muted>
        </Card>

        <Card style={{ padding: 16 }}>
          <Bold style={{ fontSize: 16, marginBottom: 10 }}>Bank details (for payouts)</Bold>
          <Field label="Bank name"><Input value={form.bankName} onChangeText={set('bankName')} /></Field>
          <Field label="Account number"><Input value={form.bankAccount} onChangeText={set('bankAccount')} /></Field>
          <Field label="IFSC"><Input autoCapitalize="characters" value={form.bankIfsc} onChangeText={set('bankIfsc')} /></Field>
        </Card>

        {msg.includes('✓') ? <SuccessText>{msg}</SuccessText> : <ErrorText>{msg}</ErrorText>}
        <Btn block disabled={busy} title={busy ? 'Saving…' : 'Save all settings'} onPress={() => save()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
