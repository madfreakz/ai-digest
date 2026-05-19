import { GoogleGenAI, FunctionCallingConfigMode, Type } from "@google/genai";
import type { FunctionDeclaration, Schema } from "@google/genai";
import { z } from "zod";
import type { ExaArticle } from "./exa";
import type { Beat, DealSignalType } from "./companies";
import { getCompanyContext, getCompanyNames, COMPANIES } from "./companies";

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
}

export interface DigestSynthesis {
  thesis: string;
  emailSubject: string;
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
          },
          required: ["title", "url", "source", "beat", "category", "companyTags", "summary", "bdRelevance", "relevanceScore", "impactScore", "impactReason", "dealSignal"],
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
  const pool = recent.length > 0 ? recent : articles;
  return pool.reduce<DigestArticle | undefined>((best, a) => {
    if (!best) return a;
    if (a.impactScore !== best.impactScore) return a.impactScore > best.impactScore ? a : best;
    return new Date(a.publishedAt).getTime() > new Date(best.publishedAt).getTime() ? a : best;
  }, undefined);
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
        `[${i + 1}] Title: ${a.title}\nURL: ${a.url}\nSource: ${a.source ?? "unknown"}\nDate: ${a.publishedAt}\nExcerpt: ${(a.text ?? "").slice(0, 300)}`,
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
- bdRelevance: 1 sentence on the partnership/deal angle — use the company's deal_vector as context if tracked
- relevanceScore (1–10): how immediately useful for a BD professional? (10 = call someone today)
- impactScore (1–10): industry significance? (10 = paradigm shift, 1 = minor update)
- impactReason: 1 sentence explaining the impactScore
- dealSignal: true ONLY if the article describes a funding round, partnership, customer win, key BD/sales hire, positioning shift, or competitive move that opens a conversation window
- dealSignalType: classify if dealSignal=true (funding_round | partnership_announced | customer_win | hiring_signal | positioning_shift | competitive_move | product_launch)

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
          thinkingConfig: { thinkingBudget: 0 },
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

  return enriched.filter(a => a.relevanceScore >= 7 || a.dealSignal);
}

const DOMAIN_ALIASES: Record<string, string> = {
  "google": "google.com",
  "meta": "meta.com",
  "microsoft": "microsoft.com",
  "nvidia": "nvidia.com",
  "amazon": "amazon.com",
  "apple": "apple.com",
  "stability ai": "stability.ai",
  "hugging face": "huggingface.co",
  "databricks": "databricks.com",
  "scale ai": "scale.com",
  "inflection": "inflection.ai",
  "adept": "adept.ai",
  "character ai": "character.ai",
  "perplexity": "perplexity.ai",
  "runway": "runwayml.com",
  "midjourney": "midjourney.com",
};

async function fetchClearbitLogos(articles: DigestArticle[]): Promise<void> {
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

  // Concurrency control: max 5 parallel Clearbit requests
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
              const url = `https://logo.clearbit.com/${domain}`;
              // Fetch with 1s timeout
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 1000);
              try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (response.ok) {
                  article.companyLogoUrl = url;
                }
              } catch (err) {
                clearTimeout(timeoutId);
                // Clearbit fetch failed, leave companyLogoUrl undefined
              }
            }
          }
        } catch {
          // Silently fail if anything goes wrong
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
  },
  required: ["thesis", "emailSubject"],
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
        `[${i + 1}] ${a.beat} | ${a.category} | relevance:${a.relevanceScore} impact:${a.impactScore}${a.dealSignal ? " DEAL" : ""}\nTitle: ${a.title}\nSummary: ${a.summary}\nBD angle: ${a.bdRelevance}`,
    )
    .join("\n\n");

  const prompt = `You are the editorial lead for Frontier AI Digest, a daily briefing for a BD/partnerships professional across Physical AI, AI Infrastructure, AI Labs, and Vertical AI.

Today's top pre-scored articles:
${articleList}

Return a JSON object with:
- "thesis": 2 sentences identifying the single most important story and what it signals for BD/partnerships practitioners today
- "emailSubject": one punchy subject line under 60 chars — specific and concrete (e.g. "Figure raises $675M — infra race heats up")`;

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SYNTHESIS_RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: 1024 },
        temperature: 0.4,
      },
    });
    const parsed = JSON.parse(response.text ?? "{}") as { thesis?: string; emailSubject?: string };
    if (typeof parsed.thesis === "string" && typeof parsed.emailSubject === "string") {
      return { thesis: parsed.thesis, emailSubject: parsed.emailSubject };
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
