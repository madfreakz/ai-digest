import { kv } from "@vercel/kv";
import type { Beat } from "./companies";
import type { DigestArticle, Digest, DigestSynthesis } from "./summarize";
import { generateDigest as generateBeatDigest, generateEditorialSynthesis } from "./summarize";
import { fetchAllNews, fetchBeatNews } from "./exa";

interface BeatCacheMetadata {
  timestamp: string;
  articleCount: number;
}

const BEAT_CACHE_TTL = 24 * 60 * 60;
const SYNTHESIS_KEY = "digest:synthesis";
const SYNTHESIS_TTL = 24 * 60 * 60;
const PUBLISHED_DIGEST_KEY = "digest:published";
const PUBLISHED_DIGEST_TTL = 25 * 60 * 60; // 25 hours — outlasts daily cron cycle

// KV is optional — if env vars are absent, fall back to direct Exa+Gemini generation
const KV_CONFIGURED = !!(process.env.KV_REST_API_URL ?? process.env.KV_URL);

function beatCacheKey(beat: Beat): string {
  return `beat:${beat}:articles`;
}

function beatMetadataKey(beat: Beat): string {
  return `beat:${beat}:metadata`;
}

export async function cacheBeatArticles(beat: Beat): Promise<DigestArticle[]> {
  try {
    const beatArticles = await fetchBeatNews(beat);
    console.log(`[beat-digests] ${beat} - fetched ${beatArticles.length} articles`);

    const beatDigest = await generateBeatDigest(beatArticles, beat);
    console.log(`[beat-digests] ${beat} - generateBeatDigest returned ${beatDigest.articles.length} articles`);

    if (KV_CONFIGURED) {
      try {
        await Promise.all([
          kv.setex(beatCacheKey(beat), BEAT_CACHE_TTL, beatDigest.articles),
          kv.setex(beatMetadataKey(beat), BEAT_CACHE_TTL, {
            timestamp: new Date().toISOString(),
            articleCount: beatDigest.articles.length,
          }),
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
    await kv.setex(PUBLISHED_DIGEST_KEY, PUBLISHED_DIGEST_TTL, digest);
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
  } else {
    allArticles = await generateFreshAllBeats(beats);
  }

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
