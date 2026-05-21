export type ThemeKey = 'Cream' | 'Ink' | 'Press';
export type HeadlineFont = 'Serif' | 'Sans';
export type ReadingMode = 'Deep Read' | 'Scan';

export interface UserPrefs {
  palette: ThemeKey;
  headlines: HeadlineFont;
  mode: ReadingMode;
}

export const DEFAULT_PREFS: UserPrefs = {
  palette: 'Cream',
  headlines: 'Serif',
  mode: 'Deep Read',
};

export interface Theme {
  bg: string; bgDeep: string;
  border: string; borderLight: string;
  textHigh: string; textMid: string; textLow: string; textGhost: string; textMin: string;
  accent: string; accentMid: string;
  mastheadBg: string; mastheadH: number;
  tabBlurBg: string;
  articleHoverBg: string; articleHoverClr: string;
  playHoverBorder: string; playHoverBg: string;
  tabHoverClr: string; scrollThumb: string;
  thumbS1: string; thumbS2: string;
  thumbVignette: string; thumbLabel: string;
  playBorder: string; playBg: string; playArrow: string;
  // Cinematic design tokens
  scrollProgressGradient: string;
  cardBackdrop: string;
  cardBorder: string;
  cardShadow: string;
  heroShadow: string;
  stoneTextureBg: string;
  // "NEW" badge — articles new since the previous publish
  newBadgeBg: string;
  newBadgeText: string;
  newBadgeBorder: string;
}

export const THEMES: Record<ThemeKey, Theme> = {
  Cream: {
    bg: '#FAF8F4',           bgDeep: '#EDE9DF',
    border: '#DED8CC',       borderLight: '#E8E2D6',
    textHigh: '#18140C',     textMid: '#585048',
    textLow: '#7A7268',      textGhost: '#A8A098',     textMin: '#C8C0B0',
    accent: '#1B3A6B',       accentMid: '#2E5EA8',
    mastheadBg: 'linear-gradient(90deg, #1B3A6B 0%, #2E5EA8 35%, transparent 100%)',
    mastheadH: 2,
    tabBlurBg: 'rgba(250,248,244,0.85)',
    articleHoverBg: 'rgba(27,58,107,0.025)',  articleHoverClr: '#080604',
    playHoverBorder: 'rgba(27,58,107,0.5)',   playHoverBg: 'rgba(27,58,107,0.1)',
    tabHoverClr: '#5A6E8A',  scrollThumb: '#D0C8BC',
    thumbS1: '#ECE8E0',      thumbS2: '#E4DED4',
    thumbVignette: 'radial-gradient(ellipse at center, transparent 25%, rgba(245,242,236,0.5) 100%)',
    thumbLabel: 'rgba(140,132,120,0.65)',
    playBorder: 'rgba(27,58,107,0.18)', playBg: 'rgba(27,58,107,0.04)', playArrow: 'rgba(27,58,107,0.38)',
    scrollProgressGradient: 'linear-gradient(90deg, #1B3A6B 0%, #2E5EA8 100%)',
    cardBackdrop: 'rgba(255,255,255,0.5)',
    cardBorder: 'rgba(222,216,204,0.6)',
    cardShadow: '0 8px 32px rgba(24,20,12,0.06), 0 2px 8px rgba(24,20,12,0.04)',
    heroShadow: '0 40px 80px rgba(24,20,12,0.12), 0 8px 16px rgba(24,20,12,0.08)',
    stoneTextureBg: '#FAF8F4',
    newBadgeBg: '#10b981', newBadgeText: '#FFFFFF', newBadgeBorder: 'rgba(6,95,70,0.20)',
  },
  Ink: {
    bg: '#18150E',           bgDeep: '#130F09',
    border: '#2C2618',       borderLight: '#231D12',
    textHigh: '#EDE5D4',     textMid: '#A89C8C',
    textLow: '#786C5C',      textGhost: '#504438',     textMin: '#302820',
    accent: '#D4785A',       accentMid: '#C86040',
    mastheadBg: 'linear-gradient(90deg, #D4785A 0%, #8A4030 46%, transparent 100%)',
    mastheadH: 2,
    tabBlurBg: 'rgba(24,21,14,0.93)',
    articleHoverBg: 'rgba(212,120,90,0.025)',  articleHoverClr: '#F8F2E8',
    playHoverBorder: 'rgba(212,120,90,0.6)',   playHoverBg: 'rgba(212,120,90,0.14)',
    tabHoverClr: '#8A7A6A',  scrollThumb: '#2C2418',
    thumbS1: '#1C1810',      thumbS2: '#181410',
    thumbVignette: 'radial-gradient(ellipse at center, transparent 20%, rgba(10,8,4,0.65) 100%)',
    thumbLabel: 'rgba(80,68,52,0.7)',
    playBorder: 'rgba(212,120,90,0.22)', playBg: 'rgba(212,120,90,0.06)', playArrow: 'rgba(212,120,90,0.5)',
    scrollProgressGradient: 'linear-gradient(90deg, #D4785A 0%, #8A4030 100%)',
    cardBackdrop: 'rgba(25,21,16,0.6)',
    cardBorder: 'rgba(44,38,24,0.8)',
    cardShadow: '0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.15)',
    heroShadow: '0 40px 80px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.2)',
    stoneTextureBg: '#18150E',
    newBadgeBg: '#34d399', newBadgeText: '#08130E', newBadgeBorder: 'rgba(167,243,208,0.35)',
  },
  Press: {
    bg: '#FFFFFF',           bgDeep: '#F2F2F2',
    border: '#E0E0E0',       borderLight: '#EBEBEB',
    textHigh: '#000000',     textMid: '#3A3A3A',
    textLow: '#6A6A6A',      textGhost: '#9A9A9A',     textMin: '#C0C0C0',
    accent: '#000000',       accentMid: '#2A2A2A',
    mastheadBg: '#000000',
    mastheadH: 3,
    tabBlurBg: 'rgba(255,255,255,0.96)',
    articleHoverBg: 'rgba(0,0,0,0.025)',       articleHoverClr: '#000000',
    playHoverBorder: 'rgba(0,0,0,0.4)',         playHoverBg: 'rgba(0,0,0,0.08)',
    tabHoverClr: '#4A4A4A',  scrollThumb: '#C8C8C8',
    thumbS1: '#F0F0F0',      thumbS2: '#E8E8E8',
    thumbVignette: 'transparent',
    thumbLabel: 'rgba(100,100,100,0.6)',
    playBorder: 'rgba(0,0,0,0.15)', playBg: 'rgba(0,0,0,0.03)', playArrow: 'rgba(0,0,0,0.3)',
    scrollProgressGradient: 'linear-gradient(90deg, #000000 0%, #2A2A2A 100%)',
    cardBackdrop: 'rgba(242,242,242,0.5)',
    cardBorder: 'rgba(224,224,224,0.8)',
    cardShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
    heroShadow: '0 40px 80px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.06)',
    stoneTextureBg: '#FFFFFF',
    newBadgeBg: '#10b981', newBadgeText: '#FFFFFF', newBadgeBorder: 'rgba(6,78,59,0.30)',
  },
};

export function getHeadlineFont(pref: HeadlineFont): string {
  return pref === 'Serif'
    ? "'Playfair Display', Georgia, serif"
    : "'DM Sans', sans-serif";
}

export function formatPublishedAt(iso: string): string {
  try {
    const d = new Date(iso);
    const ptOpts = { timeZone: 'America/Los_Angeles' } as const;
    const ptToday = new Date(new Date().toLocaleString('en-US', ptOpts));
    const ptArticle = new Date(d.toLocaleString('en-US', ptOpts));
    const isToday = ptArticle.toDateString() === ptToday.toDateString();
    const timeStr = ptArticle.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, ...ptOpts,
    });
    if (isToday) return `Today, ${timeStr} PT`;
    const dateStr = ptArticle.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', ...ptOpts,
    });
    return `${dateStr}, ${timeStr} PT`;
  } catch {
    return '';
  }
}
