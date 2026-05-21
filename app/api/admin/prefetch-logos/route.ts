import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { COMPANIES, DOMAIN_ALIASES } from "@/lib/companies";
import type { DiscoveredCompany } from "@/lib/companies";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // needs more than the default 10s

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
    const discoveredKeys = await kv.keys("discovered:*");
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

  const logoMap: Record<string, string> = {};
  let found = 0;

  // Parallel fetch with concurrency cap of 20, 3s timeout per request
  const maxConcurrent = 20;
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const runNext = () => {
    const task = queue.shift();
    if (task) { activeCount++; task(); }
  };

  await Promise.all(
    toFetch.map(
      ({ name, url }) =>
        new Promise<void>(resolve => {
          const task = async () => {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 3000);
            try {
              const res = await fetch(url, { signal: controller.signal });
              clearTimeout(tid);
              if (res.ok) {
                logoMap[name] = url;
                found++;
              }
            } catch {
              clearTimeout(tid);
            }
            activeCount--;
            resolve();
            runNext();
          };

          if (activeCount < maxConcurrent) {
            activeCount++;
            task();
          } else {
            queue.push(task);
          }
        })
    )
  );

  await kv.setex(LOGO_CACHE_KEY, LOGO_CACHE_TTL, logoMap);

  console.log(`[prefetch-logos] Cached ${found}/${toFetch.length} logos in KV`);

  return NextResponse.json({
    success: true,
    total: toFetch.length,
    found,
    missing: toFetch.length - found,
    cachedAt: new Date().toISOString(),
  });
}
