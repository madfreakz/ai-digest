import { test, describe } from "node:test";
import assert from "node:assert";
import { MOCK_DIGEST } from "../lib/mock-digest.ts";

describe("Digest Sorting and Article Count", () => {
  test("articles should be sorted by publishedAt descending within each beat", () => {
    const beats = new Map();

    for (const article of MOCK_DIGEST) {
      if (!beats.has(article.beat)) {
        beats.set(article.beat, []);
      }
      beats.get(article.beat).push(article);
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

  test("dealSignal articles should appear before non-dealSignal articles within each beat", () => {
    const beats = new Map();

    for (const article of MOCK_DIGEST) {
      if (!beats.has(article.beat)) {
        beats.set(article.beat, []);
      }
      beats.get(article.beat).push(article);
    }

    for (const [beat, articles] of beats) {
      let foundNonDealSignal = false;
      for (const article of articles) {
        if (foundNonDealSignal && article.dealSignal) {
          assert.fail(
            `Beat "${beat}": Found dealSignal article after non-dealSignal article. ` +
              `Article: "${article.title}"`
          );
        }
        if (!article.dealSignal) {
          foundNonDealSignal = true;
        }
      }
    }
  });

  test("each beat should have at least 10 articles", () => {
    const beats = new Map();

    for (const article of MOCK_DIGEST) {
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
    for (const article of MOCK_DIGEST) {
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
    for (const article of MOCK_DIGEST) {
      const date = new Date(article.publishedAt);
      assert(
        !isNaN(date.getTime()),
        `Article "${article.title}" has invalid publishedAt: ${article.publishedAt}`
      );
    }
  });

  test("should have companyLogoUrl for articles with recognized companies", () => {
    const articlesWithCompanies = MOCK_DIGEST.filter(
      (a) => a.companyTags && a.companyTags.length > 0
    );

    for (const article of articlesWithCompanies) {
      assert(
        article.companyLogoUrl || article.ogImage,
        `Article "${article.title}" with company ${article.companyTags[0]} should have companyLogoUrl or ogImage`
      );
    }
  });

  test("featured article (first article overall) should be latest dealSignal article", () => {
    const dealSignalArticles = MOCK_DIGEST.filter((a) => a.dealSignal);
    if (dealSignalArticles.length > 0) {
      const sortedByDate = dealSignalArticles.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      const latestDealSignal = sortedByDate[0];

      assert(
        MOCK_DIGEST[0].dealSignal,
        "First article in mock digest should have dealSignal=true"
      );
      assert(
        MOCK_DIGEST[0].title === latestDealSignal.title,
        "First article should be the latest dealSignal article"
      );
    }
  });
});
