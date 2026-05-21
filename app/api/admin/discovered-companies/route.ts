import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { DiscoveredCompany } from "@/lib/companies";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await kv.keys("discovered:*");
    if (keys.length === 0) {
      return NextResponse.json({ companies: [], total: 0 });
    }

    const entries = await Promise.all(
      keys.map(async (key) => {
        const data = await kv.get<DiscoveredCompany>(key);
        return data;
      })
    );

    const companies = entries
      .filter(Boolean)
      .sort((a, b) => b!.count - a!.count);

    return NextResponse.json({ companies, total: companies.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
