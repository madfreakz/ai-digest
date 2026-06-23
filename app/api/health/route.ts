import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Lightweight ops endpoint: per-beat refresh freshness + a published-digest
// summary. Bookmarkable, no auth (everything here is already public on the
// homepage). This surfaces the stale-beat detector that previously only wrote
// to server logs, so an overdue beat is visible without digging through Vercel.
export async function GET() {
  try {
    const { getBeatFreshness, getPublishedDigest } = await import("@/lib/beat-digests");
    const [freshness, digest] = await Promise.all([getBeatFreshness(), getPublishedDigest()]);

    const staleBeats = freshness.filter(f => f.stale).map(f => f.beat);
    const dates = digest ? digest.articles.map(a => a.publishedAt).sort() : [];
    const newestArticle = dates.length ? dates[dates.length - 1] : null;

    return NextResponse.json({
      status: staleBeats.length === 0 ? "ok" : "degraded",
      now: new Date().toISOString(),
      staleBeats,
      beats: freshness.map(f => ({
        beat: f.beat,
        lastSuccess: f.lastSuccess,
        ageHours: f.ageHours === null ? null : Math.round(f.ageHours * 10) / 10,
        stale: f.stale,
        ...(f.error ? { error: f.error } : {}),
      })),
      publishedDigest: digest
        ? { generatedAt: digest.generatedAt, articleCount: digest.articles.length, newestArticle }
        : null,
    });
  } catch (err) {
    console.error("[health] error:", err);
    return NextResponse.json({ status: "error", error: "health check failed" }, { status: 500 });
  }
}
