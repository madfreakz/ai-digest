import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { DISCOVERED_INDEX_KEY, KV_CONFIGURED } from "@/lib/kv-config";
import { isPlausibleDomain } from "@/lib/companies";
import type { DiscoveredCompany } from "@/lib/companies";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Read-only quality readout over the discovered:* keyspace. Makes NO Exa/Gemini
// calls. Answers "is discovery quality good enough, or is there a gap a Parallel
// enrichment pass would close?" See Knowledge/Engineering/search-provider-strategy.md.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!KV_CONFIGURED) {
    return NextResponse.json({ error: "KV not configured" }, { status: 503 });
  }

  const keys = (await kv.keys("discovered:*")).filter((k) => k !== DISCOVERED_INDEX_KEY);
  const records = (
    await Promise.all(keys.map((k) => kv.get<DiscoveredCompany>(k)))
  ).filter(Boolean) as DiscoveredCompany[];

  const total = records.length;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 1000) / 10);

  const oneHit = records.filter((r) => r.count === 1);
  const recurring = records.filter((r) => r.count >= 3);
  const implausible = records.filter((r) => !isPlausibleDomain(r.domain));

  // One-hit AND implausible domain = the most likely noise, the shortlist a
  // verification/enrichment pass would target.
  const phantomCandidates = records
    .filter((r) => r.count === 1 && !isPlausibleDomain(r.domain))
    .map((r) => ({ name: r.name, domain: r.domain, beat: r.beat, firstSeen: r.firstSeen }));

  const byBeat: Record<string, number> = {};
  for (const r of records) byBeat[r.beat] = (byBeat[r.beat] ?? 0) + 1;

  const byFirstSeen = [...records].sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));

  return NextResponse.json({
    summary: {
      total,
      oneHitWonders: { count: oneHit.length, pct: pct(oneHit.length) },
      validatedRecurring: { count: recurring.length, pct: pct(recurring.length) },
      implausibleDomain: { count: implausible.length, pct: pct(implausible.length) },
      phantomCandidates: phantomCandidates.length,
      byBeat,
      oldestFirstSeen: byFirstSeen[0]?.firstSeen ?? null,
      newestLastSeen:
        records.length > 0
          ? records.map((r) => r.lastSeen).sort().slice(-1)[0]
          : null,
      generatedAt: new Date().toISOString(),
    },
    phantomCandidates,
  });
}
