import { NextResponse } from "next/server";
import { isPlausibleDomain } from "@/lib/companies";

const UPSTREAM_TIMEOUT_MS = 4000;

export async function GET(
  _req: Request,
  context: { params: Promise<{ domain: string }> },
) {
  const { domain: rawDomain } = await context.params;
  const domain = decodeURIComponent(rawDomain).trim().toLowerCase();
  if (!isPlausibleDomain(domain)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const logoDevKey = process.env.LOGO_DEV_KEY;
  if (!logoDevKey) {
    return NextResponse.json({ error: "Logo service unavailable" }, { status: 503 });
  }

  try {
    const upstream = await fetch(
      `https://img.logo.dev/${domain}?token=${logoDevKey}&size=200&format=png`,
      { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) },
    );
    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status === 404 ? 404 : 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/png";
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
