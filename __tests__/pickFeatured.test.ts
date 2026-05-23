import { test, describe } from "node:test";
import assert from "node:assert";
import { pickFeaturedArticle, getSynthesisHero } from "../lib/summarize";
import type { Digest, DigestArticle } from "../lib/summarize";

function mkArticle(partial: Partial<DigestArticle>): DigestArticle {
  return {
    title: "stub",
    url: "https://example.com/",
    source: "stub",
    publishedAt: new Date().toISOString(),
    ogImage: null,
    beat: "AI Labs",
    category: "General",
    companyTags: [],
    summary: "",
    bdRelevance: "",
    relevanceScore: 5,
    impactScore: 5,
    impactReason: "",
    dealSignal: false,
    storyId: "test-stub",
    ...partial,
  };
}

describe("pickFeaturedArticle", () => {
  test("returns undefined for empty input", () => {
    assert.equal(pickFeaturedArticle([]), undefined);
  });

  test("picks the highest impactScore inside the 48h window", () => {
    const now = Date.now();
    const articles = [
      mkArticle({ title: "low",  impactScore: 5, publishedAt: new Date(now - 1_000).toISOString() }),
      mkArticle({ title: "high", impactScore: 9, publishedAt: new Date(now - 2_000).toISOString() }),
      mkArticle({ title: "mid",  impactScore: 7, publishedAt: new Date(now - 3_000).toISOString() }),
    ];
    assert.equal(pickFeaturedArticle(articles)?.title, "high");
  });

  test("returns undefined when nothing is within 48h (callers fall back)", () => {
    const fiveDays = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const tenDays  = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const articles = [
      mkArticle({ title: "5d/impact6",  impactScore: 6, publishedAt: fiveDays }),
      mkArticle({ title: "10d/impact9", impactScore: 9, publishedAt: tenDays }),
    ];
    assert.equal(pickFeaturedArticle(articles), undefined);
  });

  test("breaks impactScore ties by recency (newer wins)", () => {
    const now = Date.now();
    const articles = [
      mkArticle({ title: "older", impactScore: 8, publishedAt: new Date(now - 60_000).toISOString() }),
      mkArticle({ title: "newer", impactScore: 8, publishedAt: new Date(now - 1_000).toISOString() }),
    ];
    assert.equal(pickFeaturedArticle(articles)?.title, "newer");
  });

  test("ignores >48h articles when there is at least one recent one", () => {
    const now = Date.now();
    const articles = [
      mkArticle({ title: "old high impact", impactScore: 10, publishedAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() }),
      mkArticle({ title: "recent low",      impactScore: 4,  publishedAt: new Date(now - 1_000).toISOString() }),
    ];
    assert.equal(pickFeaturedArticle(articles)?.title, "recent low");
  });
});

describe("getSynthesisHero freshness guard", () => {
  function mkDigest(articles: DigestArticle[], featuredUrl?: string): Digest {
    return {
      articles,
      generatedAt: new Date().toISOString(),
      synthesis: featuredUrl
        ? { thesis: "stub", emailSubject: "stub", featuredArticleUrl: featuredUrl }
        : undefined,
    };
  }

  test("returns synthesis pick when it's within 48h", () => {
    const now = Date.now();
    const fresh = mkArticle({
      title: "fresh",
      url: "https://example.com/fresh",
      publishedAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
    });
    const digest = mkDigest([fresh], "https://example.com/fresh");
    assert.equal(getSynthesisHero(digest)?.title, "fresh");
  });

  test("falls back to pickFeaturedArticle when synthesis pick is stale", () => {
    const now = Date.now();
    const stale = mkArticle({
      title: "stale-synthesis-pick",
      url: "https://example.com/stale",
      impactScore: 10,
      publishedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const recent = mkArticle({
      title: "recent-fallback",
      url: "https://example.com/recent",
      impactScore: 6,
      publishedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    });
    const digest = mkDigest([stale, recent], "https://example.com/stale");
    assert.equal(getSynthesisHero(digest)?.title, "recent-fallback");
  });
});
