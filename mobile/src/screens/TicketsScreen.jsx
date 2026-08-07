import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, dt } from '../api.js';
import { C } from '../theme.js';
import { Bold, Btn, Card, Chip, ChipSelect, Empty, ErrorText, Field, Input, Muted, Row, Sheet, Spinner, Spread } from '../components.jsx';

const TYPES = [['order', 'Order issue'], ['payment', 'Payment'], ['refund', 'Refund'], ['account', 'Account'], ['other', 'Other']];
const PRIORITIES = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];

export default function TicketsScreen({ navigation }) {
  const [tickets, setTickets] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ subject: '', type: 'other', priority: 'medium', message: '' });
  const [err, setErr] = useState('');

  const load = () => api('/support/tickets').then((d) => setTickets(d.tickets));
  useFocusEffect(useCallback(() => { load(); }, []));

  const create = async () => {
    setErr('');
    try {
      await api('/support/tickets', { method: 'POST', body: form });
      setModal(false);
      setForm({ subject: '', type: 'other', priority: 'medium', message: '' });
      load();
    } catch (e) { setErr(e.message); }
  };

  if (!tickets) return <Spinner />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 32 }}>
        <Btn title="+ New ticket" onPress={() => setModal(true)} />
        {tickets.length === 0 ? (
          <Empty icon="🎫" text="No support tickets." />
        ) : (
          tickets.map((t) => (
            <Card key={t._id} style={{ padding: 14, gap: 4 }} onPress={() => navigation.push('TicketDetail', { id: t._id })}>
              <Spread>
                <Bold style={{ flex: 1 }}>{t.subject}</Bold>
                <Chip s={t.status} />
              </Spread>
              <Muted>{t.type} · updated {dt(t.updatedAt)}</Muted>
            </Card>
          ))
        )}
      </ScrollView>

      {modal && (
        <Sheet title="New support ticket" onClose={() => setModal(false)}>
          <Field label="Subject"><Input value={form.subject} onChangeText={(t) => setForm({ ...form, subject: t })} /></Field>
          <Field label="Type">
            <ChipSelect options={TYPES} value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
          </Field>
          <Field label="Priority">
            <ChipSelect options={PRIORITIES} value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} />
          </Field>
          <Field label="Describe the issue">
            <Input multiline value={form.message} onChangeText={(t) => setForm({ ...form, message: t })} />
          </Field>
          <ErrorText>{err}</ErrorText>
          <Btn block title="Submit ticket" onPress={create} disabled={!form.subject || !form.message} />
        </Sheet>
      )}
    </View>
  );
}

export function TicketDetailScreen({ route }) {
  const { id } = route.params;
  const [ticket, setTicket] = useState(null);
  const [reply, setReply] = useState('');

  useEffect(() => { api(`/support/tickets/${id}`).then((d) => setTicket(d.ticket)); }, [id]);
  if (!ticket) return <Spinner />;

  const sendReply = async () => {
    const d = await api(`/support/tickets/${ticket._id}/reply`, { method: 'POST', body: { message: reply } });
    setTicket(d.ticket);
    setReply('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 16 }}>
        <Spread>
          <View style={{ flex: 1 }}>
            <Bold style={{ fontSize: 16 }}>{ticket.subject}</Bold>
            <Muted>{ticket.type} · {ticket.priority} priority</Muted>
          </View>
          <Chip s={ticket.status} />
        </Spread>
        {ticket.messages.map((m) => (
          <View key={m._id} style={{ alignItems: m.senderRole === 'admin' ? 'flex-start' : 'flex-end' }}>
            <Card style={{ padding: 12, maxWidth: '85%', backgroundColor: m.senderRole === 'admin' ? '#fff' : C.brandLight }}>
              <Muted style={{ fontSize: 11 }}>{m.senderRole === 'admin' ? '🛡️ Support' : 'You'} · {dt(m.createdAt)}</Muted>
              <Muted style={{ color: C.ink, fontSize: 14 }}>{m.message}</Muted>
            </Card>
          </View>
        ))}
      </ScrollView>
      {['open', 'in_progress'].includes(ticket.status) && (
        <Row style={{ padding: 12 }}>
          <Input placeholder="Type a reply…" value={reply} onChangeText={setReply} style={{ flex: 1 }} />
          <Btn sm title="Send" onPress={sendReply} disabled={!reply} />
        </Row>
      )}
    </View>
  );
}
