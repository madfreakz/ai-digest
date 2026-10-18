import type { DigestArticle } from "./summarize";

// Checked at publish time (aggregateDigestFromBeats), so the published edition
// and the email never carry an image that can't load. Two kinds slipped
// through before:
// - relative beat placeholders from lib/exa ("/placeholder-ai-labs.png"),
//   which don't exist and break in the email, and
// - dead publisher defaults, e.g. TechCrunch's 2018 "tc-backlight" image,
//   which 404s and showed a broken image or a placeholder.
//
// Only a definite failure drops an image: a non-http(s) URL, a 404/410, or a
// 2xx that isn't an image. A timeout, a 403 or a 405 (some CDNs refuse HEAD)
// keeps it; the page still drops anything that fails in the browser.

const HEAD_TIMEOUT_MS = 4000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function isUsableImage(url: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  if (!isHttpUrl(url)) return false;
  try {
    const res = await fetchImpl(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
    });
    if (res.status === 404 || res.status === 410) return false;
    if (res.ok) {
      const type = res.headers.get("content-type");
      return !type || type.startsWith("image/");
    }
    return true;
  } catch {
    return true;
  }
}

export async function dropBrokenOgImages(
  articles: DigestArticle[],
  fetchImpl: FetchLike = fetch,
): Promise<DigestArticle[]> {
  const urls = Array.from(new Set(articles.map(a => a.ogImage).filter((u): u is string => !!u)));
  const results = await Promise.all(urls.map(async u => [u, await isUsableImage(u, fetchImpl)] as const));
  const usable = new Map(results);
  const dropped = results.filter(([, ok]) => !ok).map(([u]) => u);
  if (dropped.length > 0) {
    console.log(`[og-images] dropped ${dropped.length} unusable og:image(s): ${dropped.map(u => u.slice(0, 80)).join(", ")}`);
  }
  return articles.map(a => (a.ogImage && !usable.get(a.ogImage) ? { ...a, ogImage: null } : a));
}
