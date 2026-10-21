"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_LANG, LANGS, detectLang, translate, type Lang, type Localized, type MsgKey } from "@/lib/i18n";

const KEY = "vton.lang";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: MsgKey) => string; pick: (v: Localized) => string };
const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // ?lang= 링크 > 지난번 선택 > 브라우저 언어 순으로 고른다
  useEffect(() => {
    const q = new URLSearchParams(location.search).get("lang");
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch {}
    const valid = (v: string | null): v is Lang => !!v && LANGS.some((l) => l.id === v);
    setLangState(valid(q) ? q : valid(saved) ? saved : detectLang(navigator.language));
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch {}
  }, []);
  const t = useCallback((k: MsgKey) => translate(lang, k), [lang]);
  const pick = useCallback((v: Localized) => v[lang], [lang]);

  return <LangContext.Provider value={{ lang, setLang, t, pick }}>{children}</LangContext.Provider>;
}

export function useLang() {
  const c = useContext(LangContext);
  if (!c) throw new Error("LangProvider가 필요해요");
  return c;
}

export function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.label}</button>
      ))}
    </div>
  );
}
