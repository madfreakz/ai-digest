import { GoogleGenAI, FunctionCallingConfigMode, Type } from "@google/genai";
import type { FunctionDeclaration, Schema } from "@google/genai";
import { z } from "zod";
import type { ExaArticle } from "./exa";
import { normalizeUrl } from "./exa";
import type { Beat, DealSignalType } from "./companies";
import { getCompanyContext, getCompanyNames, COMPANIES, DOMAIN_ALIASES, resolveCanonicalCompanyName, DISCOVERY_BLOCKLIST } from "./companies";
import { KV_CONFIGURED } from "./kv-config";
import { getEffectivePriority } from "./sources";

export type { Beat, DealSignalType };

export type Category = "Funding" | "Product" | "AI/Models" | "Partnerships" | "Hiring" | "General";

export interface DigestArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  ogImage: string | null;
  companyLogoUrl?: string;
  beat: Beat;
  category: Category;
  companyTags: string[];
  summary: string;
  bdRelevance: string;
  relevanceScore: number;
  impactScore: number;
  impactReason: string;
  dealSignal: boolean;
  dealSignalType?: DealSignalType;
  storyId: string;
  // Transient flag set in the server component when this article is new
  // since the previous publish. Not persisted to KV.
  isNew?: boolean;
}

export interface DigestSynthesis {
  thesis: string;
  emailSubject: string;
  featuredArticleUrl?: string;
}

export interface Digest {
  articles: DigestArticle[];
  generatedAt: string;
  synthesis?: DigestSynthesis;
}

const ArticleSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string(),
  beat: z.enum(["Physical AI", "AI Infrastructure", "AI Labs", "Vertical AI"]),
  category: z.enum(["Funding", "Product", "AI/Models", "Partnerships", "Hiring", "General"]),
  companyTags: z.array(z.string()),
  summary: z.string(),
  bdRelevance: z.string(),
  relevanceScore: z.number().int().min(1).max(10),
  impactScore: z.number().int().min(1).max(10),
  impactReason: z.string(),
  dealSignal: z.boolean(),
  dealSignalType: z.enum([
    "funding_round", "partnership_announced", "customer_win",
    "hiring_signal", "positioning_shift", "competitive_move", "product_launch",
  ]).optional(),
  storyId: z.string(),
});

const DiscoveredCompanySchema = z.object({
  name: z.string(),
  inferredDomain: z.string(),
  suggestedBeat: z.enum(["Physical AI", "AI Infrastructure", "AI Labs", "Vertical AI"]),
});

export type DiscoveredCompanyResult = z.infer<typeof DiscoveredCompanySchema>;

const ToolOutputSchema = z.object({
  articles: z.array(ArticleSchema).default([]),
  discoveredCompanies: z.array(DiscoveredCompanySchema).default([]),
});

const RECORD_ARTICLES_TOOL: FunctionDeclaration = {
  name: "record_articles",
  description: "Record the analyzed and scored articles for the digest, plus any newly discovered companies",
  parameters: {
    type: Type.OBJECT,
    properties: {
      articles: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title:         { type: Type.STRING },
            url:           { type: Type.STRING },
            source:        { type: Type.STRING },
            beat:          { type: Type.STRING, enum: ["Physical AI", "AI Infrastructure", "AI Labs", "Vertical AI"] },
            category:      { type: Type.STRING, enum: ["Funding", "Product", "AI/Models", "Partnerships", "Hiring", "General"] },
            companyTags:   { type: Type.ARRAY, items: { type: Type.STRING } as any },
            summary:       { type: Type.STRING },
            bdRelevance:   { type: Type.STRING },
            relevanceScore: { type: Type.INTEGER },
            impactScore:   { type: Type.INTEGER },
            impactReason:  { type: Type.STRING },
            dealSignal:    { type: Type.BOOLEAN },
            dealSignalType: { type: Type.STRING, enum: ["funding_round", "partnership_announced", "customer_win", "hiring_signal", "positioning_shift", "competitive_move", "product_launch"] },
            storyId:       { type: Type.STRING },
          },
          required: ["title", "url", "source", "beat", "category", "companyTags", "summary", "bdRelevance", "relevanceScore", "impactScore", "impactReason", "dealSignal", "storyId"],
        } as any,
      },
      discoveredCompanies: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name:           { type: Type.STRING },
            inferredDomain: { type: Type.STRING },
            suggestedBeat:  { type: Type.STRING, enum: ["Physical AI", "AI Infrastructure", "AI Labs", "Vertical AI"] },
          },
          required: ["name", "inferredDomain", "suggestedBeat"],
        } as any,
      },
    },
    required: ["articles", "discoveredCompanies"],
  } as any,
};

const GEMINI_MODEL = "gemini-2.5-flash";

export function pickFeaturedArticle(articles: DigestArticle[]): DigestArticle | undefined {
  const now = Date.now();
  const recent = articles.filter(a => now - new Date(a.publishedAt).getTime() < 48 * 60 * 60 * 1000);
  // If no recent articles qualify, return undefined — callers fall back to articles[0] (sorted by publishedAt desc)
  if (recent.length === 0) return undefined;
  return recent.reduce<DigestArticle | undefined>((best, a) => {
    if (!best) return a;
    if (a.impactScore !== best.impactScore) return a.impactScore > best.impactScore ? a : best;
    return new Date(a.publishedAt).getTime() > new Date(best.publishedAt).getTime() ? a : best;
  }, undefined);
}

// Hero freshness ceiling: 48h. If synthesis picked a stale article (e.g.
// Gemini fixated on a big-number story from earlier in the week), fall back
// to pickFeaturedArticle which enforces its own 48h window.
const HERO_FRESHNESS_MS = 48 * 60 * 60 * 1000;

export function getSynthesisHero(digest: Digest): DigestArticle | undefined {
  const url = digest.synthesis?.featuredArticleUrl;
  if (url) {
    const match = digest.articles.find(a => a.url === url);
    if (match) {
      const ageMs = Date.now() - new Date(match.publishedAt).getTime();
      if (ageMs < HERO_FRESHNESS_MS) return match;
      console.log(`[hero] synthesis pick "${match.title.slice(0, 60)}" is ${(ageMs / 3_600_000).toFixed(1)}h old — falling back to pickFeaturedArticle`);
    }
  }
  return pickFeaturedArticle(digest.articles);
}

interface SummarizeBeatResult {
  articles: DigestArticle[];
  discoveredCompanies: DiscoveredCompanyResult[];
}

async function summarizeBeat(
  beat: Beat,
  articles: ExaArticle[],
  ai: GoogleGenAI,
  modelName: string,
): Promise<SummarizeBeatResult> {
  if (articles.length === 0) return { articles: [], discoveredCompanies: [] };

  const companyContext = getCompanyContext(beat);
  const allCompanyNames = await getCompanyNames();
  const companyNames = allCompanyNames.join(", ");

  const articleList = articles
    .slice(0, 15)
    .map(
      (a, i) =>
        `[${i + 1}] Title: ${a.title}\nURL: ${a.url}\nSource: ${a.source ?? "unknown"}\nDate: ${a.publishedAt}\nExcerpt: ${(a.text ?? "").slice(0, 200)}`,
    )
    .join("\n\n---\n\n");

  const prompt = `You are an AI industry analyst covering the ${beat} space for a BD/partnerships professional who needs to know what to act on today.

Today: ${new Date().toDateString()}

TRACKED COMPANIES (name: deal_vectors):
${companyContext || "None for this beat"}

Analyze these ${Math.min(articles.length, 15)} ${beat} articles and call record_articles with your results:

${articleList}

For each article:
- beat: "${beat}" — confirm or override if clearly about a different beat
- category: Funding | Product | AI/Models | Partnerships | Hiring | General
- companyTags: match to tracked names only (${companyNames}) — empty [] if none match
- summary: 2 clear sentences
- bdRelevance: 1 sentence explaining WHY this news is significant from a business/industry perspective — what does it signal about market dynamics, competitive positioning, or strategic direction? Write for a business reader who wants to understand the implication, not what to do about it. Bad: "This is relevant for BD teams." Also bad: "Reach out to X before Y." Good: "Signals that hyperscalers are shifting from raw compute capacity to developer tooling as their primary moat — compressing margins for infrastructure-only vendors."
- relevanceScore (1–10): how immediately useful for a BD professional? (10 = call someone today)
- impactScore (1–10): industry significance? (10 = paradigm shift, 1 = minor update)
- impactReason: 1 sentence explaining the impactScore
- dealSignal: true ONLY if the article describes a funding round, partnership, customer win, key BD/sales hire, positioning shift, or competitive move that opens a conversation window
- dealSignalType: classify if dealSignal=true (funding_round | partnership_announced | customer_win | hiring_signal | positioning_shift | competitive_move | product_launch)
- storyId: a short lowercase slug identifying the underlying story/event. If two articles cover the same event (e.g. same funding round, same product launch, same partnership), give them the SAME storyId. Format: "company-event-type" (e.g. "exa-series-c", "figure-bmw-deal", "openai-gpt5-release"). If an article covers a unique story, still give it a unique storyId.

Skip pure opinion pieces, low-signal blog posts, and articles clearly unrelated to ${beat}.
Skip articles primarily about: defense/military, healthcare/medical, insurance, government/govtech, education/edtech, cybersecurity, identity/access management, trust & safety, fraud prevention, mental health, adtech/advertising, or crypto/blockchain applications.

Also return discoveredCompanies: for any company in these articles that is NOT in the tracked list above AND is the subject of a funding round, major partnership, or significant product launch, include it. inferredDomain must be a web domain like "example.com" (not a description). suggestedBeat is which of the 4 beats it belongs to. Only include real AI/robotics/infrastructure startups, not Big Tech or generic terms. Skip companies in the excluded industries listed above.${
    DISCOVERY_BLOCKLIST.size > 0
      ? `\nDo NOT include in discoveredCompanies: ${Array.from(DISCOVERY_BLOCKLIST).join(", ")}.`
      : ""
  }`;

  let response: any;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          tools: [{ functionDeclarations: [RECORD_ARTICLES_TOOL] }],
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY } },
          thinkingConfig: { thinkingBudget: 128 },
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      });
      break;
    } catch (err: unknown) {
      if (attempt < 2) {
        console.warn(`Error on ${beat}, retrying…`);
        await new Promise(r => setTimeout(r, 5000));
      } else {
        throw err;
      }
    }
  }
  if (!response) {
    console.error(`[gemini] ${beat} - No response`);
    return { articles: [], discoveredCompanies: [] };
  }

  const functionCall = response.functionCalls?.[0];
  if (!functionCall || functionCall.name !== "record_articles") {
    console.error(`[gemini] ${beat} - No function call returned`, {
      hasFunctionCall: !!functionCall,
      name: functionCall?.name,
      allCalls: response.functionCalls,
    });
    return { articles: [], discoveredCompanies: [] };
  }

  console.log(`[gemini] ${beat} - function call received with ${functionCall.args.articles?.length || 0} articles, ${functionCall.args.discoveredCompanies?.length || 0} discovered`);

  const parsed = ToolOutputSchema.safeParse(functionCall.args);
  if (!parsed.success) {
    console.error(`[gemini] ${beat} - Zod validation failed:`, parsed.error.message);
    return { articles: [], discoveredCompanies: [] };
  }

  console.log(`[gemini] ${beat} - parsed ${parsed.data.articles.length} articles, ${parsed.data.discoveredCompanies.length} discovered companies`);

  const exaByUrl = new Map(articles.map(a => [a.url, a]));

  const enriched = parsed.data.articles.map(a => {
    const exa = exaByUrl.get(a.url);
    const canonicalTags = Array.from(
      new Set(a.companyTags.map(resolveCanonicalCompanyName)),
    );
    return {
      ...a,
      companyTags: canonicalTags,
      publishedAt: exa?.publishedAt ?? new Date().toISOString(),
      ogImage:     exa?.ogImage ?? null,
    };
  });

  const deduped = deduplicateBySource(enriched);
  if (deduped.length < enriched.length) {
    console.log(`[dedup] ${beat} - collapsed ${enriched.length} → ${deduped.length} articles`);
  }

  return {
    articles: deduped.filter(a => a.relevanceScore >= 8 || (a.dealSignal && a.relevanceScore >= 6)),
    discoveredCompanies: parsed.data.discoveredCompanies,
  };
}

function deduplicateBySource(articles: DigestArticle[]): DigestArticle[] {
  // Pass 1: collapse exact-URL duplicates. Gemini sometimes returns the same
  // article URL multiple times in one scoring call with different storyIds
  // (e.g. "hark-series-a" + "hark-series-a-funding"). storyId grouping alone
  // misses those — URL identity is the most reliable signal.
  const byUrl = new Map<string, DigestArticle[]>();
  for (const article of articles) {
    const key = normalizeUrl(article.url);
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key)!.push(article);
  }
  const urlDeduped: DigestArticle[] = [];
  for (const [, group] of byUrl) {
    if (group.length === 1) {
      urlDeduped.push(group[0]);
      continue;
    }
    group.sort((a, b) => {
      if (a.relevanceScore !== b.relevanceScore) return b.relevanceScore - a.relevanceScore;
      return b.impactScore - a.impactScore;
    });
    console.log(`[dedup] URL "${group[0].url}" - ${group.length} entries with storyIds [${group.map(a => a.storyId).join(", ")}] -> kept score ${group[0].relevanceScore}/${group[0].impactScore}`);
    urlDeduped.push(group[0]);
  }

  // Pass 2: collapse storyId duplicates from different sources (cross-source coverage).
  const byStory = new Map<string, DigestArticle[]>();
  for (const article of urlDeduped) {
    const key = article.storyId;
    if (!byStory.has(key)) byStory.set(key, []);
    byStory.get(key)!.push(article);
  }

  const result: DigestArticle[] = [];
  for (const [, group] of byStory) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    group.sort((a, b) => {
      const prioA = getEffectivePriority(a.source);
      const prioB = getEffectivePriority(b.source);
      if (prioA !== prioB) return prioA - prioB;
      return b.impactScore - a.impactScore;
    });
    console.log(`[dedup] story "${group[0].storyId}" - picked ${group[0].source} over ${group.slice(1).map(a => a.source).join(", ")}`);
    result.push(group[0]);
  }
  return result;
}

async function fetchCompanyLogos(articles: DigestArticle[]): Promise<void> {
  // 1. Try KV pre-cache first (populated by /api/admin/prefetch-logos)
  if (KV_CONFIGURED) {
    try {
      const { kv } = await import("@vercel/kv");
      const logoMap = await kv.get<Record<string, string>>("logos:company-map");
      if (logoMap) {
        for (const article of articles) {
          const key = article.companyTags[0]?.toLowerCase();
          if (key && logoMap[key]) article.companyLogoUrl = logoMap[key];
        }
        return; // all done — no live Clearbit calls needed
      }
    } catch {
      // fall through to live fetch
    }
  }

  // 2. Fallback: live per-article Logo.dev fetch
  const logoDevKey = process.env.LOGO_DEV_KEY;
  if (!logoDevKey) return; // no logo source available

  const companyDomainMap = new Map<string, string>();
  for (const company of COMPANIES) {
    if (company.domain) {
      companyDomainMap.set(company.name.toLowerCase(), company.domain);
    }
  }

  function resolveDomain(companyName: string): string | undefined {
    const key = companyName.toLowerCase();
    return companyDomainMap.get(key) ?? DOMAIN_ALIASES[key];
  }

  // Concurrency control: max 5 parallel Logo.dev requests
  const maxConcurrent = 5;
  let activeCount = 0;
  const queue: Array<() => Promise<void>> = [];

  const enqueueFetch = (article: DigestArticle): Promise<void> => {
    return new Promise((resolve) => {
      const task = async () => {
        try {
          const firstCompany = article.companyTags[0];
          if (firstCompany) {
            const domain = resolveDomain(firstCompany);
            if (domain) {
              const url = `https://img.logo.dev/${domain}?token=${logoDevKey}&size=200&format=png`;
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 2000);
              try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (response.ok) {
                  article.companyLogoUrl = url;
                }
              } catch {
                clearTimeout(timeoutId);
              }
            }
          }
        } catch {
          // Silently fail
        }

        activeCount--;
        resolve();
        const nextTask = queue.shift();
        if (nextTask) {
          activeCount++;
          nextTask();
        }
      };

      if (activeCount < maxConcurrent) {
        activeCount++;
        task();
      } else {
        queue.push(task);
      }
    });
  };

  await Promise.all(articles.map(enqueueFetch));
}

const SYNTHESIS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    thesis: { type: Type.STRING },
    emailSubject: { type: Type.STRING },
    featuredArticleUrl: { type: Type.STRING },
  },
  required: ["thesis", "emailSubject", "featuredArticleUrl"],
};

export async function generateEditorialSynthesis(
  articles: DigestArticle[],
): Promise<DigestSynthesis | undefined> {
  if (articles.length === 0) return undefined;

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
  // Restrict synthesis to last 48h so Gemini doesn't anchor on a splashy older
  // story (e.g. a $1.25B funding deal from 3 days ago) when picking the hero.
  // Fall back to the full set only when nothing fresh qualifies.
  const now = Date.now();
  const fresh = articles.filter(a => now - new Date(a.publishedAt).getTime() < HERO_FRESHNESS_MS);
  const pool = fresh.length > 0 ? fresh : articles;
  const top = pool.slice(0, 10);
  const articleList = top
    .map(
      (a, i) =>
        `[${i + 1}] ${a.beat} | ${a.category} | relevance:${a.relevanceScore} impact:${a.impactScore}${a.dealSignal ? " DEAL" : ""}\nTitle: ${a.title}\nURL: ${a.url}\nSummary: ${a.summary}\nBD angle: ${a.bdRelevance}`,
    )
    .join("\n\n");

  const prompt = `You are the editorial lead for Frontier AI Digest, a daily briefing for a BD/partnerships professional across Physical AI, AI Infrastructure, AI Labs, and Vertical AI.

Today's top pre-scored articles:
${articleList}

Return a JSON object with:
- "thesis": 2 sentences identifying the single most important story and what it signals for BD/partnerships practitioners today
- "emailSubject": one punchy subject line under 60 chars — specific and concrete (e.g. "Figure raises $675M — infra race heats up")
- "featuredArticleUrl": the exact URL of the article you identified as the single most important story`;

  // gemini-3.5-flash is the most 503-prone model in this app. Retry it, then
  // fall back to gemini-2.5-flash-lite (separate capacity pool, stays healthy
  // during "high demand" spikes) so the daily email keeps its thesis + subject
  // instead of silently dropping to a generic subject and heuristic hero.
  const synthesisAttempts: Array<{ model: string; thinkingBudget?: number }> = [
    { model: "gemini-3.5-flash", thinkingBudget: 512 },
    { model: "gemini-3.5-flash", thinkingBudget: 512 },
    { model: "gemini-2.5-flash-lite" },
  ];
  for (let i = 0; i < synthesisAttempts.length; i++) {
    const { model, thinkingBudget } = synthesisAttempts[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: SYNTHESIS_RESPONSE_SCHEMA,
          ...(thinkingBudget ? { thinkingConfig: { thinkingBudget } } : {}),
          temperature: 0.4,
        },
      });
      const parsed = JSON.parse(response.text ?? "{}") as { thesis?: string; emailSubject?: string; featuredArticleUrl?: string };
      if (typeof parsed.thesis === "string" && typeof parsed.emailSubject === "string") {
        if (i > 0) console.log(`[summarize] synthesis recovered via ${model} on attempt ${i + 1}`);
        return { thesis: parsed.thesis, emailSubject: parsed.emailSubject, featuredArticleUrl: parsed.featuredArticleUrl };
      }
      console.warn(`[summarize] synthesis attempt ${i + 1} (${model}) returned unusable JSON`);
    } catch (err) {
      console.warn(`[summarize] synthesis attempt ${i + 1} (${model}) failed:`, err instanceof Error ? err.message : String(err));
    }
    // Brief backoff before the next attempt (not after the last).
    if (i < synthesisAttempts.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.warn("[summarize] Editorial synthesis failed after all attempts — email will use generic subject + heuristic hero");
  return undefined;
}

export interface GenerateDigestResult {
  digest: Digest;
  discoveredCompanies: DiscoveredCompanyResult[];
}

export async function generateDigest(articles: ExaArticle[], beatFilter?: Beat): Promise<GenerateDigestResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
  const filtered = beatFilter
    ? articles.filter(a => a.beatHint === beatFilter)
    : articles;

  const groups = new Map<Beat, ExaArticle[]>();
  for (const article of filtered) {
    const beat = article.beatHint;
    if (!groups.has(beat)) groups.set(beat, []);
    groups.get(beat)!.push(article);
  }

  const beatEntries = Array.from(groups.entries());
  const allArticles: DigestArticle[] = [];
  const allDiscovered: DiscoveredCompanyResult[] = [];
  for (const [beat, items] of beatEntries) {
    try {
      const result = await summarizeBeat(beat, items, ai, GEMINI_MODEL);
      result.articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      allArticles.push(...result.articles);
      allDiscovered.push(...result.discoveredCompanies);
    } catch (err) {
      console.error(`Beat summarization failed (${beat}):`, err);
    }
  }

  await fetchCompanyLogos(allArticles);

  return {
    digest: { articles: allArticles, generatedAt: new Date().toISOString() },
    discoveredCompanies: allDiscovered,
  };
}
