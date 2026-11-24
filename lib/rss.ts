import type { Beat } from "./companies";
import type { ExaArticle } from "./exa";
import { normalizeUrl } from "./exa";

export interface RssFeedSpec {
  domain: string;
  url: string;
  maxItems?: number;
}

export const BEAT_RSS_FEEDS: Record<Beat, RssFeedSpec[]> = {
  "AI Labs": [
    { domain: "openai.com",       url: "https://openai.com/news/rss.xml" },
    { domain: "deepmind.google",  url: "https://deepmind.google/blog/rss.xml" },
    { domain: "blog.google",      url: "https://blog.google/technology/ai/rss/" },
    { domain: "huggingface.co",   url: "https://huggingface.co/blog/feed.xml" },
    { domain: "the-decoder.com",  url: "https://the-decoder.com/feed/" },
    { domain: "simonwillison.net", url: "https://simonwillison.net/atom/everything/", maxItems: 4 },
  ],
  "AI Infrastructure": [
    { domain: "blogs.nvidia.com",     url: "https://blogs.nvidia.com/feed/" },
    { domain: "vercel.com",           url: "https://vercel.com/atom" },
    { domain: "together.ai",          url: "https://www.together.ai/blog/rss.xml" },
    { domain: "weaviate.io",          url: "https://weaviate.io/blog/rss.xml" },
    { domain: "siliconangle.com",     url: "https://siliconangle.com/category/ai/feed/" },
    { domain: "blog.cloudflare.com",  url: "https://blog.cloudflare.com/tag/ai/rss/" },
  ],
  "Physical AI": [
    { domain: "bostondynamics.com",   url: "https://bostondynamics.com/feed/" },
    { domain: "therobotreport.com",   url: "https://www.therobotreport.com/feed/" },
    { domain: "spectrum.ieee.org",    url: "https://spectrum.ieee.org/feeds/topic/robotics.rss" },
    { domain: "waymo.com",            url: "https://waymo.com/blog/rss.xml" },
  ],
  "Vertical AI": [
    { domain: "techcrunch.com",   url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
    { domain: "sequoiacap.com",   url: "https://www.sequoiacap.com/feed/" },
    { domain: "greylock.com",     url: "https://greylock.com/feed/" },
    { domain: "stratechery.com",  url: "https://stratechery.com/feed/" },
  ],
};

const FEED_TIMEOUT_MS = 6000;
const FEED_WINDOW_DAYS = 7;

function decodeEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(raw: string): string {
  return decodeEntities(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tagNames: string[]): string | undefined {
  for (const tag of tagNames) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = block.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function extractAtomLink(block: string): string | undefined {
  const linkTags = block.match(/<link\b[^>]*\/?>/gi) ?? [];
  let fallbackHref: string | undefined;
  for (const tag of linkTags) {
    const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const relMatch = tag.match(/\brel=["']([^"']+)["']/i);
    const rel = relMatch?.[1]?.toLowerCase();
    if (!rel || rel === "alternate") return decodeEntities(hrefMatch[1]).trim();
    if (!fallbackHref) fallbackHref = decodeEntities(hrefMatch[1]).trim();
  }
  return fallbackHref;
}

function extractFeedImage(block: string): string | null {
  const mediaMatch =
    block.match(/<media:(?:content|thumbnail)\b[^>]*\burl=["']([^"']+)["'][^>]*>/i) ??
    block.match(/<enclosure\b[^>]*\btype=["']image\/[^"']*["'][^>]*\burl=["']([^"']+)["'][^>]*>/i) ??
    block.match(/<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\/[^"']*["'][^>]*>/i);
  if (!mediaMatch?.[1]) return null;
  const candidate = decodeEntities(mediaMatch[1]).trim();
  try {
    const u = new URL(candidate);
    return u.protocol === "http:" || u.protocol === "https:" ? candidate : null;
  } catch {
    return null;
  }
}

export function parseFeedXml(
  xml: string,
  beat: Beat,
  fallbackDomain: string,
  cutoffMs: number,
  maxItems = 6,
): ExaArticle[] {
  const itemBlocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  const entryBlocks = itemBlocks.length > 0
    ? []
    : (xml.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi) ?? []);
  const blocks = itemBlocks.length > 0 ? itemBlocks : entryBlocks;

  const seen = new Set<string>();
  const parsed: ExaArticle[] = [];

  for (const block of blocks) {
    if (parsed.length >= maxItems) break;

    const rawLink = itemBlocks.length > 0
      ? (extractTag(block, ["link"]) ?? extractAtomLink(block))
      : (extractAtomLink(block) ?? extractTag(block, ["link"]));
    if (!rawLink) continue;

    const cleanUrl = stripTags(rawLink);
    let hostname = fallbackDomain;
    try {
      const u = new URL(cleanUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      hostname = u.hostname.replace(/^www\./, "") || fallbackDomain;
    } catch {
      continue;
    }

    const norm = normalizeUrl(cleanUrl);
    if (seen.has(norm)) continue;

    const rawDate = extractTag(block, ["pubDate", "published", "updated", "dc:date"]);
    if (!rawDate) continue;
    const dateMs = Date.parse(stripTags(rawDate));
    if (Number.isNaN(dateMs) || dateMs < cutoffMs) continue;

    const rawTitle = extractTag(block, ["title"]);
    const title = rawTitle ? stripTags(rawTitle) : "Untitled";
    if (!title) continue;

    const rawBody = extractTag(block, ["content:encoded", "content", "description", "summary"]);
    const text = rawBody ? stripTags(rawBody).slice(0, 1000) : undefined;

    seen.add(norm);
    parsed.push({
      title,
      url: cleanUrl,
      publishedAt: new Date(dateMs).toISOString(),
      text,
      source: hostname,
      ogImage: extractFeedImage(block),
      beatHint: beat,
    });
  }

  return parsed;
}

export async function fetchBeatRssArticles(beat: Beat): Promise<ExaArticle[]> {
  const feeds = BEAT_RSS_FEEDS[beat] ?? [];
  if (feeds.length === 0) return [];

  const cutoffMs = Date.now() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const settled = await Promise.allSettled(
    feeds.map(async (spec) => {
      const res = await fetch(spec.url, {
        headers: {
          "User-Agent": "FrontierAIDigest/1.0 (+https://frontier-ai-digest.vercel.app)",
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const xml = await res.text();
      return parseFeedXml(xml, beat, spec.domain, cutoffMs, spec.maxItems ?? 6);
    }),
  );

  const seen = new Set<string>();
  const combined: ExaArticle[] = [];
  settled.forEach((result, idx) => {
    const spec = feeds[idx];
    if (result.status === "rejected") {
      console.warn(
        `[rss] ${beat} - ${spec.domain} failed:`,
        result.reason instanceof Error ? result.reason.message : String(result.reason),
      );
      return;
    }
    for (const item of result.value) {
      const norm = normalizeUrl(item.url);
      if (!seen.has(norm)) {
        seen.add(norm);
        combined.push(item);
      }
    }
  });

  console.log(`[rss] ${beat} - fetched ${combined.length} articles across ${feeds.length} feeds`);
  return combined;
}
