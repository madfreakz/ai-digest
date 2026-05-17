"use client";

import { useState, useEffect, createContext, useContext } from "react";
import type { Digest, DigestArticle } from "@/lib/summarize";
import type { Beat } from "@/lib/companies";
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
import BeatSection from "./BeatSection";
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

export function useTheme() {
  return useContext(ThemeCtx);
}

interface Props {
  digest: Digest;
}

function compositeScore(a: DigestArticle): number {
  return (a.relevanceScore ?? 5) * 0.7 + (a.impactScore ?? 5) * 0.3;
}

function pickFeatured(articles: DigestArticle[]): DigestArticle | undefined {
  // Prefer highest-relevance deal-signal article; fall back to highest composite score
  const withSignal = articles.filter(a => a.dealSignal);
  if (withSignal.length > 0) {
    return withSignal.sort((a, b) => compositeScore(b) - compositeScore(a))[0];
  }
  return [...articles].sort((a, b) => compositeScore(b) - compositeScore(a))[0];
}

export default function DigestClient({ digest }: Props) {
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);
  const [activeBeat, setActiveBeat] = useState<Beat>("Physical AI");

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

  const featured = pickFeatured(digest.articles);
  const rest = digest.articles.filter(a => a !== featured);

  if (!mounted) {
    return <div style={{ background: t.bg, minHeight: "100vh" }} />;
  }

  return (
    <ThemeCtx.Provider value={{ t, headlineFont, showBD, compact }}>
      <div style={{ background: t.bg, minHeight: "100vh", display: "flex", justifyContent: "center", paddingBottom: 100 }}>
        <div style={{ width: "100%", maxWidth: 680, minWidth: 0 }}>

          {/* Masthead rule */}
          <div style={{ height: t.mastheadH, background: t.mastheadBg }} />

          {/* Header */}
          <DigestHeader generatedAt={digest.generatedAt} />

          {/* Featured lead story */}
          {featured && <FeaturedStory article={featured} compact={compact} />}

          {/* Beat tabs → category tabs → articles */}
          <BeatSection
            articles={rest}
            activeBeat={activeBeat}
            onBeatChange={setActiveBeat}
          />

          {/* Footer */}
          <div style={{
            padding: compact ? "20px var(--page-pad-x)" : "26px var(--page-pad-x)",
            paddingBottom: `calc(${compact ? "20px" : "26px"} + env(safe-area-inset-bottom, 0px))`,
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
              © Mark Fok · AI Frontier Digest
            </div>
          </div>

        </div>
      </div>

      <TweaksPanel prefs={prefs} onPrefsChange={handlePrefsChange} />
    </ThemeCtx.Provider>
  );
}
