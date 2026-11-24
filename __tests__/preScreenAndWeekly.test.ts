import { test, describe } from "node:test";
import assert from "node:assert";
import type { ExaArticle } from "../lib/exa";
import type { Digest } from "../lib/summarize";
import { preScreenArticlesForScoring } from "../lib/summarize";
import { buildWeeklyEmailHtml, generateWeeklyDigest } from "../lib/weekly";

function mkExa(i: number): ExaArticle {
  return {
    title: `Story ${i}`,
    url: `https://example.com/story-${i}`,
    publishedAt: "2026-11-23T12:00:00.000Z",
    text: `Excerpt for story ${i}`,
    source: "example.com",
    ogImage: null,
    beatHint: "AI Infrastructure",
  };
}

describe("preScreenArticlesForScoring", () => {
  test("passes through unchanged without calling Gemini when <= limit", async () => {
    let calls = 0;
    const fakeAi = {
      models: {
        generateContent: async () => {
          calls++;
          return { text: "{}" };
        },
      },
    } as any;

    const input = Array.from({ length: 10 }, (_, i) => mkExa(i));
    const out = await preScreenArticlesForScoring("AI Infrastructure", input, fakeAi, 15);
    assert.equal(calls, 0);
    assert.equal(out.length, 10);
  });

  test("selects flash-lite keepIndices and tops up to floor when > limit", async () => {
    const fakeAi = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({ keepIndices: [18, 2, 16] }),
        }),
      },
    } as any;

    const input = Array.from({ length: 20 }, (_, i) => mkExa(i));
    const out = await preScreenArticlesForScoring("AI Infrastructure", input, fakeAi, 15);
    assert.equal(out.length, 8);
    assert.equal(out[0].title, "Story 18");
    assert.equal(out[1].title, "Story 2");
    assert.equal(out[2].title, "Story 16");
  });

  test("falls back to deterministic ranking when flash-lite throws", async () => {
    const fakeAi = {
      models: {
        generateContent: async () => {
          throw new Error("503 overloaded");
        },
      },
    } as any;

    const input = Array.from({ length: 20 }, (_, i) => mkExa(i));
    const out = await preScreenArticlesForScoring("AI Infrastructure", input, fakeAi, 15);
    assert.equal(out.length, 15);
  });
});

describe("generateWeeklyDigest & buildWeeklyEmailHtml", () => {
  test("synthesizes weekly briefing and renders Outlook-safe HTML", async () => {
    const sampleDigest: Digest = {
      generatedAt: "2026-11-23T14:30:00.000Z",
      articles: [
        {
          title: "OpenAI ships new reasoning stack",
          url: "https://openai.com/index/stack",
          source: "openai.com",
          publishedAt: "2026-11-23T10:00:00.000Z",
          ogImage: null,
          beat: "AI Labs",
          category: "AI/Models",
          companyTags: ["OpenAI"],
          summary: "OpenAI shipped new reasoning tiers.",
          bdRelevance: "Raises enterprise capability floor while squeezing wrapper apps.",
          relevanceScore: 9,
          impactScore: 9,
          impactReason: "Major capability jump.",
          dealSignal: true,
          storyId: "openai-stack",
        },
        {
          title: "Genesis AI raises $500M",
          url: "https://techcrunch.com/genesis",
          source: "techcrunch.com",
          publishedAt: "2026-11-22T10:00:00.000Z",
          ogImage: null,
          beat: "Physical AI",
          category: "Funding",
          companyTags: ["Genesis AI"],
          summary: "Genesis AI raised $500M.",
          bdRelevance: "Capitalizes general-purpose robotics foundation models.",
          relevanceScore: 9,
          impactScore: 8,
          impactReason: "Large round.",
          dealSignal: true,
          storyId: "genesis-500m",
        },
      ],
    };

    const fakeAi = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            emailSubject: "Reasoning models and robotics pull capital up the stack",
            weekTheme: "Labs pushed reasoning costs down while physical AI captured major capital.",
            beatSummaries: [
              {
                beat: "AI Labs",
                summary: "Frontier labs shifted focus to specialized reasoning tiers.",
                topStoryUrls: ["https://openai.com/index/stack", "https://evil.example/not-in-pool"],
              },
              {
                beat: "Physical AI",
                summary: "Foundation-model robotics drew concentrated late-stage capital.",
                topStoryUrls: ["https://techcrunch.com/genesis"],
              },
            ],
          }),
        }),
      },
    } as any;

    const weekly = await generateWeeklyDigest([sampleDigest], "2026-11-23", fakeAi);
    assert.ok(weekly);
    assert.equal(weekly.articleCount, 2);
    assert.equal(weekly.beatSummaries.length, 4);
    const labs = weekly.beatSummaries.find(b => b.beat === "AI Labs");
    assert.deepEqual(labs?.topStoryUrls, ["https://openai.com/index/stack"]);

    const html = buildWeeklyEmailHtml(weekly);
    assert.doesNotMatch(html, /display:\s*flex/);
    assert.doesNotMatch(html, /linear-gradient/);
    assert.doesNotMatch(html, /#[0-9a-fA-F]{8}\b/);
    assert.match(html, /OpenAI ships new reasoning stack/);
    assert.match(html, /href="https:\/\/frontier-ai-digest\.vercel\.app\/weekly"/);
  });
});
