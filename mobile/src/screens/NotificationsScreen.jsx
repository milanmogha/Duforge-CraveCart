import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, dt } from '../api.js';
import { C } from '../theme.js';
import { Bold, Btn, Card, Empty, Muted, Spinner, Spread } from '../components.jsx';

export default function NotificationsScreen() {
  const [data, setData] = useState(null);

  const load = () => api('/support/notifications').then(setData);
  useFocusEffect(useCallback(() => { load(); }, []));
  if (!data) return <Spinner />;

  const markRead = async () => {
    await api('/support/notifications/read', { method: 'PUT' });
    load();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 32 }}>
      <Spread>
        <Muted>{data.unread} unread</Muted>
        {data.unread > 0 && <Btn kind="gray" sm title="Mark all read" onPress={markRead} />}
      </Spread>
      {data.notifications.length === 0 ? (
        <Empty icon="🔔" text="No notifications." />
      ) : (
        data.notifications.map((n) => (
          <Card key={n._id} style={{ padding: 13, gap: 2, borderLeftWidth: n.read ? 1 : 4, borderLeftColor: n.read ? C.line : C.brand }}>
            <Spread>
              <Bold style={{ flex: 1 }}>{n.title}</Bold>
              <Muted style={{ fontSize: 11 }}>{dt(n.createdAt)}</Muted>
            </Spread>
            <Muted>{n.body}</Muted>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
