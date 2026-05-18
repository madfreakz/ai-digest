import Exa from "exa-js";
import type { Beat } from "./companies";

export interface ExaArticle {
  title: string;
  url: string;
  publishedAt: string;
  text?: string;
  source?: string;
  ogImage: string | null;
  beatHint: Beat;
}

const BEAT_PLACEHOLDERS: Record<Beat, string> = {
  "Physical AI":       "/placeholder-physical-ai.png",
  "AI Infrastructure": "/placeholder-ai-infra.png",
  "AI Labs":           "/placeholder-ai-labs.png",
  "Vertical AI":       "/placeholder-vertical-ai.png",
};

const QUERIES_PHYSICAL_AI = [
  "physical AI humanoid robot startup news 2026",
  "robotics AI funding investment round 2026",
  "Figure AI Physical Intelligence 1X Boston Dynamics Agility Robotics news",
  "Genesis AI Mind Robotics Bedrock Robotics announcement",
  "Tesla Optimus humanoid robot update progress",
  "embodied AI robot foundation model breakthrough 2026",
];

const QUERIES_AI_INFRASTRUCTURE = [
  "AI infrastructure developer tools API startup funding 2026",
  "vector database embedding search startup deal 2026",
  "LLM observability evaluation tooling announcement 2026",
  "Exa Weaviate Pinecone Modal Together AI LangChain news 2026",
  "AI compute GPU cloud infrastructure startup partnership 2026",
  "AI developer platform SDK tooling launch 2026",
];

const QUERIES_AI_LABS = [
  "Anthropic OpenAI DeepMind model release announcement 2026",
  "foundation model safety alignment research breakthrough 2026",
  "xAI Mistral Cohere model update product launch 2026",
  "AI research lab funding valuation round 2026",
  "large language model benchmark capability advance 2026",
  "AI lab partnership enterprise deployment deal 2026",
];

const QUERIES_VERTICAL_AI = [
  "Harvey Rogo Sierra Decagon Glean AI startup news 2026",
  "vertical AI legal finance healthcare enterprise deal 2026",
  "AI agent enterprise workflow automation contract win 2026",
  "AI SaaS startup revenue ARR milestone funding 2026",
  "AI copilot enterprise deployment partnership announcement 2026",
  "AI native software company customer win expansion 2026",
];

const BEAT_QUERIES: [Beat, string[]][] = [
  ["Physical AI",       QUERIES_PHYSICAL_AI],
  ["AI Infrastructure", QUERIES_AI_INFRASTRUCTURE],
  ["AI Labs",           QUERIES_AI_LABS],
  ["Vertical AI",       QUERIES_VERTICAL_AI],
];

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelay = 500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)));
      }
    }
  }
  throw lastErr;
}

export async function fetchAllNews(): Promise<ExaArticle[]> {
  const exa = new Exa(process.env.EXA_API_KEY!);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().split("T")[0];

  const allResults: ExaArticle[] = [];
  const seenUrls = new Set<string>();

  await Promise.allSettled(
    BEAT_QUERIES.flatMap(([beat, queries]) =>
      queries.map(async (query) => {
        try {
          const result = await withRetry(() =>
            exa.searchAndContents(query, {
              numResults: 8,
              startPublishedDate: startDate,
              text: { maxCharacters: 800 },
            })
          );
          for (const item of result.results) {
            if (!seenUrls.has(item.url)) {
              seenUrls.add(item.url);
              const hostname = new URL(item.url).hostname.replace(/^www\./, "");
              const image = (item as Record<string, unknown>).image as string | null;
              allResults.push({
                title: item.title ?? "Untitled",
                url: item.url,
                publishedAt: item.publishedDate ?? new Date().toISOString(),
                text: item.text ?? undefined,
                source: hostname,
                ogImage: image ?? BEAT_PLACEHOLDERS[beat],
                beatHint: beat,
              });
            }
          }
        } catch {
          // Failed queries are skipped silently — Promise.allSettled handles the rest
        }
      })
    )
  );

  return allResults;
}
