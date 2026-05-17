import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ExaArticle } from "./exa";
import type { Beat, DealSignalType } from "./companies";
import { getCompanyContext, getCompanyNames } from "./companies";

export type { Beat, DealSignalType };

export type Category = "Funding" | "Product" | "AI/Models" | "Partnerships" | "Hiring" | "General";

export interface DigestArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  ogImage: string | null;
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

export interface Digest {
  articles: DigestArticle[];
  generatedAt: string;
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

const RECORD_ARTICLES_TOOL: Anthropic.Tool = {
  name: "record_articles",
  description: "Record the analyzed and scored articles for the digest",
  input_schema: {
    type: "object",
    properties: {
      articles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title:         { type: "string" },
            url:           { type: "string" },
            source:        { type: "string" },
            beat:          { type: "string", enum: ["Physical AI", "AI Infrastructure", "AI Labs", "Vertical AI"] },
            category:      { type: "string", enum: ["Funding", "Product", "AI/Models", "Partnerships", "Hiring", "General"] },
            companyTags:   { type: "array", items: { type: "string" } },
            summary:       { type: "string" },
            bdRelevance:   { type: "string" },
            relevanceScore: { type: "number" },
            impactScore:   { type: "number" },
            impactReason:  { type: "string" },
            dealSignal:    { type: "boolean" },
            dealSignalType: {
              type: "string",
              enum: ["funding_round", "partnership_announced", "customer_win",
                     "hiring_signal", "positioning_shift", "competitive_move", "product_launch"],
            },
          },
          required: ["title", "url", "source", "beat", "category", "companyTags",
                     "summary", "bdRelevance", "relevanceScore", "impactScore", "impactReason", "dealSignal"],
        },
      },
    },
    required: ["articles"],
  } as Anthropic.Tool["input_schema"],
};

function compositeScore(a: Pick<DigestArticle, "relevanceScore" | "impactScore">): number {
  return a.relevanceScore * 0.7 + a.impactScore * 0.3;
}

async function summarizeBeat(
  beat: Beat,
  articles: ExaArticle[],
  client: Anthropic,
): Promise<DigestArticle[]> {
  if (articles.length === 0) return [];

  const companyContext = getCompanyContext(beat);
  const companyNames = getCompanyNames(beat).slice(0, 25).join(", ");

  const articleList = articles
    .slice(0, 10)
    .map(
      (a, i) =>
        `[${i + 1}] Title: ${a.title}\nURL: ${a.url}\nSource: ${a.source ?? "unknown"}\nDate: ${a.publishedAt}\nExcerpt: ${(a.text ?? "").slice(0, 300)}`,
    )
    .join("\n\n---\n\n");

  const prompt = `You are an AI industry analyst covering the ${beat} space for a BD/partnerships professional who needs to know what to act on today.

Today: ${new Date().toDateString()}

TRACKED COMPANIES (name: deal_vectors):
${companyContext || "None for this beat"}

Analyze these ${Math.min(articles.length, 10)} ${beat} articles and call record_articles with your results:

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

  let message: Message | undefined;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        tools: [RECORD_ARTICLES_TOOL],
        tool_choice: { type: "tool", name: "record_articles" },
        messages: [{ role: "user", content: prompt }],
      }, { timeout: 45_000 });
      break;
    } catch (err: unknown) {
      const apiErr = err as { status?: number; headers?: { get?: (k: string) => string | null; [k: string]: unknown } };
      if (apiErr.status === 429 && attempt < 2) {
        const raw = apiErr.headers?.get?.("retry-after") ?? (apiErr.headers as Record<string, string>)?.["retry-after"];
        const retryAfter = parseInt(raw ?? "60", 10);
        console.warn(`Rate limit on ${beat}, retrying in ${retryAfter}s…`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
      } else {
        throw err;
      }
    }
  }
  if (!message) return [];

  const toolBlock = message.content.find(b => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    console.error(`No tool_use block returned for beat: ${beat}`);
    return [];
  }

  const parsed = ToolOutputSchema.safeParse(toolBlock.input);
  if (!parsed.success) {
    console.error(`Zod validation failed for beat ${beat}:`, parsed.error.message);
    return [];
  }

  const exaByUrl = new Map(articles.map(a => [a.url, a]));

  return parsed.data.articles.map(a => {
    const exa = exaByUrl.get(a.url);
    return {
      ...a,
      publishedAt: exa?.publishedAt ?? new Date().toISOString(),
      ogImage:     exa?.ogImage ?? null,
    };
  });
}

export async function generateDigest(articles: ExaArticle[]): Promise<Digest> {
  const client = new Anthropic({ apiKey: process.env.PHYSAI_ANTHROPIC_KEY });

  // Group by beatHint
  const groups = new Map<Beat, ExaArticle[]>();
  for (const article of articles) {
    const beat = article.beatHint;
    if (!groups.has(beat)) groups.set(beat, []);
    groups.get(beat)!.push(article);
  }

  // Sequential Claude calls — avoids hitting the 8,000 TPM rate limit
  const beatEntries = Array.from(groups.entries());
  const allArticles: DigestArticle[] = [];
  for (const [beat, items] of beatEntries) {
    try {
      const result = await summarizeBeat(beat, items, client);
      allArticles.push(...result);
    } catch (err) {
      console.error(`Beat summarization failed (${beat}):`, err);
    }
  }

  // Sort: dealSignal=true first, then by composite score (relevance 70%, impact 30%)
  allArticles.sort((a, b) => {
    if (a.dealSignal !== b.dealSignal) return a.dealSignal ? -1 : 1;
    return compositeScore(b) - compositeScore(a);
  });

  return { articles: allArticles, generatedAt: new Date().toISOString() };
}
