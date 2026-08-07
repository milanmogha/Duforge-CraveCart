import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, loadToken, setToken, PANEL } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api('/auth/me');
      setUser(user);
    } catch {
      await setToken(null);
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (!t) { setUser(null); setLoading(false); return; }
      refresh();
    })();
  }, [refresh]);

  const login = async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password, panel: PANEL } });
    await setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await api('/auth/register', { method: 'POST', body: payload });
    await setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => { await setToken(null); setUser(null); };

  return (
    <AuthCtx.Provider value={{ user, setUser, loading, login, register, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refreshCart = useCallback(async () => {
    if (!user || user.role !== 'customer') return setCount(0);
    try {
      const { cart } = await api('/cart');
      setCount(cart.items.reduce((s, i) => s + i.qty, 0));
    } catch { setCount(0); }
  }, [user]);

  useEffect(() => { refreshCart(); }, [refreshCart]);

  return <CartCtx.Provider value={{ count, refreshCart }}>{children}</CartCtx.Provider>;
}
