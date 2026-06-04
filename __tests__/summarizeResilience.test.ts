import { test, describe } from "node:test";
import assert from "node:assert";
import { summarizeBeat } from "../lib/summarize";
import type { ExaArticle } from "../lib/exa";

// One realistic input article. summarizeBeat early-returns on an empty input, so
// we must pass at least one so the scoring path actually runs.
const ARTICLES: ExaArticle[] = [
  {
    title: "Acme raises $100M Series B",
    url: "https://example.com/acme",
    publishedAt: "2026-06-03T00:00:00.000Z",
    text: "Acme, an AI infrastructure startup, raised $100M.",
    source: "techcrunch.com",
    ogImage: null,
    beatHint: "AI Infrastructure",
  },
];

// A well-formed record_articles function call that passes Zod + the score filter.
function validFunctionCall() {
  return {
    functionCalls: [
      {
        name: "record_articles",
        args: {
          articles: [
            {
              title: "Acme raises $100M Series B",
              url: "https://example.com/acme",
              source: "techcrunch.com",
              beat: "AI Infrastructure",
              category: "Funding",
              companyTags: [],
              summary: "Acme raised a $100M Series B. It plans to scale its platform.",
              bdRelevance: "Signals continued infra funding momentum.",
              relevanceScore: 9,
              impactScore: 7,
              impactReason: "Sizable round for an infra player.",
              dealSignal: true,
              dealSignalType: "funding_round",
              storyId: "acme-series-b",
            },
          ],
          discoveredCompanies: [],
        },
      },
    ],
  };
}

function make503(): Error {
  return new Error("got status: 503 UNAVAILABLE. The model is overloaded. Please try again later.");
}

describe("summarizeBeat — Gemini 503 resilience", () => {
  test("falls back to flash-lite (thinkingBudget >= 512) when flash 503s, and recovers the articles", async () => {
    const calls: Array<{ model: string; thinkingBudget: number | undefined }> = [];
    const ai: any = {
      models: {
        generateContent: async (req: any) => {
          calls.push({ model: req.model, thinkingBudget: req.config?.thinkingConfig?.thinkingBudget });
          // Simulate a sustained "high demand" spike on the heavy flash model.
          if (req.model === "gemini-2.5-flash") throw make503();
          return validFunctionCall();
        },
      },
    };

    const result = await summarizeBeat("AI Infrastructure", ARTICLES, ai, "gemini-2.5-flash", { baseDelayMs: 0 });

    assert.equal(result.articles.length, 1, "should recover the scored article via the lite fallback");

    // flash retried 3x before switching models.
    assert.equal(
      calls.filter(c => c.model === "gemini-2.5-flash").length,
      3,
      "flash should be retried 3x before falling back",
    );

    // The lite fallback must be attempted AND must use a thinkingBudget lite accepts (>= 512).
    const liteCall = calls.find(c => c.model === "gemini-2.5-flash-lite");
    assert(liteCall, "flash-lite fallback must be attempted after flash exhausts");
    assert(
      liteCall!.thinkingBudget !== undefined && liteCall!.thinkingBudget >= 512,
      `lite thinkingBudget must be >= 512 (it rejects 128), got ${liteCall!.thinkingBudget}`,
    );
  });

  test("THROWS (does not silently return empty) when every attempt fails — so the caller preserves the cache", async () => {
    const ai: any = {
      models: { generateContent: async () => { throw make503(); } },
    };

    await assert.rejects(
      summarizeBeat("AI Infrastructure", ARTICLES, ai, "gemini-2.5-flash", { baseDelayMs: 0 }),
      /503|scoring failed/i,
      "a total scoring failure must throw, not resolve to an empty result",
    );
  });

  test("retries a transient soft failure (no function call), then recovers on the next attempt", async () => {
    let n = 0;
    const ai: any = {
      models: {
        generateContent: async () => {
          n++;
          // First flash attempt returns text instead of a function call; second succeeds.
          if (n === 1) return { functionCalls: [], text: "I cannot help with that." };
          return validFunctionCall();
        },
      },
    };

    const result = await summarizeBeat("AI Infrastructure", ARTICLES, ai, "gemini-2.5-flash", { baseDelayMs: 0 });
    assert.equal(result.articles.length, 1, "should recover after a transient no-function-call response");
    assert.equal(n, 2, "should have taken exactly two attempts");
  });

  test("a valid but empty function call returns empty WITHOUT throwing (genuine quiet-news day)", async () => {
    const ai: any = {
      models: {
        generateContent: async () => ({
          functionCalls: [{ name: "record_articles", args: { articles: [], discoveredCompanies: [] } }],
        }),
      },
    };

    const result = await summarizeBeat("AI Infrastructure", ARTICLES, ai, "gemini-2.5-flash", { baseDelayMs: 0 });
    assert.equal(result.articles.length, 0, "an empty-but-valid result is legitimate, not a failure");
    assert.equal(result.discoveredCompanies.length, 0);
  });
});
