"use client";

import { useState } from "react";
import type { DigestArticle, Category } from "@/lib/summarize";
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
  const grouped = CATEGORY_ORDER.reduce<Record<Category, DigestArticle[]>>(
    (acc, cat) => {
      acc[cat] = articles.filter((a) => a.category === cat);
      return acc;
    },
    {} as Record<Category, DigestArticle[]>
  );

  const activeCats = CATEGORY_ORDER.filter((c) => grouped[c].length > 0);
  const [active, setActive] = useState<Category>(activeCats[0]);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap mb-6 border-b border-slate-800 pb-0">
        {activeCats.map((cat) => (
          <button
            key={cat}
            onClick={() => setActive(cat)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative -mb-px ${
              active === cat
                ? "text-slate-100 bg-slate-900 border border-b-slate-900 border-slate-700"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {cat}
            <span className={`ml-1.5 text-xs ${active === cat ? "text-slate-400" : "text-slate-700"}`}>
              {grouped[cat].length}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="grid gap-3 sm:grid-cols-2">
        {grouped[active].map((a) => (
          <NewsCard key={a.url} article={a} />
        ))}
      </div>
    </div>
  );
}
