import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { money } from '../api.js';
import { useAuth } from '../ctx.jsx';
import { C, F } from '../theme.js';
import { Bold, Btn, Card, Empty, Muted, Spinner, Spread } from '../components.jsx';

const MENU = [
  ['Account', '👤', 'Profile details & password'],
  ['Addresses', '📍', 'Manage delivery addresses'],
  ['Wallet', '💰', 'Balance, top-up & transactions'],
  ['Favorites', '♥', 'Products you saved'],
  ['Offers', '🎟️', 'Coupons & offers'],
  ['Tickets', '🎫', 'Support tickets'],
  ['Notifications', '🔔', 'Order & account updates'],
];

export default function ProfileScreen({ navigation }) {
  const { user, loading, logout } = useAuth();

  if (loading) return <Spinner />;
  if (!user) {
    return <Empty icon="🔐" text="Login to manage your profile, wallet and orders." action={<Btn title="Login / Sign up" onPress={() => navigation.navigate('Auth')} />} />;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 32 }}>
      <Card style={{ padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <Image source={require('../../assets/logo.png')} style={{ width: 54, height: 54, borderRadius: 27 }} />
        <View style={{ flex: 1 }}>
          <Bold style={{ fontSize: 17 }}>{user.name}</Bold>
          <Muted>{user.email}</Muted>
          <Muted style={{ color: C.brand, fontFamily: F.b }}>Wallet: {money(user.walletBalance)}</Muted>
        </View>
      </Card>

      <Card>
        {MENU.map(([screen, icon, sub], i) => (
          <Pressable
            key={screen}
            onPress={() => navigation.push(screen)}
            style={{
              padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
              borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.line,
            }}
          >
            <Text style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Bold>{screen}</Bold>
              <Muted>{sub}</Muted>
            </View>
            <Text style={{ color: C.muted, fontSize: 18 }}>›</Text>
          </Pressable>
        ))}
      </Card>

      <Btn block kind="ghost" title="Log out" onPress={logout} />
    </ScrollView>
  );
}
