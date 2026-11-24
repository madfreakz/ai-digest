import { test, describe } from "node:test";
import assert from "node:assert";
import { cleanSoWhat, filterNoisyArticles, isExcludedContent, lintSoWhat } from "../lib/filters";
import { parseFeedXml } from "../lib/rss";

describe("isExcludedContent & filterNoisyArticles", () => {
  test("drops healthcare, cybersecurity, IR subdomains, roundups, and media centers", () => {
    const { kept, dropped } = filterNoisyArticles([
      {
        title: "Amesite Signs New 2,000-Patient NurseMagic Enterprise Customer",
        source: "ir.amesite.com",
        url: "https://ir.amesite.com/news-events/press-releases/detail/227",
      },
      {
        title: "Protecting where software gets built: StepSecurity's $20 million Series A",
        source: "stepsecurity.io",
        url: "https://www.stepsecurity.io/blog/stepsecurity-20-million-series-a",
        text: "StepSecurity provides cybersecurity and vulnerability protection for CI/CD pipelines.",
      },
      {
        title: "Weekly Brief, Nov. 9-16: Physical AI moves from pilots to purchase orders",
        source: "physicalainews.com",
        url: "https://physicalainews.com/weekly-brief",
      },
      {
        title: "News : Media Center : Doosan Bobcat",
        source: "doosanbobcat.com",
        url: "https://www.doosanbobcat.com/en/mediacenter/news/detail?id=335",
      },
      {
        title: "Genesis AI raises $500M to deploy glove-wearing robots",
        source: "techcrunch.com",
        url: "https://techcrunch.com/2026/11/17/genesis-ai-raises-500-million",
      },
      {
        title: "NVIDIA Introduces Nemotron for Science to Accelerate Discoveries",
        source: "nvidianews.nvidia.com",
        url: "https://nvidianews.nvidia.com/news/nvidia-introduces-nemotron-for-science",
      },
    ]);

    assert.equal(dropped.length, 4);
    assert.equal(kept.length, 2);
    assert.deepEqual(kept.map(a => a.source), ["techcrunch.com", "nvidianews.nvidia.com"]);
  });

  test("keeps tracked company even if headline mentions adjacent topic", () => {
    const verdict = isExcludedContent({
      title: "OpenAI announces healthcare compliance partnership with hospitals",
      source: "openai.com",
      url: "https://openai.com/news/healthcare-compliance",
    });
    assert.equal(verdict.excluded, false);
  });
});

describe("lintSoWhat & cleanSoWhat", () => {
  test("flags hedges, cliches, and overlong lines while accepting crisp ecosystem shifts", () => {
    const bad = lintSoWhat(
      "This could represent a significant advancement, potentially creating competitive pressure for smaller enterprise vendors across the market today.",
    );
    assert.equal(bad.ok, false);
    assert.ok(bad.issues.some(i => i.includes("hedge")));
    assert.ok(bad.issues.some(i => i.includes("cliche")));

    const good = lintSoWhat(
      "Hyperscalers are bundling inference routing natively, squeezing standalone GPU proxy margins.",
    );
    assert.equal(good.ok, true);
    assert.equal(cleanSoWhat("For BD professionals, OpenAI sets a higher floor."), "OpenAI sets a higher floor.");
  });
});

describe("parseFeedXml", () => {
  test("parses RSS 2.0 items, decodes entities, extracts media image, and respects cutoff & maxItems", () => {
    const now = Date.parse("2026-11-24T12:00:00.000Z");
    const cutoffMs = now - 7 * 24 * 60 * 60 * 1000;
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
        <channel>
          <item>
            <title><![CDATA[OpenAI &amp; Partners Ship New Reasoning Stack]]></title>
            <link>https://openai.com/index/new-stack/?utm_source=rss</link>
            <pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate>
            <description><![CDATA[<p>Details on <strong>compute</strong> pricing &amp; API limits.</p>]]></description>
            <media:content url="https://openai.com/img/hero.png" medium="image" />
          </item>
          <item>
            <title>Stale Story</title>
            <link>https://openai.com/index/old</link>
            <pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate>
            <description>Old</description>
          </item>
          <item>
            <title>Invalid Link</title>
            <link>javascript:alert(1)</link>
            <pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    const items = parseFeedXml(rss, "AI Labs", "openai.com", cutoffMs, 5);
    assert.equal(items.length, 1);
    assert.equal(items[0].title, "OpenAI & Partners Ship New Reasoning Stack");
    assert.equal(items[0].source, "openai.com");
    assert.equal(items[0].ogImage, "https://openai.com/img/hero.png");
    assert.equal(items[0].text, "Details on compute pricing & API limits.");
  });

  test("parses Atom entries with rel=alternate link and updated timestamp", () => {
    const now = Date.parse("2026-11-24T12:00:00.000Z");
    const cutoffMs = now - 7 * 24 * 60 * 60 * 1000;
    const atom = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Vercel AI SDK v5</title>
          <link rel="self" href="https://vercel.com/atom/1" />
          <link rel="alternate" href="https://vercel.com/blog/ai-sdk-v5" />
          <updated>2026-11-22T15:00:00Z</updated>
          <summary>Unified streaming primitives for edge runtimes.</summary>
        </entry>
        <entry>
          <title>Second Entry</title>
          <link href="https://vercel.com/blog/second" />
          <published>2026-11-23T09:00:00Z</published>
          <content>Second summary.</content>
        </entry>
      </feed>`;

    const items = parseFeedXml(atom, "AI Infrastructure", "vercel.com", cutoffMs, 1);
    assert.equal(items.length, 1);
    assert.equal(items[0].url, "https://vercel.com/blog/ai-sdk-v5");
    assert.equal(items[0].beatHint, "AI Infrastructure");
  });
});
