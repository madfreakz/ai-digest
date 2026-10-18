import type { DisplayArticle } from '@/lib/format';

interface HeroFeaturedStoryProps {
  article: DisplayArticle;
}

export default function HeroFeaturedStory({ article }: HeroFeaturedStoryProps) {
  return (
    <article className="lead-story">
      <div className="lead-story-inner">
        <p className="eyebrow">
          <span>Lead Story</span>
          {article.isNew && (
            <span className="new-badge" aria-label="New since last publish">New</span>
          )}
        </p>

        {/* The headline is the story's one link, stretched over the block */}
        <h1 className="lead-title">
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="story-link">
            {article.displayTitle}
          </a>
        </h1>

        <p className="story-meta">
          <span>{article.source}</span>
          {article.companyTags.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{article.companyTags.join(', ')}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>{article.publishedLabel}</span>
        </p>

        <p className="lead-summary">{article.summary}</p>

        {article.bdRelevance && (
          <div className="so-what">
            <span className="so-what-label">So What?</span>
            <p>{article.bdRelevance}</p>
          </div>
        )}
      </div>
    </article>
  );
}
