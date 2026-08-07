"use client"

// Lightweight i18n (v1 parity: language packs + Language switcher).
// Strings come from /api/catalog/languages/:code (admin-editable), are cached
// in localStorage, and fall back to the hardcoded English default per call —
// so missing keys can never blank the UI.
//
// Unlike the Vite original, initial state cannot read window/localStorage during
// render: this component is prerendered on the server. We start from the English
// fallback and hydrate the stored language in an effect instead.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const LANG_KEY = 'dapigo_lang';
const CACHE_KEY = 'dapigo_lang_cache';
const EN = { code: 'en', rtl: false, strings: {} };

const I18nCtx = createContext({ t: (k, d) => d ?? k, code: 'en', setCode: () => {}, languages: [], rtl: false });

export const useI18n = () => useContext(I18nCtx);

export function I18nProvider({ children }) {
  const [code, setCodeState] = useState('en');
  const [languages, setLanguages] = useState([]);
  const [pack, setPack] = useState(EN);

  // Resolve the active language on the client only: ?lang=hi deep-links and persists.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('lang');
    if (fromUrl) {
      localStorage.setItem(LANG_KEY, fromUrl.toLowerCase());
      setCodeState(fromUrl.toLowerCase());
      return;
    }
    const stored = localStorage.getItem(LANG_KEY);
    if (stored && stored !== 'en') setCodeState(stored);
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached?.code === (stored || 'en')) setPack(cached);
    } catch { /* corrupt cache — fall back to English */ }
  }, []);

  useEffect(() => {
    api('/catalog/languages').then((d) => setLanguages(d.languages)).catch(() => {});
  }, []);

  useEffect(() => {
    let stale = false;
    api(`/catalog/languages/${code}`)
      .then((d) => {
        if (stale) return;
        const next = { code, rtl: !!d.language.rtl, strings: d.language.strings || {} };
        setPack(next);
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      })
      .catch(() => { if (!stale && code !== 'en') setPack({ code, rtl: false, strings: {} }); });
    return () => { stale = true; };
  }, [code]);

  useEffect(() => {
    document.documentElement.lang = code;
    document.documentElement.dir = pack.rtl ? 'rtl' : 'ltr';
  }, [code, pack.rtl]);

  const setCode = useCallback((c) => {
    localStorage.setItem(LANG_KEY, c);
    setCodeState(c);
  }, []);

  const t = useCallback((key, fallback) => pack.strings[key] || fallback || key, [pack]);

  return (
    <I18nCtx.Provider value={{ t, code, setCode, languages, rtl: pack.rtl }}>
      {children}
    </I18nCtx.Provider>
  );
}
