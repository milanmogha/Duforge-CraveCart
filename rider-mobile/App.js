import { Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';

import { AuthProvider, useAuth } from './src/ctx.jsx';
import { C, F } from './src/theme.js';
import AuthScreen from './src/screens/AuthScreen.jsx';
import DashboardScreen from './src/screens/DashboardScreen.jsx';
import DeliveriesScreen from './src/screens/DeliveriesScreen.jsx';
import WalletScreen from './src/screens/WalletScreen.jsx';
import ProfileScreen from './src/screens/ProfileScreen.jsx';

const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: C.brand, background: C.bg, card: '#fff', text: C.ink, border: C.line },
};

const tabIcon = (emoji) => ({ focused }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
);

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerTitleStyle: { fontFamily: F.b, color: C.ink },
        headerTintColor: C.brand,
        headerShadowVisible: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontFamily: F.sb, fontSize: 11 },
      }}
    >
      <Tab.Screen name="DashboardTab" component={DashboardScreen} options={{ title: 'DapiGO Rider', tabBarLabel: 'Dashboard', tabBarIcon: tabIcon('📊') }} />
      <Tab.Screen name="DeliveriesTab" component={DeliveriesScreen} options={{ title: 'Deliveries', tabBarLabel: 'Deliveries', tabBarIcon: tabIcon('🛵') }} />
      <Tab.Screen name="WalletTab" component={WalletScreen} options={{ title: 'Wallet & payouts', tabBarLabel: 'Wallet', tabBarIcon: tabIcon('💰') }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile', tabBarLabel: 'Profile', tabBarIcon: tabIcon('👤') }} />
    </Tab.Navigator>
  );
}

// Everything in the rider app is behind login, so gate at the root.
function Root() {
  const { user, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!user) return <AuthScreen />;
  return (
    <NavigationContainer theme={navTheme}>
      <Tabs />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Root />
    </AuthProvider>
  );
}
