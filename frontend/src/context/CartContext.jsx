"use client"

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api } from '@/lib/api';

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
    } catch { 
      setCount(0); 
    }
  }, [user]);

  useEffect(() => { 
    refreshCart(); 
  }, [refreshCart]);

  return <CartCtx.Provider value={{ count, refreshCart }}>{children}</CartCtx.Provider>;
}
