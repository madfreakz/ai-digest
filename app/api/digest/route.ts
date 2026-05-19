import { NextResponse } from "next/server";
import { aggregateDigestFromBeats } from "@/lib/beat-digests";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[auth] CRON_SECRET not configured — refusing request");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const digest = await aggregateDigestFromBeats();

    if (!digest.articles || digest.articles.length === 0) {
      return NextResponse.json({ error: "No articles found" }, { status: 404 });
    }

    return NextResponse.json(digest);
  } catch (err) {
    console.error("Digest error:", err);
    return NextResponse.json({ error: "Failed to generate digest" }, { status: 500 });
  }
}
