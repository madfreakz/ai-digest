import { test, describe } from "node:test";
import assert from "node:assert";
import { isUsableImage, dropBrokenOgImages } from "../lib/og-images";
import type { DigestArticle } from "../lib/summarize";

function respond(status: number, contentType?: string) {
  return async () => new Response(null, {
    status,
    headers: contentType ? { "content-type": contentType } : {},
  });
}

function mkArticle(ogImage: string | null, title = "stub"): DigestArticle {
  return {
    title, url: `https://example.com/${title}`, source: "stub", publishedAt: new Date().toISOString(),
    ogImage, beat: "AI Labs", category: "General", companyTags: [], summary: "", bdRelevance: "",
    relevanceScore: 5, impactScore: 5, impactReason: "", dealSignal: false, storyId: title,
  };
}

describe("isUsableImage", () => {
  test("rejects relative beat placeholders without a request", async () => {
    let called = false;
    const ok = await isUsableImage("/placeholder-ai-labs.png", async () => { called = true; return new Response(); });
    assert.equal(ok, false);
    assert.equal(called, false);
  });

  test("rejects a 404 (TechCrunch's dead 2018 default image)", async () => {
    assert.equal(await isUsableImage("https://techcrunch.com/tc-backlight.jpg", respond(404, "text/html")), false);
  });

  test("rejects a 2xx that is not an image", async () => {
    assert.equal(await isUsableImage("https://example.com/og", respond(200, "text/html")), false);
  });

  test("accepts a 2xx image", async () => {
    assert.equal(await isUsableImage("https://example.com/og.jpg", respond(200, "image/jpeg")), true);
  });

  test("keeps the image when the check is inconclusive (403, 405, network error)", async () => {
    assert.equal(await isUsableImage("https://example.com/a.jpg", respond(403)), true);
    assert.equal(await isUsableImage("https://example.com/b.jpg", respond(405)), true);
    assert.equal(await isUsableImage("https://example.com/c.jpg", async () => { throw new Error("timeout"); }), true);
  });
});

describe("dropBrokenOgImages", () => {
  test("nulls only the unusable images and checks each URL once", async () => {
    const calls: string[] = [];
    const fetchImpl = async (url: string) => {
      calls.push(url);
      return url.includes("dead") ? new Response(null, { status: 404 }) : new Response(null, { status: 200, headers: { "content-type": "image/png" } });
    };
    const articles = [
      mkArticle("https://cdn.example.com/good.png", "a"),
      mkArticle("https://cdn.example.com/dead.png", "b"),
      mkArticle("https://cdn.example.com/dead.png", "c"),
      mkArticle("/placeholder-vertical-ai.png", "d"),
      mkArticle(null, "e"),
    ];
    const out = await dropBrokenOgImages(articles, fetchImpl);
    assert.deepEqual(out.map(a => a.ogImage), ["https://cdn.example.com/good.png", null, null, null, null]);
    assert.equal(calls.filter(u => u.includes("dead")).length, 1);
  });
});
