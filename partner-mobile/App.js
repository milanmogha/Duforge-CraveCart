import { Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';

import { AuthProvider, useAuth } from './src/ctx.jsx';
import { C, F } from './src/theme.js';
import AuthScreen from './src/screens/AuthScreen.jsx';
import DashboardScreen from './src/screens/DashboardScreen.jsx';
import OrdersScreen from './src/screens/OrdersScreen.jsx';
import ProductsScreen from './src/screens/ProductsScreen.jsx';
import WalletScreen from './src/screens/WalletScreen.jsx';
import StoreScreen from './src/screens/StoreScreen.jsx';

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
      <Tab.Screen name="DashboardTab" component={DashboardScreen} options={{ title: 'CraveCart Partner', tabBarLabel: 'Dashboard', tabBarIcon: tabIcon('📊') }} />
      <Tab.Screen name="OrdersTab" component={OrdersScreen} options={{ title: 'Orders', tabBarLabel: 'Orders', tabBarIcon: tabIcon('📦') }} />
      <Tab.Screen name="ProductsTab" component={ProductsScreen} options={{ title: 'Products', tabBarLabel: 'Products', tabBarIcon: tabIcon('🍽️') }} />
      <Tab.Screen name="WalletTab" component={WalletScreen} options={{ title: 'Wallet & payouts', tabBarLabel: 'Wallet', tabBarIcon: tabIcon('💰') }} />
      <Tab.Screen name="StoreTab" component={StoreScreen} options={{ title: 'Store settings', tabBarLabel: 'Store', tabBarIcon: tabIcon('🏪') }} />
    </Tab.Navigator>
  );
}

// Everything in the partner app is behind login, so gate at the root.
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
