import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import type { DiscoveredCompany } from "@/lib/companies";
import { DISCOVERED_INDEX_KEY } from "@/lib/kv-config";

export const dynamic = "force-dynamic";

async function removeFromIndex(deletedNames: string[]): Promise<void> {
  if (deletedNames.length === 0) return;
  try {
    const existing = (await kv.get<string[]>(DISCOVERED_INDEX_KEY)) ?? [];
    const lowered = new Set(deletedNames.map(n => n.toLowerCase()));
    const next = existing.filter(n => !lowered.has(n.toLowerCase()));
    if (next.length !== existing.length) {
      await kv.set(DISCOVERED_INDEX_KEY, next);
    }
  } catch {
    // Index will self-heal next time getCompanyNames sees an empty index
  }
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  // Header-only, matching every other route. The ?secret= query fallback that
  // used to be accepted here put CRON_SECRET into Vercel access logs, browser
  // history and outbound Referer headers — and it is the same secret that
  // authorizes the cron routes and this route's DELETE. Do not reintroduce it.
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (auth !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = (await kv.keys("discovered:*")).filter(k => k !== DISCOVERED_INDEX_KEY);
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
    console.error("[admin/discovered-companies] GET failed:", err);
    return NextResponse.json({ error: "Failed to list discovered companies" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (auth !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode");

  try {
    if (mode === "bad-domains") {
      const keys = (await kv.keys("discovered:*")).filter(k => k !== DISCOVERED_INDEX_KEY);
      let cleaned = 0;
      const removed: string[] = [];
      for (const key of keys) {
        const dc = await kv.get<DiscoveredCompany>(key);
        if (dc && (!dc.domain.includes(".") || dc.domain.includes(" "))) {
          await kv.del(key);
          removed.push(dc.name);
          cleaned++;
        }
      }
      await removeFromIndex(removed);
      return NextResponse.json({ cleaned, checked: keys.length });
    }

    const name = searchParams.get("name");
    if (!name) {
      return NextResponse.json({ error: "Provide ?name= or ?mode=bad-domains" }, { status: 400 });
    }
    const key = `discovered:${name.toLowerCase().replace(/\s+/g, "-")}`;
    await kv.del(key);
    await removeFromIndex([name]);
    return NextResponse.json({ deleted: key });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
