const TOKEN_KEY = 'cravecart_customer_token';
export const PANEL = 'customer';

// Path-based deployment: the storefront is published under /cravecart through the
// Tailscale funnel, which strips the prefix before nginx sees it. Every URL the
// browser is asked to fetch must therefore carry the prefix, or it escapes the
// mount — this is what `basePath` does for pages/assets, and what BASE does for
// the hand-rolled fetch + socket.io URLs that Next doesn't rewrite for us.
// Empty in dev, so these stay plain '/api' and '/socket.io/'.
export const BASE = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
export const API_BASE = BASE + '/api';
export const SOCKET_PATH = BASE + '/socket.io/';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API_BASE + path, {
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
