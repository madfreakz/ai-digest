import { NextResponse } from "next/server";
import { fetchRoboticsNews } from "@/lib/exa";
import { generateDigest } from "@/lib/summarize";

export const revalidate = 3600;

export async function GET() {
try {
    const articles = await fetchRoboticsNews();
    if (articles.length === 0) {
      return NextResponse.json(
        { error: "No articles found" },
        { status: 404 }
      );
    }
    const digest = await generateDigest(articles);
    return NextResponse.json(digest);
  } catch (err) {
    console.error("Digest error:", err);
    return NextResponse.json(
      { error: "Failed to generate digest" },
      { status: 500 }
    );
  }
}
