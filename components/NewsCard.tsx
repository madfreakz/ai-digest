import type { DigestArticle } from "@/lib/summarize";

const CATEGORY_STYLES: Record<string, string> = {
  Funding: "bg-emerald-950 text-emerald-400 border-emerald-800",
  Product: "bg-blue-950 text-blue-400 border-blue-800",
  "AI/Models": "bg-violet-950 text-violet-400 border-violet-800",
  Partnerships: "bg-amber-950 text-amber-400 border-amber-800",
  Hiring: "bg-pink-950 text-pink-400 border-pink-800",
  General: "bg-slate-800 text-slate-400 border-slate-700",
};

const COMPANY_COLORS: Record<string, string> = {
  "Physical Intelligence": "text-violet-400",
  "Figure AI": "text-blue-400",
  "1X Technologies": "text-cyan-400",
  "Boston Dynamics": "text-yellow-400",
  "Agility Robotics": "text-orange-400",
  Tesla: "text-red-400",
  "Genesis AI": "text-green-400",
  "Mind Robotics": "text-pink-400",
  "Bedrock Robotics": "text-amber-400",
};

export default function NewsCard({ article }: { article: DigestArticle }) {
  const catStyle =
    CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES["General"];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors flex flex-col gap-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded border ${catStyle}`}
        >
          {article.category}
        </span>
        {article.companyTags.map((c) => (
          <span
            key={c}
            className={`text-xs font-medium ${COMPANY_COLORS[c] ?? "text-slate-400"}`}
          >
            {c}
          </span>
        ))}
        <span className="text-slate-600 text-xs ml-auto">{article.source}</span>
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-slate-100 font-semibold text-sm leading-snug hover:text-blue-400 transition-colors"
      >
        {article.title}
      </a>

      <p className="text-slate-400 text-sm leading-relaxed">{article.summary}</p>

      <div className="border-l-2 border-amber-600 pl-3">
        <p className="text-slate-500 text-xs leading-relaxed">
          <span className="text-amber-600 font-semibold">BD: </span>
          {article.bdRelevance}
        </p>
      </div>
    </div>
  );
}
