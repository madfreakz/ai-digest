/**
 * Exa neural vs Parallel Search TURBO (GA /v1/search, mode:turbo) on the digest's
 * 12 broad beat queries. Retrieval-character comparison (no Gemini judge): pool
 * size, null-date rate, raw overlap, host distribution, primary-source vs
 * aggregator split. This is the cheap decisive first cut on whether Turbo — the
 * NEW July-2026 tier — changed the June `base` verdict (Exa won news recall).
 *
 * Non-destructive: reads shared query list, writes a JSON artifact to scripts/out/.
 * Run: node --env-file=.env.local --import tsx scripts/turbo-vs-exa-retrieval.ts
 */
import Exa from "exa-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { BEAT_QUERIES, normalizeUrl } from "../lib/exa";
import type { Beat } from "../lib/companies";

const PARALLEL_ENDPOINT = "https://api.parallel.ai/v1/search";
const NUM_RESULTS = 10;
const TEXT_MAX = 400;

// Rough host buckets to eyeball retrieval *character* (not a precise grader).
// Primary = wire/press/tier-0-1 news + company/VC blogs. Aggregator/low-signal =
// robotics-news mills, finance-options aggregators, social, listicles, job boards.
const PRIMARY_HOSTS = [
  "techcrunch.com", "reuters.com", "bloomberg.com", "theverge.com", "wsj.com",
  "ft.com", "cnbc.com", "forbes.com", "businesswire.com", "prnewswire.com",
  "axios.com", "theinformation.com", "venturebeat.com", "fortune.com",
  "arstechnica.com", "wired.com", "nytimes.com", "semafor.com", "crunchbase.com",
];
const AGGREGATOR_HINTS = [
  "robotwale", "robottoday", "marketchameleon", "instagram.", "facebook.",
  "x.com", "twitter.", "reddit.", "youtube.", "medium.com", "substack.com",
  "dailyai", "aidaily", "-news", "news-", "jobs.", "greenhouse.io", "lever.co",
  "ycombinator.com/jobs", "linkedin.com/jobs", "listicle", "roundup",
];

interface Row { url: string; title: string; date: string | null; host: string }

function hostOf(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "unknown"; }
}
function classify(host: string): "primary" | "aggregator" | "other" {
  if (PRIMARY_HOSTS.some((h) => host === h || host.endsWith("." + h))) return "primary";
  if (AGGREGATOR_HINTS.some((h) => host.includes(h))) return "aggregator";
  return "other";
}
function startDate7d(): string {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

async function exaArm(queries: string[], exa: Exa, startDate: string) {
  const seen = new Set<string>(); const rows: Row[] = []; let ms = 0;
  for (const q of queries) {
    const t0 = Date.now();
    try {
      const res = await exa.searchAndContents(q, {
        type: "neural", numResults: NUM_RESULTS, startPublishedDate: startDate,
        text: { maxCharacters: TEXT_MAX },
      } as any);
      ms += Date.now() - t0;
      for (const item of res.results) {
        const norm = normalizeUrl(item.url);
        if (seen.has(norm)) continue; seen.add(norm);
        rows.push({ url: item.url, title: item.title ?? "Untitled", date: item.publishedDate ?? null, host: hostOf(item.url) });
      }
    } catch (e) { console.error("[exa]", q.slice(0, 40), e instanceof Error ? e.message : e); }
  }
  return { rows, ms };
}

async function turboArm(queries: string[], startDate: string, stats: { raw: number; nullDate: number; outWindow: number }) {
  const seen = new Set<string>(); const rows: Row[] = []; let ms = 0;
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  for (const q of queries) {
    const body = {
      objective: q,
      search_queries: [q.split(" ").slice(0, 6).join(" "), q.split(" ").slice(-6).join(" ")],
      mode: "turbo",
      max_chars_total: 20000,
      advanced_settings: { source_policy: { after_date: startDate }, excerpt_settings: { max_chars_per_result: TEXT_MAX }, max_results: 20 },
    };
    const t0 = Date.now();
    let json: any;
    try {
      const res = await fetch(PARALLEL_ENDPOINT, { method: "POST", headers: { "x-api-key": process.env.PARALLEL_API_KEY!, "content-type": "application/json" }, body: JSON.stringify(body) });
      ms += Date.now() - t0;
      if (!res.ok) { console.error("[turbo]", res.status, (await res.text()).slice(0, 160)); continue; }
      json = await res.json();
    } catch (e) { console.error("[turbo]", q.slice(0, 40), e instanceof Error ? e.message : e); continue; }
    const results: any[] = json.results ?? [];
    stats.raw += results.length;
    let kept = 0;
    for (const r of results) {
      if (kept >= NUM_RESULTS) break;
      if (!r.publish_date) { stats.nullDate++; continue; }
      const t = Date.parse(r.publish_date);
      if (Number.isNaN(t) || t < startMs) { stats.outWindow++; continue; }
      const norm = normalizeUrl(r.url);
      if (seen.has(norm)) continue; seen.add(norm); kept++;
      rows.push({ url: r.url, title: r.title ?? "Untitled", date: r.publish_date, host: hostOf(r.url) });
    }
  }
  return { rows, ms };
}

function summarize(label: string, rows: Row[]) {
  const c = { primary: 0, aggregator: 0, other: 0 };
  for (const r of rows) c[classify(r.host)]++;
  return { label, pool: rows.length, ...c };
}

async function main() {
  for (const v of ["EXA_API_KEY", "PARALLEL_API_KEY"]) if (!process.env[v]) { console.error("Missing", v); process.exit(1); }
  const startDate = startDate7d();
  const exa = new Exa(process.env.EXA_API_KEY!);
  console.log(`\nExa(neural) vs Parallel Search TURBO — window since ${startDate}\n`);

  const tStats = { raw: 0, nullDate: 0, outWindow: 0 };
  const dump: Record<string, { exa: Row[]; turbo: Row[]; overlap: number }> = {};
  let exaMs = 0, turboMs = 0, exaCalls = 0, turboCalls = 0;
  const exaSummaries: any[] = []; const turboSummaries: any[] = [];

  for (const [beat, queries] of BEAT_QUERIES) {
    console.log(`\n========== ${beat} ==========`);
    const e = await exaArm(queries, exa, startDate);
    const t = await turboArm(queries, startDate, tStats);
    exaMs += e.ms; turboMs += t.ms; exaCalls += queries.length; turboCalls += queries.length;
    const exaKeys = new Set(e.rows.map((r) => normalizeUrl(r.url)));
    const overlap = t.rows.filter((r) => exaKeys.has(normalizeUrl(r.url))).length;
    dump[beat] = { exa: e.rows, turbo: t.rows, overlap };
    const es = summarize("exa", e.rows); const ts = summarize("turbo", t.rows);
    exaSummaries.push({ beat, ...es }); turboSummaries.push({ beat, ...ts });
    console.log(`EXA   pool=${es.pool}  primary=${es.primary} aggregator=${es.aggregator} other=${es.other}`);
    console.log(`TURBO pool=${ts.pool}  primary=${ts.primary} aggregator=${ts.aggregator} other=${ts.other}   raw-overlap-with-exa=${overlap}`);
    console.log(`--- EXA titles ---`);
    for (const r of e.rows) console.log(`  [${r.date?.slice(0, 10) ?? "NO-DATE"}] ${r.host}  ${r.title.slice(0, 70)}`);
    console.log(`--- TURBO titles (in-window, dated) ---`);
    for (const r of t.rows) console.log(`  [${r.date?.slice(0, 10) ?? "NO-DATE"}] ${r.host}  ${r.title.slice(0, 70)}`);
  }

  const sum = (a: any[], k: string) => a.reduce((s, v) => s + v[k], 0);
  console.log("\n\n================ AGGREGATE ================");
  console.log(`EXA    pool=${sum(exaSummaries, "pool")}  primary=${sum(exaSummaries, "primary")} aggregator=${sum(exaSummaries, "aggregator")} other=${sum(exaSummaries, "other")}`);
  console.log(`TURBO  pool=${sum(turboSummaries, "pool")}  primary=${sum(turboSummaries, "primary")} aggregator=${sum(turboSummaries, "aggregator")} other=${sum(turboSummaries, "other")}`);
  console.log(`TURBO raw returned=${tStats.raw}  null-date=${tStats.nullDate} (${((tStats.nullDate / Math.max(1, tStats.raw)) * 100).toFixed(0)}%)  out-of-window=${tStats.outWindow}`);
  console.log(`LATENCY  exa avg=${(exaMs / exaCalls).toFixed(0)}ms/call  turbo avg=${(turboMs / turboCalls).toFixed(0)}ms/call`);

  const outDir = join(process.cwd(), "scripts", "out"); mkdirSync(outDir, { recursive: true });
  const tag = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(outDir, `turbo-retrieval-${tag}.json`);
  writeFileSync(outPath, JSON.stringify({ meta: { startDate, generatedAt: new Date().toISOString() }, exaSummaries, turboSummaries, turboStats: tStats, latency: { exaAvgMs: exaMs / exaCalls, turboAvgMs: turboMs / turboCalls }, dump }, null, 2));
  console.log(`\nArtifact: ${outPath}\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
