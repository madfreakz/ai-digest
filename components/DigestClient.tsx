"use client";

import { useState, useEffect, createContext, useContext } from "react";
import type { Digest } from "@/lib/summarize";
import {
  THEMES,
  DEFAULT_PREFS,
  getHeadlineFont,
  type UserPrefs,
  type ThemeKey,
  type Theme,
} from "@/lib/themes";
import CinematicLayout from "./CinematicLayout";
import TweaksPanel from "./TweaksPanel";

interface ThemeCtxValue {
  t: Theme;
  headlineFont: string;
  showBD: boolean;
  compact: boolean;
}

export const ThemeCtx = createContext<ThemeCtxValue>({
  t: THEMES.Cream,
  headlineFont: getHeadlineFont("Serif"),
  showBD: true,
  compact: false,
});

export function useTheme(): ThemeCtxValue & Theme {
  const ctx = useContext(ThemeCtx);
  return { ...ctx, ...ctx.t };
}

interface Props {
  digest: Digest;
}

export default function DigestClient({ digest }: Props) {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("aifrontier-prefs");
      if (stored) setPrefs(JSON.parse(stored));
    } catch {}
    setMounted(true);
  }, []);

  const t = THEMES[prefs.palette as ThemeKey] ?? THEMES.Cream;
  const headlineFont = getHeadlineFont(prefs.headlines);
  const showBD  = prefs.mode === "Deep Read";
  const compact = prefs.mode === "Scan";

  useEffect(() => {
    if (!mounted) return;
    const r = document.documentElement;
    r.style.setProperty("--page-bg",           t.bg);
    r.style.setProperty("--tab-blur-bg",        t.tabBlurBg);
    r.style.setProperty("--accent",             t.accent);
    r.style.setProperty("--article-hover-bg",   t.articleHoverBg);
    r.style.setProperty("--article-hover-clr",  t.articleHoverClr);
    r.style.setProperty("--play-hover-border",  t.playHoverBorder);
    r.style.setProperty("--play-hover-bg",      t.playHoverBg);
    r.style.setProperty("--tab-hover-clr",      t.tabHoverClr);
    r.style.setProperty("--scroll-thumb",       t.scrollThumb);
    r.style.setProperty("--tab-border",         t.border);
    document.body.style.background = t.bg;
  }, [prefs.palette, t, mounted]);

  function handlePrefsChange(next: UserPrefs) {
    setPrefs(next);
    try { localStorage.setItem("aifrontier-prefs", JSON.stringify(next)); } catch {}
  }

  if (!mounted) {
    return <div style={{ background: t.bg, minHeight: "100vh" }} />;
  }

  return (
    <ThemeCtx.Provider value={{ t, headlineFont, showBD, compact }}>
      <CinematicLayout digest={digest} />
    </ThemeCtx.Provider>
  );
}
