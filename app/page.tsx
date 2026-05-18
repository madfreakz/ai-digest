import DigestClient from "@/components/DigestClient";
import { fetchAllNews } from "@/lib/exa";
import { generateDigest, type Digest } from "@/lib/summarize";
import { MOCK_DIGEST } from "@/lib/mock-digest";
import { unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

function todayKey(): string {
  return `digest:v3:${new Date().toISOString().split("T")[0]}`;
}

async function kvRead(key: string): Promise<Digest | null> {
  try {
    const { kv } = await import("@vercel/kv");
    return (await kv.get<Digest>(key)) ?? null;
  } catch {
    return null;
  }
}

const getCachedDigest = unstable_cache(
  async (): Promise<Digest | null> => {
    // Prefer KV (populated once daily by cron) — avoids re-running Exa + Claude
    const kvDigest = await kvRead(todayKey());
    if (kvDigest) return kvDigest;

    // In development without KV, use mock data for testing
    if (process.env.NODE_ENV === "development") {
      console.warn("Using mock digest data in development. Configure Vercel KV for production.");
      return MOCK_DIGEST;
    }

    try {
      const articles = await fetchAllNews();
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
