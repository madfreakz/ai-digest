'use client';

import { useRef, useEffect, useState } from 'react';
import type { DigestArticle } from '@/lib/summarize';
import { useTheme } from './DigestClient';
import { formatPublishedAt } from '@/lib/themes';
import Thumb from './Thumb';

interface UpdatedNewsCardProps {
  article: DigestArticle;
  index: number;
}

function useInView<T extends HTMLElement>(ref: React.RefObject<T | null>, threshold = 0.2) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isVisible, isMobile };
}

export default function UpdatedNewsCard({ article, index }: UpdatedNewsCardProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const { isVisible, isMobile } = useInView(ref);
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const delayMs = Math.min(200 + index * 100, 500);
  const animationDelay = `${delayMs}ms`;

  const cardStyle = {
    position: 'relative' as const,
    background: `linear-gradient(135deg, ${theme.cardBackdrop} 0%, rgba(255,255,255,0.2) 100%)`,
    backdropFilter: 'blur(8px)',
    border: `1px solid ${theme.cardBorder}`,
    borderRadius: '8px',
    overflow: 'hidden' as const,
    boxShadow: theme.cardShadow,
    opacity: isVisible ? 1 : 0,
    transform: isHovered ? 'translateY(-8px)' : 'translateY(0)',
  };

  return (
    <>
      <a
        ref={ref}
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className={isVisible ? 'card-anim' : ''}
        style={{
          ...cardStyle,
          ...(isVisible && { ['--card-anim-delay' as any]: animationDelay }),
          textDecoration: 'none',
          color: 'inherit',
          display: 'block',
          transition: 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
          boxShadow: isHovered
            ? '0 24px 48px rgba(24, 20, 12, 0.12), 0 4px 12px rgba(24, 20, 12, 0.08)'
            : theme.cardShadow,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          style={{
            display: 'flex',
            gap: 'clamp(16px, 4vw, 24px)',
            padding: 'clamp(20px, 3vw, 28px)',
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          {/* Thumbnail */}
          <div
            style={{
              flexShrink: 0,
              width: isMobile ? '100%' : '180px',
              height: isMobile ? '160px' : '140px',
              borderRadius: '6px',
              overflow: 'hidden',
              background: `repeating-linear-gradient(-45deg, ${theme.thumbS1} 0px, ${theme.thumbS1} 14px, ${theme.thumbS2} 14px, ${theme.thumbS2} 28px)`,
              transition: 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <Thumb ogImage={article.ogImage} companyLogoUrl={article.companyLogoUrl} label={article.beat} height={140} />
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Meta */}
            <div
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '10px',
                color: theme.textGhost,
                fontWeight: 300,
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span>{article.source}</span>
              {article.companyTags.length > 0 && (
                <>
                  <span>·</span>
                  <span>{article.companyTags.slice(0, 2).join(', ')}</span>
                </>
              )}
              <span>·</span>
              <span style={{ color: theme.textMin }}>{formatPublishedAt(article.publishedAt)}</span>
            </div>

            {/* Title */}
            <h3
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: '20px',
                fontWeight: 500,
                lineHeight: 1.32,
                color: isHovered ? theme.accent : theme.textHigh,
                transition: 'color 0.3s ease',
                margin: 0,
              }}
            >
              {article.title}
            </h3>

            {/* Summary */}
            <p
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                lineHeight: 1.6,
                color: theme.textMid,
                fontWeight: 300,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                margin: 0,
              }}
            >
              {article.summary}
            </p>

            {article.bdRelevance && (
              <div style={{
                borderLeft: `2px solid ${theme.accent}`,
                paddingLeft: '10px',
              }}>
                <span style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '9px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: theme.accent,
                  display: 'block',
                  marginBottom: '3px',
                }}>
                  So What?
                </span>
                <p style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: '12px',
                  lineHeight: 1.55,
                  color: theme.textMid,
                  fontStyle: 'italic',
                  fontWeight: 300,
                  margin: 0,
                }}>
                  {article.bdRelevance}
                </p>
              </div>
            )}
          </div>
        </div>
      </a>

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
        .card-anim {
          animation: fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          animation-delay: var(--card-anim-delay, 0ms);
        }
      `}</style>
    </>
  );
}
