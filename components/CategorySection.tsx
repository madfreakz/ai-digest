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

  return (
    <div className="space-y-10">
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat];
        if (items.length === 0) return null;
        return (
          <section key={cat}>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                {cat}
              </h2>
              <span className="text-slate-700 text-xs">{items.length}</span>
              <div className="flex-1 border-t border-slate-800" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((a) => (
                <NewsCard key={a.url} article={a} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
