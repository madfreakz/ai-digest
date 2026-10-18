import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { COMPANIES, DOMAIN_ALIASES } from "@/lib/companies";
import type { DiscoveredCompany } from "@/lib/companies";
import { DISCOVERED_INDEX_KEY } from "@/lib/kv-config";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // KV reads for discovered companies only

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

  // Build list of (companyNameLower, logoDevUrl)
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

  // No per-logo verification. Checking each URL against Logo.dev up front hit
  // its rate limit from Vercel (2026-10-18: 104 of 393 cached, every request
  // after roughly the 130th failing; a paced retry version then timed out),
  // and it no longer buys anything: a card drops a logo that fails to load
  // (components/Thumb.tsx). So the map is built straight from known domains.
  const logoMap: Record<string, string> = {};
  for (const { name, url } of toFetch) logoMap[name] = url;

  await kv.setex(LOGO_CACHE_KEY, LOGO_CACHE_TTL, logoMap);

  const cached = Object.keys(logoMap).length;
  console.log(`[prefetch-logos] cached ${cached} logo URLs from known domains`);

  return NextResponse.json({
    success: true,
    total: toFetch.length,
    cached,
    cachedAt: new Date().toISOString(),
  });
}
