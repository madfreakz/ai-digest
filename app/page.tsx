import DigestClient from "@/components/DigestClient";
import { fetchAllNews } from "@/lib/exa";
import { generateDigest, type Digest } from "@/lib/summarize";
import { MOCK_DIGEST } from "@/lib/mock-digest";

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

async function kvWrite(key: string, value: Digest): Promise<void> {
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(key, value, { ex: 26 * 60 * 60 });
  } catch {
    // Non-fatal
  }
}

async function getDigest(): Promise<Digest | null> {
  // Fast path: KV cache hit
  const cached = await kvRead(todayKey());
  if (cached && cached.articles.length > 0) return cached;

  if (process.env.NODE_ENV === "development") {
    return MOCK_DIGEST;
  }

  try {
    const articles = await fetchAllNews();
    if (articles.length === 0) return null;
    const digest = await generateDigest(articles);
    if (digest.articles.length === 0) return null;
    // Store in KV so subsequent loads are instant
    await kvWrite(todayKey(), digest);
    return digest;
  } catch (err) {
    console.error("Digest error:", err);
    return null;
  }
}

export default async function Home() {
  const digest = await getDigest();

  if (!digest) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
          <p style={{ color: "#7A7268", fontSize: 16 }}>Digest is generating — check back in a minute.</p>
          <p style={{ color: "#A8A098", fontSize: 13, marginTop: 8 }}>
            The daily digest is being fetched. Refresh in ~60 seconds.
          </p>
        </div>
      </div>
    );
  }

  return <DigestClient digest={digest} />;
}
