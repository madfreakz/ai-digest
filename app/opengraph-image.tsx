import { ImageResponse } from "next/og";
import { getPublishedDigest } from "@/lib/beat-digests";
import { getSynthesisHero } from "@/lib/summarize";
import { displayTitle, formatEditionDate } from "@/lib/format";

export const alt = "Frontier AI Digest: today's lead story";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Same cadence as the page: reads the published edition from KV, never
// generates one.
export const revalidate = 3600;

const MAX_HEADLINE = 120;

export default async function OpengraphImage() {
  const digest = await getPublishedDigest();
  const lead = digest ? getSynthesisHero(digest) : undefined;
  const raw = lead ? displayTitle(lead.title) : "Daily intelligence on frontier AI, with BD signal";
  const headline = raw.length > MAX_HEADLINE ? `${raw.slice(0, MAX_HEADLINE - 1).trimEnd()}…` : raw;
  const edition = digest ? formatEditionDate(digest.generatedAt) : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#FAF8F4",
        }}
      >
        <div style={{ height: 10, display: "flex", background: "linear-gradient(90deg, #1B3A6B 0%, #2E5EA8 35%, #FAF8F4 100%)" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "64px 72px" }}>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: 4, color: "#1B3A6B", textTransform: "uppercase" }}>
            Frontier AI Digest
          </div>
          <div style={{ display: "flex", marginTop: 40, fontSize: 60, lineHeight: 1.15, color: "#18140C", letterSpacing: -1 }}>
            {headline}
          </div>
          <div style={{ display: "flex", marginTop: "auto", fontSize: 26, color: "#736B61" }}>
            {edition ? `Lead story · ${edition}` : "Physical AI · AI Infrastructure · AI Labs · Vertical AI"}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
