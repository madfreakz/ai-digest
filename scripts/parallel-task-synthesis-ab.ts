/**
 * A/B #2: native (Exa retrieval -> Gemini synthesis) vs Parallel Task + Basis,
 * on the HERO-TREATMENT job. This is the complement to scripts/parallel-vs-exa-ab.ts.
 *
 * That first A/B tested the RETRIEVAL / RECALL layer (broad neural search) and
 * correctly kept Exa — because catching a fresh, breaking, primary-source item is
 * a coverage+freshness problem, which is Exa's core competency and NOT what a
 * Parallel Task (question-driven deep-research synthesis) is built for.
 *
 * This A/B tests the OTHER layer: depth + grounding + calibrated trust. The
 * question Mark actually wants answered:
 *
 *   "If I rebuilt the hero treatment from scratch, is ONE Parallel Task + Basis
 *    call (which does retrieval AND synthesis AND per-field citations AND
 *    calibrated confidence) better than my native two-step (Exa snippet ->
 *    Gemini free-text synthesis) — enough to be worth wiring in for the hero?"
 *
 * It deliberately replaces BOTH native layers (Exa + Gemini) with Parallel in
 * arm B, seeding Parallel with only the story identity (title + url), so we test
 * the whole declarative stack, not just synthesis-from-fixed-sources.
 *
 * Pipeline:
 *   1. Retrieve + score ONE beat via the REAL production path (Exa neural +
 *      summarizeBeat) so the candidate stories are fresh + judged by the digest's
 *      own bar. Take the top N by impactScore (the hero-worthy ones).
 *   2. Arm A (native): the digest's own output — summary + bdRelevance (from
 *      summarizeBeat) + thesis (from generateEditorialSynthesis, treating the
 *      story as the chosen lead). This is exactly what the digest publishes.
 *   3. Arm B (Parallel): one Task run per story (processor `core`, + one `pro`
 *      run on the top story to show the depth dial), JSON output schema = the
 *      hero fields, capturing output.content + output.basis (citations / excerpts
 *      / reasoning / calibrated confidence per field) + latency + nominal cost.
 *   4. Blind LLM-judge (Gemini, randomized arm labels) scores grounding / depth /
 *      bd-insight and flags suspect claims. Self-preference caveat noted — the
 *      human side-by-side artifact is the real arbiter for a newsletter.
 *   5. Surface the Basis calibration data so Mark can SEE calibrated confidence
 *      on his own content (the thing he wanted to understand).
 *
 * Does NOT touch the production pipeline. Reads shared libs; writes only to
 * scripts/out/. Cost is a few cents (Exa + Gemini + ~4 Parallel Task runs).
 *
 * Run:  node --env-file=.env.local --import tsx scripts/parallel-task-synthesis-ab.ts [beat] [N]
 *   beat default = "AI Labs"  (one of: "Physical AI" | "AI Infrastructure" | "AI Labs" | "Vertical AI")
 *   N    default = 3
 * Needs: EXA_API_KEY, GOOGLE_API_KEY, PARALLEL_API_KEY.
 */

import Exa from "exa-js";
import { GoogleGenAI, Type } from "@google/genai";
import type { Schema } from "@google/genai";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { BEAT_QUERIES, normalizeUrl, type ExaArticle } from "../lib/exa";
import {
  summarizeBeat,
  generateEditorialSynthesis,
  type DigestArticle,
} from "../lib/summarize";
import type { Beat } from "../lib/companies";

// --- knobs ---
const TASK_CREATE_URL = "https://api.parallel.ai/v1/tasks/runs";
const taskResultUrl = (id: string) => `https://api.parallel.ai/v1/tasks/runs/${id}/result?timeout=300`;
const PRIMARY_PROCESSOR = "core"; // Basis included; reliable up to ~10 fields
const DEEP_PROCESSOR = "pro";     // one extra run on the top story to show the dial
const JUDGE_MODEL = "gemini-2.5-flash";
const NUM_RESULTS = 10;
const TEXT_MAX_CHARS = 400;
// Nominal $/task (CPM/1000) for context only — published list prices.
const CPM: Record<string, number> = { lite: 5, base: 10, core: 25, pro: 100, ultra: 300 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const startDate7d = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; };
const hostnameOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } };

// ---------------------------------------------------------------------------
// Exa retrieval — same opts as production (lib/exa.ts), one beat.
// ---------------------------------------------------------------------------
async function exaRetrieve(beat: Beat, queries: string[], exa: Exa, startDate: string): Promise<ExaArticle[]> {
  const seen = new Set<string>();
  const out: ExaArticle[] = [];
  for (const q of queries) {
    try {
      const res = await exa.searchAndContents(q, {
        type: "neural", numResults: NUM_RESULTS, startPublishedDate: startDate,
        text: { maxCharacters: TEXT_MAX_CHARS },
      } as any);
      for (const item of res.results) {
        const norm = normalizeUrl(item.url);
        if (seen.has(norm)) continue;
        seen.add(norm);
        out.push({
          title: item.title ?? "Untitled", url: item.url,
          publishedAt: item.publishedDate ?? new Date().toISOString(),
          text: (item as Record<string, unknown>).text as string | undefined,
          source: hostnameOf(item.url), ogImage: null, beatHint: beat,
        });
      }
      console.log(`[exa] ${beat} "${q.slice(0, 44)}..." -> ${res.results.length}`);
    } catch (err) {
      console.error(`[exa] error:`, err instanceof Error ? err.message : String(err));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parallel Task arm — create run, then block on result. Returns content + basis.
// ---------------------------------------------------------------------------
const HERO_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline:       { type: "string", description: "One concise headline for this AI-industry development." },
    what_changed:   { type: "string", description: "2-3 sentences stating exactly what happened or was announced. Facts only, no spin." },
    why_it_matters: { type: "string", description: "2 sentences on what this signals for the AI market: competitive dynamics, strategic direction, or who is threatened/advantaged." },
    bd_relevance:   { type: "string", description: "1-2 sentences on why a BD/partnerships professional at an AI company should care about this." },
    key_facts:      { type: "array", items: { type: "string" }, description: "3 to 5 concrete, verifiable facts central to the story (numbers, names, dates, dollar amounts)." },
  },
  required: ["headline", "what_changed", "why_it_matters", "bd_relevance", "key_facts"],
};

interface BasisEntry { field?: string; confidence?: string; reasoning?: string; citations?: unknown[]; excerpts?: unknown[]; }
interface ParallelTaskOutcome {
  ok: boolean;
  processor: string;
  latencyMs: number;
  nominalCostUsd: number;
  content?: Record<string, unknown>;
  basis?: BasisEntry[];
  error?: string;
}

async function parallelTask(title: string, url: string, processor: string): Promise<ParallelTaskOutcome> {
  const t0 = Date.now();
  const input = `${title}\nSource URL: ${url}\n\nResearch this AI-industry development using current, primary sources and produce the requested fields. If a fact cannot be verified, say so rather than guessing.`;
  const nominalCostUsd = (CPM[processor] ?? 0) / 1000;
  try {
    const createRes = await fetch(TASK_CREATE_URL, {
      method: "POST",
      headers: { "x-api-key": process.env.PARALLEL_API_KEY!, "content-type": "application/json" },
      body: JSON.stringify({
        input,
        processor,
        task_spec: { output_schema: { type: "json", json_schema: HERO_OUTPUT_SCHEMA } },
      }),
    });
    if (!createRes.ok) {
      const text = await createRes.text();
      return { ok: false, processor, latencyMs: Date.now() - t0, nominalCostUsd, error: `create ${createRes.status}: ${text.slice(0, 240)}` };
    }
    const { run_id } = (await createRes.json()) as { run_id: string };
    console.log(`[parallel:${processor}] created ${run_id} for "${title.slice(0, 50)}..."`);

    // Block on the result endpoint (server-side waits up to ?timeout). Retry on
    // 408 (still active) a few times so longer pro runs finish.
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(taskResultUrl(run_id), { headers: { "x-api-key": process.env.PARALLEL_API_KEY! } });
      if (res.ok) {
        const json = (await res.json()) as { output?: { content?: Record<string, unknown>; basis?: BasisEntry[] } };
        console.log(`[parallel:${processor}] ${run_id} completed in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        return { ok: true, processor, latencyMs: Date.now() - t0, nominalCostUsd, content: json.output?.content, basis: json.output?.basis ?? [] };
      }
      if (res.status === 408) { console.log(`[parallel:${processor}] ${run_id} still running (attempt ${attempt + 1})...`); continue; }
      const text = await res.text();
      return { ok: false, processor, latencyMs: Date.now() - t0, nominalCostUsd, error: `result ${res.status}: ${text.slice(0, 240)}` };
    }
    return { ok: false, processor, latencyMs: Date.now() - t0, nominalCostUsd, error: "timed out after 5 result polls (~25 min)" };
  } catch (err) {
    return { ok: false, processor, latencyMs: Date.now() - t0, nominalCostUsd, error: err instanceof Error ? err.message : String(err) };
  }
}

// Best-effort flatten of a citation object to a readable "url — excerpt".
function renderCitations(basis: BasisEntry[] | undefined): { fields: number; totalCitations: number; lines: string[] } {
  if (!basis?.length) return { fields: 0, totalCitations: 0, lines: [] };
  const lines: string[] = [];
  let totalCitations = 0;
  for (const b of basis) {
    const cites = Array.isArray(b.citations) ? b.citations : [];
    totalCitations += cites.length;
    const firstUrls = cites.slice(0, 2).map((c) => {
      if (typeof c === "string") return c;
      const o = c as Record<string, unknown>;
      return (o.url as string) || (o.title as string) || JSON.stringify(o).slice(0, 80);
    });
    lines.push(`- **${b.field ?? "?"}** · confidence: \`${b.confidence ?? "n/a"}\` · ${cites.length} citation(s)${firstUrls.length ? ` → ${firstUrls.join(" ; ")}` : ""}`);
  }
  return { fields: basis.length, totalCitations, lines };
}

// ---------------------------------------------------------------------------
// Blind LLM judge (Gemini). Randomizes which arm is "Writeup 1" vs "Writeup 2".
// ---------------------------------------------------------------------------
const JUDGE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    grounding_1: { type: Type.INTEGER }, grounding_2: { type: Type.INTEGER },
    depth_1: { type: Type.INTEGER }, depth_2: { type: Type.INTEGER },
    bd_insight_1: { type: Type.INTEGER }, bd_insight_2: { type: Type.INTEGER },
    suspect_claims_1: { type: Type.ARRAY, items: { type: Type.STRING } as any },
    suspect_claims_2: { type: Type.ARRAY, items: { type: Type.STRING } as any },
    winner: { type: Type.STRING, enum: ["1", "2", "tie"] },
    rationale: { type: Type.STRING },
  },
  required: ["grounding_1", "grounding_2", "depth_1", "depth_2", "bd_insight_1", "bd_insight_2", "winner", "rationale"],
};

interface JudgeResult { winnerArm: "native" | "parallel" | "tie"; raw: Record<string, unknown>; }

async function judge(ai: GoogleGenAI, story: string, nativeText: string, parallelText: string): Promise<JudgeResult> {
  const nativeIsOne = Math.random() < 0.5;
  const one = nativeIsOne ? nativeText : parallelText;
  const two = nativeIsOne ? parallelText : nativeText;
  const prompt = `You are evaluating two writeups of the same AI-industry story for a daily briefing aimed at a BD/partnerships professional. Judge ONLY the text shown — do not assume which system produced which.

STORY: ${story}

=== Writeup 1 ===
${one}

=== Writeup 2 ===
${two}

Score each writeup 1-5 (5=best) on:
- grounding: are the claims concrete and verifiable, free of vague filler and likely hallucination?
- depth: does it add genuinely useful multi-source context vs a thin restatement?
- bd_insight: is the "why it matters" sharp and specific for a BD/partnerships reader?

Also list any specific claim in each writeup that appears unsupported, vague, or likely inaccurate (suspect_claims_1 / suspect_claims_2; empty array if none).
Then pick the overall winner ("1", "2", or "tie") and give a one-sentence rationale.`;

  const res = await ai.models.generateContent({
    model: JUDGE_MODEL,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: JUDGE_SCHEMA, temperature: 0.2, thinkingConfig: { thinkingBudget: 512 } },
  });
  const raw = JSON.parse(res.text ?? "{}") as Record<string, unknown>;
  const w = raw.winner as string;
  const winnerArm: JudgeResult["winnerArm"] =
    w === "tie" ? "tie" : (w === "1") === nativeIsOne ? "native" : "parallel";
  return { winnerArm, raw: { ...raw, _nativeWasWriteup: nativeIsOne ? 1 : 2 } };
}

// ---------------------------------------------------------------------------
async function main() {
  for (const v of ["EXA_API_KEY", "GOOGLE_API_KEY", "PARALLEL_API_KEY"]) {
    if (!process.env[v]) { console.error(`Missing ${v}. Run: node --env-file=.env.local --import tsx scripts/parallel-task-synthesis-ab.ts`); process.exit(1); }
  }
  const beat = (process.argv[2] as Beat) || ("AI Labs" as Beat);
  const N = Number(process.argv[3] || 3);
  const startDate = startDate7d();

  const exa = new Exa(process.env.EXA_API_KEY!);
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

  const beatEntry = [...BEAT_QUERIES].find(([b]) => b === beat);
  if (!beatEntry) { console.error(`Unknown beat "${beat}". Options: ${[...BEAT_QUERIES].map(([b]) => b).join(", ")}`); process.exit(1); }
  const queries = beatEntry[1];

  console.log(`\nSYNTHESIS A/B — beat="${beat}", top N=${N}, window since ${startDate}\n`);

  // 1. Real production retrieval + scoring.
  const exaArts = await exaRetrieve(beat, queries, exa, startDate);
  console.log(`[exa] ${exaArts.length} unique articles retrieved`);
  const scored = await summarizeBeat(beat, exaArts, ai, "gemini-2.5-flash");
  const stories = [...scored.articles].sort((a, b) => b.impactScore - a.impactScore || b.relevanceScore - a.relevanceScore).slice(0, N);
  console.log(`[score] ${scored.articles.length} digest-worthy; testing top ${stories.length} by impact:`);
  stories.forEach((s, i) => console.log(`  ${i + 1}. [impact ${s.impactScore}] ${s.title.slice(0, 70)}`));
  if (stories.length === 0) { console.error("No digest-worthy stories surfaced — try another beat or re-run (Exa is non-deterministic)."); process.exit(1); }

  // 2 + 3. Per story: native thesis (arm A) + Parallel Task (arm B), concurrently.
  const records: any[] = [];
  await Promise.all(
    stories.map(async (story, idx) => {
      const synthesis = await generateEditorialSynthesis(scored.articles, story).catch(() => undefined);
      const nativeText = [
        `Headline: ${story.title}`,
        `Summary: ${story.summary}`,
        `Why it matters (BD): ${story.bdRelevance}`,
        `Thesis: ${synthesis?.thesis ?? "(synthesis unavailable)"}`,
      ].join("\n");

      const proc = idx === 0 ? DEEP_PROCESSOR : PRIMARY_PROCESSOR; // one deep run on the top story
      const pTask = await parallelTask(story.title, story.url, proc);
      let alsoPro: ParallelTaskOutcome | undefined;
      if (idx === 0) alsoPro = await parallelTask(story.title, story.url, PRIMARY_PROCESSOR); // top story also on core, to compare the dial

      records.push({ idx, story, nativeText, synthesis, pTask, alsoPro });
    }),
  );
  records.sort((a, b) => a.idx - b.idx);

  // 4. Judge each (sequential to respect Gemini rate limits).
  const tallies = { native: 0, parallel: 0, tie: 0 };
  for (const r of records) {
    if (!r.pTask.ok || !r.pTask.content) { r.judge = { winnerArm: "native", raw: { skipped: r.pTask.error } }; tallies.native++; continue; }
    const c = r.pTask.content;
    const parallelText = [
      `Headline: ${c.headline ?? ""}`,
      `What changed: ${c.what_changed ?? ""}`,
      `Why it matters: ${c.why_it_matters ?? ""}`,
      `BD relevance: ${c.bd_relevance ?? ""}`,
      `Key facts: ${Array.isArray(c.key_facts) ? (c.key_facts as string[]).join("; ") : ""}`,
    ].join("\n");
    try {
      r.judge = await judge(ai, r.story.title, r.nativeText, parallelText);
      tallies[r.judge.winnerArm as "native" | "parallel" | "tie"]++;
      console.log(`[judge] "${r.story.title.slice(0, 50)}" -> ${r.judge.winnerArm}`);
    } catch (err) {
      r.judge = { winnerArm: "tie", raw: { error: err instanceof Error ? err.message : String(err) } };
      tallies.tie++;
    }
    await sleep(10_000);
  }

  // 5. Artifacts.
  const outDir = join(process.cwd(), "scripts", "out");
  mkdirSync(outDir, { recursive: true });
  const tag = new Date().toISOString().replace(/[:.]/g, "-");

  const md: string[] = [];
  md.push(`# Synthesis A/B: native (Exa→Gemini) vs Parallel Task + Basis`);
  md.push(`\nBeat: **${beat}** · top **${stories.length}** by impact · window since ${startDate} · generated ${new Date().toISOString()}`);
  md.push(`\n**Judge tally (blind Gemini):** native ${tallies.native} · parallel ${tallies.parallel} · tie ${tallies.tie}`);
  md.push(`\n> Caveat: judge is Gemini and arm A is Gemini-written, so there's mild self-preference risk even with blind labels. The side-by-side below is the real arbiter — read it yourself. The Basis tables show calibrated confidence on your own content.\n`);

  for (const r of records) {
    md.push(`\n---\n## ${r.idx + 1}. ${r.story.title}`);
    md.push(`\`${r.story.url}\` · source: ${r.story.source} · impact ${r.story.impactScore}/relevance ${r.story.relevanceScore} · published ${r.story.publishedAt}`);
    md.push(`\n### Arm A — native (Exa snippet → Gemini), ~$0.001, <5s`);
    md.push("```\n" + r.nativeText + "\n```");
    md.push(`Citations available to reader: **1** (the single Exa source URL).`);

    md.push(`\n### Arm B — Parallel Task + Basis (\`${r.pTask.processor}\`), ~$${r.pTask.nominalCostUsd.toFixed(3)}, ${(r.pTask.latencyMs / 1000).toFixed(0)}s`);
    if (!r.pTask.ok) {
      md.push(`**FAILED:** ${r.pTask.error}`);
    } else {
      const c = r.pTask.content as Record<string, unknown>;
      md.push("```");
      md.push(`Headline: ${c.headline ?? ""}`);
      md.push(`What changed: ${c.what_changed ?? ""}`);
      md.push(`Why it matters: ${c.why_it_matters ?? ""}`);
      md.push(`BD relevance: ${c.bd_relevance ?? ""}`);
      md.push(`Key facts:`);
      for (const f of (Array.isArray(c.key_facts) ? c.key_facts : []) as string[]) md.push(`  - ${f}`);
      md.push("```");
      const cit = renderCitations(r.pTask.basis);
      md.push(`\n**Basis (per-field calibrated confidence + citations) — ${cit.fields} fields, ${cit.totalCitations} citations:**`);
      md.push(cit.lines.join("\n") || "_(no basis returned)_");
    }
    if (r.alsoPro) {
      md.push(`\n<details><summary>Same story on \`${r.alsoPro.processor}\` (dial comparison)</summary>\n`);
      if (r.alsoPro.ok) {
        const c2 = r.alsoPro.content as Record<string, unknown>;
        md.push("```\n" + `What changed: ${c2.what_changed ?? ""}\nWhy it matters: ${c2.why_it_matters ?? ""}` + "\n```");
        const cit2 = renderCitations(r.alsoPro.basis);
        md.push(`Basis: ${cit2.fields} fields, ${cit2.totalCitations} citations, ~$${r.alsoPro.nominalCostUsd.toFixed(3)}, ${(r.alsoPro.latencyMs / 1000).toFixed(0)}s`);
      } else md.push(`FAILED: ${r.alsoPro.error}`);
      md.push(`</details>`);
    }
    if (r.judge) {
      md.push(`\n**Judge:** winner = **${r.judge.winnerArm}** · ${JSON.stringify(r.judge.raw)}`);
    }
  }

  const mdPath = join(outDir, `synthesis-ab-${tag}.md`);
  const jsonPath = join(outDir, `synthesis-ab-${tag}.json`);
  writeFileSync(mdPath, md.join("\n"));
  writeFileSync(jsonPath, JSON.stringify({ meta: { beat, N, startDate, primaryProcessor: PRIMARY_PROCESSOR, deepProcessor: DEEP_PROCESSOR, judgeModel: JUDGE_MODEL, generatedAt: new Date().toISOString() }, tallies, records }, null, 2));

  console.log("\n================ RESULTS ================");
  console.log(`Judge tally (blind): native=${tallies.native} parallel=${tallies.parallel} tie=${tallies.tie}`);
  const okTasks = records.filter((r) => r.pTask.ok);
  if (okTasks.length) {
    const avgLat = okTasks.reduce((a, r) => a + r.pTask.latencyMs, 0) / okTasks.length / 1000;
    const totCost = records.reduce((a, r) => a + (r.pTask.ok ? r.pTask.nominalCostUsd : 0) + (r.alsoPro?.ok ? r.alsoPro.nominalCostUsd : 0), 0);
    console.log(`Parallel: avg ${avgLat.toFixed(0)}s/task, ~$${totCost.toFixed(3)} total nominal cost across ${okTasks.length}(+1) runs`);
  }
  console.log(`\nMarkdown (read this): ${mdPath}`);
  console.log(`JSON: ${jsonPath}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
