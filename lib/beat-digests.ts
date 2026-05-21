import { kv } from "@vercel/kv";
import type { Beat } from "./companies";
import type { DigestArticle, Digest, DigestSynthesis } from "./summarize";
import { generateDigest as generateBeatDigest, generateEditorialSynthesis } from "./summarize";
import { fetchAllNews, fetchBeatNews } from "./exa";
import { getEffectivePriority } from "./sources";

interface BeatCacheMetadata {
  timestamp: string;
  articleCount: number;
}

const BEAT_CACHE_TTL = 24 * 60 * 60;
const SYNTHESIS_KEY = "digest:synthesis";
const SYNTHESIS_TTL = 24 * 60 * 60;
const PUBLISHED_DIGEST_KEY = "digest:published";

// Freshness sentinel — written on every successful beat refresh, lives well past
// the cache TTL so we can distinguish "expired cache" from "never refreshed".
const BEAT_FRESHNESS_TTL = 7 * 24 * 60 * 60;
const BEAT_STALE_AFTER_HOURS = 25;

// KV is optional — if env vars are absent, fall back to direct Exa+Gemini generation
const KV_CONFIGURED = !!(process.env.KV_REST_API_URL ?? process.env.KV_URL);

function beatCacheKey(beat: Beat): string {
  return `beat:${beat}:articles`;
}

function beatMetadataKey(beat: Beat): string {
  return `beat:${beat}:metadata`;
}

function beatFreshnessKey(beat: Beat): string {
  return `beat:${beat}:lastSuccess`;
}

export async function cacheBeatArticles(beat: Beat): Promise<DigestArticle[]> {
  try {
    const beatArticles = await fetchBeatNews(beat);
    console.log(`[beat-digests] ${beat} - fetched ${beatArticles.length} articles`);

    const beatDigest = await generateBeatDigest(beatArticles, beat);
    console.log(`[beat-digests] ${beat} - generateBeatDigest returned ${beatDigest.articles.length} articles`);

    if (KV_CONFIGURED) {
      try {
        const now = new Date().toISOString();
        await Promise.all([
          kv.setex(beatCacheKey(beat), BEAT_CACHE_TTL, beatDigest.articles),
          kv.setex(beatMetadataKey(beat), BEAT_CACHE_TTL, {
            timestamp: now,
            articleCount: beatDigest.articles.length,
          }),
          kv.setex(beatFreshnessKey(beat), BEAT_FRESHNESS_TTL, now),
        ]);
        console.log(`[beat-digests] Cached ${beatDigest.articles.length} articles for ${beat}`);
      } catch (cacheErr) {
        console.warn(`[beat-digests] Cache write failed for ${beat}:`, cacheErr instanceof Error ? cacheErr.message : String(cacheErr));
      }
    }

    return beatDigest.articles;
  } catch (err) {
    console.error(`[beat-digests] Failed to fetch/generate articles for ${beat}:`, err);
    return [];
  }
}

export async function getBeatArticles(beat: Beat): Promise<DigestArticle[]> {
  if (!KV_CONFIGURED) return [];
  try {
    const cached = await kv.get<DigestArticle[]>(beatCacheKey(beat));
    if (cached) {
      console.log(`[beat-digests] Cache HIT for ${beat}`);
      return cached;
    }
    console.log(`[beat-digests] Cache MISS: ${beat}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[kv-err:${beat}] ${msg}`);
  }
  return [];
}

async function generateFreshAllBeats(beats: Beat[]): Promise<DigestArticle[]> {
  console.log("[beat-digests] KV not configured — fetching fresh (single Exa pass)");

  let allNews: Awaited<ReturnType<typeof fetchAllNews>>;
  try {
    allNews = await fetchAllNews();
    console.log(`[beat-digests] fetchAllNews returned ${allNews.length} raw articles`);
  } catch (err) {
    console.error("[beat-digests] fetchAllNews threw:", err instanceof Error ? err.message : String(err));
    return [];
  }

  const beatResults = await Promise.allSettled(
    beats.map(async beat => {
      const beatArticles = allNews.filter(a => a.beatHint === beat);
      console.log(`[beat-digests] ${beat}: ${beatArticles.length} raw articles to process`);
      const beatDigest = await generateBeatDigest(beatArticles, beat);
      console.log(`[beat-digests] ${beat}: ${beatDigest.articles.length} articles after Gemini scoring`);
      return beatDigest.articles;
    })
  );

  const articles: DigestArticle[] = [];
  for (const result of beatResults) {
    if (result.status === "fulfilled") {
      articles.push(...result.value);
    } else {
      console.error("[beat-digests] Beat digest generation failed:", result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }
  console.log(`[beat-digests] generateFreshAllBeats complete: ${articles.length} articles total`);
  return articles;
}

export async function publishFinalDigest(digest: Digest): Promise<void> {
  if (!KV_CONFIGURED) {
    console.warn("[beat-digests] KV not configured — skipping publish");
    return;
  }
  try {
    await kv.set(PUBLISHED_DIGEST_KEY, digest);
    console.log(`[beat-digests] Published final digest (${digest.articles.length} articles)`);
  } catch (err) {
    console.error("[beat-digests] Failed to publish final digest:", err instanceof Error ? err.message : String(err));
  }
}

export async function getPublishedDigest(): Promise<Digest | null> {
  if (!KV_CONFIGURED) return null;
  try {
    const digest = await kv.get<Digest>(PUBLISHED_DIGEST_KEY);
    if (digest) {
      console.log(`[beat-digests] Published digest HIT (${digest.articles.length} articles)`);
      return digest;
    }
    console.log("[beat-digests] Published digest MISS");
  } catch (err) {
    console.error("[beat-digests] Failed to read published digest:", err instanceof Error ? err.message : String(err));
  }
  return null;
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "its", "it", "as", "that", "this", "new", "has", "have", "had", "not",
  "will", "can", "may", "into", "up", "out", "more", "than", "says",
]);

function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 1 && !STOP_WORDS.has(w)),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function deduplicateAcrossBeats(articles: DigestArticle[]): DigestArticle[] {
  if (articles.length <= 1) return articles;

  const titleSets = articles.map(a => titleWords(a.title));
  const removed = new Set<number>();

  for (let i = 0; i < articles.length; i++) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < articles.length; j++) {
      if (removed.has(j)) continue;
      if (articles[i].beat === articles[j].beat) continue;
      const sim = jaccardSimilarity(titleSets[i], titleSets[j]);
      const sharedTag = articles[i].companyTags.some(t => articles[j].companyTags.includes(t));
      if (sim >= 0.5 || (sim >= 0.35 && sharedTag)) {
        const prioI = getEffectivePriority(articles[i].source);
        const prioJ = getEffectivePriority(articles[j].source);
        const loser = prioI <= prioJ ? j : i;
        console.log(
          `[cross-beat-dedup] "${articles[loser].title}" (${articles[loser].source}) ` +
          `removed in favor of "${articles[loser === j ? i : j].title}" (${articles[loser === j ? i : j].source})`,
        );
        removed.add(loser);
      }
    }
  }

  if (removed.size > 0) {
    console.log(`[cross-beat-dedup] removed ${removed.size} cross-beat duplicate(s)`);
  }
  return articles.filter((_, idx) => !removed.has(idx));
}

export async function aggregateDigestFromBeats(): Promise<Digest> {
  const beats: Beat[] = ["Physical AI", "AI Infrastructure", "AI Labs", "Vertical AI"];

  let allArticles: DigestArticle[];
  if (KV_CONFIGURED) {
    const beatResults = await Promise.all(
      beats.map(beat =>
        getBeatArticles(beat).catch(err => {
          console.error(`[beat-digests] Failed to read ${beat}:`, err instanceof Error ? err.message : String(err));
          return [] as DigestArticle[];
        })
      )
    );
    allArticles = beatResults.flat();

    // Surface stale beats so silent refresh failures don't ship a half-empty digest
    const staleReports: string[] = [];
    for (const beat of beats) {
      try {
        const lastSuccess = await kv.get<string>(beatFreshnessKey(beat));
        if (!lastSuccess) {
          staleReports.push(`${beat} (never recorded)`);
        } else {
          const ageHours = (Date.now() - new Date(lastSuccess).getTime()) / 3_600_000;
          if (ageHours > BEAT_STALE_AFTER_HOURS) {
            staleReports.push(`${beat} (last refresh ${ageHours.toFixed(1)}h ago)`);
          }
        }
      } catch (err) {
        staleReports.push(`${beat} (freshness-check error: ${err instanceof Error ? err.message : String(err)})`);
      }
    }
    if (staleReports.length > 0) {
      console.error(`[beat-digests] STALE BEATS — refresh failed or overdue: ${staleReports.join("; ")}`);
    }
  } else {
    allArticles = await generateFreshAllBeats(beats);
  }

  allArticles = deduplicateAcrossBeats(allArticles);
  allArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  let synthesis: Digest["synthesis"] | undefined;
  if (allArticles.length > 0) {
    try {
      if (KV_CONFIGURED) {
        const cachedSynthesis = await kv.get<DigestSynthesis>(SYNTHESIS_KEY);
        if (cachedSynthesis) {
          synthesis = cachedSynthesis;
          console.log("[beat-digests] Synthesis cache HIT:", synthesis.emailSubject);
        } else {
          synthesis = await generateEditorialSynthesis(allArticles);
          if (synthesis) {
            await kv.setex(SYNTHESIS_KEY, SYNTHESIS_TTL, synthesis);
            console.log("[beat-digests] Synthesis cached:", synthesis.emailSubject);
          }
        }
      } else {
        synthesis = await generateEditorialSynthesis(allArticles);
        if (synthesis) console.log("[beat-digests] Synthesis generated (no KV):", synthesis.emailSubject);
      }
    } catch (err) {
      console.warn("[beat-digests] Synthesis failed:", err instanceof Error ? err.message : String(err));
    }
  }

  return {
    articles: allArticles,
    generatedAt: new Date().toISOString(),
    synthesis,
  };
}
