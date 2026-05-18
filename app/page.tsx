import DigestClient from "@/components/DigestClient";
import { MOCK_DIGEST } from "@/lib/mock-digest";
import { aggregateDigestFromBeats } from "@/lib/beat-digests";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (process.env.NODE_ENV === "development") {
    return <DigestClient digest={MOCK_DIGEST} />;
  }

  const digest = await aggregateDigestFromBeats();

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

  return <DigestClient digest={digest} />;
}
