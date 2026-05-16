"use client";

import { useState, useEffect, createContext, useContext } from "react";
import type { Digest, DigestArticle } from "@/lib/summarize";
import {
  THEMES,
  DEFAULT_PREFS,
  getHeadlineFont,
  type UserPrefs,
  type ThemeKey,
  type Theme,
} from "@/lib/themes";
import DigestHeader from "./DigestHeader";
import FeaturedStory from "./FeaturedStory";
import CategorySection from "./CategorySection";

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

export function useTheme() {
  return useContext(ThemeCtx);
}

interface Props {
  digest: Digest;
}

export default function DigestClient({ digest }: Props) {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("physai-prefs");
      if (stored) setPrefs(JSON.parse(stored));
    } catch {}
    setMounted(true);
  }, []);

  const t = THEMES[prefs.palette as ThemeKey] ?? THEMES.Cream;
  const headlineFont = getHeadlineFont(prefs.headlines);
  const showBD = prefs.mode === "Deep Read";
  const compact = prefs.mode === "Scan";

  useEffect(() => {
    if (!mounted) return;
    const r = document.documentElement;
    r.style.setProperty("--page-bg", t.bg);
    r.style.setProperty("--tab-blur-bg", t.tabBlurBg);
    r.style.setProperty("--accent", t.accent);
    r.style.setProperty("--article-hover-bg", t.articleHoverBg);
    r.style.setProperty("--article-hover-clr", t.articleHoverClr);
    r.style.setProperty("--play-hover-border", t.playHoverBorder);
    r.style.setProperty("--play-hover-bg", t.playHoverBg);
    r.style.setProperty("--tab-hover-clr", t.tabHoverClr);
    r.style.setProperty("--scroll-thumb", t.scrollThumb);
    r.style.setProperty("--tab-border", t.border);
    document.body.style.background = t.bg;
  }, [prefs.palette, t, mounted]);

  function handlePrefsChange(next: UserPrefs) {
    setPrefs(next);
    try {
      localStorage.setItem("physai-prefs", JSON.stringify(next));
    } catch {}
  }

  // Sort articles by publishedAt desc; featured = first
  const sorted = [...digest.articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const featured: DigestArticle | undefined = sorted[0];
  const rest = sorted.slice(1);

  if (!mounted) {
    // SSR pass: render with default prefs, no CSS vars yet
    return <div style={{ background: t.bg, minHeight: "100vh" }} />;
  }

  return (
    <ThemeCtx.Provider value={{ t, headlineFont, showBD, compact }}>
      <div style={{ background: t.bg, minHeight: "100vh", display: "flex", justifyContent: "center", paddingBottom: 100 }}>
        <div style={{ width: "100%", maxWidth: 680 }}>

          {/* Masthead rule */}
          <div style={{ height: t.mastheadH, background: t.mastheadBg }} />

          {/* Header */}
          <DigestHeader generatedAt={digest.generatedAt} />

          {/* Featured lead story */}
          {featured && <FeaturedStory article={featured} compact={compact} />}

          {/* Category tabs + articles */}
          <CategorySection articles={rest} />

          {/* Footer */}
          <div style={{
            padding: compact ? "20px 56px" : "26px 56px",
            background: t.bgDeep,
            borderTop: `1px solid ${t.border}`,
            marginTop: 20,
          }}>
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              color: t.textGhost,
              fontWeight: 300,
            }}>
              © Mark Fok · Physical AI News
            </div>
          </div>

        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
