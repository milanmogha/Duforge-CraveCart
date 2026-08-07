import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { api } from '../api.js';
import { useAuth } from '../ctx.jsx';
import { C } from '../theme.js';
import { Bold, Btn, Card, Chip, Empty, Field, Input, Muted, Row, Sheet, Spread } from '../components.jsx';

export default function AddressesScreen() {
  const { user, refresh } = useAuth();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ label: 'Home', line1: '', area: '', city: '', pincode: '', isDefault: false });

  const save = async () => {
    await api('/auth/addresses', { method: 'POST', body: form });
    await refresh();
    setModal(false);
    setForm({ label: 'Home', line1: '', area: '', city: '', pincode: '', isDefault: false });
  };
  const del = async (id) => { await api(`/auth/addresses/${id}`, { method: 'DELETE' }); refresh(); };
  const makeDefault = async (id) => { await api(`/auth/addresses/${id}`, { method: 'PUT', body: { isDefault: true } }); refresh(); };

  const addresses = user?.addresses || [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 32 }}>
        <Btn title="+ Add address" onPress={() => setModal(true)} />
        {addresses.length === 0 && <Empty icon="📍" text="No saved addresses." />}
        {addresses.map((a) => (
          <Card key={a._id} style={{ padding: 14, gap: 6 }}>
            <Spread>
              <Row>
                <Bold>{a.label}</Bold>
                {a.isDefault && <Chip s="default" color={C.green} />}
              </Row>
            </Spread>
            <Muted>{a.line1}, {a.area ? a.area + ', ' : ''}{a.city} {a.pincode}</Muted>
            <Row>
              {!a.isDefault && <Btn kind="gray" sm title="Set default" onPress={() => makeDefault(a._id)} />}
              <Btn kind="danger" sm title="Delete" onPress={() => del(a._id)} />
            </Row>
          </Card>
        ))}
      </ScrollView>

      {modal && (
        <Sheet title="Add address" onClose={() => setModal(false)}>
          <Field label="Label">
            <Row>
              {['Home', 'Work', 'Other'].map((l) => (
                <Btn key={l} sm kind={form.label === l ? 'primary' : 'gray'} title={l} onPress={() => setForm({ ...form, label: l })} />
              ))}
            </Row>
          </Field>
          <Field label="Address line"><Input value={form.line1} onChangeText={(t) => setForm({ ...form, line1: t })} /></Field>
          <Field label="Area"><Input value={form.area} onChangeText={(t) => setForm({ ...form, area: t })} /></Field>
          <Field label="City"><Input value={form.city} onChangeText={(t) => setForm({ ...form, city: t })} /></Field>
          <Field label="Pincode"><Input keyboardType="number-pad" value={form.pincode} onChangeText={(t) => setForm({ ...form, pincode: t })} /></Field>
          <Row style={{ marginBottom: 12 }}>
            <Btn sm kind={form.isDefault ? 'primary' : 'gray'} title={form.isDefault ? '✓ Default address' : 'Set as default'} onPress={() => setForm({ ...form, isDefault: !form.isDefault })} />
          </Row>
          <Btn block title="Save" onPress={save} disabled={!form.line1 || !form.city} />
        </Sheet>
      )}
    </View>
  );
}
