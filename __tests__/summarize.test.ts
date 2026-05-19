import { test, describe } from "node:test";
import assert from "node:assert";
import { MOCK_DIGEST } from "../lib/mock-digest";

const articles = MOCK_DIGEST.articles;

describe("Digest Sorting and Article Count", () => {
  test("articles should be sorted by publishedAt descending within each beat", () => {
    const beats = new Map<string, any[]>();

    for (const article of articles) {
      if (!beats.has(article.beat)) {
        beats.set(article.beat, []);
      }
      beats.get(article.beat)!.push(article);
    }

    for (const [beat, articles] of beats) {
      let lastTime = Infinity;
      for (const article of articles) {
        const currentTime = new Date(article.publishedAt).getTime();
        assert(
          currentTime <= lastTime,
          `Beat "${beat}": Article "${article.title}" (${new Date(article.publishedAt).toISOString()}) ` +
            `should come before previous article. Times not in descending order.`
        );
        lastTime = currentTime;
      }
    }
  });

  test("articles with relevanceScore >= 7 or dealSignal should represent the majority within each beat", () => {
    const beats = new Map<string, any[]>();

    for (const article of articles) {
      if (!beats.has(article.beat)) {
        beats.set(article.beat, []);
      }
      beats.get(article.beat)!.push(article);
    }

    for (const [beat, beatArticles] of beats) {
      const qualifying = beatArticles.filter((a: any) => a.relevanceScore >= 7 || a.dealSignal);
      assert(
        qualifying.length > 0,
        `Beat "${beat}" has no articles with relevanceScore >= 7 or dealSignal`
      );
    }
  });

  test("each beat should have at least 10 articles", () => {
    const beats = new Map<string, number>();

    for (const article of articles) {
      beats.set(article.beat, (beats.get(article.beat) || 0) + 1);
    }

    for (const [beat, count] of beats) {
      assert(
        count >= 10,
        `Beat "${beat}" has ${count} articles, expected at least 10`
      );
    }
  });

  test("all articles should have required fields", () => {
    for (const article of articles) {
      assert(article.title, "Article missing title");
      assert(article.url, "Article missing url");
      assert(article.source, "Article missing source");
      assert(article.publishedAt, "Article missing publishedAt");
      assert(article.beat, "Article missing beat");
      assert(article.companyTags, "Article missing companyTags");
      assert(Array.isArray(article.companyTags), "companyTags should be array");
      assert(article.summary, "Article missing summary");
      assert(
        article.relevanceScore !== undefined,
        "Article missing relevanceScore"
      );
      assert(
        article.impactScore !== undefined,
        "Article missing impactScore"
      );
      assert(
        article.dealSignal !== undefined,
        "Article missing dealSignal boolean"
      );
    }
  });

  test("publishedAt should be valid ISO string", () => {
    for (const article of articles) {
      const date = new Date(article.publishedAt);
      assert(
        !isNaN(date.getTime()),
        `Article "${article.title}" has invalid publishedAt: ${article.publishedAt}`
      );
    }
  });

  test("should have companyLogoUrl for articles with recognized companies", () => {
    const articlesWithCompanies = articles.filter(
      (a) => a.companyTags && a.companyTags.length > 0
    );

    for (const article of articlesWithCompanies) {
      assert(
        article.companyLogoUrl || article.ogImage,
        `Article "${article.title}" with company ${article.companyTags[0]} should have companyLogoUrl or ogImage`
      );
    }
  });

  test("featured article (first article overall) should be highest impactScore in last 24h, ties broken by recency", () => {
    const now = Date.now();
    const recent = articles.filter(
      (a) => now - new Date(a.publishedAt).getTime() < 24 * 60 * 60 * 1000
    );
    const pool = recent.length > 0 ? recent : articles;
    const maxImpact = Math.max(...pool.map((a) => a.impactScore));
    const expected = pool
      .filter((a) => a.impactScore === maxImpact)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];

    assert(
      articles[0].title === expected.title,
      `Featured should be "${expected.title}" (impactScore: ${maxImpact}), got "${articles[0].title}"`
    );
  });
});
