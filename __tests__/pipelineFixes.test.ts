import { test, describe } from "node:test";
import assert from "node:assert";
import type { ExaArticle } from "../lib/exa";
import type { DigestArticle } from "../lib/summarize";
import { selectArticlesForScoring } from "../lib/summarize";
import { deduplicateAcrossBeats } from "../lib/beat-digests";
import { requireCronAuth } from "../lib/auth";

function mkExa(partial: Partial<ExaArticle>): ExaArticle {
  return {
    title: "Stub",
    url: "https://example.com/a",
    publishedAt: "2026-11-22T12:00:00.000Z",
    source: "unknown.com",
    ogImage: null,
    beatHint: "AI Labs",
    ...partial,
  };
}

function mkDigestArticle(partial: Partial<DigestArticle>): DigestArticle {
  return {
    title: "Stub",
    url: "https://example.com/a",
    source: "unknown.com",
    publishedAt: "2026-11-22T12:00:00.000Z",
    ogImage: null,
    beat: "AI Labs",
    category: "Product",
    companyTags: [],
    summary: "Summary.",
    bdRelevance: "Relevance.",
    relevanceScore: 8,
    impactScore: 8,
    impactReason: "Reason.",
    dealSignal: false,
    storyId: "stub-story",
    ...partial,
  };
}

describe("selectArticlesForScoring", () => {
  test("prioritizes fresh Tier-0/1 articles appended later over older Tier-4 items and pushes future dates last", () => {
    const now = Date.parse("2026-11-23T12:00:00.000Z");
    const oldTier4 = Array.from({ length: 15 }, (_, i) =>
      mkExa({
        title: `Old Tier4 ${i}`,
        url: `https://unknown${i}.example.com/post`,
        source: `unknown${i}.example.com`,
        publishedAt: "2026-11-17T12:00:00.000Z",
      }),
    );
    const freshTc = mkExa({
      title: "Fresh TC",
      url: "https://techcrunch.com/2026/11/23/fresh-tc",
      source: "techcrunch.com",
      publishedAt: "2026-11-23T08:00:00.000Z",
    });
    const freshVc = mkExa({
      title: "Fresh VC",
      url: "https://a16z.com/fresh-vc",
      source: "a16z.com",
      publishedAt: "2026-11-23T07:00:00.000Z",
    });
    const futureBad = mkExa({
      title: "Future article",
      url: "https://techcrunch.com/2026/11/28/future",
      source: "techcrunch.com",
      publishedAt: "2026-11-28T00:00:00.000Z",
    });

    const selected = selectArticlesForScoring([...oldTier4, futureBad, freshVc, freshTc], 15, now);
    assert.equal(selected.length, 15);
    assert.equal(selected[0].title, "Fresh TC");
    assert.equal(selected[1].title, "Fresh VC");
    assert.ok(!selected.some(a => a.title === "Future article"));
  });
});

describe("deduplicateAcrossBeats", () => {
  test("collapses same-beat duplicates from separate beat caches and keeps higher-tier source", () => {
    const a1 = mkDigestArticle({
      title: "Genesis AI raises $500M to deploy glove-wearing robots",
      url: "https://techcrunch.com/2026/11/17/genesis-ai-raises-500m",
      source: "techcrunch.com",
      beat: "Physical AI",
      companyTags: ["Genesis AI"],
      storyId: "genesis-ai-500m-series",
    });
    const a2 = mkDigestArticle({
      title: "Genesis AI raises $500M for glove-wearing robots",
      url: "https://startupfortune.com/genesis-ai-500m",
      source: "startupfortune.com",
      beat: "Physical AI",
      companyTags: ["Genesis AI"],
      storyId: "genesis-ai-funding",
    });
    const distinct = mkDigestArticle({
      title: "OpenAI embeds external safety researchers",
      url: "https://techcrunch.com/2026/11/16/openai-safety",
      source: "techcrunch.com",
      beat: "AI Labs",
      companyTags: ["OpenAI"],
      storyId: "openai-apollo-safety",
    });

    const deduped = deduplicateAcrossBeats([a2, a1, distinct]);
    assert.equal(deduped.length, 2);
    assert.ok(deduped.some(a => a.source === "techcrunch.com" && a.companyTags.includes("Genesis AI")));
    assert.ok(!deduped.some(a => a.source === "startupfortune.com"));
  });

  test("collapses matching storyId across different headlines", () => {
    const a1 = mkDigestArticle({
      title: "Anthropic files S-1 for historic IPO",
      url: "https://techcrunch.com/anthropic-ipo",
      source: "techcrunch.com",
      beat: "AI Labs",
      storyId: "anthropic-ipo-2026",
    });
    const a2 = mkDigestArticle({
      title: "Circular financing faces Wall Street test ahead of listing",
      url: "https://siliconangle.com/anthropic-listing",
      source: "siliconangle.com",
      beat: "AI Infrastructure",
      storyId: "anthropic-ipo-2026",
    });

    const deduped = deduplicateAcrossBeats([a2, a1]);
    assert.equal(deduped.length, 1);
    assert.equal(deduped[0].source, "techcrunch.com");
  });
});

describe("requireCronAuth", () => {
  test("validates CRON_SECRET presence and exact Bearer token", () => {
    const prev = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      const res500 = requireCronAuth(new Request("https://example.com/api/beat"));
      assert.equal(res500?.status, 500);

      process.env.CRON_SECRET = "super-secret-value";
      assert.equal(requireCronAuth(new Request("https://example.com/api/beat"))?.status, 401);
      assert.equal(
        requireCronAuth(new Request("https://example.com/api/beat", { headers: { authorization: "super-secret-value" } }))?.status,
        401,
      );
      assert.equal(
        requireCronAuth(new Request("https://example.com/api/beat", { headers: { authorization: "Bearer wrong" } }))?.status,
        401,
      );
      assert.equal(
        requireCronAuth(new Request("https://example.com/api/beat", { headers: { authorization: "Bearer super-secret-value" } })),
        null,
      );
    } finally {
      if (prev === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prev;
    }
  });
});
