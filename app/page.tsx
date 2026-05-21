import DigestClient from "@/components/DigestClient";
import { MOCK_DIGEST } from "@/lib/mock-digest";
import { getPublishedDigest, getPreviousDigest } from "@/lib/beat-digests";

// Force dynamic rendering so the build never makes live Exa/Gemini calls.
// Content is stable — it only changes when send-digest publishes to
// digest:published and calls revalidatePath('/') to bust the CDN cache.
export const dynamic = "force-dynamic";

export default async function Home() {
  if (process.env.NODE_ENV === "development") {
    return <DigestClient digest={MOCK_DIGEST} />;
  }

  // Only serve the published digest. If it's missing, show the empty state
  // rather than triggering live Exa+Gemini aggregation on a pageview —
  // that would expose unauthenticated cost (any visitor / scraper could
  // drive Exa and Gemini spend).
  const [digest, previous] = await Promise.all([
    getPublishedDigest(),
    getPreviousDigest(),
  ]);

  if (!digest || digest.articles.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF8F4" }}>
        <div style={{ textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
          <p style={{ color: "#7A7268", fontSize: 16 }}>First digest arrives at 7am PT.</p>
          <p style={{ color: "#A8A098", fontSize: 13, marginTop: 8 }}>Check back then — refreshes daily at 7am and 4pm PT.</p>
        </div>
      </div>
    );
  }

  // First-publish guard: only mark "new" when a previous snapshot exists,
  // otherwise every article on day one would carry a NEW badge.
  const priorIds = previous ? new Set(previous.articles.map(a => a.storyId)) : null;
  const augmented = priorIds
    ? { ...digest, articles: digest.articles.map(a => ({ ...a, isNew: !priorIds.has(a.storyId) })) }
    : digest;

  return <DigestClient digest={augmented} />;
}
