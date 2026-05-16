"use client";

import { useState } from "react";
import type { DigestArticle, Category } from "@/lib/summarize";
import { useTheme } from "./DigestClient";
import NewsCard from "./NewsCard";

const CATEGORY_ORDER: Category[] = [
  "Funding",
  "Product",
  "AI/Models",
  "Partnerships",
  "Hiring",
  "General",
];

interface Props {
  articles: DigestArticle[];
}

export default function CategorySection({ articles }: Props) {
  const { t } = useTheme();

  const grouped = CATEGORY_ORDER.reduce<Record<Category, DigestArticle[]>>(
    (acc, cat) => {
      acc[cat] = articles.filter((a) => a.category === cat);
      return acc;
    },
    {} as Record<Category, DigestArticle[]>
  );

  const activeCats = CATEGORY_ORDER.filter((c) => grouped[c].length > 0);
  const [active, setActive] = useState<Category>(activeCats[0] ?? "General");
  const [animKey, setAnimKey] = useState(0);

  function switchTab(tab: Category) {
    if (tab === active) return;
    setActive(tab);
    setAnimKey((k) => k + 1);
  }

  return (
    <div>
      {/* Sticky tab bar */}
      <div
        className="tab-bar"
        style={{ position: "sticky", top: 0, zIndex: 10, padding: "0 var(--page-pad-x)" }}
      >
        <div style={{ display: "flex", overflowX: "auto", WebkitOverflowScrolling: "touch" as const, scrollbarWidth: "none" }}>
          {activeCats.map((cat) => {
            const isActive = cat === active;
            return (
              <button
                key={cat}
                onClick={() => switchTab(cat)}
                className={`tab-btn${isActive ? " tab-active" : ""}`}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: isActive
                    ? `1.5px solid ${t.accent}`
                    : "1.5px solid transparent",
                  padding: "16px 18px 14px",
                  marginBottom: -1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  className="tab-label"
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: isActive ? 500 : 300,
                    color: isActive ? t.accent : t.textGhost,
                    transition: "all 0.14s ease",
                  }}
                >
                  {cat}
                </span>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 9,
                    color: isActive ? t.textGhost : t.textMin,
                    transition: "color 0.14s ease",
                  }}
                >
                  {grouped[cat].length}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Article list with fade animation on tab change */}
      <div key={animKey} className="tab-content">
        {grouped[active].map((article, i) => (
          <NewsCard key={article.url} article={article} index={i} />
        ))}
      </div>
    </div>
  );
}
