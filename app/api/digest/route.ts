import { NextResponse } from "next/server";
import { fetchAllNews } from "@/lib/exa";
import { generateDigest, type Digest } from "@/lib/summarize";

export const dynamic = "force-dynamic";

function dateKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `digest:v3:${d.toISOString().split("T")[0]}`;
}

async function kvGet(key: string): Promise<Digest | null> {
  try {
    const { kv } = await import("@vercel/kv");
    const val = await kv.get<Digest>(key);
    return val ?? null;
  } catch {
    return null;
  }
}

async function kvSet(key: string, value: Digest): Promise<void> {
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(key, value, { ex: 48 * 60 * 60 }); // 48-hour TTL — covers overnight gap
  } catch {
    // Non-fatal — continue without caching
  }
}

export async function GET() {
  // Cache hit: return today's digest immediately (only if it has articles)
  const cached = await kvGet(dateKey());
  if (cached && cached.articles.length > 0) return NextResponse.json(cached);

  try {
    const articles = await fetchAllNews();

    if (articles.length === 0) {
      // Try yesterday as a graceful fallback
      const stale = await kvGet(dateKey(-1));
      if (stale) return NextResponse.json({ ...stale, stale: true });
      return NextResponse.json({ error: "No articles found" }, { status: 404 });
    }

    const digest = await generateDigest(articles);
    if (digest.articles.length > 0) await kvSet(dateKey(), digest);
    return NextResponse.json(digest);
  } catch (err) {
    console.error("Digest error:", err);
    const stale = await kvGet(dateKey(-1));
    if (stale) return NextResponse.json({ ...stale, stale: true });
    return NextResponse.json({ error: "Failed to generate digest" }, { status: 500 });
  }
}
