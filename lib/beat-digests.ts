import { kv } from "@vercel/kv";
import type { Beat } from "./companies";
import type { DigestArticle, Digest, DigestSynthesis, DiscoveredCompanyResult } from "./summarize";
import { generateDigest as generateBeatDigest, generateEditorialSynthesis, pickFeaturedArticle } from "./summarize";
import { fetchAllNews, fetchBeatNews, fetchVcBlogArticles, normalizeUrl } from "./exa";
import type { DiscoveredCompany } from "./companies";
import { isBlockedDiscovery, isPlausibleDomain } from "./companies";
import { KV_CONFIGURED, DISCOVERED_INDEX_KEY } from "./kv-config";
import { getEffectivePriority } from "./sources";

interface BeatCacheMetadata {
  timestamp: string;
  articleCount: number;
}

const BEAT_CACHE_TTL = 24 * 60 * 60;
const SYNTHESIS_KEY = "digest:synthesis";
const SYNTHESIS_TTL = 24 * 60 * 60;
const PUBLISHED_DIGEST_KEY = "digest:published";
const PREVIOUS_DIGEST_KEY = "digest:previous";

// Freshness sentinel — written on every successful beat refresh, lives well past
// the cache TTL so we can distinguish "expired cache" from "never refreshed".
const BEAT_FRESHNESS_TTL = 7 * 24 * 60 * 60;
const BEAT_STALE_AFTER_HOURS = 25;

function beatCacheKey(beat: Beat): string {
  return `beat:${beat}:articles`;
}

function beatMetadataKey(beat: Beat): string {
  return `beat:${beat}:metadata`;
}

function beatFreshnessKey(beat: Beat): string {
  return `beat:${beat}:lastSuccess`;
}

const DISCOVERED_TTL = 30 * 24 * 60 * 60;
const VC_ARTICLES_KEY = "vc-articles:latest";

async function mergeVcArticles(beat: Beat): Promise<import("./exa").ExaArticle[]> {
  const day = new Date().getUTCDay();
  const isTueOrThu = day === 2 || day === 4;

  if (!KV_CONFIGURED) return [];

  if (isTueOrThu) {
    try {
      const cached = await kv.get<import("./exa").ExaArticle[]>(VC_ARTICLES_KEY);
      if (!cached) {
        console.log("[beat-digests] VC blog query running (Tue/Thu)");
        const vcArticles = await fetchVcBlogArticles();
        console.log(`[beat-digests] VC blog query returned ${vcArticles.length} articles`);
        if (vcArticles.length > 0) {
          await kv.setex(VC_ARTICLES_KEY, BEAT_CACHE_TTL, vcArticles);
        }
        return vcArticles;
      }
      return cached;
    } catch (err) {
      console.warn("[beat-digests] VC blog fetch failed:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }

  try {
    return await kv.get<import("./exa").ExaArticle[]>(VC_ARTICLES_KEY) ?? [];
  } catch {
    return [];
  }
}

async function storeDiscoveredCompanies(discovered: DiscoveredCompanyResult[]): Promise<void> {
  if (!KV_CONFIGURED || discovered.length === 0) return;
  const filtered = discovered.filter(dc => !isBlockedDiscovery(dc.name));
  if (filtered.length < discovered.length) {
    console.log(`[discovered] Filtered ${discovered.length - filtered.length} blocked entries`);
  }
  if (filtered.length === 0) return;
  const now = new Date().toISOString();
  const addedNames: string[] = [];
  let phantomCandidates = 0; // first-seen discoveries whose inferredDomain is implausible
  for (const dc of filtered) {
    const key = `discovered:${dc.name.toLowerCase().replace(/\s+/g, "-")}`;
    try {
      const existing = await kv.get<DiscoveredCompany>(key);
      const domainOK = isPlausibleDomain(dc.inferredDomain);
      if (!existing && !domainOK) phantomCandidates++;
      console.log(`[discovered:quality] ${dc.name} | ${existing ? "recurring" : "new"} | domainOK=${domainOK} | ${dc.suggestedBeat}`);
      if (existing) {
        const newDomain = dc.inferredDomain.includes(".") && !dc.inferredDomain.includes(" ")
          ? dc.inferredDomain : existing.domain;
        await kv.setex(key, DISCOVERED_TTL, { ...existing, domain: newDomain, lastSeen: now, count: existing.count + 1 });
      } else {
        await kv.setex(key, DISCOVERED_TTL, {
          name: dc.name,
          domain: dc.inferredDomain,
          beat: dc.suggestedBeat,
          firstSeen: now,
          lastSeen: now,
          count: 1,
        });
      }
      addedNames.push(dc.name);
    } catch (err) {
      console.warn(`[discovered] Failed to store ${dc.name}:`, err instanceof Error ? err.message : String(err));
    }
  }
  if (addedNames.length > 0) {
    try {
      const existingIndex = (await kv.get<string[]>(DISCOVERED_INDEX_KEY)) ?? [];
      const merged = Array.from(new Set([...existingIndex, ...addedNames]));
      await kv.set(DISCOVERED_INDEX_KEY, merged);
    } catch (err) {
      console.warn("[discovered] Failed to update index:", err instanceof Error ? err.message : String(err));
    }
  }
  console.log(`[discovered] Stored ${filtered.length} discovered companies (${phantomCandidates} phantom-candidate, implausible domain)`);
}

export async function cacheBeatArticles(beat: Beat): Promise<DigestArticle[]> {
  try {
    const [beatArticles, vcArticles] = await Promise.all([
      fetchBeatNews(beat),
      mergeVcArticles(beat),
    ]);

    const seenUrls = new Set(beatArticles.map(a => a.url));
    const mergedArticles = [...beatArticles];
    for (const vc of vcArticles) {
      if (!seenUrls.has(vc.url)) {
        seenUrls.add(vc.url);
        mergedArticles.push({ ...vc, beatHint: beat });
      }
    }
    console.log(`[beat-digests] ${beat} - fetched ${beatArticles.length} beat + ${vcArticles.length} VC articles`);

    const { digest: beatDigest, discoveredCompanies } = await generateBeatDigest(mergedArticles, beat);
    console.log(`[beat-digests] ${beat} - generateBeatDigest returned ${beatDigest.articles.length} articles`);

    if (discoveredCompanies.length > 0) {
      await storeDiscoveredCompanies(discoveredCompanies);
    }

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
    // LOAD-BEARING: generateBeatDigest throws when scoring totally fails (e.g. a
    // Gemini 503 spike across flash + flash-lite). The throw lands HERE, BEFORE
    // the KV write above, so the previous good beat cache is left intact and the
    // freshness sentinel is NOT stamped — the stale-beat detector in
    // aggregateDigestFromBeats will then correctly flag the overdue beat. Do NOT
    // "recover" by writing beatDigest.articles ([]) into the cache here, and do
    // NOT move the KV write below this catch. See feedback_gemini_503_resilience.
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
      const { digest: beatDigest } = await generateBeatDigest(beatArticles, beat);
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
    // Rotate the currently published digest into digest:previous, but only when
    // the new publish is from a different UTC calendar date. This protects the
    // previous snapshot from being clobbered by same-day re-runs (manual
    // retries, cron retries, the second daily refresh).
    const existing = await kv.get<Digest>(PUBLISHED_DIGEST_KEY);
    if (existing && existing.generatedAt.slice(0, 10) !== digest.generatedAt.slice(0, 10)) {
      await kv.set(PREVIOUS_DIGEST_KEY, existing);
      console.log(`[beat-digests] Rotated previous digest (${existing.articles.length} articles, ${existing.generatedAt.slice(0, 10)})`);
    }

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

export async function getPreviousDigest(): Promise<Digest | null> {
  if (!KV_CONFIGURED) return null;
  try {
    return (await kv.get<Digest>(PREVIOUS_DIGEST_KEY)) ?? null;
  } catch (err) {
    console.error("[beat-digests] Failed to read previous digest:", err instanceof Error ? err.message : String(err));
    return null;
  }
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

// Pre-pass: collapse exact-URL duplicates regardless of beat. The same article
// can land in multiple beat caches because Gemini's `beat` field is an LLM
// reassignment, not the cache-key origin — e.g. a Hark TC article surfaces in
// 4 beat-query passes and Gemini tags all of them as "AI Labs", so they all
// look same-beat to the title-similarity dedup below and slip through.
function deduplicateByUrl(articles: DigestArticle[]): DigestArticle[] {
  const byUrl = new Map<string, DigestArticle[]>();
  for (const article of articles) {
    const key = normalizeUrl(article.url);
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key)!.push(article);
  }
  const result: DigestArticle[] = [];
  for (const [, group] of byUrl) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    group.sort((a, b) => {
      const prioA = getEffectivePriority(a.source);
      const prioB = getEffectivePriority(b.source);
      if (prioA !== prioB) return prioA - prioB;
      if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;
      return b.impactScore - a.impactScore;
    });
    console.log(
      `[url-dedup] "${group[0].url}" - ${group.length} copies across beats [${group.map(a => a.beat).join(", ")}] -> kept beat=${group[0].beat}`,
    );
    result.push(group[0]);
  }
  return result;
}

function deduplicateAcrossBeats(articles: DigestArticle[]): DigestArticle[] {
  if (articles.length <= 1) return articles;

  const titleSets = articles.map(a => titleWords(a.title));
  const removed = new Set<number>();

  for (let i = 0; i < articles.length; i++) {
    if (removed.has(i)) continue;
    for (let j = i + 1; j < articles.length; j++) {
      if (removed.has(j) || removed.has(i)) continue;
      if (articles[i].beat === articles[j].beat) continue;
      const sim = jaccardSimilarity(titleSets[i], titleSets[j]);
      const sharedTag = articles[i].companyTags.some(t => articles[j].companyTags.includes(t));
      if (sim >= 0.5 || (sim >= 0.40 && sharedTag)) {
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

  const beforeUrl = allArticles.length;
  allArticles = deduplicateByUrl(allArticles);
  if (allArticles.length < beforeUrl) {
    console.log(`[aggregate] url-dedup collapsed ${beforeUrl} -> ${allArticles.length} articles`);
  }
  allArticles = deduplicateAcrossBeats(allArticles);
  allArticles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  let synthesis: Digest["synthesis"] | undefined;
  if (allArticles.length > 0) {
    // Freshness-first: choose the lead story deterministically, THEN synthesize
    // the thesis + subject about it. The hero (getSynthesisHero) resolves the
    // same featuredArticleUrl, so the hero and the editorial lead can never
    // split. articles are already sorted newest-first, so allArticles[0] is the
    // safe fallback when nothing is within pickFeaturedArticle's 48h window.
    const featured = pickFeaturedArticle(allArticles) ?? allArticles[0];
    try {
      if (KV_CONFIGURED) {
        const cachedSynthesis = await kv.get<DigestSynthesis>(SYNTHESIS_KEY);
        // Reuse the cache ONLY if it was written for today's lead story.
        // Otherwise the article set has moved on (a newer story is now the
        // freshest high-impact pick) and the cached thesis/subject describe a
        // stale lead — which is exactly what made the hero and top story diverge.
        if (cachedSynthesis && cachedSynthesis.featuredArticleUrl === featured.url) {
          synthesis = cachedSynthesis;
          console.log("[beat-digests] Synthesis cache HIT (lead unchanged):", synthesis.emailSubject);
        } else {
          if (cachedSynthesis) {
            console.log(`[beat-digests] Synthesis cache STALE — lead changed to "${featured.title.slice(0, 60)}", regenerating`);
          }
          synthesis = await generateEditorialSynthesis(allArticles, featured);
          if (synthesis) {
            await kv.setex(SYNTHESIS_KEY, SYNTHESIS_TTL, synthesis);
            console.log("[beat-digests] Synthesis cached:", synthesis.emailSubject);
          }
        }
      } else {
        synthesis = await generateEditorialSynthesis(allArticles, featured);
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
