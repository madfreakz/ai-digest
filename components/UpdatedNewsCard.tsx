'use client';

import { useState } from 'react';
import type { DigestArticle } from '@/lib/summarize';
import { useTheme } from './DigestClient';
import { formatPublishedAt } from '@/lib/themes';
import Thumb from './Thumb';

interface UpdatedNewsCardProps {
  article: DigestArticle;
}

export default function UpdatedNewsCard({ article }: UpdatedNewsCardProps) {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  // Company-tagged stories show their logo or no image at all: their og:images
  // were often unrelated stock photos (2829582). Untagged stories may use theirs.
  const logoUrl = article.companyLogoUrl ?? null;
  const ogUrl = article.companyTags.length === 0 && article.ogImage?.startsWith('http')
    ? article.ogImage
    : null;
  const imageUrl = logoUrl ?? ogUrl;
  const showThumb = imageUrl !== null && !imgFailed;

  return (
    <article
      className="news-card"
      style={{
        background: `linear-gradient(135deg, ${theme.cardBackdrop} 0%, rgba(255,255,255,0.2) 100%)`,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${theme.cardBorder}`,
        borderRadius: '8px',
        overflow: 'hidden',
        transform: isHovered ? 'translateY(-8px)' : 'translateY(0)',
        transition: 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
        boxShadow: isHovered
          ? '0 24px 48px rgba(24, 20, 12, 0.12), 0 4px 12px rgba(24, 20, 12, 0.08)'
          : theme.cardShadow,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="card-layout">
        {/* Thumbnail: only when there is a real logo or photo */}
        {showThumb && (
          <div
            className="card-thumb"
            aria-hidden="true"
            style={{
              transition: 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <Thumb src={imageUrl} isLogo={logoUrl !== null} onError={() => setImgFailed(true)} />
          </div>
        )}

        {/* Content */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
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
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {article.isNew && (
              <span
                aria-label="New since last publish"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  padding: '4px 7px',
                  borderRadius: 4,
                  background: theme.newBadgeBg,
                  color: theme.newBadgeText,
                  border: `1px solid ${theme.newBadgeBorder}`,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                }}
              >
                New
              </span>
            )}
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

          {/* Title: the card's one link, stretched over the whole card */}
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
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card-link"
            >
              {article.title}
            </a>
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
    </article>
  );
}
