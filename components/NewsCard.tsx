"use client";

import { useTheme } from "./DigestClient";
import { formatPublishedAt } from "@/lib/themes";
import type { DigestArticle } from "@/lib/summarize";
import Thumb from "./Thumb";

interface Props {
  article: DigestArticle;
  index: number;
}

export default function NewsCard({ article, index }: Props) {
  const { t, headlineFont, showBD, compact } = useTheme();
  const hasThumb = index === 0 && (!!article.ogImage || !!article.companyTags.length);
  const thumbH = compact ? 160 : 220;
  const time = formatPublishedAt(article.publishedAt);

  const padV = compact
    ? hasThumb ? "14px var(--page-pad-x) 16px" : "14px var(--page-pad-x) 14px"
    : hasThumb ? "22px var(--page-pad-x) 30px" : "24px var(--page-pad-x) 28px";

  return (
    <div
      className="article-item"
      style={{ borderTop: index === 0 ? "none" : `1px solid ${t.borderLight}` }}
    >
      {hasThumb && (
        <a href={article.url} target="_blank" rel="noopener noreferrer">
          <Thumb
            ogImage={article.ogImage}
            label={article.companyTags.join(" · ").toLowerCase() || article.category.toLowerCase()}
            height={thumbH}
          />
        </a>
      )}

      <div style={{ padding: padV }}>
        {/* Meta */}
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          color: t.textGhost,
          fontWeight: 300,
          marginBottom: 9,
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

        {/* Title — slightly larger + accent left border for high-impact articles */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="article-link"
          style={article.impactScore >= 8 ? { borderLeft: `2px solid ${t.accent}`, paddingLeft: 10, display: "block" } : undefined}
        >
          <div
            className="article-title"
            style={{
              fontFamily: headlineFont,
              fontSize: hasThumb ? 20 : article.impactScore >= 8 ? 18 : 16.5,
              fontWeight: hasThumb ? 500 : article.impactScore >= 8 ? 500 : 400,
              lineHeight: 1.36,
              color: t.textHigh,
              marginBottom: hasThumb ? 13 : 9,
            }}
          >
            {article.title}
            <span className="ext-arrow">↗</span>
          </div>
        </a>

        {/* Summary */}
        <div style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13.5,
          lineHeight: 1.72,
          color: t.textMid,
          fontWeight: 300,
          marginBottom: showBD ? 13 : 0,
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
