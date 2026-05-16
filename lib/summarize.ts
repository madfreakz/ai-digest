import Anthropic from "@anthropic-ai/sdk";
import type { ExaArticle } from "./exa";

export type Category =
  | "Funding"
  | "Product"
  | "AI/Models"
  | "Partnerships"
  | "Hiring"
  | "General";

export interface DigestArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  ogImage: string | null;
  category: Category;
  companyTags: string[];
  summary: string;
  bdRelevance: string;
}

export interface Digest {
  articles: DigestArticle[];
  generatedAt: string;
}

const KNOWN_COMPANIES = [
  "Physical Intelligence",
  "Figure AI",
  "1X Technologies",
  "Boston Dynamics",
  "Agility Robotics",
  "Tesla",
  "Genesis AI",
  "Mind Robotics",
  "Bedrock Robotics",
  "Apptronik",
  "Unitree",
  "Sanctuary AI",
  "Fourier Intelligence",
  "Aethon",
  "Diligent Robotics",
  "Machina Labs",
  "Covariant",
  "Bright Machines",
  "Veo Robotics",
  "Symbotic",
  "Richtech Robotics",
  "Nauticus Robotics",
  "Sarcos",
];

export async function generateDigest(articles: ExaArticle[]): Promise<Digest> {
  const client = new Anthropic({ apiKey: process.env.PHYSAI_ANTHROPIC_KEY });

  const sliced = articles.slice(0, 25);

  const articleList = sliced
    .map(
      (a, i) =>
        `[${i + 1}] Title: ${a.title}\nURL: ${a.url}\nSource: ${a.source ?? "unknown"}\nDate: ${a.publishedAt}\nExcerpt: ${(a.text ?? "").slice(0, 500)}`
    )
    .join("\n\n---\n\n");

  const prompt = `You are a Physical AI and robotics industry analyst helping a business development professional track the space. Today's date is ${new Date().toDateString()}.

Here are recent news articles about Physical AI, robotics, and related startups:

${articleList}

Based on these articles, produce a JSON response with this exact structure:
{
  "articles": [
    {
      "title": "exact article title",
      "url": "exact article url",
      "source": "domain name",
      "category": one of ["Funding", "Product", "AI/Models", "Partnerships", "Hiring", "General"],
      "companyTags": ["Company Name"],
      "summary": "2 sentence summary of the article",
      "bdRelevance": "1 sentence on why this matters for someone doing BD/partnerships in Physical AI"
    }
  ]
}

Rules:
- Only include articles that are genuinely relevant to Physical AI, robotics, embodied AI, or related hardware/software. Skip generic tech news.
- companyTags must only contain these known companies (or leave empty []): ${KNOWN_COMPANIES.join(", ")}
- Be specific and factual in summaries — no fluff
- bdRelevance should identify partnership angles, expansion signals, or BD entry points
- Return ONLY valid JSON, no markdown fences, no extra text`;

  const message = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  const parsed = JSON.parse(text) as {
    articles: Omit<DigestArticle, "publishedAt" | "ogImage">[];
  };

  // Build a lookup from URL → Exa metadata
  const exaByUrl = new Map(sliced.map((a) => [a.url, a]));

  const enrichedArticles: DigestArticle[] = parsed.articles.map((a) => {
    const exa = exaByUrl.get(a.url);
    return {
      ...a,
      publishedAt: exa?.publishedAt ?? new Date().toISOString(),
      ogImage: exa?.ogImage ?? null,
    };
  });

  return {
    articles: enrichedArticles,
    generatedAt: new Date().toISOString(),
  };
}
