import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const TOKEN_KEY = 'dapigo_customer_token';
export const PANEL = 'customer';

// In dev, the backend lives on the same machine as the Metro bundler — derive its
// LAN IP from Expo's hostUri so a physical phone reaches it with zero config.
const devHost = (Constants.expoConfig?.hostUri || '').split(':')[0];
export const API_ORIGIN =
  process.env.EXPO_PUBLIC_API_URL || (devHost ? `http://${devHost}:5000` : 'http://localhost:5000');

// The deployed API lives under a path prefix (…ts.net/dapigo). socket.io needs the
// prefix as `path`, not as part of the URL (a URL path would be read as a namespace).
const originMatch = API_ORIGIN.match(/^(https?:\/\/[^/]+)(\/.*)?$/);
export const SOCKET_ORIGIN = originMatch ? originMatch[1] : API_ORIGIN;
export const SOCKET_PATH = (originMatch?.[2] ? originMatch[2].replace(/\/+$/, '') : '') + '/socket.io/';

let token = null;
export const loadToken = async () => {
  token = await AsyncStorage.getItem(TOKEN_KEY);
  return token;
};
export const getToken = () => token;
export const setToken = async (t) => {
  token = t;
  if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
  else await AsyncStorage.removeItem(TOKEN_KEY);
};

export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API_ORIGIN + '/api' + path, {
    method,
    headers,
    body: formData || (body ? JSON.stringify(body) : undefined),
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
export const dt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
// Uploaded images come back as relative /uploads/... paths — point them at the API host.
export const img = (u) => (!u ? undefined : /^https?:/.test(u) ? u : API_ORIGIN + (u.startsWith('/') ? u : '/' + u));
