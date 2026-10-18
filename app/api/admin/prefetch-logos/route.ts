import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { COMPANIES, DOMAIN_ALIASES } from "@/lib/companies";
import type { DiscoveredCompany } from "@/lib/companies";
import { DISCOVERED_INDEX_KEY } from "@/lib/kv-config";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // ~400 paced requests with retries

const LOGO_CACHE_KEY = "logos:company-map";
const LOGO_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days

function resolveDomain(company: (typeof COMPANIES)[number]): string | undefined {
  if (company.domain) return company.domain;
  return DOMAIN_ALIASES[company.name.toLowerCase()];
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logoDevKey = process.env.LOGO_DEV_KEY;
  if (!logoDevKey) {
    return NextResponse.json({ error: "LOGO_DEV_KEY not configured" }, { status: 500 });
  }

  // Build list of (companyNameLower, logoDevUrl) to verify
  const toFetch: Array<{ name: string; url: string }> = [];
  const seen = new Set<string>();

  for (const company of COMPANIES) {
    const domain = resolveDomain(company);
    if (!domain) continue;
    const key = company.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    toFetch.push({ name: key, url: `https://img.logo.dev/${domain}?token=${logoDevKey}&size=200&format=png` });
  }

  // Also add DOMAIN_ALIASES entries not already covered by COMPANIES
  for (const [aliasName, domain] of Object.entries(DOMAIN_ALIASES)) {
    if (seen.has(aliasName)) continue;
    seen.add(aliasName);
    toFetch.push({ name: aliasName, url: `https://img.logo.dev/${domain}?token=${logoDevKey}&size=200&format=png` });
  }

  // Also add KV-discovered companies
  try {
    const discoveredKeys = (await kv.keys("discovered:*")).filter(k => k !== DISCOVERED_INDEX_KEY);
    for (const dKey of discoveredKeys) {
      const dc = await kv.get<DiscoveredCompany>(dKey);
      if (!dc?.domain) continue;
      const key = dc.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      toFetch.push({ name: key, url: `https://img.logo.dev/${dc.domain}?token=${logoDevKey}&size=200&format=png` });
    }
  } catch {
    // KV read failed; proceed with static companies only
  }

  // Start from the current map: a request that fails this run keeps the logo
  // it had. A full overwrite let one rate-limited run (2026-10-18: 104 of 393,
  // every request after roughly the 130th failing) wipe logos the digest
  // already had. Names no longer tracked or discovered fall out.
  let previous: Record<string, string> = {};
  try {
    previous = (await kv.get<Record<string, string>>(LOGO_CACHE_KEY)) ?? {};
  } catch {
    // start empty
  }
  const logoMap: Record<string, string> = {};
  for (const { name } of toFetch) {
    if (previous[name]) logoMap[name] = previous[name];
  }

  // Paced: a few requests at a time, retrying 429s with backoff (Retry-After
  // when Logo.dev sends it). Status counts are returned so a bad run says why.
  const MAX_CONCURRENT = 4;
  const MAX_ATTEMPTS = 3;
  const TIMEOUT_MS = 6000;
  const statuses: Record<string, number> = {};
  const bump = (k: string) => { statuses[k] = (statuses[k] ?? 0) + 1; };
  let found = 0;

  async function check(name: string, url: string): Promise<void> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (res.status === 429 && attempt < MAX_ATTEMPTS) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * attempt;
          await new Promise(r => setTimeout(r, Math.min(waitMs, 10_000)));
          continue;
        }
        bump(String(res.status));
        if (res.ok) {
          logoMap[name] = url;
          found++;
        }
        return;
      } catch {
        if (attempt === MAX_ATTEMPTS) bump("timeout_or_network");
      }
    }
  }

  let next = 0;
  await Promise.all(
    Array.from({ length: MAX_CONCURRENT }, async () => {
      while (next < toFetch.length) {
        const { name, url } = toFetch[next++];
        await check(name, url);
      }
    }),
  );

  await kv.setex(LOGO_CACHE_KEY, LOGO_CACHE_TTL, logoMap);

  const cached = Object.keys(logoMap).length;
  console.log(`[prefetch-logos] fetched ${found}/${toFetch.length}, cached ${cached} (kept ${cached - found} from the previous map)`, statuses);

  return NextResponse.json({
    success: true,
    total: toFetch.length,
    found,
    keptFromPrevious: cached - found,
    cached,
    missing: toFetch.length - cached,
    statuses,
    cachedAt: new Date().toISOString(),
  });
}
