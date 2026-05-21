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
  "humanoid robotics companies raising capital or announcing commercial partnerships",
  "embodied AI and physical robotics enterprise deployment contracts and milestones",
  "robotics company product launches, competitive moves, or strategic hires",
];

const QUERIES_AI_INFRASTRUCTURE = [
  "AI developer infrastructure and tooling companies announcing funding or product milestones",
  "vector databases, LLM observability, and ML platform providers announcing deals or launches",
  "AI compute and cloud infrastructure companies raising capital or forming partnerships",
];

const QUERIES_AI_LABS = [
  "foundation model laboratories releasing new models or announcing major research breakthroughs",
  "AI research lab funding rounds, valuations, and strategic partnerships",
  "AI safety and alignment research announcements and institutional moves",
];

const QUERIES_VERTICAL_AI = [
  "vertical AI software companies signing enterprise customers or announcing ARR growth",
  "AI agent and workflow automation companies raising capital or announcing partnerships",
  "AI copilot products winning enterprise contracts or expanding into new verticals",
];

const TC_QUERIES: Record<Beat, string> = {
  "Physical AI":       "robotics AI companies funding partnerships launches",
  "AI Infrastructure": "AI infrastructure tooling companies funding product launches",
  "AI Labs":           "AI lab foundation model research funding partnerships",
  "Vertical AI":       "vertical AI software companies funding enterprise deals",
};

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

async function runBeatQueries(
  beat: Beat,
  queries: string[],
  exa: Exa,
  startDate: string,
  seenUrls: Set<string>,
): Promise<ExaArticle[]> {
  const results: ExaArticle[] = [];

  const allQueries: Array<{ query: string; opts: Record<string, unknown> }> = queries.map(q => ({
    query: q,
    opts: { type: "neural", numResults: 10, startPublishedDate: startDate, text: { maxCharacters: 400 } },
  }));

  const tcQuery = TC_QUERIES[beat];
  if (tcQuery) {
    allQueries.push({
      query: tcQuery,
      opts: {
        type: "neural",
        numResults: 5,
        startPublishedDate: startDate,
        text: { maxCharacters: 400 },
        includeDomains: ["techcrunch.com"],
      },
    });
  }

  await Promise.allSettled(
    allQueries.map(async ({ query, opts }) => {
      const isTc = "includeDomains" in opts;
      const label = isTc ? `[TC] "${query.slice(0, 40)}..."` : `"${query.slice(0, 40)}..."`;
      try {
        const result = await withRetry(() =>
          exa.searchAndContents(query, opts as any)
        );
        console.log(`[exa] ${beat} - query: ${label} - results: ${result.results.length}`);
        for (const item of result.results) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            const hostname = new URL(item.url).hostname.replace(/^www\./, "");
            const image = (item as Record<string, unknown>).image as string | null;
            results.push({
              title: item.title ?? "Untitled",
              url: item.url,
              publishedAt: item.publishedDate ?? new Date().toISOString(),
              text: (item as Record<string, unknown>).text as string | undefined,
              source: hostname,
              ogImage: image ?? BEAT_PLACEHOLDERS[beat],
              beatHint: beat,
            });
          }
        }
      } catch (err) {
        console.error(`[exa] ${beat} - query: ${label} - error:`, err instanceof Error ? err.message : String(err));
      }
    })
  );
  return results;
}

export async function fetchBeatNews(beat: Beat): Promise<ExaArticle[]> {
  const exa = new Exa(process.env.EXA_API_KEY!);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().split("T")[0];
  const queries = BEAT_QUERIES.find(([b]) => b === beat)?.[1] ?? [];
  return runBeatQueries(beat, queries, exa, startDate, new Set());
}

export async function fetchAllNews(): Promise<ExaArticle[]> {
  const exa = new Exa(process.env.EXA_API_KEY!);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().split("T")[0];

  const seenUrls = new Set<string>();
  const beatResultArrays = await Promise.allSettled(
    BEAT_QUERIES.map(([beat, queries]) => runBeatQueries(beat, queries, exa, startDate, seenUrls))
  );

  return beatResultArrays.flatMap(r => r.status === "fulfilled" ? r.value : []);
}
