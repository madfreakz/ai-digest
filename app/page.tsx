import DigestHeader from "@/components/DigestHeader";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import CategorySection from "@/components/CategorySection";
import { fetchRoboticsNews } from "@/lib/exa";
import { generateDigest, type Digest } from "@/lib/summarize";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

const getCachedDigest = unstable_cache(
  async (): Promise<Digest | null> => {
    try {
      const articles = await fetchRoboticsNews();
      if (articles.length === 0) return null;
      return generateDigest(articles);
    } catch (err) {
      console.error("Digest error:", err);
      return null;
    }
  },
  ["daily-digest"],
  { revalidate: 3600 }
);

export default async function Home() {
  const digest = await getCachedDigest();

  if (!digest) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 text-lg">Failed to load digest.</p>
          <p className="text-slate-600 text-sm mt-2">
            Check that your API keys are set in .env.local
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <DigestHeader generatedAt={digest.generatedAt} />
        <ExecutiveSummary summary={digest.executiveSummary} />
        <CategorySection articles={digest.articles} />
      </div>
    </main>
  );
}
