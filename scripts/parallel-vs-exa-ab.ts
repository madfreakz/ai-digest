/**
 * A/B: Parallel Search vs Exa on the Frontier AI Digest's broad-neural retrieval slot.
 *
 * Question this answers: of the stories that would ACTUALLY make the digest
 * (relevanceScore >= 8, or dealSignal && >= 6 — the bar enforced by the
 * production `summarizeBeat`), how many does each provider uniquely surface that
 * the other misses? That is the recall question. We reuse `summarizeBeat`
 * verbatim as the judge so "digest-worthy" is the digest's own definition, not an
 * abstract relevance score.
 *
 * Scope: the 12 broad neural beat queries (3 per beat x 4 beats) from lib/exa.ts.
 * Both arms use the SAME 7-day window. The TechCrunch + 21-VC-blog domain-filtered
 * queries are a deferred secondary arm (depends on confirming Parallel's domain
 * include field) — recall gaps hide in the broad-neural slot, so we test that first.
 *
 * This script does NOT touch the production pipeline. It only reads the shared
 * query list + scorer and writes a JSON artifact under scripts/out/.
 *
 * Run:  node --env-file=.env.local --import tsx scripts/parallel-vs-exa-ab.ts
 * Needs: EXA_API_KEY, GOOGLE_API_KEY, KV tokens (all present), and PARALLEL_API_KEY.
 */

import Exa from "exa-js";
import { GoogleGenAI } from "@google/genai";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { BEAT_QUERIES, normalizeUrl, type ExaArticle } from "../lib/exa";
import { summarizeBeat, type DigestArticle } from "../lib/summarize";
import type { Beat } from "../lib/companies";

// --- knobs (kept aligned with production retrieval in lib/exa.ts) ---
// v1beta/search is the full retrieval product (accepts processor, max_results,
// source_policy.after_date). The GA /v1/search rejects all of those — confirmed
// 2026-06-03: server-side after_date freshness works here, returns dated results.
const PARALLEL_ENDPOINT = "https://api.parallel.ai/v1beta/search";
const PARALLEL_PROCESSOR = "base";   // retrieval tier (~2-5s). 'pro' (15-60s) blurs into research.
const NUM_RESULTS = 10;              // == Exa numResults per query; Parallel kept to top-N in-window/query
const TEXT_MAX_CHARS = 400;          // == Exa text.maxCharacters
const JUDGE_MODEL = "gemini-2.5-flash";
const JUDGE_CHUNK = 15;              // summarizeBeat slice(0,15) cap — chunk to avoid truncating the A/B
const JUDGE_SPACING_MS = 10_000;     // Gemini rate-limit spacing (project CLAUDE.md)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function startDate7d(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0]; // YYYY-MM-DD, same as lib/exa.ts
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Exa arm — replay the beat's neural queries with the EXACT production opts.
// ---------------------------------------------------------------------------
async function exaArm(beat: Beat, queries: string[], exa: Exa, startDate: string): Promise<ExaArticle[]> {
  const seen = new Set<string>();
  const out: ExaArticle[] = [];
  for (const q of queries) {
    try {
      const res = await exa.searchAndContents(q, {
        type: "neural",
        numResults: NUM_RESULTS,
        startPublishedDate: startDate,
        text: { maxCharacters: TEXT_MAX_CHARS },
      } as any);
      for (const item of res.results) {
        const norm = normalizeUrl(item.url);
        if (seen.has(norm)) continue;
        seen.add(norm);
        out.push({
          title: item.title ?? "Untitled",
          url: item.url,
          publishedAt: item.publishedDate ?? new Date().toISOString(),
          text: (item as Record<string, unknown>).text as string | undefined,
          source: hostnameOf(item.url),
          ogImage: null,
          beatHint: beat,
        });
      }
      console.log(`[exa] ${beat} "${q.slice(0, 44)}..." -> ${res.results.length}`);
    } catch (err) {
      console.error(`[exa] ${beat} "${q.slice(0, 44)}..." error:`, err instanceof Error ? err.message : String(err));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parallel arm — POST /v1/search. Defensive about the (unconfirmed) date filter:
// attempt source_policy.after_date; if the API rejects it, drop it and rely on
// the client-side 7-day post-filter below (which we apply unconditionally).
// ---------------------------------------------------------------------------
interface ParallelResult {
  url: string;
  title?: string;
  publish_date?: string | null;
  excerpts?: string[];
}
let sourcePolicyWorks = true; // flips false on first 4xx that looks like a schema rejection

async function parallelSearch(query: string, startDate: string): Promise<ParallelResult[]> {
  // Over-fetch modestly so the client-side 7-day post-filter (which also drops
  // null-publish_date pages) still leaves a pool comparable to Exa's 10/query.
  // Over-fetch more when the server-side date filter is unavailable.
  const maxResults = sourcePolicyWorks ? 20 : 30;
  const body: Record<string, unknown> = {
    objective: query,
    search_queries: [query],
    processor: PARALLEL_PROCESSOR,
    max_results: maxResults,
    max_chars_per_result: TEXT_MAX_CHARS,
  };
  if (sourcePolicyWorks) body.source_policy = { after_date: startDate };

  const res = await fetch(PARALLEL_ENDPOINT, {
    method: "POST",
    headers: { "x-api-key": process.env.PARALLEL_API_KEY!, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    if (sourcePolicyWorks && (res.status === 400 || res.status === 422)) {
      console.warn(`[parallel] source_policy rejected (${res.status}: ${text.slice(0, 160)}); retrying without it (client-side date filter only)`);
      sourcePolicyWorks = false;
      return parallelSearch(query, startDate);
    }
    throw new Error(`Parallel ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { results?: ParallelResult[] };
  return json.results ?? [];
}

interface ParallelStats {
  raw: number;
  nullDate: number;
  outOfWindow: number;
}

async function parallelArm(
  beat: Beat,
  queries: string[],
  startDate: string,
  stats: ParallelStats,
): Promise<ExaArticle[]> {
  const seen = new Set<string>();
  const out: ExaArticle[] = [];
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  for (const q of queries) {
    let results: ParallelResult[] = [];
    try {
      results = await parallelSearch(q, startDate);
    } catch (err) {
      console.error(`[parallel] ${beat} "${q.slice(0, 44)}..." error:`, err instanceof Error ? err.message : String(err));
      continue;
    }
    stats.raw += results.length;
    let keptThisQuery = 0;
    for (const r of results) {
      if (keptThisQuery >= NUM_RESULTS) break; // match Exa's per-query budget
      // Enforce the 7-day window client-side. Parallel publish_date is nullable;
      // drop nulls + out-of-window so the pool matches Exa's server-side window.
      if (!r.publish_date) {
        stats.nullDate++;
        continue;
      }
      const ms = Date.parse(r.publish_date);
      if (Number.isNaN(ms) || ms < startMs) {
        stats.outOfWindow++;
        continue;
      }
      const norm = normalizeUrl(r.url);
      if (seen.has(norm)) continue;
      seen.add(norm);
      keptThisQuery++;
      out.push({
        title: r.title ?? "Untitled",
        url: r.url,
        publishedAt: r.publish_date,
        text: (r.excerpts ?? []).join(" ").slice(0, TEXT_MAX_CHARS) || undefined,
        source: hostnameOf(r.url),
        ogImage: null,
        beatHint: beat,
      });
    }
    console.log(`[parallel] ${beat} "${q.slice(0, 44)}..." -> ${results.length} raw, kept ${keptThisQuery} in-window`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Judge + attribution, per beat.
// ---------------------------------------------------------------------------
interface BeatVerdict {
  beat: Beat;
  exaPool: number;
  parallelPool: number;
  rawOverlap: number;        // shared normalized URLs in the candidate pools
  worthyExaOnly: number;
  worthyParallelOnly: number;
  worthyBoth: number;
  exaOnlyTitles: string[];
  parallelOnlyTitles: string[];
  exaPrecision: number;      // digest-worthy attributable to Exa / Exa pool
  parallelPrecision: number; // digest-worthy attributable to Parallel / Parallel pool
}

// Ride out transient Gemini 503 "high demand" spikes on the scoring call.
// NOTE: the usual lite fallback (feedback_gemini_503_resilience) is UNUSABLE
// here — summarizeBeat hardcodes thinkingBudget:128, which gemini-2.5-flash-lite
// rejects (it requires 512-24576). That fallback only works for the SYNTHESIS
// call, not scoring. So we instead retry gemini-2.5-flash with patient backoff.
async function judgeChunkSafe(beat: Beat, chunkArts: ExaArticle[], ai: GoogleGenAI) {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await summarizeBeat(beat, chunkArts, ai, JUDGE_MODEL);
    } catch (err) {
      lastErr = err;
      const waitMs = 20_000 * (attempt + 1);
      console.warn(`[judge] ${beat} ${JUDGE_MODEL} attempt ${attempt + 1}/4 failed: ${err instanceof Error ? err.message.slice(0, 80) : String(err)}; waiting ${waitMs / 1000}s`);
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

async function judgeBeat(
  beat: Beat,
  exaArts: ExaArticle[],
  parArts: ExaArticle[],
  ai: GoogleGenAI,
): Promise<BeatVerdict> {
  // Union the two pools, tagged by which provider(s) surfaced each normalized URL.
  const tag = new Map<string, { inExa: boolean; inParallel: boolean; art: ExaArticle }>();
  for (const a of exaArts) {
    const k = normalizeUrl(a.url);
    const t = tag.get(k);
    if (t) t.inExa = true;
    else tag.set(k, { inExa: true, inParallel: false, art: a });
  }
  for (const a of parArts) {
    const k = normalizeUrl(a.url);
    const t = tag.get(k);
    if (t) t.inParallel = true;
    else tag.set(k, { inExa: false, inParallel: true, art: a });
  }
  const rawOverlap = [...tag.values()].filter((t) => t.inExa && t.inParallel).length;
  const union = [...tag.values()].map((t) => t.art);

  // Score the union through the production scorer, chunked to dodge slice(0,15).
  const worthy: DigestArticle[] = [];
  const chunks = chunk(union, JUDGE_CHUNK);
  for (let i = 0; i < chunks.length; i++) {
    const res = await judgeChunkSafe(beat, chunks[i], ai);
    worthy.push(...res.articles);
    console.log(`[judge] ${beat} chunk ${i + 1}/${chunks.length} (${chunks[i].length} arts) -> ${res.articles.length} digest-worthy`);
    if (i < chunks.length - 1) await sleep(JUDGE_SPACING_MS);
  }

  // Attribute each digest-worthy story to provider(s). Group by storyId (falling
  // back to normalized URL) and OR the memberships, so a story found by BOTH
  // providers under different URLs (split across chunks) credits both arms.
  const byStory = new Map<string, { inExa: boolean; inParallel: boolean; title: string }>();
  for (const w of worthy) {
    const memb = tag.get(normalizeUrl(w.url));
    if (!memb) continue; // should not happen: summarizeBeat prefers the input URL
    const key = w.storyId || normalizeUrl(w.url);
    const g = byStory.get(key) ?? { inExa: false, inParallel: false, title: w.title };
    g.inExa = g.inExa || memb.inExa;
    g.inParallel = g.inParallel || memb.inParallel;
    byStory.set(key, g);
  }

  let worthyExaOnly = 0;
  let worthyParallelOnly = 0;
  let worthyBoth = 0;
  const exaOnlyTitles: string[] = [];
  const parallelOnlyTitles: string[] = [];
  for (const g of byStory.values()) {
    if (g.inExa && g.inParallel) worthyBoth++;
    else if (g.inExa) {
      worthyExaOnly++;
      exaOnlyTitles.push(g.title);
    } else if (g.inParallel) {
      worthyParallelOnly++;
      parallelOnlyTitles.push(g.title);
    }
  }

  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    beat,
    exaPool: exaArts.length,
    parallelPool: parArts.length,
    rawOverlap,
    worthyExaOnly,
    worthyParallelOnly,
    worthyBoth,
    exaOnlyTitles,
    parallelOnlyTitles,
    exaPrecision: exaArts.length ? round((worthyExaOnly + worthyBoth) / exaArts.length) : 0,
    parallelPrecision: parArts.length ? round((worthyParallelOnly + worthyBoth) / parArts.length) : 0,
  };
}

// ---------------------------------------------------------------------------
async function main() {
  for (const v of ["EXA_API_KEY", "GOOGLE_API_KEY", "PARALLEL_API_KEY"]) {
    if (!process.env[v]) {
      console.error(`Missing ${v} in env. Run with: node --env-file=.env.local --import tsx scripts/parallel-vs-exa-ab.ts`);
      process.exit(1);
    }
  }

  const startDate = startDate7d();
  const exa = new Exa(process.env.EXA_API_KEY!);
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
  console.log(`\nA/B: Parallel(${PARALLEL_PROCESSOR}) vs Exa(neural) — window since ${startDate}\n`);

  const verdicts: BeatVerdict[] = [];
  const pStats: ParallelStats = { raw: 0, nullDate: 0, outOfWindow: 0 };
  const rawDump: Record<string, { exa: ExaArticle[]; parallel: ExaArticle[] }> = {};

  for (const [beat, queries] of BEAT_QUERIES) {
    console.log(`\n=== ${beat} ===`);
    const exaArts = await exaArm(beat, queries, exa, startDate);
    const parArts = await parallelArm(beat, queries, startDate, pStats);
    rawDump[beat] = { exa: exaArts, parallel: parArts };
    try {
      const verdict = await judgeBeat(beat, exaArts, parArts, ai);
      verdicts.push(verdict);
    } catch (err) {
      console.error(`[judge] ${beat} FAILED after model fallbacks — recording as incomplete:`, err instanceof Error ? err.message : String(err));
    }
    await sleep(JUDGE_SPACING_MS);
  }

  // Aggregate.
  const sum = (f: (v: BeatVerdict) => number) => verdicts.reduce((a, v) => a + f(v), 0);
  const aggExaOnly = sum((v) => v.worthyExaOnly);
  const aggParOnly = sum((v) => v.worthyParallelOnly);
  const aggBoth = sum((v) => v.worthyBoth);

  console.log("\n\n================ RESULTS ================");
  console.log("beat                 | exaPool parPool overlap | exaOnly parOnly both | exaPrec parPrec");
  for (const v of verdicts) {
    console.log(
      `${v.beat.padEnd(20)} | ${String(v.exaPool).padStart(7)} ${String(v.parallelPool).padStart(7)} ${String(v.rawOverlap).padStart(7)} | ` +
        `${String(v.worthyExaOnly).padStart(7)} ${String(v.worthyParallelOnly).padStart(7)} ${String(v.worthyBoth).padStart(4)} | ` +
        `${String(v.exaPrecision).padStart(7)} ${String(v.parallelPrecision).padStart(7)}`,
    );
  }
  console.log("----------------------------------------");
  console.log(`AGGREGATE digest-worthy: exaOnly=${aggExaOnly}  parallelOnly=${aggParOnly}  both=${aggBoth}`);
  console.log(`NET RECALL GAP (parallelOnly - exaOnly) = ${aggParOnly - aggExaOnly}`);
  console.log(`Parallel pool quality: raw=${pStats.raw}  null-date=${pStats.nullDate}  out-of-window=${pStats.outOfWindow}  source_policy server-side date filter used: ${sourcePolicyWorks}`);
  console.log("\nVERDICT RULE: Parallel earns wiring only if parallelOnly >> exaOnly AND precision not far worse AND null-date rate low. Otherwise Exa stays.");

  console.log("\n--- Parallel-only digest-worthy (hand-verify these are real, recent, on-beat) ---");
  for (const v of verdicts) for (const t of v.parallelOnlyTitles) console.log(`  [${v.beat}] ${t}`);
  console.log("\n--- Exa-only digest-worthy ---");
  for (const v of verdicts) for (const t of v.exaOnlyTitles) console.log(`  [${v.beat}] ${t}`);

  // Artifact.
  const outDir = join(process.cwd(), "scripts", "out");
  mkdirSync(outDir, { recursive: true });
  const tag = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(outDir, `parallel-ab-${tag}.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        meta: { startDate, processor: PARALLEL_PROCESSOR, judgeModel: JUDGE_MODEL, sourcePolicyServerSideDateFilter: sourcePolicyWorks, generatedAt: new Date().toISOString() },
        aggregate: { worthyExaOnly: aggExaOnly, worthyParallelOnly: aggParOnly, worthyBoth: aggBoth, netRecallGap: aggParOnly - aggExaOnly, parallelPoolStats: pStats },
        verdicts,
        raw: rawDump,
      },
      null,
      2,
    ),
  );
  console.log(`\nArtifact: ${outPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
