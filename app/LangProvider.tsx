"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Globe, Tick } from "./icons";
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

/** 헤더 오른쪽 언어 버튼. 누르면 아래에서 시트가 올라와 네 언어 중 하나를 고른다. */
export function LangSwitch() {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const cur = LANGS.find((l) => l.id === lang)!;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button className="lang-btn" aria-label={`${t("lang.title")}: ${cur.name}`} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Globe size={18} />{cur.code}
      </button>
      {open && (
        <div className="sheet-dim" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t("lang.title")} onClick={(e) => e.stopPropagation()}>
            <div className="handle" />
            <h2>{t("lang.title")}</h2>
            {LANGS.map((l) => (
              <button key={l.id} className="opt" lang={l.id} aria-pressed={lang === l.id} onClick={() => { setLang(l.id); setOpen(false); }}>
                <span>{l.name}</span>
                <small>{l.code}</small>
                {lang === l.id ? <Tick /> : <i style={{ width: 20 }} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** 잠깐 떴다 사라지는 알림. 눌리지 않고(pointer-events: none) 2.4초 뒤 사라진다. */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = msg ? <div className="toast" role="status">{msg}</div> : null;
  return [show, node] as const;
}
