import { NextResponse } from "next/server";
import { cacheBeatArticles } from "@/lib/beat-digests";
import type { Beat } from "@/lib/companies";

const VALID_BEATS: Beat[] = ["Physical AI", "AI Infrastructure", "AI Labs", "Vertical AI"];

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const beat = searchParams.get("beat") as Beat | null;

  if (!beat || !VALID_BEATS.includes(beat)) {
    return NextResponse.json(
      { error: "Invalid or missing beat parameter" },
      { status: 400 }
    );
  }

  try {
    const articles = await cacheBeatArticles(beat);
    return NextResponse.json({
      success: true,
      beat,
      articleCount: articles.length,
      cachedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`Beat caching failed (${beat}):`, err);
    return NextResponse.json(
      { error: "Failed to cache beat articles" },
      { status: 500 }
    );
  }
}
