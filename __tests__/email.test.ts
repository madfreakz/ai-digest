import { test, describe } from "node:test";
import assert from "node:assert";
import { buildEmailHtml, firstSentence } from "../lib/email";
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

  test("groups by beat, leads with bdRelevance, shows NEW badge, and links to archive", () => {
    const rich = mkDigest([
      mkArticle({ title: "Lead story", url: "https://example.com/lead" }),
      mkArticle({
        title: "New infra shift",
        url: "https://example.com/infra",
        beat: "AI Infrastructure",
        bdRelevance: "Cloud providers squeeze standalone GPU hosts.",
        summary: "Generic summary sentence.",
        isNew: true,
        storyId: "infra-1",
      }),
      mkArticle({
        title: "Older robotics story",
        url: "https://example.com/old-bot",
        beat: "Physical AI",
        bdRelevance: "Should be omitted when new stories exist.",
        isNew: false,
        storyId: "bot-1",
      }),
    ]);
    const richHtml = buildEmailHtml(rich);
    assert.match(richHtml, /What Shifted Today/);
    assert.match(richHtml, />AI Infrastructure\s*</);
    assert.match(richHtml, />NEW<\/span>/);
    assert.match(richHtml, /Cloud providers squeeze standalone GPU hosts\./);
    assert.doesNotMatch(richHtml, /Generic summary sentence\./);
    assert.doesNotMatch(richHtml, /Should be omitted when new stories exist\./);
    assert.match(richHtml, /href="https:\/\/frontier-ai-digest\.vercel\.app\/archive"/);
  });

  test("falls back to firstSentence(summary) without double periods when bdRelevance is empty", () => {
    const single = mkDigest([
      mkArticle({ title: "Lead story", url: "https://example.com/lead" }),
      mkArticle({
        title: "Single sentence item",
        url: "https://example.com/single",
        bdRelevance: "",
        summary: "Only one sentence here.",
        storyId: "single",
      }),
    ]);
    const singleHtml = buildEmailHtml(single);
    assert.match(singleHtml, />Only one sentence here\.</);
    assert.doesNotMatch(singleHtml, /\.\./);
  });
});

describe("firstSentence", () => {
  test("extracts the first sentence without double punctuation", () => {
    assert.equal(firstSentence("One sentence. Two sentence."), "One sentence.");
    assert.equal(firstSentence("Only one sentence."), "Only one sentence.");
    assert.equal(firstSentence("No trailing punctuation"), "No trailing punctuation.");
    assert.equal(firstSentence("Big launch! More details follow."), "Big launch!");
  });

  test("does not split on decimals or common abbreviations", () => {
    assert.equal(
      firstSentence("Pedestal AI raised $4.7M in U.S. seed funding. It targets supply chains."),
      "Pedestal AI raised $4.7M in U.S. seed funding.",
    );
    assert.equal(
      firstSentence("Acme Inc. launched v3.0 for A.I. teams. Revenue doubled."),
      "Acme Inc. launched v3.0 for A.I. teams.",
    );
  });
});
