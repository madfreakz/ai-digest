import { test, describe } from "node:test";
import assert from "node:assert";
import { summarizeBeat } from "../lib/summarize";
import type { ExaArticle } from "../lib/exa";

// Build N distinct Exa input articles (unique url + storyId so nothing dedups).
function makeExaArticles(n: number): ExaArticle[] {
  return Array.from({ length: n }, (_, i) => ({
    title: `Story ${i}`,
    url: `https://example.com/a${i}`,
    publishedAt: `2026-07-0${(i % 9) + 1}T00:00:00.000Z`,
    text: `Body ${i}`,
    source: "techcrunch.com",
    ogImage: null,
    beatHint: "AI Infrastructure" as const,
  }));
}

// A record_articles call scoring each input with the given relevance/dealSignal.
// `specs[i]` corresponds to input article i.
function scoredCall(specs: Array<{ relevanceScore: number; dealSignal: boolean }>) {
  return {
    functionCalls: [
      {
        name: "record_articles",
        args: {
          articles: specs.map((s, i) => ({
            title: `Story ${i}`,
            url: `https://example.com/a${i}`,
            source: "techcrunch.com",
            beat: "AI Infrastructure",
            category: "General",
            companyTags: [],
            summary: `Summary ${i}. Second sentence.`,
            bdRelevance: `Relevance ${i}.`,
            relevanceScore: s.relevanceScore,
            impactScore: 5,
            impactReason: "reason",
            dealSignal: s.dealSignal,
            dealSignalType: s.dealSignal ? "funding_round" : undefined,
            storyId: `story-${i}`,
          })),
          discoveredCompanies: [],
        },
      },
    ],
  };
}

function aiReturning(response: unknown) {
  return { models: { generateContent: async () => response } } as any;
}

describe("summarizeBeat — per-beat depth floor", () => {
  test("backfills below-gate articles up to the 6-article floor, picking highest relevance", async () => {
    // 3 clear the gate (relevanceScore >= 8); 5 sit below it (no deal signal).
    const specs = [
      { relevanceScore: 9, dealSignal: false }, // pass
      { relevanceScore: 8, dealSignal: false }, // pass
      { relevanceScore: 8, dealSignal: false }, // pass
      { relevanceScore: 7, dealSignal: false }, // below → backfill candidate (highest)
      { relevanceScore: 7, dealSignal: false }, // below → backfill candidate
      { relevanceScore: 6, dealSignal: false }, // below → backfill candidate
      { relevanceScore: 5, dealSignal: false }, // below → should NOT make the cut
      { relevanceScore: 4, dealSignal: false }, // below → should NOT make the cut
    ];
    const result = await summarizeBeat(
      "AI Infrastructure",
      makeExaArticles(specs.length),
      aiReturning(scoredCall(specs)),
      "gemini-2.5-flash",
      { baseDelayMs: 0 },
    );

    assert.equal(result.articles.length, 6, "should top up from 3 gate-passers to the 6-article floor");
    // The three backfilled slots must be the highest-relevance below-gate stories (7,7,6), not the 5/4.
    const scores = result.articles.map(a => a.relevanceScore).sort((x, y) => y - x);
    assert.deepEqual(scores, [9, 8, 8, 7, 7, 6], "backfill takes the most-relevant below-gate articles");
  });

  test("floor is a floor, not a quota: a beat with fewer real articles shows only what it has", async () => {
    // Only 4 articles exist for the beat; 1 passes the gate. Can't invent 6.
    const specs = [
      { relevanceScore: 9, dealSignal: false }, // pass
      { relevanceScore: 7, dealSignal: false }, // backfill
      { relevanceScore: 6, dealSignal: false }, // backfill
      { relevanceScore: 5, dealSignal: false }, // backfill
    ];
    const result = await summarizeBeat(
      "AI Infrastructure",
      makeExaArticles(specs.length),
      aiReturning(scoredCall(specs)),
      "gemini-2.5-flash",
      { baseDelayMs: 0 },
    );
    assert.equal(result.articles.length, 4, "cannot exceed the number of real deduped articles");
  });

  test("no backfill when the gate already yields >= 6 (no low-relevance dilution)", async () => {
    const specs = Array.from({ length: 8 }, () => ({ relevanceScore: 9, dealSignal: false }));
    const result = await summarizeBeat(
      "AI Infrastructure",
      makeExaArticles(specs.length),
      aiReturning(scoredCall(specs)),
      "gemini-2.5-flash",
      { baseDelayMs: 0 },
    );
    assert.equal(result.articles.length, 8, "all gate-passers are kept; the floor never trims above it");
    assert.ok(result.articles.every(a => a.relevanceScore >= 8), "no below-gate articles pulled in when unneeded");
  });

  test("does not duplicate a gate-passer into the backfill", async () => {
    const specs = [
      { relevanceScore: 6, dealSignal: true },  // passes via deal signal at >= 6
      { relevanceScore: 7, dealSignal: false }, // backfill
      { relevanceScore: 6, dealSignal: false }, // backfill
      { relevanceScore: 5, dealSignal: false }, // backfill
    ];
    const result = await summarizeBeat(
      "AI Infrastructure",
      makeExaArticles(specs.length),
      aiReturning(scoredCall(specs)),
      "gemini-2.5-flash",
      { baseDelayMs: 0 },
    );
    const urls = result.articles.map(a => a.url);
    assert.equal(new Set(urls).size, urls.length, "no article appears twice");
    assert.equal(result.articles.length, 4);
  });
});
