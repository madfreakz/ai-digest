import Exa from "exa-js";

export interface ExaArticle {
  title: string;
  url: string;
  publishedAt: string;
  text?: string;
  source?: string;
  ogImage: string | null;
}

const QUERIES = [
  "physical AI humanoid robot startup news 2025",
  "robotics AI funding investment round 2025",
  "Figure AI Physical Intelligence 1X Boston Dynamics Agility Robotics news",
  "Genesis AI Mind Robotics Bedrock Robotics announcement",
  "Tesla Optimus humanoid robot update progress",
  "embodied AI robot foundation model breakthrough 2025",
];

export async function fetchRoboticsNews(): Promise<ExaArticle[]> {
  const exa = new Exa(process.env.EXA_API_KEY!);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().split("T")[0];

  const allResults: ExaArticle[] = [];
  const seenUrls = new Set<string>();

  await Promise.allSettled(
    QUERIES.map(async (query) => {
      try {
        const result = await exa.searchAndContents(query, {
          numResults: 8,
          startPublishedDate: startDate,
          text: { maxCharacters: 800 },
          highlights: { numSentences: 2, highlightsPerUrl: 1 },
        });
        for (const item of result.results) {
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            const hostname = new URL(item.url).hostname.replace(/^www\./, "");
            allResults.push({
              title: item.title ?? "Untitled",
              url: item.url,
              publishedAt: item.publishedDate ?? new Date().toISOString(),
              text: item.text ?? undefined,
              source: hostname,
              ogImage: (item as Record<string, unknown>).image as string | null ?? null,
            });
          }
        }
      } catch {
        // skip failed queries silently
      }
    })
  );

  return allResults;
}
