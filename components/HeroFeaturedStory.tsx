'use client';

import { useRef, useEffect, useState } from 'react';
import type { DigestArticle } from '@/lib/summarize';
import { useTheme } from './DigestClient';
import { formatPublishedAt } from '@/lib/themes';

interface HeroFeaturedStoryProps {
  article: DigestArticle;
  compact?: boolean;
}

function useInView(ref: React.RefObject<HTMLAnchorElement | null>, threshold = 0.15) {
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

export default function HeroFeaturedStory({ article, compact = false }: HeroFeaturedStoryProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const isVisible = useInView(ref);
  const theme = useTheme();

  const minHeight = compact ? '60vh' : '78vh';
  const padding = compact ? '48px 56px' : '60px 56px';
  const titleSize = compact ? '38px' : '48px';
  const gap = compact ? '32px' : '40px';

  return (
    <a
      ref={ref}
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: 'relative',
        minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: `linear-gradient(135deg, rgba(27, 58, 107, 0.02) 0%, rgba(27, 58, 107, 0.01) 100%)`,
        textDecoration: 'none',
        color: 'inherit',
      }}
      className={isVisible ? 'hero-visible' : ''}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          padding,
          display: 'flex',
          flexDirection: 'column',
          gap,
          opacity: isVisible ? 1 : 0.7,
          transition: 'opacity 0.6s ease',
        }}
      >
        {/* Text content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            className={isVisible ? 'hero-anim hero-anim-1' : ''}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              fontVariantCaps: 'small-caps',
              color: theme.accent,
              textTransform: 'uppercase',
              opacity: isVisible ? 1 : 0,
            }}
          >
            Lead Story
          </div>

          <h1
            className={isVisible ? 'hero-anim hero-anim-2' : ''}
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: titleSize,
              fontWeight: 600,
              lineHeight: 1.2,
              color: theme.textHigh,
              letterSpacing: '-0.02em',
              opacity: isVisible ? 1 : 0,
            }}
          >
            {article.title}
          </h1>

          <div
            className={isVisible ? 'hero-anim hero-anim-3' : ''}
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '12px',
              color: theme.textGhost,
              fontWeight: 300,
              opacity: isVisible ? 1 : 0,
            }}
          >
            <span>{article.source}</span>
            {article.companyTags.length > 0 && (
              <>
                <span>·</span>
                <span>{article.companyTags.join(', ')}</span>
              </>
            )}
            <span>·</span>
            <span style={{ color: theme.textMin }}>{formatPublishedAt(article.publishedAt)}</span>
          </div>

          <p
            className={isVisible ? 'hero-anim hero-anim-4' : ''}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '16px',
              lineHeight: 1.7,
              color: theme.textMid,
              fontWeight: 300,
              opacity: isVisible ? 1 : 0,
            }}
          >
            {article.summary}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .hero-anim {
          animation: fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        .hero-anim-1 { animation-delay: 0.1s; }
        .hero-anim-2 { animation-delay: 0.15s; }
        .hero-anim-3 { animation-delay: 0.2s; }
        .hero-anim-4 { animation-delay: 0.25s; }
      `}</style>
    </a>
  );
}
