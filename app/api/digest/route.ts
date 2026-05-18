import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getDigest, DIGEST_TAG } from "@/lib/digest-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  revalidateTag(DIGEST_TAG, "max");
  try {
    const digest = await getDigest();
    if (!digest) {
      return NextResponse.json({ error: "No articles found" }, { status: 404 });
    }
    return NextResponse.json(digest);
  } catch (err) {
    console.error("Digest error:", err);
    return NextResponse.json({ error: "Failed to generate digest" }, { status: 500 });
  }
}
