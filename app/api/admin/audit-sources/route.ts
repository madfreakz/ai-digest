import { NextResponse } from "next/server";
import Exa from "exa-js";
import { COMPANIES } from "@/lib/companies";
import type { Beat } from "@/lib/companies";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BEAT_QUERIES: [Beat, string[]][] = [
  ["Physical AI", [
    "humanoid robotics companies raising capital or announcing commercial partnerships",
    "embodied AI and physical robotics enterprise deployment contracts and milestones",
    "robotics company product launches, competitive moves, or strategic hires",
  ]],
  ["AI Infrastructure", [
    "AI developer infrastructure and tooling companies announcing funding or product milestones",
    "vector databases, LLM observability, and ML platform providers announcing deals or launches",
    "AI compute and cloud infrastructure companies raising capital or forming partnerships",
  ]],
  ["AI Labs", [
    "foundation model laboratories releasing new models or announcing major research breakthroughs",
    "AI research lab funding rounds, valuations, and strategic partnerships",
    "AI safety and alignment research announcements and institutional moves",
  ]],
  ["Vertical AI", [
    "vertical AI software companies signing enterprise customers or announcing ARR growth",
    "AI agent and workflow automation companies raising capital or announcing partnerships",
    "AI copilot products winning enterprise contracts or expanding into new verticals",
  ]],
];

const VC_BLOG_DOMAINS: Record<string, string> = {
  "Andreessen Horowitz": "a16z.com",
  "a16z": "a16z.com",
  "Sequoia": "sequoiacap.com",
  "Benchmark": "benchmark.com",
  "Greylock": "greylock.com",
  "Khosla Ventures": "khoslaventures.com",
  "Lux Capital": "luxcapital.com",
  "Eclipse Ventures": "eclipse.vc",
  "Radical Ventures": "radical.vc",
  "Lightspeed": "lsvp.com",
  "Redpoint": "redpoint.com",
  "Conviction Capital": "conviction.com",
  "NEA": "nea.com",
  "Index Ventures": "indexventures.com",
  "General Catalyst": "generalcatalyst.com",
  "Kleiner Perkins": "kleinerperkins.com",
  "Insight Partners": "insightpartners.com",
  "DCVC": "dcvc.com",
  "Accel": "accel.com",
  "Coatue": "coatue.com",
  "ICONIQ Growth": "iconiqcapital.com",
  "GV": "gv.com",
  "CapitalG": "capitalg.com",
  "Menlo Ventures": "menlovc.com",
  "Salesforce Ventures": "salesforceventures.com",
  "EQT Ventures": "eqtventures.com",
  "Bessemer": "bvp.com",
  "Spark Capital": "sparkcapital.com",
  "SoftBank": "softbank.com",
};

interface DomainInfo {
  domain: string;
  count: number;
  beats: string[];
  sampleTitles: string[];
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const exa = new Exa(process.env.EXA_API_KEY!);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const startDate = sevenDaysAgo.toISOString().split("T")[0];

  const domainMap = new Map<string, DomainInfo>();

  for (const [beat, queries] of BEAT_QUERIES) {
    const results = await Promise.allSettled(
      queries.map(async (query) => {
        const result = await exa.searchAndContents(query, {
          type: "neural",
          numResults: 10,
          startPublishedDate: startDate,
          text: { maxCharacters: 100 },
        });
        return result.results.map((item) => ({
          title: item.title ?? "Untitled",
          url: item.url,
          beat,
        }));
      }),
    );

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const item of r.value) {
        try {
          const hostname = new URL(item.url).hostname.replace(/^www\./, "");
          const existing = domainMap.get(hostname);
          if (existing) {
            existing.count++;
            if (!existing.beats.includes(item.beat)) existing.beats.push(item.beat);
            if (existing.sampleTitles.length < 3) existing.sampleTitles.push(item.title);
          } else {
            domainMap.set(hostname, {
              domain: hostname,
              count: 1,
              beats: [item.beat],
              sampleTitles: [item.title],
            });
          }
        } catch {
          // skip malformed URLs
        }
      }
    }
  }

  const domains = Array.from(domainMap.values()).sort((a, b) => b.count - a.count);

  // Extract unique VCs from companies.ts
  const trackedVCs = new Set<string>();
  for (const company of COMPANIES) {
    for (const vc of company.vcBacked) {
      trackedVCs.add(vc);
    }
  }

  const vcBlogs = Array.from(trackedVCs)
    .filter((vc) => VC_BLOG_DOMAINS[vc])
    .map((vc) => ({ vc, blogDomain: VC_BLOG_DOMAINS[vc] }));

  return NextResponse.json({
    summary: {
      totalArticles: domains.reduce((sum, d) => sum + d.count, 0),
      uniqueDomains: domains.length,
      queriedAt: new Date().toISOString(),
    },
    domains,
    vcBlogs,
  });
}
