'use client';

import { useState, useRef, useEffect } from 'react';
import type { DigestArticle, Beat } from '@/lib/summarize';
import { useTheme } from './DigestClient';
import UpdatedNewsCard from './UpdatedNewsCard';

interface UpdatedBeatSectionProps {
  articles: DigestArticle[];
}

function useInView<T extends HTMLElement>(ref: React.RefObject<T | null>, threshold = 0.15) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          obs.unobserve(entry.target);
        }
      },
      { threshold }
    );

    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, threshold]);

  return isVisible;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

const BEATS: Beat[] = ['AI Labs', 'Physical AI', 'AI Infrastructure', 'Vertical AI'];

export default function UpdatedBeatSection({ articles }: UpdatedBeatSectionProps) {
  const [activeBeat, setActiveBeat] = useState<Beat>(
    () => BEATS.find(beat => articles.some(a => a.beat === beat)) ?? 'AI Labs'
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [fadeIn, setFadeIn] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const isVisible = useInView(ref);
  const theme = useTheme();
  const prefersReducedMotion = usePrefersReducedMotion();

  const beatArticles = articles.filter((a) => a.beat === activeBeat);
  const categories = Array.from(new Set(beatArticles.map((a) => a.category)));
  const filteredArticles = activeCategory
    ? beatArticles.filter((a) => a.category === activeCategory)
    : beatArticles;

  const beatCounts = BEATS.map((beat) => ({
    beat,
    count: articles.filter((a) => a.beat === beat).length,
  }));

  const handleBeatChange = (beat: Beat) => {
    if (beat !== activeBeat) {
      setFadeIn(false);
      setActiveCategory(null);
      const delay = prefersReducedMotion ? 0 : 150;
      setTimeout(() => {
        setActiveBeat(beat);
        setFadeIn(true);
      }, delay);
    }
  };

  const handleBeatKeyDown = (e: React.KeyboardEvent, index: number) => {
    let newIndex = index;
    if (e.key === 'ArrowRight') {
      newIndex = (index + 1) % BEATS.length;
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      newIndex = (index - 1 + BEATS.length) % BEATS.length;
      e.preventDefault();
    }
    if (newIndex !== index) {
      handleBeatChange(BEATS[newIndex]);
    }
  };

  return (
    <>
      {/* Sticky tab bar with enhanced styling */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          background: theme.tabBlurBg,
          borderBottom: `1px solid rgba(27, 58, 107, 0.10)`,
          padding: '16px var(--page-pad-x)',
          boxShadow: '0 2px 8px rgba(27, 58, 107, 0.04)',
        }}
      >
        <div
          role="tablist"
          style={{
            display: 'flex',
            gap: 0,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
        >
          {beatCounts.map(({ beat, count }, index) => (
            <button
              key={beat}
              role="tab"
              aria-selected={activeBeat === beat}
              aria-label={`${beat} category with ${count} articles`}
              onClick={() => handleBeatChange(beat)}
              onKeyDown={(e) => handleBeatKeyDown(e, index)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: `1.5px solid ${activeBeat === beat ? theme.accent : 'transparent'}`,
                padding: '10px 18px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '11.5px',
                fontWeight: activeBeat === beat ? 500 : 400,
                letterSpacing: '0.03em',
                color: activeBeat === beat ? theme.accent : theme.textGhost,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.18s ease, border-color 0.18s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (activeBeat !== beat) {
                  (e.target as HTMLButtonElement).style.color = theme.tabHoverClr;
                }
              }}
              onMouseLeave={(e) => {
                if (activeBeat !== beat) {
                  (e.target as HTMLButtonElement).style.color = theme.textGhost;
                }
              }}
            >
              <span>{beat}</span>
              <span
                aria-hidden="true"
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '9px',
                  opacity: 0.7,
                }}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Category tabs */}
        {categories.length > 0 && (
          <div
            role="tablist"
            aria-label={`Category filter for ${activeBeat}`}
            style={{
              display: 'flex',
              gap: 0,
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              borderTop: `1px solid rgba(${
                theme.bg === '#FAF8F4'
                  ? '222, 216, 204'
                  : theme.bg === '#18150E'
                  ? '44, 38, 24'
                  : '224, 224, 224'
              }, 0.3)`,
            }}
          >
            <button
              role="tab"
              aria-selected={activeCategory === null}
              aria-label="Show all categories"
              onClick={() => setActiveCategory(null)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: `1.5px solid ${activeCategory === null ? theme.accent : 'transparent'}`,
                padding: '7px 16px',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '10.5px',
                fontWeight: activeCategory === null ? 500 : 400,
                letterSpacing: '0.04em',
                textTransform: 'uppercase' as const,
                color: activeCategory === null ? theme.accent : theme.textGhost,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.18s ease, border-color 0.18s ease',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (activeCategory !== null) {
                  (e.target as HTMLButtonElement).style.color = theme.tabHoverClr;
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== null) {
                  (e.target as HTMLButtonElement).style.color = theme.textGhost;
                }
              }}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                role="tab"
                aria-selected={activeCategory === cat}
                aria-label={`Filter by ${cat}`}
                onClick={() => setActiveCategory(cat)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: `1.5px solid ${activeCategory === cat ? theme.accent : 'transparent'}`,
                  padding: '7px 16px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '10.5px',
                  fontWeight: activeCategory === cat ? 500 : 400,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase' as const,
                  color: activeCategory === cat ? theme.accent : theme.textGhost,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.18s ease, border-color 0.18s ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (activeCategory !== cat) {
                    (e.target as HTMLButtonElement).style.color = theme.tabHoverClr;
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeCategory !== cat) {
                    (e.target as HTMLButtonElement).style.color = theme.textGhost;
                  }
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Articles section with distinct background */}
      <section
        ref={ref}
        style={{
          padding: `32px var(--page-pad-x) 80px`,
          background: `linear-gradient(180deg, rgba(250, 248, 244, 0.15) 0%, rgba(250, 248, 244, 0.08) 50%, rgba(27, 58, 107, 0.02) 100%)`,
          borderTop: `1px solid rgba(27, 58, 107, 0.06)`,
          borderBottom: `1px solid rgba(27, 58, 107, 0.06)`,
        }}
      >
        <div>
          <h2
            className={isVisible ? 'beat-anim' : ''}
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(24px, 5vw, 32px)',
              fontWeight: 600,
              color: theme.textHigh,
              marginBottom: 'clamp(32px, 8vw, 48px)',
              opacity: isVisible ? 1 : 0,
            }}
          >
            {activeBeat}
          </h2>
        </div>

        {/* Articles grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 'clamp(24px, 4vw, 32px)',
            opacity: fadeIn ? 1 : 0.3,
            transition: 'opacity 0.15s ease',
          }}
        >
          {filteredArticles.length > 0 ? (
            filteredArticles.map((article, i) => (
              <UpdatedNewsCard key={`${activeBeat}-${activeCategory}-${i}`} article={article} index={i} />
            ))
          ) : (
            <p style={{ color: theme.textGhost, fontStyle: 'italic' }}>No articles found{activeCategory ? ` in ${activeCategory}` : ''} for {activeBeat}</p>
          )}
        </div>
      </section>

    </>
  );
}
