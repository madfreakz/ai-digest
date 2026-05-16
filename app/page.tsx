import DigestClient from "@/components/DigestClient";
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
          <p style={{ color: "#7A7268", fontSize: 16 }}>Failed to load digest.</p>
          <p style={{ color: "#A8A098", fontSize: 13, marginTop: 8 }}>
            Check that your API keys are set in .env.local
          </p>
        </div>
      </div>
    );
  }

  return <DigestClient digest={digest} />;
}
