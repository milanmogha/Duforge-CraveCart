import { Text, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';

import { AuthProvider, CartProvider, useCart } from './src/ctx.jsx';
import { C, F } from './src/theme.js';
import HomeScreen from './src/screens/HomeScreen.jsx';
import ProductsScreen from './src/screens/ProductsScreen.jsx';
import ProductDetailScreen from './src/screens/ProductDetailScreen.jsx';
import StoresScreen, { StoreScreen } from './src/screens/StoresScreen.jsx';
import OffersScreen from './src/screens/OffersScreen.jsx';
import CartScreen from './src/screens/CartScreen.jsx';
import CheckoutScreen from './src/screens/CheckoutScreen.jsx';
import OrdersScreen from './src/screens/OrdersScreen.jsx';
import OrderDetailScreen from './src/screens/OrderDetailScreen.jsx';
import AuthScreen from './src/screens/AuthScreen.jsx';
import ProfileScreen from './src/screens/ProfileScreen.jsx';
import AccountScreen from './src/screens/AccountScreen.jsx';
import AddressesScreen from './src/screens/AddressesScreen.jsx';
import WalletScreen from './src/screens/WalletScreen.jsx';
import FavoritesScreen from './src/screens/FavoritesScreen.jsx';
import TicketsScreen, { TicketDetailScreen } from './src/screens/TicketsScreen.jsx';
import NotificationsScreen from './src/screens/NotificationsScreen.jsx';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: C.brand, background: C.bg, card: '#fff', text: C.ink, border: C.line },
};

const screenOptions = {
  headerTitleStyle: { fontFamily: F.b, color: C.ink },
  headerTintColor: C.brand,
  headerShadowVisible: false,
};

const tabIcon = (emoji) => ({ focused }) => (
  <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
);

function Tabs() {
  const { count } = useCart();
  return (
    <Tab.Navigator
      screenOptions={{
        ...screenOptions,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontFamily: F.sb, fontSize: 11 },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'CraveCart', tabBarLabel: 'Home', tabBarIcon: tabIcon('🏠') }} />
      <Tab.Screen name="StoresTab" component={StoresScreen} options={{ title: 'All stores', tabBarLabel: 'Stores', tabBarIcon: tabIcon('🏪') }} />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          title: 'Your cart',
          tabBarLabel: 'Cart',
          tabBarIcon: tabIcon('🛒'),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: C.brand, fontFamily: F.b, fontSize: 11 },
        }}
      />
      <Tab.Screen name="OrdersTab" component={OrdersScreen} options={{ title: 'My orders', tabBarLabel: 'Orders', tabBarIcon: tabIcon('📦') }} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'My profile', tabBarLabel: 'Profile', tabBarIcon: tabIcon('👤') }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <AuthProvider>
      <CartProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="dark" />
          <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen name="Products" component={ProductsScreen} options={{ title: 'Browse products' }} />
            <Stack.Screen name="Product" component={ProductDetailScreen} options={{ title: 'Product' }} />
            <Stack.Screen name="Store" component={StoreScreen} options={{ title: 'Store' }} />
            <Stack.Screen name="Offers" component={OffersScreen} options={{ title: 'Offers & coupons' }} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
            <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order' }} />
            <Stack.Screen name="Auth" component={AuthScreen} options={{ title: 'Login', presentation: 'modal' }} />
            <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Account' }} />
            <Stack.Screen name="Addresses" component={AddressesScreen} options={{ title: 'Addresses' }} />
            <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'Wallet' }} />
            <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Favorites' }} />
            <Stack.Screen name="Tickets" component={TicketsScreen} options={{ title: 'Support tickets' }} />
            <Stack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ title: 'Ticket' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </CartProvider>
    </AuthProvider>
  );
}
