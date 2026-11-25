// Jev shadow run: a time-boxed experiment that asks TypeSafe's Jev decision
// model (via OpenRouter's Decisions API) the same gate questions the scoring LLM
// answers, for every pre-screen candidate, and logs both sides to KV. It never
// changes what the digest publishes. Every entry point here swallows its own
// errors: a Jev or KV failure must never fail or delay a beat beyond the
// per-call timeout.
//
// Why: the current gate (relevanceScore >= 8, or dealSignal + >= 6) rests on an
// integer the prose-writing LLM emits, and the pre-screen drops ~30 of ~45
// candidates with no record. Jev returns calibrated probabilities per article.
// After a week, `npm run jev:report` turns the log into a disagreement table.

import type { Beat } from "./companies";

export const JEV_MODEL = "typesafe/jev-1.14";
const DECISIONS_URL = "https://openrouter.ai/api/alpha/decisions";

// The experiment turns itself off after this instant unless JEV_SHADOW_UNTIL
// overrides it. JEV_SHADOW=off is the kill switch.
const DEFAULT_SHADOW_UNTIL = "2026-12-02T00:00:00Z";
export const JEV_SHADOW_TTL_SECONDS = 21 * 24 * 60 * 60;
const CALL_TIMEOUT_MS = 15_000;
const SHADOW_BUDGET_MS = 30_000;
const CONCURRENCY = 10;

export const RELEVANCE_LEVELS = [
  "PR fluff, opinion piece, weekly roundup, landing page, or a minor update",
  "Routine small funding round or incremental product news",
  "Notable enterprise adoption, or a strategic funding round above $50M",
  "Major model, infrastructure, or distribution shift in the AI stack",
] as const;

const EXCLUDED_INDUSTRIES =
  "defense or military, healthcare or medical, insurance, government or govtech, " +
  "education or edtech, cybersecurity, identity or access management, trust and safety, " +
  "fraud prevention, mental health, adtech or advertising, or crypto or blockchain";

// Beat routing as a Choice. The current pipeline only drops stories "clearly
// unrelated" to the beat (the LLM may re-assign the rest), so the gate cuts only
// when `unrelated` wins; the beat probabilities are logged for routing analysis.
export const BEAT_CRITERIA: Record<string, string> = {
  physical_ai: "Robotics, humanoids, autonomous vehicles and machines, embodied AI, and the models and hardware behind them",
  ai_infrastructure: "Compute, GPUs and chips, data centers, cloud, inference and training platforms, and developer tooling for AI",
  ai_labs: "AI model labs and their models, products, research, business, and leadership (OpenAI, Anthropic, Google DeepMind, Meta, xAI, Mistral, and others)",
  vertical_ai: "AI applications and companies built for a specific industry or job function",
  unrelated: "Not about AI, robotics, or AI infrastructure at all",
};

export interface JevArticleInput {
  url: string; // normalized
  title: string;
  source: string;
  publishedAt: string;
  excerpt: string; // already sanitized by the caller
}

export interface JevVerdict {
  relevance: number; // probability-weighted level, 0..3
  relevanceProbs: number[]; // P(level 0..3)
  deal: number; // P(yes)
  excluded: number; // P(yes)
  beat: string; // most likely BEAT_CRITERIA key
  beatProbs: Record<string, number>;
}

/** P(level 3: major shift). */
export const pMajor = (v: JevVerdict) => v.relevanceProbs[3] ?? 0;
/** P(level 2 or 3: notable or major). */
export const pNotable = (v: JevVerdict) => (v.relevanceProbs[2] ?? 0) + (v.relevanceProbs[3] ?? 0);

export type JevResult = { verdict: JevVerdict; cost: number } | { error: string };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function isJevShadowEnabled(
  env: Record<string, string | undefined> = process.env,
  now = Date.now(),
): boolean {
  if ((env.JEV_SHADOW ?? "").toLowerCase() === "off") return false;
  if (!env.OPENROUTER_API_KEY?.trim()) return false;
  if (!(env.KV_REST_API_URL ?? env.KV_URL)) return false;
  const until = Date.parse(env.JEV_SHADOW_UNTIL ?? DEFAULT_SHADOW_UNTIL);
  return Number.isNaN(until) || now < until;
}

export function buildJevRequest(beat: Beat, article: JevArticleInput) {
  return {
    model: JEV_MODEL,
    state: {
      beat,
      title: article.title,
      source: article.source,
      published: article.publishedAt.slice(0, 10),
      excerpt: article.excerpt,
    },
    questions: {
      relevance: {
        type: "score",
        instructions:
          "How important is the news story in `title` and `excerpt` for a strategy leader tracking where value is " +
          "shifting across the AI stack (models, compute, developer tooling, vertical apps, robotics)?",
        criteria: [...RELEVANCE_LEVELS],
      },
      deal: {
        type: "noul",
        instructions:
          "Does the story in `excerpt` describe a major funding round, a strategic partnership, a marquee enterprise " +
          "rollout, a positioning shift, a competitive move, or a major product launch?",
      },
      excluded: {
        type: "noul",
        instructions: `Is the story in \`excerpt\` primarily about ${EXCLUDED_INDUSTRIES}?`,
      },
      beat: {
        type: "choice",
        instructions: "Which area of AI is the story in `title` and `excerpt` mainly about?",
        criteria: BEAT_CRITERIA,
      },
    },
  };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function parseJevResponse(body: unknown): JevVerdict {
  const answers = (body as { answers?: Record<string, Record<string, unknown>> })?.answers;
  if (!answers) throw new Error("no answers in response");
  const rel = answers.relevance;
  const relevance = num(rel?.score);
  const probsRaw = (rel?.probabilities ?? {}) as Record<string, unknown>;
  // Index by key, not position: Jev's key order varies between calls.
  const relevanceProbs = RELEVANCE_LEVELS.map((_, i) => num(probsRaw[String(i)]) ?? 0);
  const deal = num(answers.deal?.noul);
  const excluded = num(answers.excluded?.noul);
  const beatChoice = answers.beat?.choice;
  const beatRaw = (answers.beat?.probabilities ?? {}) as Record<string, unknown>;
  const beatProbs = Object.fromEntries(Object.keys(BEAT_CRITERIA).map(k => [k, num(beatRaw[k]) ?? 0]));
  if (relevance === null || deal === null || excluded === null || typeof beatChoice !== "string") {
    throw new Error("missing or refused answer");
  }
  return { relevance, relevanceProbs, deal, excluded, beat: beatChoice, beatProbs };
}

async function askJev(
  beat: Beat,
  article: JevArticleInput,
  apiKey: string,
  fetchImpl: FetchLike,
  signal: AbortSignal,
): Promise<JevResult> {
  try {
    const res = await fetchImpl(DECISIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildJevRequest(beat, article)),
      signal,
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const body = await res.json();
    const cost = num((body as { usage?: { cost?: unknown } })?.usage?.cost) ?? 0;
    return { verdict: parseJevResponse(body), cost };
  } catch (err) {
    return { error: err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120) };
  }
}

/**
 * Ask Jev about every article. Never throws; failures come back as { error }.
 * The whole run is capped at `budgetMs` (summarizeBeat awaits it, so a slow or
 * hanging alpha endpoint must not push a beat toward the function limit). The
 * calls start before pre-screen, so in practice they finish during scoring.
 */
export async function scoreWithJev(
  beat: Beat,
  articles: JevArticleInput[],
  opts: { fetchImpl?: FetchLike; timeoutMs?: number; budgetMs?: number; apiKey?: string } = {},
): Promise<Map<string, JevResult>> {
  const out = new Map<string, JevResult>();
  const apiKey = opts.apiKey ?? process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return out;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? CALL_TIMEOUT_MS;
  const budget = AbortSignal.timeout(opts.budgetMs ?? SHADOW_BUDGET_MS);
  let next = 0;
  const worker = async () => {
    while (next < articles.length) {
      const a = articles[next++];
      if (budget.aborted) {
        out.set(a.url, { error: "shadow budget exceeded" });
        continue;
      }
      out.set(a.url, await askJev(beat, a, apiKey, fetchImpl, AbortSignal.any([budget, AbortSignal.timeout(timeoutMs)])));
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, articles.length) }, worker));
  return out;
}

// ── Tentative Jev gate ───────────────────────────────────────────────────────
// Mirrors the current rule's intent (strong story, or a deal that is at least
// notable), plus the exclusion and off-beat drops the LLM does in prose. The
// shadow log keeps raw probabilities, so the report can re-run other cut-offs.
// The live gate keeps a lone 8, the top of the rubric's "notable" (7-8) band,
// so the Jev gate has a matching high-bar notable path alongside major and deal.
export interface JevGateThresholds {
  major: number; // P(major shift) that keeps a story on its own
  notable: number; // P(notable or major) that keeps a story on its own
  dealProb: number; // P(deal) needed for the deal path
  dealNotable: number; // P(notable or major) needed on the deal path
}
export const DEFAULT_JEV_GATE: JevGateThresholds = { major: 0.5, notable: 0.8, dealProb: 0.7, dealNotable: 0.5 };

export function jevWouldKeep(v: JevVerdict, t: JevGateThresholds = DEFAULT_JEV_GATE): boolean {
  if (v.excluded >= 0.5 || v.beat === "unrelated") return false;
  return pMajor(v) >= t.major || pNotable(v) >= t.notable || (v.deal >= t.dealProb && pNotable(v) >= t.dealNotable);
}

// ── Shadow record ────────────────────────────────────────────────────────────
export interface ShadowItem {
  url: string;
  title: string;
  source: string;
  prescreenKept: boolean; // reached the scoring LLM
  llm?: { relevanceScore: number; dealSignal: boolean; excludedIndustry: boolean };
  passedGate: boolean; // current quality gate (before the depth floor)
  published: boolean; // in the beat's final list (gate + floor, after dedup)
  jev?: JevVerdict;
  jevError?: string;
}

export interface ShadowRecord {
  beat: Beat;
  date: string; // YYYY-MM-DD (UTC)
  recordedAt: string;
  model: string;
  calls: number;
  failures: number;
  cost: number;
  items: ShadowItem[];
}

export interface CurrentDecisions {
  poolInputs: JevArticleInput[];
  prescreenKept: Set<string>; // normalized urls
  llmScored: Map<string, { relevanceScore: number; dealSignal: boolean; excludedIndustry: boolean }>;
  passedGate: Set<string>;
  published: Set<string>;
}

export function buildShadowRecord(
  beat: Beat,
  current: CurrentDecisions,
  jev: Map<string, JevResult>,
  now = new Date(),
): ShadowRecord {
  let failures = 0;
  let cost = 0;
  const items: ShadowItem[] = current.poolInputs.map(a => {
    const r = jev.get(a.url);
    const item: ShadowItem = {
      url: a.url,
      title: a.title,
      source: a.source,
      prescreenKept: current.prescreenKept.has(a.url),
      llm: current.llmScored.get(a.url),
      passedGate: current.passedGate.has(a.url),
      published: current.published.has(a.url),
    };
    if (!r) {
      item.jevError = "not called";
      failures++;
    } else if ("error" in r) {
      item.jevError = r.error;
      failures++;
    } else {
      item.jev = r.verdict;
      cost += r.cost;
    }
    return item;
  });
  return {
    beat,
    date: now.toISOString().slice(0, 10),
    recordedAt: now.toISOString(),
    model: JEV_MODEL,
    calls: jev.size,
    failures,
    cost,
    items,
  };
}

export function shadowKey(date: string, beat: Beat): string {
  return `jev-shadow:${date}:${beat}`;
}

/** Join Jev's answers with the current pipeline's decisions and write to KV. Never throws. */
export async function recordJevShadow(
  beat: Beat,
  jevPromise: Promise<Map<string, JevResult>>,
  current: CurrentDecisions,
): Promise<void> {
  try {
    const jev = await jevPromise;
    const record = buildShadowRecord(beat, current, jev);
    const { kv } = await import("@vercel/kv");
    await kv.setex(shadowKey(record.date, beat), JEV_SHADOW_TTL_SECONDS, record);
    console.log(
      `[jev-shadow] ${beat} - ${record.items.length} articles, ${record.failures} failures, $${record.cost.toFixed(5)}`,
    );
  } catch (err) {
    console.warn(`[jev-shadow] ${beat} - record failed:`, err instanceof Error ? err.message : String(err));
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
// Pure: turns stored shadow records into a markdown report. Used by
// scripts/jev-shadow-report.ts. A url seen on several days keeps its latest row.

type DatedItem = ShadowItem & { beat: Beat; date: string };

function jevCutReason(v: JevVerdict): string {
  if (v.excluded >= 0.5) return "excluded industry";
  if (v.beat === "unrelated") return "unrelated to AI";
  return "below relevance bar";
}

export function currentStatus(i: ShadowItem): string {
  if (i.published) return i.passedGate ? "published (gate)" : "published (floor backfill)";
  if (!i.prescreenKept) return "dropped at pre-screen";
  if (!i.llm) return "skipped by scoring LLM";
  if (i.llm.excludedIndustry) return "LLM marked excluded";
  if (i.passedGate) return "passed gate, lost in dedup";
  return `below gate (LLM ${i.llm.relevanceScore}${i.llm.dealSignal ? ", deal" : ""})`;
}

const pct = (n: number, d: number) => (d === 0 ? "0%" : `${Math.round((n / d) * 100)}%`);
const f2 = (n: number) => n.toFixed(2);
const cell = (s: string) => s.replace(/\|/g, "/").replace(/\s+/g, " ").slice(0, 110);

export function buildShadowReport(
  records: ShadowRecord[],
  t: JevGateThresholds = DEFAULT_JEV_GATE,
): string {
  const sorted = [...records].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const latest = new Map<string, DatedItem>();
  for (const r of sorted) for (const i of r.items) latest.set(i.url, { ...i, beat: r.beat, date: r.date });
  const judged = [...latest.values()].filter(i => i.jev);
  const keeps = (i: ShadowItem, tt = t) => Boolean(i.jev && jevWouldKeep(i.jev, tt));

  const totalCalls = records.reduce((s, r) => s + r.items.length, 0);
  const totalFailures = records.reduce((s, r) => s + r.failures, 0);
  const totalCost = records.reduce((s, r) => s + r.cost, 0);
  const days = new Set(records.map(r => r.date));

  const lines: string[] = [];
  lines.push(`# Jev shadow report`, "");
  lines.push(
    `Model \`${JEV_MODEL}\`. Gate tested: drop if P(excluded industry) >= 0.5 or the beat choice is "unrelated"; ` +
      `otherwise keep if P(major) >= ${t.major}, or P(notable or major) >= ${t.notable}, ` +
      `or P(deal) >= ${t.dealProb} with P(notable or major) >= ${t.dealNotable}. ` +
      `"Major" = major model, infra, or distribution shift; "notable" = enterprise adoption or a >$50M strategic round.`,
    "",
  );
  lines.push(`## Overview`, "");
  lines.push(`- ${days.size} day(s), ${records.length} beat run(s), ${latest.size} unique articles (${judged.length} with a Jev answer)`);
  lines.push(`- Jev calls: ${totalCalls}, failures: ${totalFailures} (${pct(totalFailures, totalCalls)}), cost: $${totalCost.toFixed(4)}`, "");

  const pubKeep = judged.filter(i => i.published && keeps(i)).length;
  const pubCut = judged.filter(i => i.published && !keeps(i)).length;
  const dropKeep = judged.filter(i => !i.published && keeps(i)).length;
  const dropCut = judged.filter(i => !i.published && !keeps(i)).length;
  lines.push(`## Agreement`, "");
  lines.push(`| | Jev keeps | Jev cuts |`, `|---|---|---|`);
  lines.push(`| **Published** | ${pubKeep} | ${pubCut} |`);
  lines.push(`| **Not published** | ${dropKeep} | ${dropCut} |`, "");
  lines.push(`Agreement: ${pct(pubKeep + dropCut, judged.length)} of judged articles.`, "");

  lines.push(`## Volume per beat run`, "");
  lines.push(`| Date | Beat | Pool | Published | Jev keeps | Both |`, `|---|---|---|---|---|---|`);
  for (const r of sorted) {
    const jk = r.items.filter(i => keeps(i));
    lines.push(
      `| ${r.date} | ${r.beat} | ${r.items.length} | ${r.items.filter(i => i.published).length} | ${jk.length} | ${jk.filter(i => i.published).length} |`,
    );
  }
  lines.push("");

  const runs = Math.max(1, sorted.length);
  const sweep = (label: string, field: "major" | "notable", values: number[]) => {
    lines.push(`## Threshold sweep: ${label} (other cut-offs at default, average per beat run)`, "");
    lines.push(`| ${label} >= | Avg Jev keeps | Of which published |`, `|---|---|---|`);
    for (const value of values) {
      const tt = { ...t, [field]: value };
      let kept = 0;
      let both = 0;
      for (const r of sorted) {
        for (const i of r.items) {
          if (!keeps(i, tt)) continue;
          kept++;
          if (i.published) both++;
        }
      }
      lines.push(`| ${value} | ${(kept / runs).toFixed(1)} | ${(both / runs).toFixed(1)} |`);
    }
    lines.push("");
  };
  sweep("P(major)", "major", [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
  sweep("P(notable or major)", "notable", [0.6, 0.7, 0.8, 0.85, 0.9, 1.01]);

  const header = [
    `| Date | Beat | Story | Source | P(major) | P(notable+) | P(deal) | LLM score | Why | Your call |`,
    `|---|---|---|---|---|---|---|---|---|---|`,
  ];
  const row = (i: DatedItem, why: string) =>
    `| ${i.date} | ${i.beat} | [${cell(i.title)}](${i.url}) | ${cell(i.source)} | ${f2(pMajor(i.jev!))} | ` +
    `${f2(pNotable(i.jev!))} | ${f2(i.jev!.deal)} | ${i.llm ? i.llm.relevanceScore : "-"} | ${why} | |`;

  const missed = judged.filter(i => !i.published && keeps(i)).sort((a, b) => pMajor(b.jev!) - pMajor(a.jev!));
  lines.push(`## A. Jev would keep, you never saw (${missed.length})`, "");
  lines.push(`Mark "Jev" if you'd have wanted it, "current" if dropping it was right.`, "");
  lines.push(...header, ...missed.map(i => row(i, currentStatus(i))), "");

  const cut = judged.filter(i => i.published && !keeps(i)).sort((a, b) => pMajor(a.jev!) - pMajor(b.jev!));
  lines.push(`## B. You saw it, Jev would cut (${cut.length})`, "");
  lines.push(`Mark "Jev" if it was filler, "current" if it belonged in the digest.`, "");
  lines.push(...header, ...cut.map(i => row(i, `${jevCutReason(i.jev!)}; ${currentStatus(i)}`)), "");

  return lines.join("\n");
}
