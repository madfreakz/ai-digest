import { test, describe } from "node:test";
import assert from "node:assert";
import {
  buildJevRequest,
  buildShadowRecord,
  buildShadowReport,
  currentStatus,
  isJevShadowEnabled,
  jevWouldKeep,
  parseJevResponse,
  recordJevShadow,
  scoreWithJev,
  type JevArticleInput,
  type JevVerdict,
} from "../lib/jev-shadow";

const article = (i: number): JevArticleInput => ({
  url: `https://example.com/a${i}`,
  title: `Story ${i}`,
  source: "techcrunch.com",
  publishedAt: "2026-11-24T08:00:00.000Z",
  excerpt: `Body ${i}`,
});

const okBody = (rel: number, deal = 0.1, excluded = 0.02) => ({
  answers: {
    relevance: { type: "score", score: rel, probabilities: { "3": 0.5, "0": 0.1, "1": 0.1, "2": 0.3 } },
    deal: { type: "noul", noul: deal },
    excluded: { type: "noul", noul: excluded },
    beat: { type: "choice", choice: "ai_labs", probabilities: { unrelated: 0.05, ai_labs: 0.9, vertical_ai: 0.05 } },
  },
  usage: { cost: 0.00002 },
});

// probs = [fluff, routine, notable, major]
const verdict = (probs: number[], v: Partial<JevVerdict> = {}): JevVerdict => ({
  relevance: probs.reduce((s, p, i) => s + p * i, 0),
  relevanceProbs: probs,
  deal: 0,
  excluded: 0,
  beat: "ai_labs",
  beatProbs: { ai_labs: 1 },
  ...v,
});

describe("isJevShadowEnabled", () => {
  const base = { OPENROUTER_API_KEY: "k", KV_REST_API_URL: "u" };
  const before = Date.parse("2026-11-30T00:00:00Z");
  test("on with key + KV inside the window", () => {
    assert.strictEqual(isJevShadowEnabled(base, before), true);
  });
  test("off after the default end date", () => {
    assert.strictEqual(isJevShadowEnabled(base, Date.parse("2026-12-02T00:00:01Z")), false);
  });
  test("JEV_SHADOW_UNTIL extends the window", () => {
    assert.strictEqual(
      isJevShadowEnabled({ ...base, JEV_SHADOW_UNTIL: "2026-12-10T00:00:00Z" }, Date.parse("2026-12-05T00:00:00Z")),
      true,
    );
  });
  test("kill switch, missing key, missing KV", () => {
    assert.strictEqual(isJevShadowEnabled({ ...base, JEV_SHADOW: "off" }, before), false);
    assert.strictEqual(isJevShadowEnabled({ KV_REST_API_URL: "u" }, before), false);
    assert.strictEqual(isJevShadowEnabled({ OPENROUTER_API_KEY: "k" }, before), false);
  });
});

describe("request and parsing", () => {
  test("request carries the article as state and four typed questions", () => {
    const req = buildJevRequest("AI Labs", article(1));
    assert.strictEqual(req.model, "typesafe/jev-1.14");
    assert.strictEqual(req.state.title, "Story 1");
    assert.strictEqual(req.state.published, "2026-11-24");
    assert.deepStrictEqual(Object.keys(req.questions).sort(), ["beat", "deal", "excluded", "relevance"]);
    assert.strictEqual(req.questions.relevance.criteria?.length, 4);
  });
  test("probabilities are read by key, not position", () => {
    const v = parseJevResponse(okBody(2.2));
    assert.deepStrictEqual(v.relevanceProbs, [0.1, 0.1, 0.3, 0.5]);
    assert.strictEqual(v.relevance, 2.2);
    assert.strictEqual(v.beat, "ai_labs");
    assert.strictEqual(v.beatProbs.ai_labs, 0.9);
    assert.strictEqual(v.beatProbs.physical_ai, 0); // missing keys default to 0
  });
  test("a refused or missing answer throws", () => {
    assert.throws(() => parseJevResponse({ answers: { relevance: { type: "refusal" } } }));
    assert.throws(() => parseJevResponse({}));
  });
});

describe("scoreWithJev never throws", () => {
  test("mixes successes, HTTP errors, and network errors per article", async () => {
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (body.state.title === "Story 1") return new Response("busy", { status: 503 });
      if (body.state.title === "Story 2") throw new Error("socket hang up");
      return new Response(JSON.stringify(okBody(2.5)), { status: 200 });
    };
    const out = await scoreWithJev("AI Labs", [article(0), article(1), article(2)], { fetchImpl, apiKey: "k" });
    assert.strictEqual(out.size, 3);
    assert.ok("verdict" in out.get(article(0).url)!);
    assert.deepStrictEqual(out.get(article(1).url), { error: "HTTP 503" });
    assert.deepStrictEqual(out.get(article(2).url), { error: "socket hang up" });
  });
  test("a hanging endpoint is cut off by the overall budget", async () => {
    // Never resolves on its own; only rejects when its signal aborts. The ref'd
    // timer stands in for a real socket: AbortSignal.timeout is unref'd, and
    // Node 22's test runner cancels a test whose only pending work is unref'd.
    const fetchImpl = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        const socket = setTimeout(() => {}, 5_000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(socket);
          reject(new Error("aborted"));
        });
      });
    const articles = Array.from({ length: 25 }, (_, i) => article(i));
    const t0 = Date.now();
    const out = await scoreWithJev("AI Labs", articles, { fetchImpl, apiKey: "k", timeoutMs: 10_000, budgetMs: 100 });
    assert.ok(Date.now() - t0 < 2_000, "returned within budget");
    assert.strictEqual(out.size, 25);
    for (const r of out.values()) assert.ok("error" in r);
    assert.ok([...out.values()].some(r => "error" in r && r.error === "shadow budget exceeded"));
  });
  test("no key means no calls", async () => {
    let called = false;
    const out = await scoreWithJev("AI Labs", [article(0)], {
      apiKey: "",
      fetchImpl: async () => {
        called = true;
        return new Response("{}");
      },
    });
    assert.strictEqual(out.size, 0);
    assert.strictEqual(called, false);
  });
});

describe("recordJevShadow never throws into the beat", () => {
  test("a rejected Jev promise is swallowed", async () => {
    const empty = { poolInputs: [], prescreenKept: new Set<string>(), llmScored: new Map(), passedGate: new Set<string>(), published: new Set<string>() };
    await assert.doesNotReject(recordJevShadow("AI Labs", Promise.reject(new Error("boom")), empty));
  });
});

describe("jevWouldKeep", () => {
  // Real case from the first run: 71% major, 24% fluff. Expected value 2.19,
  // but the probability of a major shift is what the gate should read.
  test("bimodal major story kept on P(major)", () =>
    assert.strictEqual(jevWouldKeep(verdict([0.24, 0.04, 0.01, 0.71])), true));
  test("routine story cut", () => assert.strictEqual(jevWouldKeep(verdict([0.2, 0.6, 0.1, 0.1])), false));
  test("notable deal kept via deal path", () =>
    assert.strictEqual(jevWouldKeep(verdict([0.1, 0.1, 0.7, 0.1], { deal: 0.9 })), true));
  test("middling notable without a deal cut", () =>
    assert.strictEqual(jevWouldKeep(verdict([0.2, 0.2, 0.5, 0.1], { deal: 0.3 })), false));
  test("high-bar notable kept alone, like a lone 8 today", () =>
    assert.strictEqual(jevWouldKeep(verdict([0.05, 0.05, 0.7, 0.2], { deal: 0.3 })), true));
  test("excluded industry cut even if major", () =>
    assert.strictEqual(jevWouldKeep(verdict([0, 0, 0, 1], { excluded: 0.9 })), false));
  test("unrelated beat cut even if major", () =>
    assert.strictEqual(jevWouldKeep(verdict([0, 0, 0, 1], { beat: "unrelated" })), false));
});

describe("shadow record and report", () => {
  const pool = [article(0), article(1), article(2), article(3)];
  const jev = new Map([
    [pool[0].url, { verdict: verdict([0, 0, 0.1, 0.9]), cost: 0.00002 }],
    [pool[1].url, { verdict: verdict([0, 0.1, 0.2, 0.7]), cost: 0.00002 }],
    [pool[2].url, { verdict: verdict([0.7, 0.2, 0.1, 0]), cost: 0.00002 }],
    [pool[3].url, { error: "HTTP 503" }],
  ]);
  const record = buildShadowRecord(
    "AI Labs",
    {
      poolInputs: pool,
      prescreenKept: new Set([pool[0].url, pool[2].url, pool[3].url]),
      llmScored: new Map([
        [pool[0].url, { relevanceScore: 9, dealSignal: false, excludedIndustry: false }],
        [pool[2].url, { relevanceScore: 6, dealSignal: false, excludedIndustry: false }],
      ]),
      passedGate: new Set([pool[0].url]),
      published: new Set([pool[0].url, pool[2].url]),
    },
    jev,
    new Date("2026-11-25T11:00:00Z"),
  );

  test("record joins both sides and counts failures and cost", () => {
    assert.strictEqual(record.date, "2026-11-25");
    assert.strictEqual(record.failures, 1);
    assert.ok(Math.abs(record.cost - 0.00006) < 1e-12);
    assert.strictEqual(record.items[1].prescreenKept, false);
    assert.strictEqual(record.items[3].jevError, "HTTP 503");
  });

  test("current status names where each story left the pipeline", () => {
    assert.strictEqual(currentStatus(record.items[0]), "published (gate)");
    assert.strictEqual(currentStatus(record.items[1]), "dropped at pre-screen");
    assert.strictEqual(currentStatus(record.items[2]), "published (floor backfill)");
  });

  test("report lists both disagreement directions", () => {
    const md = buildShadowReport([record]);
    assert.match(md, /## A\. Jev would keep, you never saw \(1\)/);
    assert.match(md, /Story 1\]\(https:\/\/example\.com\/a1\).*dropped at pre-screen/);
    assert.match(md, /## B\. You saw it, Jev would cut \(1\)/);
    assert.match(md, /Story 2\].*below relevance bar; published \(floor backfill\)/);
    assert.match(md, /Agreement: 33% of judged articles/);
  });
});
