import { test, describe } from "node:test";
import assert from "node:assert";
import { buildEmailHtml } from "../lib/email";
import type { Digest, DigestArticle } from "../lib/summarize";

function mkArticle(partial: Partial<DigestArticle>): DigestArticle {
  return {
    title: "stub", url: "https://example.com/", source: "stub", publishedAt: new Date().toISOString(),
    ogImage: null, beat: "AI Labs", category: "Partnerships", companyTags: [], summary: "First sentence. Second.",
    bdRelevance: "Why it matters.", relevanceScore: 9, impactScore: 9, impactReason: "", dealSignal: false,
    storyId: "stub", ...partial,
  };
}

function mkDigest(articles: DigestArticle[]): Digest {
  return {
    articles,
    generatedAt: "2026-10-18T14:30:00.000Z",
    synthesis: { thesis: "Thesis.", emailSubject: "Subject", featuredArticleUrl: articles[0]?.url },
  };
}

const digest = mkDigest([
  mkArticle({ title: "Lead story wins a big deal | TechCrunch", url: "https://example.com/lead", ogImage: "/placeholder-ai-labs.png" }),
  mkArticle({ title: "Second <story> about robots | VentureBeat", url: "https://example.com/two", beat: "Physical AI", storyId: "two" }),
]);
const html = buildEmailHtml(digest);

describe("buildEmailHtml", () => {
  test("uses nothing Outlook for Windows drops: flexbox, gradients, 8-digit hex", () => {
    assert.doesNotMatch(html, /display:\s*flex/);
    assert.doesNotMatch(html, /linear-gradient/);
    assert.doesNotMatch(html, /#[0-9a-fA-F]{8}\b/);
  });

  test("drops the publisher suffix from titles", () => {
    assert.match(html, />Lead story wins a big deal</);
    assert.doesNotMatch(html, /\| TechCrunch/);
  });

  test("still escapes titles", () => {
    assert.match(html, /Second &lt;story&gt; about robots/);
  });

  test("never renders a relative placeholder as an image", () => {
    assert.doesNotMatch(html, /<img[^>]+src="\/placeholder/);
  });

  test("uses the darkened category colors, not the old low-contrast ones", () => {
    assert.match(html, /color:#92400e/);   // Partnerships, 6.1:1
    assert.doesNotMatch(html, /#f59e0b;/i); // old amber text, 2.0:1
  });

  test("dates the email in Pacific time", () => {
    assert.match(html, /Sunday, October 18, 2026/);
  });

  test("shows the stale-beat banner only when a beat is overdue", () => {
    assert.doesNotMatch(html, /didn't refresh in time/);
    assert.match(buildEmailHtml(digest, ["Vertical AI"]), /didn't refresh in time: <strong>Vertical AI<\/strong>/);
  });
});
