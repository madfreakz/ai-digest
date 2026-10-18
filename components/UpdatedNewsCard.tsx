'use client';

import { useState } from 'react';
import type { DisplayArticle } from '@/lib/format';
import Thumb from './Thumb';

interface UpdatedNewsCardProps {
  article: DisplayArticle;
}

export default function UpdatedNewsCard({ article }: UpdatedNewsCardProps) {
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
    <article className="news-card">
      <div className="card-layout">
        {/* Thumbnail: only when there is a real logo or photo */}
        {showThumb && (
          <div className="card-thumb" aria-hidden="true">
            <Thumb src={imageUrl} isLogo={logoUrl !== null} onError={() => setImgFailed(true)} />
          </div>
        )}

        <div className="card-body">
          <p className="story-meta">
            {article.isNew && (
              <span className="new-badge" aria-label="New since last publish">New</span>
            )}
            <span>{article.source}</span>
            {article.companyTags.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{article.companyTags.slice(0, 2).join(', ')}</span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{article.publishedLabel}</span>
          </p>

          {/* Title: the card's one link, stretched over the whole card */}
          <h3 className="card-title">
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="story-link">
              {article.displayTitle}
            </a>
          </h3>

          <p className="card-summary">{article.summary}</p>

          {article.bdRelevance && (
            <div className="so-what">
              <span className="so-what-label">So What?</span>
              <p>{article.bdRelevance}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
