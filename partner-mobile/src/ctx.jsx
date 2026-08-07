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
    const data = await api('/auth/register', { method: 'POST', body: { ...payload, role: PANEL } });
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
