import { GoogleGenAI, FunctionCallingConfigMode, Type } from "@google/genai";
import type { FunctionDeclaration, Schema } from "@google/genai";
import { z } from "zod";
import type { ExaArticle } from "./exa";
import type { Beat, DealSignalType } from "./companies";
import { getCompanyContext, getCompanyNames, COMPANIES, DOMAIN_ALIASES } from "./companies";
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

const ToolOutputSchema = z.object({ articles: z.array(ArticleSchema).default([]) });

const RECORD_ARTICLES_TOOL: FunctionDeclaration = {
  name: "record_articles",
  description: "Record the analyzed and scored articles for the digest",
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
    },
    required: ["articles"],
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

export function getSynthesisHero(digest: Digest): DigestArticle | undefined {
  const url = digest.synthesis?.featuredArticleUrl;
  if (url) {
    const match = digest.articles.find(a => a.url === url);
    if (match) return match;
  }
  return pickFeaturedArticle(digest.articles);
}

async function summarizeBeat(
  beat: Beat,
  articles: ExaArticle[],
  ai: GoogleGenAI,
  modelName: string,
): Promise<DigestArticle[]> {
  if (articles.length === 0) return [];

  const companyContext = getCompanyContext(beat);
  const companyNames = getCompanyNames(beat).slice(0, 25).join(", ");

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

Skip pure opinion pieces, low-signal blog posts, and articles clearly unrelated to ${beat}.`;

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
          maxOutputTokens: 4096,
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
    return [];
  }

  const functionCall = response.functionCalls?.[0];
  if (!functionCall || functionCall.name !== "record_articles") {
    console.error(`[gemini] ${beat} - No function call returned`, {
      hasFunctionCall: !!functionCall,
      name: functionCall?.name,
      allCalls: response.functionCalls,
    });
    return [];
  }

  console.log(`[gemini] ${beat} - function call received with ${functionCall.args.articles?.length || 0} articles`);

  const parsed = ToolOutputSchema.safeParse(functionCall.args);
  if (!parsed.success) {
    console.error(`[gemini] ${beat} - Zod validation failed:`, parsed.error.message);
    return [];
  }

  console.log(`[gemini] ${beat} - parsed ${parsed.data.articles.length} articles`);

  const exaByUrl = new Map(articles.map(a => [a.url, a]));

  const enriched = parsed.data.articles.map(a => {
    const exa = exaByUrl.get(a.url);
    return {
      ...a,
      publishedAt: exa?.publishedAt ?? new Date().toISOString(),
      ogImage:     exa?.ogImage ?? null,
    };
  });

  const deduped = deduplicateBySource(enriched);
  if (deduped.length < enriched.length) {
    console.log(`[dedup] ${beat} - collapsed ${enriched.length} → ${deduped.length} articles`);
  }

  return deduped.filter(a => a.relevanceScore >= 8 || (a.dealSignal && a.relevanceScore >= 6));
}

function deduplicateBySource(articles: DigestArticle[]): DigestArticle[] {
  const groups = new Map<string, DigestArticle[]>();
  for (const article of articles) {
    const key = article.storyId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(article);
  }

  const result: DigestArticle[] = [];
  for (const [, group] of groups) {
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

const KV_CONFIGURED = !!(process.env.KV_REST_API_URL ?? process.env.KV_URL);

async function fetchClearbitLogos(articles: DigestArticle[]): Promise<void> {
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
  const top = articles.slice(0, 10);
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

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SYNTHESIS_RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: 512 },
        temperature: 0.4,
      },
    });
    const parsed = JSON.parse(response.text ?? "{}") as { thesis?: string; emailSubject?: string; featuredArticleUrl?: string };
    if (typeof parsed.thesis === "string" && typeof parsed.emailSubject === "string") {
      return { thesis: parsed.thesis, emailSubject: parsed.emailSubject, featuredArticleUrl: parsed.featuredArticleUrl };
    }
  } catch (err) {
    console.warn("[summarize] Editorial synthesis failed:", err instanceof Error ? err.message : String(err));
  }
  return undefined;
}

export async function generateDigest(articles: ExaArticle[], beatFilter?: Beat): Promise<Digest> {
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });
  // Filter articles by beat if specified
  const filtered = beatFilter
    ? articles.filter(a => a.beatHint === beatFilter)
    : articles;

  // Group by beatHint
  const groups = new Map<Beat, ExaArticle[]>();
  for (const article of filtered) {
    const beat = article.beatHint;
    if (!groups.has(beat)) groups.set(beat, []);
    groups.get(beat)!.push(article);
  }

  // Sequential Gemini calls
  const beatEntries = Array.from(groups.entries());
  const allArticles: DigestArticle[] = [];
  for (const [beat, items] of beatEntries) {
    try {
      const result = await summarizeBeat(beat, items, ai, GEMINI_MODEL);
      result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      allArticles.push(...result);
    } catch (err) {
      console.error(`Beat summarization failed (${beat}):`, err);
    }
  }

  // Fetch Clearbit logos for company tags (with concurrency control)
  await fetchClearbitLogos(allArticles);

  return { articles: allArticles, generatedAt: new Date().toISOString() };
}
