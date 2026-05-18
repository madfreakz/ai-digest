import { kv } from "@vercel/kv";
import type { Beat } from "./companies";
import type { DigestArticle, Digest } from "./summarize";
import { generateDigest as generateBeatDigest } from "./summarize";
import { fetchAllNews } from "./exa";

interface BeatCacheMetadata {
  timestamp: string;
  articleCount: number;
}

const BEAT_CACHE_TTL = 24 * 60 * 60; // 24 hours (beat runs once per day)
const AGGREGATOR_CACHE_TTL = 24 * 60 * 60; // 24 hours (one digest per day)

function beatCacheKey(beat: Beat): string {
  return `beat:${beat}:articles`;
}

function beatMetadataKey(beat: Beat): string {
  return `beat:${beat}:metadata`;
}

const AGGREGATOR_KEY = "digest:aggregated";
const AGGREGATOR_METADATA_KEY = "digest:aggregated:metadata";

export async function cacheBeatArticles(beat: Beat): Promise<DigestArticle[]> {
  try {
    const articles = await fetchAllNews();
    const beatArticles = articles.filter(a => a.beatHint === beat);

    const beatDigest = await generateBeatDigest(beatArticles, beat);

    await Promise.all([
      kv.setex(beatCacheKey(beat), BEAT_CACHE_TTL, JSON.stringify(beatDigest.articles)),
      kv.setex(
        beatMetadataKey(beat),
        BEAT_CACHE_TTL,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          articleCount: beatDigest.articles.length,
        })
      ),
    ]);

    console.log(`[beat-digests] Cached ${beatDigest.articles.length} articles for ${beat}`);
    return beatDigest.articles;
  } catch (err) {
    console.error(`[beat-digests] Cache error for ${beat}:`, err);
    return [];
  }
}

export async function getBeatArticles(beat: Beat): Promise<DigestArticle[]> {
  try {
    const cached = await kv.get<string>(beatCacheKey(beat));
    if (cached) {
      console.log(`[beat-digests] Cache HIT for ${beat}`);
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn(`[beat-digests] Cache read error for ${beat}:`, err);
  }

  console.log(`[beat-digests] Cache MISS for ${beat}, fetching fresh`);
  return cacheBeatArticles(beat);
}

export async function aggregateDigestFromBeats(): Promise<Digest> {
  const beats: Beat[] = ["Physical AI", "AI Infrastructure", "AI Labs", "Vertical AI"];

  try {
    const cached = await kv.get<string>(AGGREGATOR_KEY);
    if (cached) {
      console.log("[beat-digests] Aggregator cache HIT");
      return JSON.parse(cached);
    }
  } catch (err) {
    console.warn("[beat-digests] Aggregator cache read error:", err);
  }

  console.log("[beat-digests] Aggregator cache MISS, rebuilding from beats");

  const allArticles: DigestArticle[] = [];
  const beatMetadata: Record<string, BeatCacheMetadata> = {};

  for (const beat of beats) {
    try {
      const articles = await getBeatArticles(beat);
      allArticles.push(...articles);

      const metadata = await kv.get<string>(beatMetadataKey(beat));
      if (metadata) {
        beatMetadata[beat] = JSON.parse(metadata);
      }
    } catch (err) {
      console.error(`[beat-digests] Failed to fetch ${beat}:`, err);
    }
  }

  allArticles.sort((a, b) => {
    const dateA = new Date(a.publishedAt).getTime();
    const dateB = new Date(b.publishedAt).getTime();
    if (dateA !== dateB) return dateB - dateA;
    if (a.dealSignal !== b.dealSignal) return a.dealSignal ? -1 : 1;
    const scoreA = a.relevanceScore * 0.7 + a.impactScore * 0.3;
    const scoreB = b.relevanceScore * 0.7 + b.impactScore * 0.3;
    return scoreB - scoreA;
  });

  const digest: Digest = {
    articles: allArticles,
    generatedAt: new Date().toISOString(),
  };

  try {
    await Promise.all([
      kv.setex(AGGREGATOR_KEY, AGGREGATOR_CACHE_TTL, JSON.stringify(digest)),
      kv.setex(AGGREGATOR_METADATA_KEY, AGGREGATOR_CACHE_TTL, JSON.stringify(beatMetadata)),
    ]);
  } catch (err) {
    console.warn("[beat-digests] Failed to cache aggregated digest:", err);
  }

  return digest;
}
