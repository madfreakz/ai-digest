import DigestClient from "@/components/DigestClient";
import { MOCK_DIGEST } from "@/lib/mock-digest";
import type { Digest } from "@/lib/summarize";

export const dynamic = "force-dynamic";

async function getCachedDigest(): Promise<Digest | null> {
  try {
    const { kv } = await import("@vercel/kv");
    const fmt = (d: Date) => `digest:v3:${d.toISOString().split("T")[0]}`;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Try today first, then yesterday — never generate inline (would timeout)
    for (const key of [fmt(today), fmt(yesterday)]) {
      const val = await kv.get<Digest>(key);
      if (val && val.articles?.length > 0) return val;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function Home() {
  if (process.env.NODE_ENV === "development") {
    return <DigestClient digest={MOCK_DIGEST} />;
  }

  const digest = await getCachedDigest();

  if (!digest) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF8F4" }}>
        <div style={{ textAlign: "center", fontFamily: "'DM Sans', sans-serif" }}>
          <p style={{ color: "#7A7268", fontSize: 16 }}>First digest arrives at 7am PT.</p>
          <p style={{ color: "#A8A098", fontSize: 13, marginTop: 8 }}>Check back then — refreshes daily at 7am and 4pm PT.</p>
        </div>
      </div>
    );
  }

  return <DigestClient digest={digest} />;
}
