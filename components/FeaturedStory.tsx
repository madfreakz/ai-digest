"use client";

import { useTheme } from "./DigestClient";
import { formatPublishedAt } from "@/lib/themes";
import type { DigestArticle } from "@/lib/summarize";
import Thumb from "./Thumb";

interface Props {
  article: DigestArticle;
  compact: boolean;
}

export default function FeaturedStory({ article, compact }: Props) {
  const { t, headlineFont, showBD } = useTheme();
  const thumbH = compact ? 240 : 360;
  const time = formatPublishedAt(article.publishedAt);

  return (
    <div
      className="featured-wrap"
      style={{ borderBottom: `1px solid ${t.border}`, borderTop: `1px solid ${t.border}` }}
    >
      <a href={article.url} target="_blank" rel="noopener noreferrer">
        <div className="featured-inner">
          <Thumb
            ogImage={article.ogImage}
            companyLogoUrl={article.companyLogoUrl}
            label={article.companyTags.join(" · ").toLowerCase() || article.category.toLowerCase()}
            height={thumbH}
          />
        </div>
      </a>

      <div style={{ padding: compact ? "20px var(--page-pad-x) 26px" : "28px var(--page-pad-x) 38px" }}>
        {/* Lead Story label */}
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 10,
          color: t.accent,
          fontVariantCaps: "small-caps",
          letterSpacing: "0.1em",
          fontWeight: 500,
          marginBottom: 12,
        }}>
          Lead Story
        </div>

        {/* Meta */}
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          color: t.textGhost,
          fontWeight: 300,
          marginBottom: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}>
          <span>{article.source}</span>
          {article.companyTags.length > 0 && (
            <>
              <span style={{ color: t.borderLight }}>·</span>
              <span>{article.companyTags.join(", ")}</span>
            </>
          )}
          <span style={{ color: t.borderLight }}>·</span>
          <span style={{ color: t.textMin }}>{time}</span>
        </div>

        {/* Title */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="article-link"
          style={{ display: "block", marginBottom: 14 }}
        >
          <div
            className="article-title featured-title"
            style={{
              fontFamily: headlineFont,
              fontSize: compact ? 20 : 26,
              fontWeight: 500,
              lineHeight: 1.28,
              color: t.textHigh,
            }}
          >
            {article.title}
            <span className="ext-arrow" style={{ fontSize: 14 }}>↗</span>
          </div>
        </a>

        {/* Summary */}
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          lineHeight: 1.72,
          color: t.textMid,
          fontWeight: 300,
          marginBottom: showBD ? 15 : 0,
        }}>
          {article.summary}
        </div>

        {/* BD insight */}
        {showBD && (
          <div style={{ paddingLeft: 16, borderLeft: `1.5px solid ${t.accent}` }}>
            <span style={{
              fontSize: 10,
              color: t.accent,
              fontFamily: "'DM Sans', sans-serif",
              fontVariantCaps: "small-caps",
              letterSpacing: "0.07em",
              fontWeight: 500,
              marginRight: 8,
            }}>
              So What?
            </span>
            <span style={{
              fontSize: 12.5,
              lineHeight: 1.62,
              color: t.textLow,
              fontStyle: "italic",
              fontFamily: "'Playfair Display', Georgia, serif",
            }}>
              {article.bdRelevance}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
